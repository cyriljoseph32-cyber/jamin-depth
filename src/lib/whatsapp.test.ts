import { describe, it, expect } from "vitest";
import {
  buildWaLink,
  buildMailto,
  recoverySummary,
  recoveryPrefill,
  divingPrefill,
  contactSummary,
} from "./whatsapp";
import { SITE } from "@/content/site";

describe("buildWaLink", () => {
  it("returns the bare business link with no message", () => {
    expect(buildWaLink()).toBe(`https://wa.me/${SITE.phoneE164}`);
  });

  it("encodes the message into the text query param", () => {
    const link = buildWaLink("Hello there & friends");
    expect(link.startsWith(`https://wa.me/${SITE.phoneE164}?text=`)).toBe(true);
    expect(link).toContain("Hello%20there%20%26%20friends");
  });

  it("targets the verified E.164 number without a plus or spaces", () => {
    expect(SITE.phoneE164).toBe("66633753316");
    expect(buildWaLink()).not.toContain("+");
    expect(buildWaLink()).not.toContain(" ");
  });
});

describe("recoverySummary", () => {
  it("includes all provided fields in order and skips empty optionals", () => {
    const msg = recoverySummary({
      name: "Alex",
      contact: "+66 63 375 3316",
      object: "Gold ring",
      location: "Chaweng pier north side",
      lostAt: "Today 14:00",
      depth: "",
      conditions: "",
    });
    expect(msg).toContain("Object: Gold ring");
    expect(msg).toContain("Location: Chaweng pier north side");
    expect(msg).toContain("Name: Alex");
    expect(msg).not.toContain("Estimated depth:");
    expect(msg).not.toContain("Conditions:");
    expect(msg.startsWith(`Hello ${SITE.name}`)).toBe(true);
  });

  it("keeps optional lines when present", () => {
    const msg = recoverySummary({
      name: "Sam",
      contact: "sam@mail.com",
      object: "GoPro",
      location: "reef",
      lostAt: "yesterday",
      depth: "6 m",
      conditions: "calm",
    });
    expect(msg).toContain("Estimated depth: 6 m");
    expect(msg).toContain("Conditions: calm");
  });
});

describe("prefills", () => {
  it("recovery prefill mentions the business and location", () => {
    const p = recoveryPrefill();
    expect(p).toContain(SITE.name);
    expect(p).toContain(SITE.location);
    expect(p).toContain("[object]");
  });

  it("diving prefill mentions diving", () => {
    expect(divingPrefill().toLowerCase()).toContain("diving");
  });
});

describe("contactSummary", () => {
  it("includes name, contact and message body", () => {
    const msg = contactSummary({ name: "Jo", contact: "jo@mail.com", message: "Question about diving" });
    expect(msg).toContain("Name: Jo");
    expect(msg).toContain("Contact: jo@mail.com");
    expect(msg).toContain("Question about diving");
  });
});

describe("buildMailto", () => {
  it("targets the business email with encoded subject and body", () => {
    const link = buildMailto("Recovery request", "Object: ring");
    expect(link.startsWith(`mailto:${SITE.email}?`)).toBe(true);
    expect(link).toContain("subject=Recovery+request");
    expect(link).toContain("body=Object%3A+ring");
  });
});
