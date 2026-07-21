import type { Metadata } from "next";
import { SITE, siteUrl } from "@/content/site";

interface PageMetaInput {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
}

/**
 * Build unique, canonical, OG/Twitter-complete metadata for a page.
 * The root layout supplies metadataBase + title template, so `title`
 * here is the page-specific segment.
 */
export function pageMetadata({ title, description, path, keywords }: PageMetaInput): Metadata {
  const canonical = path === "/" ? "/" : path;
  const url = `${siteUrl()}${path === "/" ? "" : path}`;
  return {
    title,
    description,
    keywords,
    alternates: { canonical },
    openGraph: {
      type: "website",
      siteName: SITE.name,
      title: `${title} — ${SITE.name}`,
      description,
      url,
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} — ${SITE.name}`,
      description,
    },
  };
}
