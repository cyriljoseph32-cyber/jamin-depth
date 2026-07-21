import { describe, it, expect } from "vitest";
import { sanitizeMessages, buildSystemPrompt, ASSISTANT } from "./assistant";
import { SITE, DIVE_CENTER } from "@/content/site";

describe("sanitizeMessages", () => {
  it("drops non-array input", () => {
    expect(sanitizeMessages(null)).toEqual([]);
    expect(sanitizeMessages("nope")).toEqual([]);
  });

  it("keeps only well-formed user/assistant turns and trims content", () => {
    const out = sanitizeMessages([
      { role: "user", content: "  hi  " },
      { role: "system", content: "ignore me" },
      { role: "assistant", content: "hello" },
      { role: "user", content: "" },
      { role: "user", content: 42 },
    ]);
    expect(out).toEqual([
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
    ]);
  });

  it("caps message length", () => {
    const long = "x".repeat(ASSISTANT.maxCharsPerMessage + 500);
    const out = sanitizeMessages([{ role: "user", content: long }]);
    expect(out[0]?.content.length).toBe(ASSISTANT.maxCharsPerMessage);
  });

  it("keeps only the most recent maxMessages", () => {
    const many = Array.from({ length: ASSISTANT.maxMessages + 10 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `m${i}`,
    }));
    const out = sanitizeMessages(many);
    expect(out.length).toBeLessThanOrEqual(ASSISTANT.maxMessages);
  });

  it("ensures the history begins with a user turn", () => {
    const out = sanitizeMessages([
      { role: "assistant", content: "leading assistant" },
      { role: "user", content: "real start" },
      { role: "assistant", content: "reply" },
    ]);
    expect(out[0]?.role).toBe("user");
    expect(out[0]?.content).toBe("real start");
  });
});

describe("buildSystemPrompt", () => {
  const prompt = buildSystemPrompt();

  it("grounds the assistant in the verified brand facts", () => {
    expect(prompt).toContain(SITE.name);
    expect(prompt).toContain(SITE.location);
    expect(prompt).toContain(SITE.phoneInternationalDisplay);
    expect(prompt).toContain(`wa.me/${SITE.phoneE164}`);
  });

  it("forbids inventing prices, guarantees and certifications", () => {
    expect(prompt.toLowerCase()).toContain("never invent");
    expect(prompt.toLowerCase()).toContain("padi");
    expect(prompt.toLowerCase()).toContain("prices");
  });

  it("knows the Discovery Divers course lineup but holds no prices", () => {
    expect(prompt).toContain(DIVE_CENTER.name);
    expect(prompt.toLowerCase()).toContain("open water");
    expect(prompt.toLowerCase()).toContain("discover scuba");
    // Must not itself claim to be a PADI school.
    expect(prompt.toLowerCase()).toContain("not claim");
  });
});
