import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Oswald, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "../globals.css";
import { SITE, siteUrl } from "@/content/site";
import {
  getDictionary,
  isLocale,
  locales,
  htmlLang,
  ogLocale,
  type Locale,
} from "@/content/i18n";
import { pathFor, alternatesFor } from "@/content/routes";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { WhatsAppFab } from "@/components/site/WhatsAppFab";
import { ChatWidget } from "@/components/assistant/ChatWidget";
import { DepthBackground } from "@/components/visuals/DepthBackground";
import { AnalyticsListener } from "@/components/site/AnalyticsListener";
import { professionalServiceJsonLd, websiteJsonLd } from "@/lib/seo";

/**
 * This is the app's *root* layout — it lives under `[locale]` so that
 * `<html lang>` can reflect the language actually being served. Requests
 * without a locale prefix are redirected by `src/middleware.ts`.
 */

const oswald = Oswald({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-oswald",
  display: "swap",
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  const locale = raw;
  const dict = getDictionary(locale);

  return {
    metadataBase: new URL(siteUrl()),
    title: {
      default: `${SITE.name} — ${SITE.tagline} · ${SITE.location}`,
      template: `%s — ${SITE.name}`,
    },
    description: dict.meta.home.description,
    applicationName: SITE.name,
    authors: [{ name: SITE.name }],
    creator: SITE.name,
    alternates: {
      canonical: pathFor("home", locale),
      languages: alternatesFor("home"),
    },
    openGraph: {
      type: "website",
      siteName: SITE.name,
      locale: ogLocale[locale],
      url: `${siteUrl()}${pathFor("home", locale)}`,
      // Card artwork comes from `src/app/opengraph-image.tsx` via the file
      // convention, which Next also reuses for Twitter.
    },
    twitter: { card: "summary_large_image" },
    robots: { index: true, follow: true },
    formatDetection: { telephone: true },
  };
}

export const viewport: Viewport = {
  themeColor: "#05080d",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);

  return (
    <html
      lang={htmlLang[locale]}
      className={`${oswald.variable} ${plexSans.variable} ${plexMono.variable}`}
    >
      <body className="grain min-h-screen antialiased">
        {/* Tag the document as JS-capable so reveal animations only apply when
            JavaScript is available (content stays visible otherwise). */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(professionalServiceJsonLd(locale)) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd(locale)) }}
        />

        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:bg-signal focus:px-4 focus:py-2 focus:font-mono focus:text-xs focus:uppercase focus:tracking-widest focus:text-ink"
        >
          {dict.nav.skipToContent}
        </a>

        <DepthBackground />
        <Header dict={dict} locale={locale} />
        <main id="main" className="pb-24">
          {children}
        </main>
        <Footer dict={dict} locale={locale} />
        <WhatsAppFab dict={dict} />
        <ChatWidget dict={dict} locale={locale} />
        <AnalyticsListener />
      </body>
    </html>
  );
}
