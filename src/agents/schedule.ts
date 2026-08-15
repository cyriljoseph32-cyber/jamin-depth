import type { Locale } from "@/content/i18n";
import { FOLLOW_UP } from "./config";
import { auditDraft, requiresHumanApproval } from "./policy";
import { render } from "./templates";
import { nextDayBrief } from "./roles/booking";
import { weeklyReport } from "./roles/ops";
import { executeAction } from "./execute";
import { note, type AuditLog } from "./audit";
import type { ApprovalQueue, QueuedItem } from "./queue";
import type { Lead, Ports } from "./adapters";
import { actionFactory, greetingName, localHour } from "./roles/shared";
import type { AgentName, Priority, ProposedAction } from "./types";

/**
 * Work that is triggered by the clock rather than by a message: follow-ups, the
 * evening-before brief, the weekly report.
 *
 * Kept out of the route handlers so each job can be tested with a fixed `now`
 * and no HTTP involved.
 */

export const jobs = ["follow-ups", "daily-brief", "weekly-report"] as const;
export type Job = (typeof jobs)[number];

export function isJob(value: string): value is Job {
  return (jobs as readonly string[]).includes(value);
}

export interface JobDeps {
  ports: Ports;
  queue: ApprovalQueue;
  log: AuditLog;
  /** ISO instant. Injected so a run is reproducible. */
  now: string;
}

export interface JobResult {
  job: Job;
  /** One line per thing done or deliberately not done. */
  details: string[];
  queued: number;
  executed: number;
  skipped: number;
}

/* ------------------------------------------------------------------ *
 * Follow-ups
 * ------------------------------------------------------------------ */

/** Stages where the ball is in the client's court. */
const CHASEABLE = new Set(["new", "qualified", "awaiting_client"]);

const HOUR_MS = 3_600_000;

/**
 * Leads that have gone quiet long enough to deserve one nudge.
 *
 * Three guards, in order of how much damage they prevent: never more than
 * `maxPerLead` in total, never inside the quiet hours, and never for someone
 * with a flagged safety topic — a person waiting on a medical answer must not
 * receive a cheerful "still interested?".
 */
export function dueFollowUps(leads: readonly Lead[], now: string): { lead: Lead; attempt: 1 | 2 }[] {
  const at = new Date(now).getTime();
  const due: { lead: Lead; attempt: 1 | 2 }[] = [];

  for (const lead of leads) {
    if (!CHASEABLE.has(lead.stage)) continue;
    if (lead.sensitiveTopics.length > 0) continue;
    if (lead.followUps >= FOLLOW_UP.maxPerLead) continue;

    const attempt = (lead.followUps + 1) as 1 | 2;
    const waitHours = attempt === 1 ? FOLLOW_UP.firstAfterHours : FOLLOW_UP.secondAfterHours;
    const since = new Date(lead.lastFollowUpAt ?? lead.updatedAt).getTime();
    if (Number.isNaN(since) || at - since < waitHours * HOUR_MS) continue;

    due.push({ lead, attempt });
  }

  return due;
}

function inQuietHours(now: string): boolean {
  const hour = localHour(now);
  const { from, to } = FOLLOW_UP.quietHours;
  return hour >= from || hour < to;
}

/**
 * The single gate for scheduled work.
 *
 * Every action produced by a cron job goes through the same two checks as one
 * produced by an inbound message — the action-type matrix and the word-level
 * guard — and is queued if either objects. Without this, a job could quietly
 * become a way to bypass approval, which is how a "harmless" internal report
 * ends up carrying a supplier commitment out of the building.
 */
async function gateAndDispatch(
  action: ProposedAction,
  deps: JobDeps,
  meta: { eventId: string; agent: AgentName; priority: Priority },
  result: JobResult,
): Promise<void> {
  const verdict = requiresHumanApproval(action);
  const violations = action.draft ? auditDraft(action.draft.body) : [];

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
    const item = await deps.queue.enqueue({
      eventId: meta.eventId,
      agent: meta.agent,
      action: decided,
      priority: meta.priority,
    });
    result.queued += 1;
    result.details.push(`${action.summary} — en attente de validation (${item.id}).`);
    note(deps.log, meta.eventId, meta.agent, "queued", `${action.type} — ${item.reasons.join(", ")}`);
    return;
  }

  const run = await executeAction(decided, { ports: deps.ports, now: deps.now });
  if (run.ok) {
    result.executed += 1;
    result.details.push(action.summary);
    note(deps.log, meta.eventId, meta.agent, "executed", action.type);
  } else {
    result.skipped += 1;
    result.details.push(`${action.summary} — non délivré (${run.reason}).`);
    note(deps.log, meta.eventId, meta.agent, "skipped", `${action.type} — ${run.reason ?? "inconnu"}`);
  }
}

