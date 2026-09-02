import type { ApprovalVerdict, LeadSignals } from "./types";

/**
 * Numeric confidence (0-100) for one agent's proposal, built only from
 * signals the rest of this system already computes — nothing here is a fresh
 * heuristic invented for this file.
 *
 * Base 50, four independently-justified adjustments, then a hard cap:
 *
 *   1. Signal completeness (±30) — the share of `LeadSignals.{activity,
 *      dates, partySize, certified}` (the four facts a reply actually
 *      depends on) that reception managed to read out of the message. More
 *      known → less the agent is guessing.
 *   2. Language detection (±15) — `detectLanguage()`'s own "high"/"low"
 *      verdict (`language.ts`) on whether the reply is even in the right
 *      language.
 *   3. Policy verdict (±15, no cap yet) — `policy.ts::requiresHumanApproval()`
 *      already judged this exact action; `required: false` (reversible /
 *      cleared) is a vote of confidence from the one file whose job is
 *      judging that, `required: true` costs a small penalty on top of the
 *      hard cap below.
 *   4. Unverified facts (+10 / up to -30) — `outcome.gaps` is already the
 *      list of `Verified<T> === "TODO"` policy facts the reply needed and
 *      could not state (see `config.ts`); each one is a fact the agent is
 *      choosing not to know, so more of them can only pull confidence down.
 *
 * The four components are clamped to [0, 100]. Separately — and this is the
 * point of the whole exercise — whenever `verdict.required` is true the
 * score is capped at `APPROVAL_REQUIRED_CONFIDENCE_CAP` regardless of how
 * well the other three components score: `policy.ts` asked for a human
 * precisely because the system is not sure enough to act alone, so the
 * number itself must never claim otherwise.
 */
export const APPROVAL_REQUIRED_CONFIDENCE_CAP = 74;

const RELEVANT_SIGNAL_FIELDS = ["activity", "dates", "partySize", "certified"] as const;

function signalCompleteness(signals: LeadSignals): number {
  const present = RELEVANT_SIGNAL_FIELDS.filter((field) => {
    const value = signals[field];
    return Array.isArray(value) ? value.length > 0 : value !== undefined;
  }).length;
  return present / RELEVANT_SIGNAL_FIELDS.length;
}

export interface ConfidenceInputs {
  signals: LeadSignals;
  /** `outcome.gaps` — unverified (`TODO`) policy facts the reply needed. */
  gaps: readonly string[];
  /** `detectLanguage(event.text, event.locale).confidence` for this event. */
  languageConfidence?: "high" | "low";
  /** This action's verdict from `requiresHumanApproval()`, once known. */
  verdict?: ApprovalVerdict;
}

export function computeConfidence({ signals, gaps, languageConfidence, verdict }: ConfidenceInputs): number {
  let score = 50;

  score += Math.round(30 * signalCompleteness(signals));

  if (languageConfidence === "high") score += 15;
  else if (languageConfidence === "low") score -= 15;

  if (verdict) score += verdict.required ? -10 : 15;

  score += gaps.length === 0 ? 10 : -Math.min(gaps.length * 8, 30);

  score = Math.max(0, Math.min(100, score));

  if (verdict?.required) score = Math.min(score, APPROVAL_REQUIRED_CONFIDENCE_CAP);

  return score;
}
