import { SITE, DIVE_CENTER } from "@/content/site";
import { defaultLocale, type Locale } from "@/content/i18n";
import type { ApproverRole, Channel, Priority } from "./types";

/**
 * Operating configuration — the written result of the Phase 0 audit.
 *
 * This is the ONE file the owner edits when the business changes. Every value
 * that has not been confirmed is literally `TODO`, and the type system makes it
 * impossible to drop a `TODO` into a customer-facing sentence: read it through
 * `verified()` and handle the `null`, or call `requireVerified()` and let the
 * agent record a gap instead of guessing.
 *
 * Verified brand facts (phone, socials, partner) are NOT duplicated here —
 * they stay in `src/content/site.ts`, which the whole site already trusts.
 */

export const TODO = "TODO" as const;
export type Todo = typeof TODO;

/** A business fact that may not have been confirmed yet. */
export type Verified<T> = T | Todo;

export function isTodo<T>(value: Verified<T>): value is Todo {
  return value === TODO;
}

/** Narrow to the real value, or `null` when it is still unconfirmed. */
export function verified<T>(value: Verified<T>): T | null {
  return isTodo(value) ? null : value;
}

/**
 * Use when a value is required to continue. Returns the value or `null`, and
 * pushes a human-readable gap onto `gaps` — the agent then declines to state
 * the fact rather than inventing it.
 */
export function requireVerified<T>(value: Verified<T>, label: string, gaps: string[]): T | null {
  const ok = verified(value);
  if (ok === null && !gaps.includes(label)) gaps.push(label);
  return ok;
}

/** How much a channel is allowed to do on its own. */
export type ChannelAutomation =
  /** The system may send an approved template unattended. */
  | "auto_reply"
  /** The system only prepares a draft; a human presses send. */
  | "draft_only"
  /** Inbound only — nothing goes out on this channel. */
  | "inbound_only";

export interface ChannelConfig {
  enabled: boolean;
  automation: ChannelAutomation;
  /** Why it is not enabled, so the checklist in docs/agents/CONNECTORS.md stays honest. */
  note?: string;
}

/**
 * Channels, as confirmed in the audit: WhatsApp and the Meta DMs are live,
 * e-mail and Google Business Profile are not.
 *
 * Note `automation: "draft_only"` everywhere for now. WhatsApp is answered from
 * the Business app by hand, so there is no API to send through; the value flips
 * to `auto_reply` per channel once its connector is wired AND the owner has
 * watched the drafts for a while. That is a config change, not a code change.
 */
export const CHANNELS: Record<Channel, ChannelConfig> = {
  whatsapp: {
    enabled: true,
    automation: "draft_only",
    note: `Primary channel (${SITE.phoneInternationalDisplay}). WhatsApp Business App vs Cloud API not yet confirmed — TODO.`,
  },
  instagram: { enabled: true, automation: "draft_only", note: `${SITE.social.instagramHandle} — Meta API not connected.` },
  facebook: { enabled: true, automation: "draft_only", note: "Page DMs — Meta API not connected." },
  site_form: { enabled: true, automation: "draft_only", note: "Client-side form; today it opens a wa.me deep link." },
  site_chat: { enabled: true, automation: "auto_reply", note: "Existing on-site assistant (/api/chat), already live and grounded." },
  email: { enabled: false, automation: "inbound_only", note: `Not confirmed. SITE.email (${SITE.email}) is still a placeholder.` },
  google_business: { enabled: false, automation: "draft_only", note: "Profile not confirmed as claimed/managed." },
  phone: { enabled: true, automation: "inbound_only", note: "Human only. The system never calls anyone." },
  internal: { enabled: true, automation: "auto_reply", note: "Staff-facing notes and reports." },
};

/**
 * Where availability comes from. Confirmed in the audit: seats are held by the
 * partner dive centre, reached by message — so no machine here can ever know a
 * seat is free. `canSystemHold: false` is what makes the booking agent produce
 * a request-to-partner instead of a confirmation, and it is read by
 * `policy.ts` to force approval on every `confirm_booking`.
 */
export const AVAILABILITY = {
  source: "partner_message" as const,
  partner: DIVE_CENTER.name,
  partnerUrl: DIVE_CENTER.url,
  canSystemHold: false,
  /** Typical turnaround for the partner's answer — unconfirmed, so never quoted to a client. */
  partnerResponseHours: TODO as Verified<number>,
} as const;

export interface Approver {
  role: ApproverRole;
  name: Verified<string>;
  /** Where the escalation is delivered. */
  reachAt: Verified<string>;
  /** Action classes this person may release from the queue. */
  mayApprove: readonly ("money" | "medical" | "booking" | "publishing" | "legal" | "ops")[];
}

/**
 * Who may release a queued action. Names are TODO on purpose: until the owner
 * fills them in, every escalation lands on `owner`, which is the safe default.
 */
