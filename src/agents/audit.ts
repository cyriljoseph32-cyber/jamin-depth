import type { AgentName, AuditEntry } from "./types";

/**
 * The audit journal.
 *
 * Every decision the system takes is one line here, in the order it happened.
 * It exists so the owner can answer "why did it say that?" without reading
 * code, and so a wrong reply can be traced to the rule that allowed it.
 *
 * The clock is injected: tests get stable output, and a replayed event keeps
 * its original timestamps.
 */

export type Clock = () => string;

export const systemClock: Clock = () => new Date().toISOString();

export interface AuditLog {
  record(entry: Omit<AuditEntry, "at">): void;
  entries(): readonly AuditEntry[];
  /** Only the lines for one event — what an escalation briefing quotes. */
  forEvent(eventId: string): readonly AuditEntry[];
  /** Plain-text rendering for a human. */
  format(): string;
}

export function createAuditLog(clock: Clock = systemClock): AuditLog {
  const entries: AuditEntry[] = [];
  return {
    record(entry) {
      entries.push({ at: clock(), ...entry });
    },
    entries() {
      return entries;
    },
    forEvent(eventId) {
      return entries.filter((e) => e.eventId === eventId);
    },
    format() {
      return entries.map((e) => `${e.at} [${e.eventId}] ${e.agent}/${e.step}: ${e.detail}`).join("\n");
    },
  };
}

/** Steps used across the system. Kept as a union so a typo shows up in review. */
export const auditSteps = [
  "received",
  "classified",
  "duplicate",
  "routed",
  "proposed",
  "queued",
  "released",
  "blocked",
  "escalated",
  "executed",
  "skipped",
] as const;
export type AuditStep = (typeof auditSteps)[number];

/** Small helper so call sites read as one line. */
export function note(
  log: AuditLog,
  eventId: string,
  agent: AgentName,
  step: AuditStep,
  detail: string,
): void {
  log.record({ eventId, agent, step, detail });
}
