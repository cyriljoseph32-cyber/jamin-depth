import type { Locale } from "@/content/i18n";

/**
 * Core vocabulary of the Jammin's Depths agent system.
 *
 * Everything here is data — no side effects, no I/O. An agent takes an
 * `InboundEvent` and returns an `AgentOutcome`: a set of *proposed* actions.
 * Nothing reaches the outside world until the orchestrator has run the
 * approval policy (`policy.ts`) and, where required, a human has released the
 * action from the queue (`queue.ts`).
 */

/** Channels the business can actually be reached on. Enabled per channel in `config.ts`. */
export const channels = [
  "whatsapp",
  "email",
  "instagram",
  "facebook",
  "site_form",
  "site_chat",
  "phone",
  "google_business",
  "internal",
] as const;
export type Channel = (typeof channels)[number];

/** What an inbound event turns out to be. Drives routing. */
export const eventKinds = [
  "lead",
  "booking",
  "question",
  "safety",
  "content",
  "review",
  "incident",
  "internal_task",
  "supplier",
  "report",
  "unknown",
] as const;
export type EventKind = (typeof eventKinds)[number];

/**
 * Priority ladder. P0 is "a human must see this now" — safety, incidents,
 * anything medical. P1 is a live booking window. P2 is a normal lead. P3 is
 * back-office.
 */
export type Priority = "P0" | "P1" | "P2" | "P3";

/** The activities the business sells. Kept separate from pricing (`catalog.ts`). */
export const activities = [
  "discover_scuba",
  "certified_fun_dive",
  "course",
  "snorkeling",
  "recovery",
  "other",
] as const;
export type Activity = (typeof activities)[number];

export interface Contact {
  name?: string;
  handle?: string;
  phone?: string;
  email?: string;
}

export interface InboundEvent {
  /** Stable id from the source channel. Used for de-duplication. */
  id: string;
  channel: Channel;
  /** ISO 8601. */
  receivedAt: string;
  from: Contact;
  text: string;
  /** Conversation/thread id when the channel has one — groups follow-ups. */
  threadId?: string;
  /** Locale if the channel already knows it (e.g. the site's `/fr` chat). */
  locale?: Locale;
  /** Free-form channel metadata. Never trusted for decisions. */
  meta?: Readonly<Record<string, string>>;
}

/** What the reception agent manages to read out of a message, deterministically. */
export interface LeadSignals {
  locale: Locale;
  /** Detected but unsupported language (e.g. "de") — triggers a human handoff. */
  foreignLanguage?: string;
  activity?: Activity;
  /** ISO dates (YYYY-MM-DD) mentioned in the message, in order of appearance. */
  dates: string[];
  /** Raw date-ish phrases we could not resolve — never guessed into a date. */
  vagueDates: string[];
  partySize?: number;
  certified?: boolean;
  certificationHint?: string;
  sensitiveTopics: SensitiveTopic[];
  /** Keys of `POLICIES` the visitor asked about — see `extract.ts`. */
  policyQuestions: string[];
  /** True when the message asks something the config cannot answer verifiably. */
  needsVerifiedData: boolean;
}

/** Topics that must never be answered by a machine. Detected in `policy.ts`. */
export const sensitiveTopics = [
  "medical",
  "pregnancy",
  "medication",
  "panic_anxiety",
  "cannot_swim",
  "certification_problem",
  "incident",
  "complaint",
  "refund_request",
  "price_negotiation",
  "legal",
  "minor",
] as const;
export type SensitiveTopic = (typeof sensitiveTopics)[number];

/** Every outward-facing or state-changing thing the system can propose. */
export const actionTypes = [
  "send_message",
  "create_lead",
  "update_lead",
  "schedule_followup",
  "request_documents",
  "draft_booking_recap",
  "confirm_booking",
  "modify_booking",
  "cancel_booking",
  "create_calendar_event",
  "update_calendar_event",
  "send_payment_link",
  "record_payment",
  "refund",
  "publish_content",
  "reply_review",
  "notify_staff",
  "report_incident",
  "supplier_message",
  "internal_report",
] as const;
export type ActionType = (typeof actionTypes)[number];

export type Risk = "none" | "low" | "high" | "critical";

/** A message the system wants to send, in the visitor's language. */
export interface MessageDraft {
  channel: Channel;
  to: Contact;
  locale: Locale;
  subject?: string;
  body: string;
  /** Template id the body came from — auditable, and cheap to review. */
  templateId: string;
}

export interface ProposedAction {
  id: string;
  type: ActionType;
  /** One line a human can approve or reject without opening anything else. */
  summary: string;
  risk: Risk;
  /** Present for `send_message` / `reply_review` / `publish_content`. */
  draft?: MessageDraft;
  payload?: Readonly<Record<string, unknown>>;
  /** Filled by the policy layer, never by the agent itself. */
  approval?: ApprovalVerdict;
}

export interface ApprovalVerdict {
  required: boolean;
  /** Machine-readable rule ids, e.g. `rule:payment`, `rule:unverified-availability`. */
  reasons: string[];
  approver: ApproverRole;
}

export const approverRoles = ["owner", "instructor", "ops", "none"] as const;
export type ApproverRole = (typeof approverRoles)[number];

export interface Escalation {
  to: ApproverRole;
  reason: string;
  urgency: Priority;
  /** What the human is told, in the team's working language. */
  briefing: string;
}

export interface AgentOutcome {
  agent: AgentName;
  eventId: string;
  kind: EventKind;
  priority: Priority;
  signals?: LeadSignals;
  actions: ProposedAction[];
  /** Facts the agent refused to state because they are unverified. */
  gaps: string[];
  escalation?: Escalation;
  notes: string[];
  /**
   * 0-100 confidence in this proposal, from `confidence.ts::computeConfidence()`.
   * Optional here because most agents do not set it themselves — the
   * orchestrator fills it in from signals, gaps and the policy verdict when
   * an agent leaves it unset, so every `AgentOutcome` it journals ends up
   * with one.
   */
  confidence?: number;
}

export const agentNames = [
  "orchestrator",
  "reception",
  "booking",
  "safety",
  "content",
  "reputation",
  "ops",
] as const;
export type AgentName = (typeof agentNames)[number];

/** Signature every specialised agent implements. Pure: no I/O, no network. */
export interface Agent {
  name: AgentName;
  handle(event: InboundEvent, signals: LeadSignals): AgentOutcome;
}

export interface AuditEntry {
  at: string;
  eventId: string;
  agent: AgentName;
  /** `classified`, `routed`, `queued`, `executed`, `blocked`, `escalated`. */
  step: string;
  detail: string;
}
