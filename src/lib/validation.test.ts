import { describe, it, expect } from "vitest";
import {
  isBlank,
  isValidContact,
  minLength,
  isLikelySpam,
  validateRecovery,
  validateContact,
  hasErrors,
} from "./validation";
import { en } from "@/content/en";
import { fr } from "@/content/fr";

describe("isBlank", () => {
  it("treats empty and whitespace as blank", () => {
    expect(isBlank("")).toBe(true);
    expect(isBlank("   ")).toBe(true);
    expect(isBlank(undefined)).toBe(true);
    expect(isBlank("x")).toBe(false);
  });
});

describe("isValidContact", () => {
  it("accepts emails and phone-like strings", () => {
    expect(isValidContact("someone@example.com")).toBe(true);
    expect(isValidContact("+66 63 375 3316")).toBe(true);
    expect(isValidContact("0633753316")).toBe(true);
  });
  it("rejects nonsense and too-short values", () => {
    expect(isValidContact("abc")).toBe(false);
    expect(isValidContact("!!")).toBe(false);
  });
});

describe("minLength", () => {
  it("counts trimmed length", () => {
    expect(minLength("  hello  ", 5)).toBe(true);
    expect(minLength("hi", 5)).toBe(false);
  });
});

describe("isLikelySpam", () => {
  it("flags filled honeypot", () => {
    expect(isLikelySpam("bot", 5000)).toBe(true);
  });
  it("flags instant submits", () => {
    expect(isLikelySpam("", 200)).toBe(true);
  });
  it("passes genuine submissions", () => {
    expect(isLikelySpam("", 5000)).toBe(false);
  });
});

describe("validateRecovery", () => {
  it("reports errors for all missing required fields", () => {
    const errors = validateRecovery({ name: "", contact: "", object: "", location: "", lostAt: "" });
    expect(hasErrors(errors)).toBe(true);
    expect(errors.name).toBeTruthy();
    expect(errors.contact).toBeTruthy();
    expect(errors.object).toBeTruthy();
    expect(errors.location).toBeTruthy();
    expect(errors.lostAt).toBeTruthy();
  });

  it("passes a complete, valid submission", () => {
    const errors = validateRecovery({
      name: "Alex",
      contact: "+66 63 375 3316",
      object: "Ring",
      location: "Chaweng pier",
      lostAt: "Today 14:00",
    });
    expect(hasErrors(errors)).toBe(false);
  });

  it("flags an invalid contact format", () => {
    const errors = validateRecovery({
      name: "Alex",
      contact: "nope",
      object: "Ring",
      location: "pier",
      lostAt: "today",
    });
    expect(errors.contact).toBeTruthy();
  });
});

describe("validateContact", () => {
  it("requires a message of reasonable length", () => {
    const errors = validateContact({ name: "Jo", contact: "jo@mail.com", message: "hi" });
    expect(errors.message).toBeTruthy();
  });
  it("passes a valid message", () => {
    const errors = validateContact({
      name: "Jo",
      contact: "jo@mail.com",
      message: "I'd like to ask about diving next week.",
    });
    expect(hasErrors(errors)).toBe(false);
  });
});

describe("localised messages", () => {
  /**
   * The messages used to be hardcoded English, so a French visitor was told in
   * English what they had got wrong — on a French-first site, at the exact
   * moment they were stuck. These assert the actual strings, not just that
   * something truthy came back, so a hardcoded `return "…"` cannot come back
   * unnoticed.
   */
  it("returns French messages when given the French dictionary", () => {
    const errors = validateRecovery(
      { name: "", contact: "", object: "", location: "", lostAt: "" },
      fr.forms.validation,
    );
    expect(errors.name).toBe("Indiquez-nous votre nom.");
    expect(errors.object).toBe("Qu'avez-vous perdu ?");
    expect(errors.contact).toBe("Un téléphone, WhatsApp ou e-mail est nécessaire.");
  });

  it("localises the invalid-contact message too, not just the missing one", () => {
    const errors = validateContact(
      { name: "Alex", contact: "nope", message: "Bonjour, j'ai une question." },
      fr.forms.validation,
    );
    expect(errors.contact).toBe(fr.forms.validation.contactInvalid);
  });

  it("still defaults to English when no dictionary is passed", () => {
    const errors = validateContact({ name: "", contact: "", message: "" });
    expect(errors.name).toBe(en.forms.validation.name);
  });

  it("keeps both dictionaries filled — an empty string would render as no error", () => {
    for (const dict of [en, fr]) {
      for (const [key, message] of Object.entries(dict.forms.validation)) {
        expect(message.trim(), `${key} must not be blank`).not.toBe("");
      }
    }
  });
});
