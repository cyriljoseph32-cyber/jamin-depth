import { describe, expect, it } from "vitest";
import { APPROVAL_REQUIRED_CONFIDENCE_CAP, computeConfidence } from "./confidence";
import type { ApprovalVerdict, LeadSignals } from "./types";

/** A fully-known lead: every field `computeConfidence()` looks at is present. */
const COMPLETE_SIGNALS: LeadSignals = {
  locale: "en",
  activity: "certified_fun_dive",
  dates: ["2026-09-10"],
  vagueDates: [],
  partySize: 2,
  certified: true,
  sensitiveTopics: [],
  policyQuestions: [],
  needsVerifiedData: false,
};

/** Almost nothing known — the reception agent is guessing. */
const SPARSE_SIGNALS: LeadSignals = {
  locale: "en",
  dates: [],
  vagueDates: ["next week"],
  sensitiveTopics: [],
  policyQuestions: ["cancellation"],
  needsVerifiedData: true,
};

const CLEARED: ApprovalVerdict = { required: false, reasons: [], approver: "none" };
const NEEDS_APPROVAL: ApprovalVerdict = {
  required: true,
  reasons: ["rule:booking-confirmation"],
  approver: "owner",
};

describe("computeConfidence", () => {
  it("scores high for complete data, a cleared verdict, known language and no gaps", () => {
    const score = computeConfidence({
      signals: COMPLETE_SIGNALS,
      gaps: [],
      languageConfidence: "high",
      verdict: CLEARED,
    });
    expect(score).toBeGreaterThanOrEqual(85);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("scores low for missing data, unresolved language and unverified (TODO) facts", () => {
    const score = computeConfidence({
      signals: SPARSE_SIGNALS,
      gaps: ["cancellation", "deposit"],
      languageConfidence: "low",
    });
    expect(score).toBeLessThan(40);
  });

  it("never exceeds the cap once a human approval is required, even with otherwise-perfect signals", () => {
    const score = computeConfidence({
      signals: COMPLETE_SIGNALS,
      gaps: [],
      languageConfidence: "high",
      verdict: NEEDS_APPROVAL,
    });
    expect(score).toBeLessThanOrEqual(APPROVAL_REQUIRED_CONFIDENCE_CAP);
  });

  it("caps every score in [0, 100] regardless of inputs", () => {
    const low = computeConfidence({ signals: SPARSE_SIGNALS, gaps: ["a", "b", "c", "d", "e"], languageConfidence: "low" });
    const high = computeConfidence({
      signals: COMPLETE_SIGNALS,
      gaps: [],
      languageConfidence: "high",
      verdict: CLEARED,
    });
    expect(low).toBeGreaterThanOrEqual(0);
    expect(high).toBeLessThanOrEqual(100);
  });

  it("rewards a cleared verdict over an unresolved one, all else equal", () => {
    const withoutVerdict = computeConfidence({ signals: COMPLETE_SIGNALS, gaps: [] });
    const cleared = computeConfidence({ signals: COMPLETE_SIGNALS, gaps: [], verdict: CLEARED });
    expect(cleared).toBeGreaterThan(withoutVerdict);
  });
});
