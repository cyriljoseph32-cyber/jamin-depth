import type { Locale } from "@/content/i18n";
import { FOLLOW_UP, POLICIES, isTodo, type Verified } from "./config";
import { detectLanguage } from "./language";
import { extract } from "./extract";
import { auditDraft, detectSensitiveTopics, hasHardStop, requiresHumanApproval, type DraftViolation } from "./policy";
import { createAuditLog, note, systemClock, type AuditLog, type Clock } from "./audit";
import { createApprovalQueue, type ApprovalQueue, type QueuedItem } from "./queue";
import { createMockPorts, contactKey, type LeadStage, type Ports } from "./adapters";
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

/* ------------------------------------------------------------------ *
 * Execution
 * ------------------------------------------------------------------ */

function stageFor(kind: EventKind, signals: LeadSignals | undefined): LeadStage {
  if (signals && signals.sensitiveTopics.length > 0 && hasHardStop(signals.sensitiveTopics)) return "escalated";
  if (kind === "booking") return "awaiting_partner";
  if (signals?.activity !== undefined) return "qualified";
  return "new";
}

/** Normalised text, for spotting the same message arriving twice. */
function fingerprint(event: InboundEvent): string {
  return `${event.threadId ?? event.from.phone ?? event.from.handle ?? event.channel}|${event.text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()}`;
}

const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

export function createOrchestrator(deps: OrchestratorDeps = {}): Orchestrator {
  const clock = deps.clock ?? systemClock;
  const log = deps.log ?? createAuditLog(clock);
  const queue = deps.queue ?? createApprovalQueue(clock);
  const ports = deps.ports ?? createMockPorts(clock);
  const routes: Record<EventKind, Agent> = { ...ROUTES, ...deps.routes };

  const seenIds = new Set<string>();
  const seenFingerprints = new Map<string, number>();

  async function execute(action: ProposedAction, event: InboundEvent, signals: LeadSignals | undefined, kind: EventKind): Promise<{ ok: boolean; reason?: string }> {
    switch (action.type) {
      case "send_message":
      case "request_documents":
      case "internal_report":
      case "notify_staff": {
        if (!action.draft) return { ok: true };
        const result = await ports.messaging.send(action.draft);
        return result.ok ? { ok: true } : { ok: false, reason: result.reason };
      }

      case "create_lead":
      case "update_lead": {
        ports.crm.upsert({
          contact: event.from,
          channel: event.channel,
          locale: signals?.locale ?? "fr",
          activity: signals?.activity,
          dates: signals?.dates ?? [],
          partySize: signals?.partySize,
          certified: signals?.certified,
          stage: stageFor(kind, signals),
          sensitiveTopics: signals?.sensitiveTopics ?? [],
        });
        return { ok: true };
      }

      case "schedule_followup": {
        // The cap lives here, not in the agent: an agent proposing a nudge is
        // fine, sending a third one to the same person is not.
        const key = contactKey(event.from, event.channel);
        const lead = ports.crm.find(key);
        if (lead && lead.followUps >= FOLLOW_UP.maxPerLead) {
          return { ok: false, reason: `follow-up cap reached (${FOLLOW_UP.maxPerLead})` };
        }
        if (lead) ports.crm.countFollowUp(key);
        return { ok: true };
      }

      case "draft_booking_recap":
        return { ok: true };

      default:
        // Everything else is approval-gated and never reaches this branch.
        return { ok: false, reason: `no executor for ${action.type}` };
    }
  }

  return {
    queue,
    log,
    ports,

    async handle(event) {
      const base: Omit<RunResult, "kind"> = {
        eventId: event.id,
        duplicate: false,
        executed: [],
        queued: [],
        blocked: [],
        skipped: [],
      };

      note(log, event.id, "orchestrator", "received", `${event.channel} · ${event.text.slice(0, 120)}`);

      // De-duplication: the same id, or the same text in the same thread within
      // ten minutes. Channels retry webhooks, and people send twice when nervous.
      const print = fingerprint(event);
      const previous = seenFingerprints.get(print);
      const receivedMs = new Date(event.receivedAt).getTime();
      const isDuplicate =
        seenIds.has(event.id) ||
        (previous !== undefined && Math.abs(receivedMs - previous) <= DUPLICATE_WINDOW_MS);

      if (isDuplicate) {
        note(log, event.id, "orchestrator", "duplicate", "Événement déjà traité — aucune action.");
        return { ...base, duplicate: true, kind: "unknown" };
      }
      seenIds.add(event.id);
      seenFingerprints.set(print, receivedMs);

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
        const verdict = requiresHumanApproval(action, {
          signals,
          unverified: outcome.gaps,
        });

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
          const item = queue.enqueue({
            eventId: event.id,
            agent: agent.name,
            action: decided,
            priority: outcome.priority,
          });
          result.queued.push(item);
          note(
            log,
            event.id,
            agent.name,
            "queued",
            `${item.id} · ${action.type} — ${item.reasons.join(", ")}`,
          );
          continue;
        }

        const run = await execute(decided, event, signals, kind);
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

      return result;
    },
  };
}
