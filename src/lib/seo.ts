import { SITE, DIVE_CENTER, siteUrl } from "@/content/site";
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
    "@type": ["ProfessionalService", "SportsActivityLocation"],
    name: SITE.name,
    description: getDictionary(locale).meta.home.description,
    slogan: SITE.slogan,
    url: `${siteUrl()}${pathFor("home", locale)}`,
    image: `${siteUrl()}/opengraph-image`,
    logo: `${siteUrl()}/brand/logo-square.png`,
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


/** "฿5,850" → 5850. Returns null when a course has no published price. */
function priceValue(price?: string): number | null {
  if (!price) return null;
  const digits = price.replace(/[^\d]/g, "");
  return digits ? Number(digits) : null;
}

/**
 * The PADI course catalogue as schema.org Courses.
 *
 * Prices are owner-provided Discovery Divers rates — verified, so they belong
 * in structured data. The provider is credited explicitly: these courses are
 * taught by Jammin's Depths but booked and run through Discovery Divers.
 */
export function coursesJsonLd(locale: Locale = defaultLocale) {
  const dict = getDictionary(locale);
  const url = `${siteUrl()}${pathFor("diving", locale)}`;

  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: dict.diving.coursesTitle,
    itemListElement: dict.diving.courses.map((course, i) => {
      const value = priceValue(course.priceFrom);
      return {
        "@type": "ListItem",
        position: i + 1,
        item: {
          "@type": "Course",
          name: course.name,
          description: course.summary,
          url,
          inLanguage: htmlLang[locale],
          provider: {
            "@type": "Organization",
            name: DIVE_CENTER.name,
            url: DIVE_CENTER.url,
          },
          ...(value
            ? {
                offers: {
                  "@type": "Offer",
                  price: value,
                  priceCurrency: "THB",
                  availability: "https://schema.org/InStock",
                  url: DIVE_CENTER.pricingUrl,
                },
              }
            : {}),
        },
      };
    }),
  };
}

/**
 * FAQPage structured data.
 *
 * Only `confirmed` answers are emitted. An answer still awaiting the owner's
 * input must never surface in a search result, so unconfirmed entries are
 * filtered out here even though they render on the page with a badge.
 * Returns null when nothing is confirmed, so the caller can skip the script.
 */
export function faqJsonLd(locale: Locale = defaultLocale) {
  const items = getDictionary(locale).faq.items.filter((item) => item.confirmed);
  if (items.length === 0) return null;

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: htmlLang[locale],
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}
