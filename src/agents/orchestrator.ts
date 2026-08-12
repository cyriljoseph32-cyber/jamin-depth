import type { Locale } from "@/content/i18n";
import { POLICIES, isTodo, type Verified } from "./config";
import { detectLanguage } from "./language";
import { extract } from "./extract";
import { auditDraft, detectSensitiveTopics, hasHardStop, requiresHumanApproval, type DraftViolation } from "./policy";
import { createAuditLog, note, systemClock, type AuditEntry, type AuditLog, type Clock } from "./audit";
import { createApprovalQueue, type ApprovalQueue, type QueuedItem } from "./queue";
import { createMockPorts, type Ports } from "./adapters";
import { executeAction } from "./execute";
import { receptionAgent } from "./roles/reception";
import { bookingAgent } from "./roles/booking";
import { safetyAgent } from "./roles/safety";
import { contentAgent } from "./roles/content";
import { reputationAgent } from "./roles/reputation";
import { opsAgent } from "./roles/ops";
import type {
  Agent,
  AgentOutcome,
  EventKind,
  InboundEvent,
  LeadSignals,
  ProposedAction,
} from "./types";

/**
 * The orchestrator.
 *
 * One entry point, one pass per inbound event:
 *
 *   read signals (free) → classify → route → agent proposes → policy decides →
 *   queue or execute → journal
 *
 * The invariant worth defending: an agent's output is a *proposal*. Only this
 * file decides what leaves the building, and it decides with two independent
 * gates — the action-type matrix and the word-level draft guard. If either
 * objects, the action goes to the queue. Nothing here can be configured into
 * skipping both.
 */

export interface OrchestratorDeps {
  ports?: Ports;
  queue?: ApprovalQueue;
  log?: AuditLog;
  clock?: Clock;
  /**
   * Override the agent handling one or more kinds of event. The seam exists so
   * the guard rails can be tested against a deliberately misbehaving agent, and
   * so a new specialised agent can be added without touching this file.
   */
  routes?: Partial<Record<EventKind, Agent>>;
  /**
   * Called once at the end of a run with that run's journal lines. The audit log
   * itself stays synchronous and in memory — one batched write beats eight
   * round trips, and a failed write must never lose the reply it describes.
   */
  persistAudit?: (entries: readonly AuditEntry[]) => Promise<void>;
  /** Notified for every item put in the queue, and for every escalation. */
  onQueued?: (item: QueuedItem) => Promise<void>;
}

export interface BlockedAction {
  action: ProposedAction;
  violations: DraftViolation[];
}

export interface RunResult {
  eventId: string;
  /** True when the event was already processed — nothing was re-sent. */
  duplicate: boolean;
  kind: EventKind;
  signals?: LeadSignals;
  outcome?: AgentOutcome;
  executed: ProposedAction[];
  queued: QueuedItem[];
  /** Actions whose draft failed the guard. They are queued, never softened. */
  blocked: BlockedAction[];
  skipped: { action: ProposedAction; reason: string }[];
}

export interface Orchestrator {
  handle(event: InboundEvent): Promise<RunResult>;
  readonly queue: ApprovalQueue;
  readonly log: AuditLog;
  readonly ports: Ports;
}

/* ------------------------------------------------------------------ *
 * Signals
 * ------------------------------------------------------------------ */

function unconfirmed(keys: readonly string[]): string[] {
  const policies = POLICIES as Readonly<Record<string, Verified<unknown>>>;
  return keys.filter((k) => {
    const value = policies[k];
    return value === undefined || isTodo(value);
  });
}

/** Everything the agents need, derived by rules only — zero model calls. */
export function readSignals(event: InboundEvent): LeadSignals {
  const language = detectLanguage(event.text, event.locale);
  const facts = extract(event.text, event.receivedAt);
  return {
    locale: language.locale,
    foreignLanguage: language.foreignLanguage,
    activity: facts.activity,
    dates: facts.dates,
    vagueDates: facts.vagueDates,
    partySize: facts.partySize,
    certified: facts.certified,
    certificationHint: facts.certificationHint,
    sensitiveTopics: detectSensitiveTopics(event.text),
    policyQuestions: facts.policyQuestions,
    needsVerifiedData: unconfirmed(facts.policyQuestions).length > 0,
  };
}

/* ------------------------------------------------------------------ *
 * Classification & routing
 * ------------------------------------------------------------------ */

const CONTENT_REQUEST = /\b(contenu|article|blog|post|publication|r[ée]seaux|instagram\s+post|caption|newsletter|seo)\b/i;
const REPORT_REQUEST = /\b(rapport|report|brief|bilan|r[ée]capitulatif\s+hebdo)\b/i;
const BOOKING_INTENT =
  /\b(je\s+r[ée]serve|r[ée]server|on\s+r[ée]serve|c'est\s+bon\s+pour|je\s+confirme|book\s+(?:it|us|me)|i'?d\s+like\s+to\s+book|we'?ll\s+take|let'?s\s+book|confirm)\b/i;

