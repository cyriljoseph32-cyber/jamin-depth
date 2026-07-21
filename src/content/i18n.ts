import { en, type Dictionary } from "./en";

/**
 * i18n scaffold.
 *
 * English ships today. French and Thai are prepared for: add `fr.ts` / `th.ts`
 * exporting the same `Dictionary` shape, register them in `dictionaries`, and
 * extend `locales`. To add localised URLs later, introduce an `app/[locale]`
 * segment and read the locale param instead of the hard-coded default.
 */
export const locales = ["en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

const dictionaries: Record<Locale, Dictionary> = {
  en,
};

export function getDictionary(locale: Locale = defaultLocale): Dictionary {
  return dictionaries[locale];
}

/** Convenience for server components that only need the default locale today. */
export const t = getDictionary(defaultLocale);