export const APPROVERS: readonly Approver[] = [
  {
    role: "owner",
    name: TODO,
    reachAt: TODO,
    mayApprove: ["money", "medical", "booking", "publishing", "legal", "ops"],
  },
  { role: "instructor", name: TODO, reachAt: TODO, mayApprove: ["medical", "booking", "ops"] },
  { role: "ops", name: TODO, reachAt: TODO, mayApprove: ["ops"] },
];

/** First approver allowed to release this class of action, else the owner. */
export function approverFor(
  klass: "money" | "medical" | "booking" | "publishing" | "legal" | "ops",
): ApproverRole {
  return APPROVERS.find((a) => a.mayApprove.includes(klass))?.role ?? "owner";
}

/** Target first-response time per priority, in minutes. Internal goals — never quoted to a client. */
export const SLA_MINUTES: Record<Priority, number> = { P0: 15, P1: 60, P2: 240, P3: 1440 };

/**
 * Follow-up discipline. Two nudges maximum, ever — a dive holiday enquiry that
 * has gone quiet twice is not won by a third message, and being remembered as
 * the centre that spammed you is expensive.
 */
export const FOLLOW_UP = {
  maxPerLead: 2,
  firstAfterHours: 24,
  secondAfterHours: 72,
  /**
   * Local hours (Asia/Bangkok) during which nothing outbound is sent.
   * Matched to the confirmed WhatsApp hours (8h–20h): a nudge that arrives when
   * nobody can answer the reply it provokes is worse than no nudge.
   */
  quietHours: { from: 20, to: 8 },
} as const;

/**
 * Facts the system is asked for constantly and must never improvise.
 * Each one that is still `TODO` becomes a gap in the outcome and, where it
 * blocks a reply, a human handoff.
 */
export const POLICIES = {
  cancellation: TODO as Verified<string>,
  deposit: TODO as Verified<string>,
  paymentMethods: TODO as Verified<readonly string[]>,
  meetingPoint: TODO as Verified<string>,
  pickupIncluded: TODO as Verified<boolean>,
  /**
   * When the centre can be REACHED — confirmed from the site.
   *
   * Deliberately not `boatSchedule`. An opening hour is not a departure time:
   * filing it there would have an agent tell a client the boat leaves at 11:00.
   * Departure times stay unconfirmed until the partner gives them.
   */
  openingHours:
    "Centre ouvert 11h–18h tous les jours ; WhatsApp répondu 8h–20h ; ouvert 363 jours/an (fermé le 1er janvier et le 13 avril, Songkran)." as Verified<string>,
  boatSchedule: TODO as Verified<string>,
  /**
   * Languages the humans actually speak — never inferred from the site's locales.
   * French only: the "French spoken" badge is documented as owner-confirmed in
   * `src/content/en.ts`. English is used all over the site, but nobody has
   * stated it as a spoken skill, so it is not claimed here.
   */
  staffLanguages: ["français"] as Verified<readonly string[]>,
  insurance: TODO as Verified<string>,
  minorMinimumAge: TODO as Verified<number>,
  /**
   * The protocol to follow when a diver discloses something medical.
   *
   * **Partial, on purpose.** The site states two things and no more: a medical
   * questionnaire is completed, and the centre may refuse anyone judged unfit to
   * dive (alcohol in particular). It says nothing about specific
   * contraindications or the standard PADI medical certificate — so this text
   * says that too, and travels with every escalation. A protocol that pretended
   * to be complete would be read as one.
   */
  medicalProtocol:
    "Questionnaire médical à compléter avant de plonger. Le centre peut refuser la plongée à toute personne jugée inapte (alcool notamment). NON COUVERT : contre-indications précises et certificat médical PADI — à confirmer avec le centre, et à trancher par un humain au cas par cas." as Verified<string>,
  /** Documents to bring on day one. Confirmed from the site. */
  requiredDocuments: [
    "carte de certification (vérification en ligne possible si elle est perdue)",
    "logbook si vous en avez un",
    "questionnaire médical complété",
  ] as Verified<readonly string[]>,
} as const;

/**
 * Days the centre is closed, as `MM-DD`. Open 363 days a year — confirmed.
 * Checked when a requested date is read, because accepting an enquiry for
 * 1 January and discovering the closure later costs a client.
 */
export const CLOSED_DATES: readonly string[] = ["01-01", "04-13"];

export function isClosed(isoDate: string): boolean {
  return CLOSED_DATES.includes(isoDate.slice(5, 10));
}

export const OPS = {
  timezone: "Asia/Bangkok",
  /** Language the team is briefed in. Client replies use the client's locale. */
  workingLocale: defaultLocale as Locale,
  /** Audience order for content: francophone first, then international English. */
  contentAudiences: ["fr", "en"] as readonly Locale[],
  channels: CHANNELS,
  availability: AVAILABILITY,
  approvers: APPROVERS,
  sla: SLA_MINUTES,
  followUp: FOLLOW_UP,
  policies: POLICIES,
} as const;

/** Every unconfirmed policy, for the ops report and the owner's checklist. */
export function openGaps(): string[] {
  return Object.entries(POLICIES)
    .filter(([, v]) => isTodo(v as Verified<unknown>))
    .map(([k]) => `policies.${k}`);
}
