import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary, isLocale, type Locale } from "@/content/i18n";
import { allSubPageParams, pageKeyFromSlug, type SubPageKey } from "@/content/routes";
import { pageMetadata } from "@/lib/metadata";
import { DivingPage } from "@/components/pages/DivingPage";
import { BaptismPage } from "@/components/pages/BaptismPage";
import { RecoveryPage } from "@/components/pages/RecoveryPage";
import { AboutPage } from "@/components/pages/AboutPage";
import { ContactPage } from "@/components/pages/ContactPage";
import { PrivacyPage } from "@/components/pages/PrivacyPage";

/**
 * Every non-home page, resolved from its *localised* slug.
 *
 * One dynamic segment serves both languages: `/fr/plongee` and `/en/diving`
 * both land here and resolve to the `diving` page key via `routes.ts`. That
 * keeps French SEO slugs possible without duplicating a folder tree per locale.
 */

const PAGES: Record<
  SubPageKey,
  (props: { dict: ReturnType<typeof getDictionary>; locale: Locale }) => React.ReactNode
> = {
  diving: DivingPage,
  baptism: BaptismPage,
  recovery: RecoveryPage,
  about: AboutPage,
  contact: ContactPage,
  privacy: PrivacyPage,
};

/** Pre-render all locale/slug pairs at build time. */
export function generateStaticParams() {
  return allSubPageParams();
}

/**
 * Unknown slugs must reach this segment so the explicit `notFound()` below
 * renders the *branded* 404 from `[locale]/not-found.tsx`. Setting
 * `dynamicParams = false` would short-circuit earlier and fall back to Next's
 * bare "404" page instead.
 */
export const dynamicParams = true;

function resolve(localeRaw: string, slug: string) {
  if (!isLocale(localeRaw)) return null;
  const key = pageKeyFromSlug(localeRaw, slug);
  return key ? { locale: localeRaw, key } : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale: localeRaw, slug } = await params;
  const hit = resolve(localeRaw, slug);
  if (!hit) return {};

  const dict = getDictionary(hit.locale);
  const meta = dict.meta[hit.key];
  return pageMetadata({
    title: meta.title,
    description: meta.description,
    pageKey: hit.key,
    locale: hit.locale,
    keywords: "keywords" in meta ? [...meta.keywords] : undefined,
  });
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: localeRaw, slug } = await params;
  const hit = resolve(localeRaw, slug);
  if (!hit) notFound();

  const Component = PAGES[hit.key];
  return <Component dict={getDictionary(hit.locale)} locale={hit.locale} />;
}
