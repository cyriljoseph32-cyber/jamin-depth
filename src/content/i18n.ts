import { en, type Dictionary } from "./en";
import { fr } from "./fr";

/**
 * i18n core.
 *
 * French is the default locale: the business targets francophone visitors in
 * Koh Samui first, without excluding English speakers. Both locales are fully
 * translated and independently indexable (`/fr/…`, `/en/…`).
 *
 * To add a locale: create `<code>.ts` exporting a `Dictionary`, register it in
 * `dictionaries`, add it to `locales`, and add its slugs to `SLUGS` in
 * routes.ts. Nothing in the components needs to change.
 */
export const locales = ["fr", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "fr";

const dictionaries: Record<Locale, Dictionary> = { fr, en };

export function getDictionary(locale: Locale = defaultLocale): Dictionary {
  return dictionaries[locale];
}

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

/** BCP 47 tags for <html lang> and Open Graph. */
export const htmlLang: Record<Locale, string> = { fr: "fr", en: "en" };
export const ogLocale: Record<Locale, string> = { fr: "fr_FR", en: "en_US" };

export type { Dictionary };
