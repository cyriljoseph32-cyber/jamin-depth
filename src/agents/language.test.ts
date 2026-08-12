import { describe, expect, it } from "vitest";
import { detectLanguage } from "./language";

describe("detectLanguage", () => {
  it("reads a French enquiry", () => {
    const v = detectLanguage("Bonjour, nous sommes 2 et nous voudrions faire un baptême de plongée.");
    expect(v.locale).toBe("fr");
    expect(v.foreignLanguage).toBeUndefined();
  });

  it("reads an English enquiry", () => {
    const v = detectLanguage("Hello, we are two certified divers and would like to book a fun dive.");
    expect(v.locale).toBe("en");
    expect(v.foreignLanguage).toBeUndefined();
  });

  it("prefers the message over the browsing locale", () => {
    // The visitor landed on /fr but wrote in English — answer in English.
    const v = detectLanguage("Hi, how much for two people, we are certified and want to dive", "fr");
    expect(v.locale).toBe("en");
  });

  it("falls back to the hint when the text carries no signal", () => {
    expect(detectLanguage("???", "en").locale).toBe("en");
    expect(detectLanguage("???").locale).toBe("fr");
  });

  it("flags a language nobody confirmed we speak", () => {
    const v = detectLanguage("Hallo, ich möchte tauchen. Wie viel kostet das?");
    expect(v.foreignLanguage).toBe("de");
  });

  it("flags non-Latin scripts on sight", () => {
    expect(detectLanguage("สวัสดีครับ").foreignLanguage).toBe("th");
    expect(detectLanguage("नमस्ते").foreignLanguage).toBe("hi");
  });

  it("does not hand off an English message containing one foreign word", () => {
    const v = detectLanguage("Hi, hola from the boat, we would like to book two dives for tomorrow please");
    expect(v.foreignLanguage).toBeUndefined();
    expect(v.locale).toBe("en");
  });

  it("uses accents to settle short French messages", () => {
    const v = detectLanguage("Baptême possible demain ?");
    expect(v.locale).toBe("fr");
  });
});
