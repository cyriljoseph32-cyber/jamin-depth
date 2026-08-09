import { describe, it, expect } from "vitest";
import { professionalServiceJsonLd, faqJsonLd, coursesJsonLd } from "./seo";
import { getDictionary, locales } from "@/content/i18n";
import { pathFor } from "@/content/routes";

describe("professionalServiceJsonLd", () => {
  it("is a LocalBusiness subtype, not a plain LocalBusiness", () => {
    // ProfessionalService carries strictly more meaning; a downgrade would be
    // a regression, so pin the type.
    expect(professionalServiceJsonLd("en")["@type"]).toContain("ProfessionalService");
  });

  it("spans every published rate, courses and trips alike", () => {
    const d = getDictionary("en").diving;
    const published = [
      ...d.courses.map((c) => c.priceFrom),
      ...d.trips.map((t) => t.price),
    ]
      .filter((p): p is string => Boolean(p))
      .map((p) => Number(p.replace(/[^\d]/g, "")));

    const range = professionalServiceJsonLd("en").priceRange;
    const [low, high] = range!.split("–").map((p) => Number(p.replace(/[^\d]/g, "")));

    // Asserting the band *contains* every rate, and touches both ends, rather
    // than restating the function's own min/max — which would pass even if
    // both it and the test read only half the catalogue.
    expect(Math.min(...published)).toBe(low);
    expect(Math.max(...published)).toBe(high);
    for (const price of published) {
      expect(price).toBeGreaterThanOrEqual(low!);
      expect(price).toBeLessThanOrEqual(high!);
    }
  });

  it("describes the two services with the home page's own words", () => {
    const home = getDictionary("fr").home;
    const services = professionalServiceJsonLd("fr").hasOfferCatalog.itemListElement.map(
      (entry) => entry.itemOffered.description,
    );
    expect(services).toContain(home.divingCardBody);
    expect(services).toContain(home.recoveryCardBody);
  });

  it("omits the fields the owner has not confirmed", () => {
    // email and availableLanguage stay out until he confirms the mailbox and
    // the languages he actually converses in.
    const jsonLd: Record<string, unknown> = professionalServiceJsonLd("en");
    expect(jsonLd.email).toBeUndefined();
    expect(jsonLd.availableLanguage).toBeUndefined();
  });
});

describe("faqJsonLd", () => {
  it("claims a distinct URL per page", () => {
    const diving = faqJsonLd("fr", "diving");
    const baptism = faqJsonLd("fr", "baptism");
    expect(diving?.mainEntityOfPage).toContain(pathFor("diving", "fr"));
    expect(baptism?.mainEntityOfPage).toContain(pathFor("baptism", "fr"));
    // The bug this whole change exists to fix: one FAQPage, two URLs, nothing
    // telling them apart.
    expect(diving?.mainEntityOfPage).not.toBe(baptism?.mainEntityOfPage);
  });

  it("keeps unconfirmed answers out of structured data", () => {
    const items = [
      { q: "Settled", a: "Yes.", confirmed: true },
      { q: "Still open", a: "Placeholder.", confirmed: false },
    ];
    const names = faqJsonLd("en", "diving", items)?.mainEntity.map((e) => e.name);
    expect(names).toEqual(["Settled"]);
  });

  it("returns null when nothing is confirmed, so the caller emits no script", () => {
    expect(faqJsonLd("en", "diving", [{ q: "Q", a: "A", confirmed: false }])).toBeNull();
  });

  it("serves the recovery questions when handed them", () => {
    for (const locale of locales) {
      const recovery = getDictionary(locale).faqRecovery;
      const jsonLd = faqJsonLd(locale, "recovery", recovery.items);
      expect(jsonLd?.mainEntity).toHaveLength(recovery.items.length);
      expect(jsonLd?.mainEntityOfPage).toContain(pathFor("recovery", locale));
    }
  });
});

describe("coursesJsonLd", () => {
  it("prices only the courses that publish a rate", () => {
    const priced = coursesJsonLd("en").itemListElement.filter((entry) => "offers" in entry.item);
    const published = getDictionary("en").diving.courses.filter((c) => c.priceFrom);
    expect(priced).toHaveLength(published.length);
  });
});
