import { SITE, siteUrl } from "@/content/site";

/**
 * JSON-LD for a ProfessionalService.
 * Deliberately omits address, geo, opening hours, price and reviews —
 * none are verified, and the brief forbids inventing them.
 */
export function professionalServiceJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: SITE.name,
    description:
      "Underwater recovery and diving in Koh Samui, Thailand. Lost item recovery from beach, boat or certain waterfall zones, plus accompanied diving — direct, local and methodical.",
    slogan: SITE.slogan,
    url: siteUrl(),
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
      "underwater recovery",
      "lost item recovery",
      "diving",
      "Koh Samui",
    ],
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE.name,
    url: siteUrl(),
    inLanguage: "en",
  };
}
