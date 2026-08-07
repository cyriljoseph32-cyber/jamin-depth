import type { MetadataRoute } from "next";
import { siteUrl } from "@/content/site";
import { locales } from "@/content/i18n";
import { PAGE_KEYS, pathFor, alternatesFor, type PageKey } from "@/content/routes";

/**
 * Bilingual sitemap: every page in every locale, each entry declaring its
 * `alternates.languages` so Google pairs the translations instead of
 * treating them as duplicates.
 */
const PRIORITY: Record<PageKey, number> = {
  home: 1,
  diving: 0.9,
  recovery: 0.8,
  contact: 0.7,
  about: 0.6,
  privacy: 0.2,
};

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const now = new Date();

  return locales.flatMap((locale) =>
    PAGE_KEYS.map((key) => ({
      url: `${base}${pathFor(key, locale)}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: PRIORITY[key],
      alternates: {
        languages: Object.fromEntries(
          Object.entries(alternatesFor(key)).map(([l, path]) => [l, `${base}${path}`]),
        ),
      },
    })),
  );
}
