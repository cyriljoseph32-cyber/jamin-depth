import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary, isLocale } from "@/content/i18n";
import { pageMetadata } from "@/lib/metadata";
import { HomePage } from "@/components/pages/HomePage";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  return pageMetadata({
    title: dict.meta.home.title,
    description: dict.meta.home.description,
    pageKey: "home",
    locale,
    keywords: [...dict.meta.home.keywords],
  });
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <HomePage dict={getDictionary(locale)} locale={locale} />;
}
