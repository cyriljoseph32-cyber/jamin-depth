import { describe, expect, it } from "vitest";
import { POLICIES, openGaps, isTodo } from "./config";

/**
 * Discovery Divers' cancellation, flying-after-diving and medical-questionnaire
 * procedure came from the partner centre's own printed form, photographed and
 * handed over directly by the owner — a primary source, not the reseller pages
 * `AUDIT.md` already flagged as non-operative. This locks the config change in.
 */
describe("Discovery Divers confirmed policies", () => {
  it("no longer leaves cancellation or flyingAfterDiving open", () => {
    expect(isTodo(POLICIES.cancellation)).toBe(false);
    expect(isTodo(POLICIES.flyingAfterDiving)).toBe(false);
    const gaps = openGaps();
    expect(gaps).not.toContain("policies.cancellation");
    expect(gaps).not.toContain("policies.flyingAfterDiving");
  });

  it("states the 24-hour rule and the same-day-flight rule in figures", () => {
    expect(POLICIES.cancellation).toContain("24h");
    expect(POLICIES.cancellation).toContain("100%");
    expect(POLICIES.flyingAfterDiving).toContain("18h");
    expect(POLICIES.flyingAfterDiving).toContain("300 m");
  });

  it("keeps the medical protocol honest about what is still unconfirmed", () => {
    expect(POLICIES.medicalProtocol).toContain("NON COUVERT");
    expect(POLICIES.medicalProtocol).toContain("Diver Medical Questionnaire");
  });
});
