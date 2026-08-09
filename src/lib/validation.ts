import { en } from "@/content/en";
import type { Dictionary } from "@/content/i18n";

/**
 * Pure, framework-free form validation helpers.
 * Kept side-effect free so they are trivially unit-testable and reusable
 * across the recovery and contact forms.
 */

export type Errors<T extends string> = Partial<Record<T, string>>;

/**
 * Messages are passed in rather than baked in, so a French visitor is told in
 * French what is missing. English is the default, which keeps the signature
 * backwards compatible — the same arrangement `src/lib/whatsapp.ts` uses for
 * its `wa` copy.
 */
export type ValidationCopy = Dictionary["forms"]["validation"];
const defaultValidation: ValidationCopy = en.forms.validation;

export function isBlank(value: string | undefined | null): boolean {
  return !value || value.trim().length === 0;
}

/** Lenient contact check: accepts a phone-ish string OR an email. */
export function isValidContact(value: string): boolean {
  const v = value.trim();
  if (v.length < 5) return false;
  const emailLike = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const phoneLike = /^[+()\d][\d\s().-]{4,}$/.test(v);
  return emailLike || phoneLike;
}

export function minLength(value: string, n: number): boolean {
  return value.trim().length >= n;
}

/**
 * Lightweight anti-spam heuristic used client-side:
 * - a honeypot field that must stay empty (bots fill every field)
 * - a minimum time-on-form so instant auto-submits are rejected
 */
export function isLikelySpam(honeypot: string, elapsedMs: number): boolean {
  if (honeypot.trim().length > 0) return true;
  if (elapsedMs < 1200) return true;
  return false;
}

export interface RecoveryInput {
  name: string;
  contact: string;
  object: string;
  location: string;
  lostAt: string;
}

export function validateRecovery(
  input: RecoveryInput,
  copy: ValidationCopy = defaultValidation,
): Errors<keyof RecoveryInput> {
  const errors: Errors<keyof RecoveryInput> = {};
  if (isBlank(input.name)) errors.name = copy.name;
  if (isBlank(input.contact)) errors.contact = copy.contactRequired;
  else if (!isValidContact(input.contact)) errors.contact = copy.contactInvalid;
  if (isBlank(input.object)) errors.object = copy.object;
  if (isBlank(input.location)) errors.location = copy.location;
  if (isBlank(input.lostAt)) errors.lostAt = copy.lostAt;
  return errors;
}

export interface ContactInput {
  name: string;
  contact: string;
  message: string;
}

export function validateContact(
  input: ContactInput,
  copy: ValidationCopy = defaultValidation,
): Errors<keyof ContactInput> {
  const errors: Errors<keyof ContactInput> = {};
  if (isBlank(input.name)) errors.name = copy.name;
  if (isBlank(input.contact)) errors.contact = copy.contactRequired;
  else if (!isValidContact(input.contact)) errors.contact = copy.contactInvalid;
  if (isBlank(input.message)) errors.message = copy.message;
  else if (!minLength(input.message, 10)) errors.message = copy.messageShort;
  return errors;
}

export function hasErrors<T extends string>(errors: Errors<T>): boolean {
  return Object.keys(errors).length > 0;
}
