import type { Locale } from "@/content/i18n";
import { SITE } from "@/content/site";
import { buildWaLink } from "@/lib/whatsapp";
import { formatTHB, offersFor, PRICE_CAVEAT } from "../catalog";
import { FOLLOW_UP, OPS } from "../config";
import { actionRisk } from "../policy";
import type { ActionType, Activity, Contact, MessageDraft, ProposedAction, Risk } from "../types";

/** Helpers shared by the specialised agents. Pure, no I/O. */

/**
 * Deterministic action ids, scoped to the event: `evt-12:send_message:1`.
 * Stable ids mean a queued item can be matched to the run that produced it,
 * and two identical replays produce identical output.
 */
export function actionFactory(eventId: string) {
  let seq = 0;
  return function action(input: {
    type: ActionType;
    summary: string;
    draft?: MessageDraft;
    payload?: Readonly<Record<string, unknown>>;
    risk?: Risk;
  }): ProposedAction {
    seq += 1;
    return {
      id: `${eventId}:${input.type}:${seq}`,
      type: input.type,
      summary: input.summary,
      risk: input.risk ?? actionRisk(input.type),
      draft: input.draft,
      payload: input.payload,
    };
  };
}

/** First name if we have one, else a neutral address that still reads human. */
export function greetingName(contact: Contact, locale: Locale): string {
  const name = contact.name?.trim().split(/\s+/)[0];
  if (name && name.length > 1) return name;
  return locale === "fr" ? "à vous" : "there";
}

export function whatsappLink(): string {
  return buildWaLink();
}

/**
 * Cheapest confirmed price for an activity, formatted. Returns `null` when no
 * offer for it has a verified price — the caller then drops the price sentence
 * rather than inventing a figure.
 */
export function priceFor(activity: Activity): string | null {
  for (const offer of offersFor(activity)) {
    const price = typeof offer.fromPriceTHB === "number" ? offer.fromPriceTHB : null;
    if (price !== null) return formatTHB(price);
  }
  return null;
}

export function priceCaveat(locale: Locale): string {
  return PRICE_CAVEAT[locale];
}

/* ------------------------------------------------------------------ *
 * Time
 * ------------------------------------------------------------------ */

const BANGKOK_OFFSET_HOURS = 7;
const HOUR_MS = 3_600_000;

/** Local (Asia/Bangkok) hour of an instant. */
export function localHour(iso: string): number {
  const d = new Date(new Date(iso).getTime() + BANGKOK_OFFSET_HOURS * HOUR_MS);
  return d.getUTCHours();
}

/**
 * Push a send time out of the quiet window.
 *
 * Nobody on holiday wants a dive-centre nudge at 02:00, and a message that
 * arrives at a civil hour gets read. Quiet hours run 21:00→08:00 local.
 */
export function respectQuietHours(iso: string): string {
  const { from, to } = FOLLOW_UP.quietHours;
  const hour = localHour(iso);
  if (hour < from && hour >= to) return iso;

  const local = new Date(new Date(iso).getTime() + BANGKOK_OFFSET_HOURS * HOUR_MS);
  // After the evening cut-off, the next allowed slot is tomorrow morning.
  if (hour >= from) local.setUTCDate(local.getUTCDate() + 1);
  local.setUTCHours(to, 0, 0, 0);
  return new Date(local.getTime() - BANGKOK_OFFSET_HOURS * HOUR_MS).toISOString();
}

/** A follow-up time `hours` after `iso`, moved out of quiet hours. */
export function followUpAt(iso: string, attempt: 1 | 2): string {
  const hours = attempt === 1 ? FOLLOW_UP.firstAfterHours : FOLLOW_UP.secondAfterHours;
  return respectQuietHours(new Date(new Date(iso).getTime() + hours * HOUR_MS).toISOString());
}

/** Whole days from `iso` to an ISO date, negative when the date has passed. */
export function daysUntil(iso: string, isoDate: string): number {
  const from = new Date(iso);
  const utcFrom = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const target = new Date(`${isoDate}T00:00:00Z`).getTime();
  if (Number.isNaN(target)) return Number.POSITIVE_INFINITY;
  return Math.round((target - utcFrom) / 86_400_000);
}

/** Human date in the visitor's language: `samedi 14 mars` / `Saturday 14 March`. */
export function formatDate(isoDate: string, locale: Locale): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(d);
}

/* ------------------------------------------------------------------ *
 * Copy fragments
 * ------------------------------------------------------------------ */

/** `a, b et c` / `a, b and c`. */
export function joinList(items: readonly string[], locale: Locale): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0] ?? "";
  const head = items.slice(0, -1).join(", ");
  return `${head} ${locale === "fr" ? "et" : "and"} ${items[items.length - 1]}`;
}

/** The internal briefing language — the team reads one language, clients get theirs. */
export const teamLocale: Locale = OPS.workingLocale;

/** Contact line used in review replies and handoffs. */
export function contactLine(): string {
  return `${SITE.phoneInternationalDisplay} (WhatsApp)`;
}