/**
 * What is this event? Order matters: safety outranks everything, because a
 * booking message that also mentions asthma is a safety message.
 */
export function classify(event: InboundEvent, signals: LeadSignals): EventKind {
  if (signals.sensitiveTopics.includes("incident")) return "incident";
  if (hasHardStop(signals.sensitiveTopics)) return "safety";
  if (signals.sensitiveTopics.includes("certification_problem")) return "safety";

  if (event.channel === "google_business" || event.meta?.rating !== undefined) return "review";

  if (event.channel === "internal") {
    if (CONTENT_REQUEST.test(event.text)) return "content";
    if (REPORT_REQUEST.test(event.text)) return "report";
    return "internal_task";
  }

  // Booking owns an enquiry only once there is enough to ask the partner with:
  // a date, a real activity, and — unless the client states they are booking —
  // the party size and the level. Anything less is still qualification, and
  // reception owns it, because a partner request with holes costs a round trip.
  const bookable =
    signals.dates.length > 0 && signals.activity !== undefined && signals.activity !== "recovery" && signals.activity !== "other";
  if (bookable && BOOKING_INTENT.test(event.text)) return "booking";
  const levelKnown =
    signals.certified !== undefined ||
    signals.activity === "discover_scuba" ||
    signals.activity === "snorkeling";
  if (bookable && signals.partySize !== undefined && levelKnown) return "booking";

  if (signals.activity !== undefined) return "lead";
  return event.text.trim().length > 0 ? "question" : "unknown";
}

const ROUTES: Record<EventKind, Agent> = {
  incident: safetyAgent,
  safety: safetyAgent,
  review: reputationAgent,
  booking: bookingAgent,
  content: contentAgent,
  report: opsAgent,
  internal_task: opsAgent,
  supplier: opsAgent,
  lead: receptionAgent,
  question: receptionAgent,
  unknown: receptionAgent,
};

/** Normalised text, for spotting the same message arriving twice. */
export function fingerprint(event: InboundEvent): string {
  return `${event.threadId ?? event.from.phone ?? event.from.handle ?? event.channel}|${event.text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()}`;
}

export function createOrchestrator(deps: OrchestratorDeps = {}): Orchestrator {
  const clock = deps.clock ?? systemClock;
  const log = deps.log ?? createAuditLog(clock);
  const queue = deps.queue ?? createApprovalQueue(clock);
  const ports = deps.ports ?? createMockPorts(clock);
  const routes: Record<EventKind, Agent> = { ...ROUTES, ...deps.routes };

  return {
    queue,
    log,
    ports,

    async handle(event) {
      const before = log.entries().length;
      const flush = async () => {
        if (!deps.persistAudit) return;
        try {
          await deps.persistAudit(log.entries().slice(before));
        } catch (err) {
          // A journal that cannot be written must not swallow the work it describes.
          console.error("audit persist failed:", err);
        }
      };

      const base: Omit<RunResult, "kind"> = {
        eventId: event.id,
        duplicate: false,
        executed: [],
        queued: [],
        blocked: [],
        skipped: [],
      };

      note(log, event.id, "orchestrator", "received", `${event.channel} · ${event.text.slice(0, 120)}`);

      // De-duplication is a port, not a Set: Meta retries webhooks, and on
      // Vercel every invocation is a fresh process.
      const first = await ports.seen.claim(event.id, fingerprint(event), event.receivedAt);
      if (!first) {
        note(log, event.id, "orchestrator", "duplicate", "Événement déjà traité — aucune action.");
        await flush();
        return { ...base, duplicate: true, kind: "unknown" };
      }

      const signals = readSignals(event);
      const kind = classify(event, signals);
      note(
        log,
        event.id,
        "orchestrator",
        "classified",
        `${kind} · ${signals.locale}${signals.foreignLanguage ? ` (langue détectée : ${signals.foreignLanguage})` : ""}${
          signals.sensitiveTopics.length > 0 ? ` · sensible : ${signals.sensitiveTopics.join(",")}` : ""
        }`,
      );

      const agent = routes[kind];
      note(log, event.id, "orchestrator", "routed", `→ ${agent.name}`);

      const outcome = agent.handle(event, signals);
      note(
        log,
        event.id,
        agent.name,
        "proposed",
        `${outcome.actions.length} action(s), priorité ${outcome.priority}${
          outcome.gaps.length > 0 ? `, lacunes : ${outcome.gaps.join(" | ")}` : ""
        }`,
      );

      const result: RunResult = { ...base, kind, signals, outcome };

      for (const action of outcome.actions) {
        // Gate 1: what kind of action is this?
        const verdict = requiresHumanApproval(action, { signals, unverified: outcome.gaps });

        // Gate 2: what does the message actually say?
        const violations = action.draft ? auditDraft(action.draft.body) : [];
        if (violations.length > 0) {
          result.blocked.push({ action, violations });
          note(
            log,
            event.id,
            agent.name,
            "blocked",
            `${action.type} — ${violations.map((v) => `${v.rule} (« ${v.excerpt} »)`).join("; ")}`,
          );
        }

        const decided: ProposedAction = {
          ...action,
          approval:
            violations.length > 0
              ? {
                  required: true,
                  reasons: [...new Set([...verdict.reasons, ...violations.map((v) => v.rule)])],
                  approver: verdict.approver === "none" ? "owner" : verdict.approver,
                }
              : verdict,
        };

        if (decided.approval?.required) {
          const item = await queue.enqueue({
            eventId: event.id,
            agent: agent.name,
            action: decided,
            priority: outcome.priority,
          });
          result.queued.push(item);
          note(log, event.id, agent.name, "queued", `${item.id} · ${action.type} — ${item.reasons.join(", ")}`);
          if (deps.onQueued) {
            try {
              await deps.onQueued(item);
            } catch (err) {
              // A notification that fails must not lose the queued item.
              console.error("queue notification failed:", err);
              note(log, event.id, agent.name, "skipped", `notification file échouée pour ${item.id}`);
            }
          }
          continue;
        }

        const run = await executeAction(decided, { ports, event, signals, kind, now: clock() });
        if (run.ok) {
          result.executed.push(decided);
          note(log, event.id, agent.name, "executed", `${action.type} — ${action.summary}`);
        } else {
          result.skipped.push({ action: decided, reason: run.reason ?? "unknown" });
          note(log, event.id, agent.name, "skipped", `${action.type} — ${run.reason ?? "raison inconnue"}`);
        }
      }

      // Escalations are internal and must never wait behind an approval.
      if (outcome.escalation) {
        const escalation = outcome.escalation;
        note(
          log,
          event.id,
          agent.name,
          "escalated",
          `${escalation.urgency} → ${escalation.to} · ${escalation.reason}`,
        );
        await ports.messaging.send({
          channel: "internal",
          to: { name: escalation.to },
          locale: "fr" as Locale,
          body: `[${escalation.urgency}] ${escalation.reason}\n\n${escalation.briefing}`,
          templateId: "escalation",
        });
      }

      await flush();
      return result;
    },
  };
}

