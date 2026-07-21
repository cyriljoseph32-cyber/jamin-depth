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