async function runFollowUps(deps: JobDeps): Promise<JobResult> {
  const result: JobResult = { job: "follow-ups", details: [], queued: 0, executed: 0, skipped: 0 };

  if (inQuietHours(deps.now)) {
    result.details.push("Heures calmes (21 h–8 h, Asia/Bangkok) : aucune relance.");
    result.skipped += 1;
    return result;
  }

  const leads = await deps.ports.crm.all();
  const due = dueFollowUps(leads, deps.now);
  if (due.length === 0) {
    result.details.push("Aucune relance due.");
    return result;
  }

  for (const { lead, attempt } of due) {
    const locale: Locale = lead.locale === "en" ? "en" : "fr";
    const action = actionFactory(`followup-${lead.id}-${attempt}`);
    const message = render(`lead.followup.${attempt}`, locale, {
      name: greetingName(lead.contact, locale),
    });

    if (!message.ok) {
      result.details.push(`${lead.key} : gabarit non rendu (${message.missing.join(", ")}).`);
      result.skipped += 1;
      continue;
    }

    const proposed: ProposedAction = action({
      type: "send_message",
      summary: `Relance ${attempt}/${FOLLOW_UP.maxPerLead} — ${lead.contact.name ?? lead.key}`,
      draft: {
        channel: lead.channel,
        to: lead.contact,
        locale,
        body: message.body,
        templateId: message.templateId,
      },
    });

    // Same two gates as an inbound reply. A follow-up is still a message to a
    // customer, so it earns no shortcut.
    await gateAndDispatch(
      proposed,
      deps,
      { eventId: `followup-${lead.id}-${attempt}`, agent: "reception", priority: "P3" },
      result,
    );

    // Counted once the nudge has been decided on, whether it was sent straight
    // away or is waiting for a thumb: the cap must hold either way, or a lead
    // whose card is never tapped would be re-queued every hour.
    await deps.ports.crm.countFollowUp(lead.key, deps.now);
  }

  return result;
}

/* ------------------------------------------------------------------ *
 * Briefs and reports
 * ------------------------------------------------------------------ */

/** Tomorrow's date in Bangkok, as an ISO date. */
export function tomorrowInBangkok(now: string): string {
  const local = new Date(new Date(now).getTime() + 7 * HOUR_MS + 24 * HOUR_MS);
  return local.toISOString().slice(0, 10);
}

/** Monday of the current week in Bangkok, as an ISO date. */
export function weekStartInBangkok(now: string): string {
  const local = new Date(new Date(now).getTime() + 7 * HOUR_MS);
  const day = local.getUTCDay(); // 0 = Sunday
  const back = day === 0 ? 6 : day - 1;
  return new Date(local.getTime() - back * 24 * HOUR_MS).toISOString().slice(0, 10);
}

/** Every action from a report run, through the gate. Internal notes pass; commitments queue. */
async function deliver(
  actions: readonly ProposedAction[],
  deps: JobDeps,
  meta: { eventId: string; agent: AgentName },
  result: JobResult,
): Promise<void> {
  for (const action of actions) {
    await gateAndDispatch(action, deps, { ...meta, priority: "P3" }, result);
  }
}

async function runDailyBrief(deps: JobDeps): Promise<JobResult> {
  const result: JobResult = { job: "daily-brief", details: [], queued: 0, executed: 0, skipped: 0 };
  const date = tomorrowInBangkok(deps.now);
  const outcome = nextDayBrief({
    date,
    now: deps.now,
    leads: await deps.ports.crm.all(),
    pending: await deps.queue.pending(),
  });
  await deliver(outcome.actions, deps, { eventId: outcome.eventId, agent: "booking" }, result);
  for (const gap of outcome.gaps) note(deps.log, outcome.eventId, "booking", "skipped", `lacune : ${gap}`);
  return result;
}

async function runWeeklyReport(deps: JobDeps): Promise<JobResult> {
  const result: JobResult = { job: "weekly-report", details: [], queued: 0, executed: 0, skipped: 0 };
  const outcome = weeklyReport({
    now: deps.now,
    weekStart: weekStartInBangkok(deps.now),
    leads: await deps.ports.crm.all(),
    queue: await deps.queue.all(),
    ports: deps.ports,
  });
  await deliver(outcome.actions, deps, { eventId: outcome.eventId, agent: "ops" }, result);
  return result;
}

export async function runJob(job: Job, deps: JobDeps): Promise<JobResult> {
  switch (job) {
    case "follow-ups":
      return runFollowUps(deps);
    case "daily-brief":
      return runDailyBrief(deps);
    case "weekly-report":
      return runWeeklyReport(deps);
  }
}

/** Exposed for the queue digest the brief links to. */
export type { QueuedItem };
