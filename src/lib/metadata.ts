import type { Metadata } from "next";
import { SITE, siteUrl } from "@/content/site";
import { ogLocale, type Locale } from "@/content/i18n";
import { pathFor, alternatesFor, type PageKey } from "@/content/routes";

interface PageMetaInput {
  title: string;
  description: string;
  /** Route key — the localised path and hreflang set are derived from it. */
  pageKey: PageKey;
  locale: Locale;
  keywords?: string[];
}

/**
 * Build unique, canonical, OG/Twitter-complete metadata for a page.
 *
 * The canonical points at *this* locale's URL, while `alternates.languages`
 * lists every translation (hreflang) so Google serves the right language and
 * doesn't treat the two versions as duplicates. The root layout supplies
 * metadataBase + the title template.
 */
export function pageMetadata({
  title,
  description,
  pageKey,
  locale,
  keywords,
}: PageMetaInput): Metadata {
  const path = pathFor(pageKey, locale);
  return {
    title,
    description,
    keywords,
    alternates: {
      canonical: path,
      languages: alternatesFor(pageKey),
    },
    openGraph: {
      type: "website",
      siteName: SITE.name,
      title: `${title} — ${SITE.name}`,
      description,
      url: `${siteUrl()}${path}`,
      locale: ogLocale[locale],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} — ${SITE.name}`,
      description,
    },
  };
}