/* ------------------------------------------------------------------ *
 * Releasing an approved action
 * ------------------------------------------------------------------ */

export interface ReleaseDeps {
  queue: ApprovalQueue;
  ports: Ports;
  log?: AuditLog;
  clock?: Clock;
  persistAudit?: (entries: readonly AuditEntry[]) => Promise<void>;
}

export interface ReleaseResult {
  status: "sent" | "recorded" | "rejected" | "not_found" | "already_decided" | "blocked";
  item?: QueuedItem;
  detail?: string;
}

/**
 * Approve or reject a queued action — the path the Telegram buttons take.
 *
 * `recorded` is the honest outcome for the actions this system must never
 * perform itself (money, seats, publications, incident filings): the decision
 * is journalled, and the human does the act in the relevant tool.
 */
export async function release(
  id: string,
  decision: "approve" | "reject",
  by: string,
  deps: ReleaseDeps,
): Promise<ReleaseResult> {
  const clock = deps.clock ?? systemClock;
  const log = deps.log ?? createAuditLog(clock);
  const before = log.entries().length;

  const existing = await deps.queue.get(id);
  if (!existing) return { status: "not_found" };
  if (existing.status !== "pending") return { status: "already_decided", item: existing };

  if (decision === "reject") {
    const item = await deps.queue.reject(id, by);
    note(log, existing.eventId, existing.agent, "released", `${id} rejeté par ${by}`);
    if (deps.persistAudit) await deps.persistAudit(log.entries().slice(before));
    return { status: "rejected", item };
  }

  const approved = await deps.queue.approve(id, by);
  if (!approved) return { status: "already_decided", item: existing };

  const run = await executeAction(approved.action, { ports: deps.ports, now: clock() });

  if (run.ok) {
    await deps.queue.markExecuted(id, clock());
    note(log, existing.eventId, existing.agent, "executed", `${id} approuvé par ${by} — ${approved.action.type}`);
    if (deps.persistAudit) await deps.persistAudit(log.entries().slice(before));
    return { status: "sent", item: approved };
  }

  const humanPerformed = run.reason?.startsWith("human-performed") === true;
  const step = humanPerformed ? "released" : "blocked";
  note(
    log,
    existing.eventId,
    existing.agent,
    step,
    `${id} approuvé par ${by} — ${run.reason ?? "non exécuté"}`,
  );
  if (deps.persistAudit) await deps.persistAudit(log.entries().slice(before));
  return {
    status: humanPerformed ? "recorded" : "blocked",
    item: approved,
    detail: run.reason,
  };
}
