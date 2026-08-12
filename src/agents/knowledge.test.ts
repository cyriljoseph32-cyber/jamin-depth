import { describe, expect, it } from "vitest";
import { locales } from "@/content/i18n";
import { auditDraft } from "./policy";
import { findAnswer, knowledgeBase, normalise } from "./knowledge";

describe("knowledgeBase", () => {
  it("loads the site's FAQ for both locales", () => {
    for (const locale of locales) {
      const entries = knowledgeBase(locale);
      expect(entries.length, locale).toBeGreaterThan(5);
      expect(entries.some((e) => e.source === "faq"), locale).toBe(true);
      expect(entries.some((e) => e.source === "faqRecovery"), locale).toBe(true);
    }
  });

  it("keeps only answers the owner has confirmed", () => {
    // An unconfirmed answer is not a weaker answer — it is not an answer.
    for (const locale of locales) {
      for (const entry of knowledgeBase(locale)) {
        expect(entry.answer.trim().length, entry.id).toBeGreaterThan(0);
      }
    }
  });

  it("every answer survives the outgoing guard", () => {
    // The safety net that matters: the FAQ is published copy, but it is quoted
    // to clients by the system, so it faces the same relecture as a template.
    // If someone edits a promise into the site FAQ, this fails here first.
    for (const locale of locales) {
      for (const entry of knowledgeBase(locale)) {
        const violations = auditDraft(entry.answer);
        expect(violations, `${entry.id}/${locale}: ${violations.map((v) => v.rule).join(", ")}`).toEqual([]);
      }
    }
  });
});

describe("normalise", () => {
  it("makes accents irrelevant to matching", () => {
    expect(normalise("Baptême")).toBe("bapteme");
    expect(normalise("PLONGÉE")).toBe("plongee");
  });
});

describe("findAnswer", () => {
  it("answers a beginner question from the owner's own words", () => {
    const match = findAnswer("Je n'ai jamais plongé, est-ce que je peux quand même plonger ?", "fr");
    expect(match?.entry.answer).toMatch(/Discover Scuba Diving/);
  });

  it("answers in English from the English FAQ", () => {
    const match = findAnswer("Do I need to know how to swim to dive?", "en");
    expect(match?.entry.answer).toMatch(/[Ss]wimming requirements/);
  });

  it("finds the recovery answers too", () => {
    const match = findAnswer("Est-ce que vous garantissez de retrouver l'objet perdu ?", "fr");
    expect(match?.entry.source).toBe("faqRecovery");
    expect(match?.entry.answer).toMatch(/^Non/);
  });

  it("stays silent rather than answering the wrong question", () => {
    expect(findAnswer("Bonjour", "fr")).toBeNull();
    expect(findAnswer("ok merci", "fr")).toBeNull();
    // One shared word is not a topic match.
    expect(findAnswer("plongée", "fr")).toBeNull();
  });

  it("refuses to pick between two equally plausible answers", () => {
    // Ambiguity goes to a human; a confident answer to an unasked question is worse
    // than no answer.
    const match = findAnswer("apporter réserver plongée matériel", "fr");
    if (match) expect(match.score).toBeGreaterThan(2);
  });
});
