import { SITE, siteUrl } from "@/content/site";
import { getDictionary, defaultLocale, htmlLang, type Locale } from "@/content/i18n";
import { pathFor } from "@/content/routes";

/**
 * JSON-LD for a ProfessionalService.
 * Deliberately omits address, geo, opening hours, price and reviews —
 * none are verified, and the brief forbids inventing them.
 */
export function professionalServiceJsonLd(locale: Locale = defaultLocale) {
  return {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: SITE.name,
    description: getDictionary(locale).meta.home.description,
    slogan: SITE.slogan,
    url: `${siteUrl()}${pathFor("home", locale)}`,
    image: `${siteUrl()}/opengraph-image`,
    telephone: `+${SITE.phoneE164}`,
    areaServed: SITE.areaServed.map((name) => ({ "@type": "Place", name })),
    address: {
      "@type": "PostalAddress",
      addressLocality: "Koh Samui",
      addressRegion: "Surat Thani",
      addressCountry: "TH",
    },
    sameAs: [SITE.social.instagram, SITE.social.facebook],
    knowsAbout: [
      "diving",
      "PADI courses",
      "fun dives",
      "underwater recovery",
      "lost item recovery",
      "Koh Samui",
    ],
  };
}

export function websiteJsonLd(locale: Locale = defaultLocale) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE.name,
    url: `${siteUrl()}${pathFor("home", locale)}`,
    inLanguage: htmlLang[locale],
  };
}
