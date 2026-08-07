import { locales, type Locale } from "./i18n";

/**
 * Localised routing.
 *
 * Each page has a stable *key* used throughout the code, and one slug per
 * locale used in the URL. French slugs matter for local SEO — `/fr/plongee`
 * ranks for "plongée Koh Samui" in a way `/fr/diving` never would.
 *
 * This table is the single source of truth for navigation, hreflang,
 * canonicals and the sitemap. Adding a page means adding one entry here plus a
 * case in `app/[locale]/[slug]/page.tsx` — nothing else.
 */
export const PAGE_KEYS = ["home", "diving", "recovery", "about", "contact", "privacy"] as const;
export type PageKey = (typeof PAGE_KEYS)[number];

/** Pages that live under a slug. `home` is the locale root and has none. */
export type SubPageKey = Exclude<PageKey, "home">;

export const SLUGS: Record<Locale, Record<SubPageKey, string>> = {
  fr: {
    diving: "plongee",
    recovery: "recuperation-sous-marine",
    about: "le-plongeur",
    contact: "contact",
    privacy: "confidentialite",
  },
  en: {
    diving: "diving",
    recovery: "recovery",
    about: "about",
    contact: "contact",
    privacy: "privacy",
  },
};

/** Absolute in-app path for a page in a locale, e.g. ("diving","fr") → "/fr/plongee". */
export function pathFor(key: PageKey, locale: Locale): string {
  return key === "home" ? `/${locale}` : `/${locale}/${SLUGS[locale][key]}`;
}

/** Reverse lookup used by the [slug] route to resolve which page to render. */
export function pageKeyFromSlug(locale: Locale, slug: string): SubPageKey | null {
  const entries = Object.entries(SLUGS[locale]) as [SubPageKey, string][];
  return entries.find(([, s]) => s === slug)?.[0] ?? null;
}

/** Every (locale, slug) pair — drives generateStaticParams and the sitemap. */
export function allSubPageParams(): { locale: Locale; slug: string }[] {
  return locales.flatMap((locale) =>
    (Object.values(SLUGS[locale]) as string[]).map((slug) => ({ locale, slug })),
  );
}

/**
 * Same page, every locale — for `alternates.languages` (hreflang).
 * Google needs each version to point at all the others, including itself.
 */
export function alternatesFor(key: PageKey): Record<Locale, string> {
  return Object.fromEntries(locales.map((l) => [l, pathFor(key, l)])) as Record<Locale, string>;
}

/** Main navigation, in display order. Recovery follows diving — diving leads. */
export const NAV_KEYS: readonly SubPageKey[] = ["diving", "recovery", "about", "contact"];
export const FOOTER_LEGAL_KEYS: readonly SubPageKey[] = ["privacy", "contact"];
