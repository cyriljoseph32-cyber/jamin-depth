/**
 * Pure, framework-free form validation helpers.
 * Kept side-effect free so they are trivially unit-testable and reusable
 * across the recovery and contact forms.
 */

export type Errors<T extends string> = Partial<Record<T, string>>;

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

export function validateRecovery(input: RecoveryInput): Errors<keyof RecoveryInput> {
  const errors: Errors<keyof RecoveryInput> = {};
  if (isBlank(input.name)) errors.name = "Please tell us your name.";
  if (isBlank(input.contact)) errors.contact = "A phone, WhatsApp or email is required.";
  else if (!isValidContact(input.contact)) errors.contact = "Enter a valid phone/WhatsApp or email.";
  if (isBlank(input.object)) errors.object = "What did you lose?";
  if (isBlank(input.location)) errors.location = "Where did it happen? Be as precise as you can.";
  if (isBlank(input.lostAt)) errors.lostAt = "Roughly when did it happen?";
  return errors;
}

export interface ContactInput {
  name: string;
  contact: string;
  message: string;
}

export function validateContact(input: ContactInput): Errors<keyof ContactInput> {
  const errors: Errors<keyof ContactInput> = {};
  if (isBlank(input.name)) errors.name = "Please tell us your name.";
  if (isBlank(input.contact)) errors.contact = "A phone, WhatsApp or email is required.";
  else if (!isValidContact(input.contact)) errors.contact = "Enter a valid phone/WhatsApp or email.";
  if (isBlank(input.message)) errors.message = "Add a short message.";
  else if (!minLength(input.message, 10)) errors.message = "A little more detail helps us help you.";
  return errors;
}

export function hasErrors<T extends string>(errors: Errors<T>): boolean {
  return Object.keys(errors).length > 0;
}
