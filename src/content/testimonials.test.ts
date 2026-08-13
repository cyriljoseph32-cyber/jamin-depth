import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { TESTIMONIALS, publishedTestimonials, pendingConsentCount } from "./testimonials";

/**
 * Guards on the testimonials block.
 *
 * These quotes came out of private WhatsApp threads. The rules below are what
 * make it safe to keep them in the repository at all, so they are tested rather
 * than trusted to memory.
 */

describe("testimonials", () => {
  it("publishes nothing without the sender's permission", () => {
    // Not a style assertion — the state of the world. Every quote is still
    // awaiting a yes. Flip a `consent` flag and this count changes.
    expect(publishedTestimonials()).toEqual([]);
    expect(pendingConsentCount()).toBe(TESTIMONIALS.length);
  });

  it("carries no surname, address, date of birth or phone number", () => {
    for (const item of TESTIMONIALS) {
      const field = `${item.name} — ${item.quote}`;
      expect(field, `${item.name}: address`).not.toMatch(
        /\b\d{1,4}\s+(rue|avenue|av\.|bd|boulevard|impasse|chemin)\b/i,
      );
      expect(field, `${item.name}: postcode`).not.toMatch(/\b\d{5}\b/);
      expect(field, `${item.name}: date of birth`).not.toMatch(/\b\d{2}\/\d{2}\/\d{4}\b/);
      expect(field, `${item.name}: phone`).not.toMatch(/(\+\d[\d\s.-]{8,})|(\b\d{9,}\b)/);
      // First names, or a sign-off like "Frank & Lion" — never "First Last".
      expect(item.name, `${item.name}: surname`).not.toMatch(/^\p{Lu}\p{L}+\s+\p{Lu}\p{L}+$/u);
    }
  });

  it("keeps the quotes out of the dictionary, which ships to the browser", () => {
    // The dictionary crosses a client boundary, so Next serialises all of it
    // into every page's HTML. A pending quote stored there is readable with
    // "view source" no matter what the component decides to render — the
    // consent flag would gate the display and not the publication.
    for (const file of ["fr.ts", "en.ts"]) {
      const dict = readFileSync(new URL(`./${file}`, import.meta.url), "utf8");
      for (const item of TESTIMONIALS) {
        expect(dict, `${file} must not carry the quote`).not.toContain(item.quote);
        expect(dict, `${file} must not carry the name`).not.toContain(item.name);
      }
    }
  });

  it("declares no Review or AggregateRating structured data", () => {
    // A business marking up its own hand-picked quotes as review data on its
    // own page is against Google's guidelines and risks a manual action.
    const seo = readFileSync(new URL("../lib/seo.ts", import.meta.url), "utf8");
    expect(seo).not.toMatch(/AggregateRating|"@type":\s*"Review"/);
  });
});
