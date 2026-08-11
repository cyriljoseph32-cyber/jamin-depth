import { ASSISTANT } from "@/lib/assistant";
import { auditDraft } from "./policy";

/**
 * The (deliberately small) place a language model is allowed to act.
 *
 * Classification, extraction, routing and policy are all rule-based, so a
 * normal enquiry costs zero tokens. The model is used for one thing only:
 * rewriting an already-approved, already-grounded draft so it reads naturally —
 * and its output is re-audited by `auditDraft()` before anyone sees it. If the
 * rewrite introduces a promise, the original template text is kept.
 *
 * Consequences worth stating: no client message is ever answered by free-form
 * generation, and the system works end to end with no API key at all.
 */

export interface LlmRequest {
  system: string;
  /** The draft to improve, plus any grounding notes. Never raw customer text alone. */
  user: string;
  maxTokens: number;
}

export interface LlmClient {
  /** Returns the completion text, or null when unavailable/over budget. */
  complete(req: LlmRequest): Promise<string | null>;
}

/**
 * Token budget. `perEventCalls: 1` is the important number — an agent may
 * polish one message per inbound event, not iterate.
 */
export const LLM_BUDGET = {
  model: ASSISTANT.model,
  perEventCalls: 1,
  maxOutputTokens: 320,
  /** Longer inbound text is truncated rather than paid for in full. */
  maxInputChars: 1200,
} as const;

/** The default: no model at all. The system must be fully functional here. */
export function createNoopLlm(): LlmClient {
  return { async complete() { return null; } };
}

/** Deterministic stand-in for tests. */
export function createStubLlm(reply: string | null): LlmClient & { calls: LlmRequest[] } {
  const calls: LlmRequest[] = [];
  return {
    calls,
    async complete(req) {
      calls.push(req);
      return reply;
    },
  };
}

/** Hard cap on calls per event, applied on top of any client. */
export function withCallBudget(client: LlmClient, maxCalls = LLM_BUDGET.perEventCalls): LlmClient {
  let used = 0;
  return {
    async complete(req) {
      if (used >= maxCalls) return null;
      used += 1;
      return client.complete({ ...req, user: req.user.slice(0, LLM_BUDGET.maxInputChars) });
    },
  };
}

const POLISH_SYSTEM = `You rewrite short customer messages for a small dive operation in Koh Samui.
Rules, absolute: keep every fact exactly as given, add nothing. Do not add prices, dates,
availability, weather, wildlife, response times, guarantees or medical opinions. Keep the same
language as the draft. Keep it under five sentences. No emoji, no markdown, no headings.
Return only the rewritten message.`;

/**
 * Improve a draft's phrasing without changing its content.
 *
 * Returns the original text unless the rewrite is non-empty AND passes the same
 * guard the template output passed. Any doubt keeps the template — a slightly
 * stiff sentence is not a risk; an invented one is.
 */
export async function polish(client: LlmClient, draft: string): Promise<string> {
  if (draft.trim().length === 0) return draft;
  const out = await client.complete({
    system: POLISH_SYSTEM,
    user: draft,
    maxTokens: LLM_BUDGET.maxOutputTokens,
  });
  if (!out) return draft;
  const cleaned = out.trim();
  if (cleaned.length === 0) return draft;
  return auditDraft(cleaned).length === 0 ? cleaned : draft;
}
