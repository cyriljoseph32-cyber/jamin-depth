import { SITE, DIVE_CENTER, siteUrl } from "@/content/site";
import { getDictionary, defaultLocale, htmlLang, type Locale } from "@/content/i18n";
import { pathFor, type PageKey } from "@/content/routes";

/** "฿5,850" → 5850. Returns null when a course has no published price. */
function priceValue(price?: string): number | null {
  if (!price) return null;
  const digits = price.replace(/[^\d]/g, "");
  return digits ? Number(digits) : null;
}

/**
 * The published price band, derived rather than written down.
 *
 * Reading it off `courses[].priceFrom` and `trips[].price` means a rate change
 * in the dictionary carries into the structured data on its own; a hardcoded
 * "฿2,450–฿17,900" would quietly go stale the first time a price moves.
 * Returns null if no price is published at all, so the field can be dropped
 * rather than emitted empty.
 */
function priceRange(locale: Locale): string | null {
  const d = getDictionary(locale).diving;
  const values = [
    ...d.courses.map((c) => priceValue(c.priceFrom)),
    ...d.trips.map((t) => priceValue(t.price)),
  ].filter((v): v is number => v !== null);
  if (values.length === 0) return null;

  const format = (n: number) => `฿${n.toLocaleString("en-US")}`;
  return `${format(Math.min(...values))}–${format(Math.max(...values))}`;
}

/**
 * JSON-LD for a ProfessionalService.
 *
 * `ProfessionalService` is a subtype of `LocalBusiness`, so this is the
 * business listing — more specific, not less.
 *
 * Deliberately omits geo, opening hours and reviews — none are verified, and
 * the brief forbids inventing them. Two more are omitted on the owner's
 * instruction until he confirms them: `email` (the address is still a
 * placeholder) and `availableLanguage` (which means the languages the business
 * converses in, not the languages the site is published in — `WebSite`
 * already carries the latter as `inLanguage`).
 */
export function professionalServiceJsonLd(locale: Locale = defaultLocale) {
  const dict = getDictionary(locale);
  const range = priceRange(locale);

  return {
    "@context": "https://schema.org",
    "@type": ["ProfessionalService", "SportsActivityLocation"],
    name: SITE.name,
    description: dict.meta.home.description,
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
    ...(range ? { priceRange: range } : {}),
    knowsAbout: [
      "diving",
      "PADI courses",
      "fun dives",
      "underwater recovery",
      "lost item recovery",
      "Koh Samui",
    ],
    /*
     * The two services, described with the same sentences the home page uses.
     * Restating them here would create a second copy free to drift from the
     * first — and the page copy is the one that gets edited.
     */
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: dict.home.worldsTitle,
      itemListElement: [
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: dict.home.divingCardTitle,
            description: dict.home.divingCardBody,
            url: `${siteUrl()}${pathFor("diving", locale)}`,
          },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: dict.home.recoveryCardTitle,
            description: dict.home.recoveryCardBody,
            url: `${siteUrl()}${pathFor("recovery", locale)}`,
          },
        },
      ],
    },
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

export type FaqItem = { q: string; a: string; confirmed: boolean };

/**
 * FAQPage structured data.
 *
 * Only `confirmed` answers are emitted. An answer still awaiting the owner's
 * input must never surface in a search result, so unconfirmed entries are
 * filtered out here even though they render on the page with a badge.
 * Returns null when nothing is confirmed, so the caller can skip the script.
 *
 * `page` names which URL the FAQPage belongs to. Without it the same entity
 * was declared on two pages with nothing to tell them apart, leaving Google to
 * guess which one it described. Each caller now claims its own URL.
 *
 * `items` lets a page serve a different question set — the recovery page has
 * its own — while keeping one implementation of the filter and the shape.
 */
export function faqJsonLd(
  locale: Locale = defaultLocale,
  page: PageKey = "home",
  items: readonly FaqItem[] = getDictionary(locale).faq.items,
) {
  const confirmed = items.filter((item) => item.confirmed);
  if (confirmed.length === 0) return null;

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: htmlLang[locale],
    mainEntityOfPage: `${siteUrl()}${pathFor(page, locale)}`,
    mainEntity: confirmed.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}
