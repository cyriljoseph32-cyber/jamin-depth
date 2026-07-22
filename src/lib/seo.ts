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
      "Diving and underwater recovery in Koh Samui, Thailand. PADI courses with Discovery Divers and fun dives, plus professional recovery of lost objects from beach, boat or certain waterfall zones — direct, local and methodical.",
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
      "diving",
      "PADI courses",
      "fun dives",
      "underwater recovery",
      "lost item recovery",
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
