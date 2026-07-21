import { SITE } from "@/content/site";

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
export function recoverySummary(fields: RecoveryFields): string {
  const lines = [
    `Hello ${SITE.name}, I need underwater recovery assistance in ${SITE.location}.`,
    "",
    line("Name", fields.name),
    line("Contact", fields.contact),
    line("Object", fields.object),
    line("Location", fields.location),
    line("Lost on", fields.lostAt),
    line("Estimated depth", fields.depth),
    line("Conditions", fields.conditions),
  ].filter((l): l is string => l !== null);
  return lines.join("\n");
}

/** Brief-specified short pre-fill used on generic recovery CTAs. */
export function recoveryPrefill(): string {
  return `Hello ${SITE.name}, I need underwater recovery assistance in ${SITE.location}. Object: [object]. Location: [location]. Lost on: [date/time].`;
}

/** Diving enquiry pre-fill. */
export function divingPrefill(): string {
  return `Hello ${SITE.name}, I'd like to ask about diving in ${SITE.location}.`;
}

export interface ContactFields {
  name: string;
  contact: string;
  message: string;
}

/** General contact message summary. */
export function contactSummary(fields: ContactFields): string {
  const lines = [
    `Hello ${SITE.name},`,
    "",
    line("Name", fields.name),
    line("Contact", fields.contact),
    "",
    fields.message.trim(),
  ].filter((l): l is string => l !== null);
  return lines.join("\n");
}
