import { describe, expect, it } from "vitest";
import {
  detectPolicyQuestions,
  extract,
  extractActivity,
  extractCertification,
  extractDates,
  extractPartySize,
} from "./extract";

/** Wednesday 11 March 2026 — fixed so nothing here depends on the wall clock. */
const NOW = "2026-03-11T09:00:00.000Z";

describe("extractDates", () => {
  it("resolves tomorrow and the day after", () => {
    expect(extractDates("on peut plonger demain ?", NOW).dates).toEqual(["2026-03-12"]);
    expect(extractDates("après-demain si possible", NOW).dates).toEqual(["2026-03-13"]);
  });

  it("does not read tomorrow out of the day after", () => {
    expect(extractDates("après-demain", NOW).dates).toEqual(["2026-03-13"]);
  });

  it("reads day-first numeric dates", () => {
    expect(extractDates("dispo le 14/03 ?", NOW).dates).toEqual(["2026-03-14"]);
    expect(extractDates("le 02/04/2027", NOW).dates).toEqual(["2027-04-02"]);
  });

  it("reads written months in both languages and both orders", () => {
    expect(extractDates("le 14 mars", NOW).dates).toEqual(["2026-03-14"]);
    expect(extractDates("March 14", NOW).dates).toEqual(["2026-03-14"]);
    expect(extractDates("14 March 2026", NOW).dates).toEqual(["2026-03-14"]);
  });

  it("rolls a past day/month into next year rather than into the past", () => {
    // 5 January is behind the reference, so it can only mean next January.
    expect(extractDates("le 5 janvier", NOW).dates).toEqual(["2027-01-05"]);
  });

  it("resolves a weekday to its next occurrence", () => {
    // Reference is a Wednesday; Friday is two days out.
    expect(extractDates("vendredi ça vous va ?", NOW).dates).toEqual(["2026-03-13"]);
    // The same weekday means next week, never today.
    expect(extractDates("mercredi", NOW).dates).toEqual(["2026-03-18"]);
  });

  it("refuses to invent a date from a vague phrase", () => {
    const { dates, vagueDates } = extractDates("on aimerait plonger la semaine prochaine", NOW);
    expect(dates).toEqual([]);
    expect(vagueDates).toEqual(["la semaine prochaine"]);
  });

  it("treats a bare month as vague", () => {
    const { dates, vagueDates } = extractDates("we are coming in April", NOW);
    expect(dates).toEqual([]);
    expect(vagueDates).toEqual(["in April"]);
  });

  it("keeps a real date next to a vague one", () => {
    const { dates, vagueDates } = extractDates("bientôt, disons le 20/03", NOW);
    expect(dates).toEqual(["2026-03-20"]);
    expect(vagueDates).toEqual(["bientôt"]);
  });

  it("ignores an impossible date", () => {
    expect(extractDates("le 32/13", NOW).dates).toEqual([]);
  });

  it("de-duplicates the same day written twice", () => {
    expect(extractDates("le 14/03, donc le 14 mars", NOW).dates).toEqual(["2026-03-14"]);
  });
});

describe("extractPartySize", () => {
  it("reads digits and words", () => {
    expect(extractPartySize("nous sommes 4")).toBe(4);
    expect(extractPartySize("3 personnes")).toBe(3);
    expect(extractPartySize("we are two")).toBe(2);
    expect(extractPartySize("for 5 people")).toBe(5);
  });

  it("infers a couple and a solo diver", () => {
    expect(extractPartySize("je viens avec ma femme")).toBe(2);
    expect(extractPartySize("just me")).toBe(1);
  });

  it("stays undefined rather than guessing", () => {
    expect(extractPartySize("on aimerait plonger")).toBeUndefined();
  });

  it("ignores an implausible count", () => {
    expect(extractPartySize("200 personnes")).toBeUndefined();
  });
});

describe("extractCertification", () => {
  it("reads a stated certification", () => {
    expect(extractCertification("I'm Open Water certified").certified).toBe(true);
    expect(extractCertification("j'ai le niveau 2").certified).toBe(true);
  });

  it("reads a stated beginner", () => {
    expect(extractCertification("je n'ai jamais plongé").certified).toBe(false);
    expect(extractCertification("complete beginner, first time").certified).toBe(false);
  });

  it("asserts nothing when the message says both", () => {
    const out = extractCertification("moi je n'ai jamais plongé mais ma femme est Open Water");
    expect(out.certified).toBeUndefined();
    expect(out.certificationHint).toMatch(/confirm/i);
  });
});

describe("extractActivity", () => {
  it("recognises each offer family", () => {
    expect(extractActivity("un baptême pour ma fille")).toBe("discover_scuba");
    expect(extractActivity("on veut passer l'Open Water")).toBe("course");
    expect(extractActivity("sortie à Sail Rock")).toBe("certified_fun_dive");
    expect(extractActivity("juste du snorkeling")).toBe("snorkeling");
    expect(extractActivity("j'ai perdu ma bague dans l'eau")).toBe("recovery");
  });

  it("puts recovery ahead of a generic diving mention", () => {
    expect(extractActivity("téléphone tombé à l'eau, vous plongez pour le retrouver ?")).toBe("recovery");
  });

  it("uses the stated level to resolve a vague diving request", () => {
    expect(extractActivity("we want to dive", true)).toBe("certified_fun_dive");
    expect(extractActivity("we want to dive", false)).toBe("discover_scuba");
    expect(extractActivity("we want to dive")).toBe("other");
  });
});

describe("detectPolicyQuestions", () => {
  it("spots questions whose answer is not confirmed", () => {
    expect(detectPolicyQuestions("vous prenez la carte ?")).toContain("paymentMethods");
    expect(detectPolicyQuestions("what's your cancellation policy?")).toContain("cancellation");
    expect(detectPolicyQuestions("on se retrouve où ?")).toContain("meetingPoint");
    expect(detectPolicyQuestions("à quelle heure le départ ?")).toContain("boatSchedule");
  });

  it("stays quiet on a plain enquiry", () => {
    expect(detectPolicyQuestions("un baptême pour deux le 14 mars")).toEqual([]);
  });
});

describe("extract", () => {
  it("reads a whole enquiry in one pass", () => {
    const out = extract("Bonjour, nous sommes 2, jamais plongé, baptême possible le 14/03 ?", NOW);
    expect(out).toMatchObject({
      dates: ["2026-03-14"],
      partySize: 2,
      certified: false,
      activity: "discover_scuba",
    });
  });
});
