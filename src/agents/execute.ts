import { FOLLOW_UP } from "./config";
import { auditDraft } from "./policy";
import { contactKey, type Ports } from "./adapters";
import type { EventKind, InboundEvent, LeadSignals, ProposedAction } from "./types";
import { hasHardStop } from "./policy";
import type { LeadStage } from "./adapters";

/**
 * The single place an action becomes a real-world effect.
 *
 * Extracted from the orchestrator on purpose: an action released from the
 * Telegram queue hours later must travel the *same* path as one that never
 * needed approval. Two code paths would eventually disagree, and the one that
 * drifted would be the one carrying an approved message to a customer.
 *
 * Two invariants live here rather than in the callers:
 *  - the outgoing draft is re-audited immediately before it is sent;
 *  - the follow-up cap is enforced at send time, not at proposal time.
 */

export interface ExecuteContext {
  ports: Ports;
  /** The event that produced the action. Absent for scheduled work. */
  event?: InboundEvent;
  signals?: LeadSignals;
  kind?: EventKind;
  /** Now, ISO. Injected so scheduled runs and replays are deterministic. */
  now: string;
}

export interface ExecuteResult {
  ok: boolean;
  reason?: string;
}

export function stageFor(kind: EventKind | undefined, signals: LeadSignals | undefined): LeadStage {
  if (signals && hasHardStop(signals.sensitiveTopics)) return "escalated";
  if (kind === "booking") return "awaiting_partner";
  if (signals?.activity !== undefined) return "qualified";
  return "new";
}

export async function executeAction(action: ProposedAction, ctx: ExecuteContext): Promise<ExecuteResult> {
  const { ports, event, signals, now } = ctx;

  switch (action.type) {
    case "send_message":
    case "request_documents":
    case "internal_report":
    case "notify_staff":
    case "supplier_message":
    case "reply_review": {
      if (!action.draft) return { ok: true };

      // The guard runs again here. A draft can sit in the queue for hours, and
      // the catalogue or the confirmed policies may have changed underneath it.
      const violations = auditDraft(action.draft.body);
      if (violations.length > 0) {
        return { ok: false, reason: `draft-guard:${violations.map((v) => v.rule).join(",")}` };
      }

      const result = await ports.messaging.send(action.draft);
      return result.ok ? { ok: true } : { ok: false, reason: result.reason };
    }

    case "create_lead":
    case "update_lead": {
      if (!event) return { ok: false, reason: "no-event-for-lead" };
      await ports.crm.upsert({
        contact: event.from,
        channel: event.channel,
        locale: signals?.locale ?? "fr",
        activity: signals?.activity,
        dates: signals?.dates ?? [],
        partySize: signals?.partySize,
        certified: signals?.certified,
        stage: stageFor(ctx.kind, signals),
        sensitiveTopics: signals?.sensitiveTopics ?? [],
      });
      return { ok: true };
    }

    case "schedule_followup": {
      // The cap lives here, not in the agent: an agent proposing a nudge is
      // fine, sending a third one to the same person is not.
      if (!event) return { ok: false, reason: "no-event-for-followup" };
      const key = contactKey(event.from, event.channel);
      const lead = await ports.crm.find(key);
      if (lead && lead.followUps >= FOLLOW_UP.maxPerLead) {
        return { ok: false, reason: `follow-up cap reached (${FOLLOW_UP.maxPerLead})` };
      }
      if (lead) await ports.crm.countFollowUp(key, now);
      return { ok: true };
    }

    case "create_calendar_event":
    case "update_calendar_event": {
      const payload = action.payload ?? {};
      const date = typeof payload.date === "string" ? payload.date : undefined;
      if (!date) return { ok: false, reason: "calendar-event-without-date" };
      await ports.calendar.create({
        title: typeof payload.title === "string" ? payload.title : action.summary,
        date,
        description: typeof payload.description === "string" ? payload.description : action.summary,
      });
      return { ok: true };
    }

    case "draft_booking_recap":
      // Nothing to do outside: the recap is carried in the payload and read by
      // whoever opens the audit trail or the queue item.
      return { ok: true };

    /**
     * Deliberately not executable by this system, ever. Money, seats, public
     * words on a review platform, incident filings and contracts are released
     * by a human IN the relevant tool — approving them here records the
     * decision, it does not perform the act.
     */
    case "confirm_booking":
    case "modify_booking":
    case "cancel_booking":
    case "send_payment_link":
    case "record_payment":
    case "refund":
    case "publish_content":
    case "report_incident":
      return { ok: false, reason: `human-performed:${action.type}` };
  }
}
