import { SITE } from "@/content/site";
import { en } from "@/content/en";
import type { Dictionary } from "@/content/en";

/** The message copy that ends up inside WhatsApp. Defaults to English. */
type WaCopy = Dictionary["wa"];
const defaultWa: WaCopy = en.wa;

/**
 * Pure helpers to build WhatsApp (wa.me) deep links and a mailto: fallback.
 * No secrets, no backend — the "form submit" is a structured deep link the
 * user sends themselves. Fully client-safe and unit-tested.
 */

/** Build a wa.me link to the business number with an optional pre-filled message. */
export function buildWaLink(message?: string): string {
  const base = `https://wa.me/${SITE.phoneE164}`;
  if (!message) return base;
  return `${base}?text=${encodeURIComponent(message)}`;
}

/** Build a mailto: link with subject + body (email fallback for users without WhatsApp). */
export function buildMailto(subject: string, body: string): string {
  const params = new URLSearchParams({ subject, body });
  return `mailto:${SITE.email}?${params.toString()}`;
}

export interface RecoveryFields {
  name: string;
  contact: string;
  object: string;
  location: string;
  lostAt: string;
  depth?: string;
  conditions?: string;
}

/** Skip empty optional lines so the message stays clean. */
function line(label: string, value?: string): string | null {
  const v = value?.trim();
  return v ? `${label}: ${v}` : null;
}

/**
 * Structured, human-readable recovery summary sent to the diver.
 * Order mirrors the on-page form so it reads naturally in the chat.
 */
export function recoverySummary(fields: RecoveryFields, wa: WaCopy = defaultWa): string {
  const lines = [
    wa.recoveryIntro,
    "",
    line(wa.labels.name, fields.name),
    line(wa.labels.contact, fields.contact),
    line(wa.labels.object, fields.object),
    line(wa.labels.location, fields.location),
    line(wa.labels.lostAt, fields.lostAt),
    line(wa.labels.depth, fields.depth),
    line(wa.labels.conditions, fields.conditions),
  ].filter((l): l is string => l !== null);
  return lines.join("\n");
}

/** Brief-specified short pre-fill used on generic recovery CTAs. */
export function recoveryPrefill(wa: WaCopy = defaultWa): string {
  return wa.recoveryPrefill;
}

/** Diving enquiry pre-fill. */
export function divingPrefill(wa: WaCopy = defaultWa): string {
  return wa.divingPrefill;
}

export interface ContactFields {
  name: string;
  contact: string;
  message: string;
}

/** General contact message summary. */
export function contactSummary(fields: ContactFields, wa: WaCopy = defaultWa): string {
  const lines = [
    wa.contactIntro,
    "",
    line(wa.labels.name, fields.name),
    line(wa.labels.contact, fields.contact),
    "",
    fields.message.trim(),
  ].filter((l): l is string => l !== null);
  return lines.join("\n");
}

/** Pre-fill for a specific PADI course card. */
export function coursePrefill(courseName: string, wa: WaCopy = defaultWa): string {
  return wa.coursePrefill.replace("{course}", courseName);
}

/** Pre-fill for a specific fun-dive / day-trip card. */
export function tripPrefill(tripName: string, wa: WaCopy = defaultWa): string {
  return wa.tripPrefill.replace("{trip}", tripName);
}
