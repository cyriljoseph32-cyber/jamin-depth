import type { AgentName, ApproverRole, Priority, ProposedAction } from "./types";
import type { Clock } from "./audit";
import { systemClock } from "./audit";

/**
 * The human validation queue.
 *
 * This is where the mandate becomes concrete: an action that needs a person
 * lands here and does nothing until someone releases it. There is no timeout
 * that auto-approves, and no "urgent" flag that bypasses the queue — urgency
 * changes the ORDER, never the requirement.
 *
 * Asynchronous throughout, because the real implementation is a table in
 * Supabase (`adapters/supabase.ts`) that has to survive a redeploy. The
 * in-memory version below is for tests and for running with no credentials.
 */

export type QueueStatus = "pending" | "approved" | "rejected" | "expired";

export interface QueuedItem {
  id: string;
  eventId: string;
  agent: AgentName;
  action: ProposedAction;
  priority: Priority;
  approver: ApproverRole;
  reasons: readonly string[];
  /** What the reviewer reads first — one line, no context switching. */
  summary: string;
  queuedAt: string;
  status: QueueStatus;
  decidedBy?: string;
  decidedAt?: string;
  decisionNote?: string;
  /** Set once the released action actually ran, so nothing is sent twice. */
  executedAt?: string;
}

export interface EnqueueInput {
  eventId: string;
  agent: AgentName;
  action: ProposedAction;
  priority: Priority;
}

export interface ApprovalQueue {
  enqueue(input: EnqueueInput): Promise<QueuedItem>;
  get(id: string): Promise<QueuedItem | undefined>;
  /** Pending items, most urgent first, oldest first within a priority. */
  pending(approver?: ApproverRole): Promise<readonly QueuedItem[]>;
  approve(id: string, by: string, note?: string): Promise<QueuedItem | undefined>;
  reject(id: string, by: string, note?: string): Promise<QueuedItem | undefined>;
  /** Stamped after execution — the guard against a double send. */
  markExecuted(id: string, at: string): Promise<QueuedItem | undefined>;
  all(): Promise<readonly QueuedItem[]>;
}

export const PRIORITY_ORDER: Record<Priority, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };

/** Shared ordering so every implementation presents the same queue. */
export function byUrgency(a: QueuedItem, b: QueuedItem): number {
  return (
    PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
    a.queuedAt.localeCompare(b.queuedAt) ||
    a.id.localeCompare(b.id)
  );
}

export function createApprovalQueue(clock: Clock = systemClock): ApprovalQueue {
  const items = new Map<string, QueuedItem>();
  let seq = 0;

  function decide(id: string, status: QueueStatus, by: string, note?: string): QueuedItem | undefined {
    const item = items.get(id);
    // Deciding twice is a bug in the caller, not something to silently accept.
    if (!item || item.status !== "pending") return undefined;
    const decided: QueuedItem = {
      ...item,
      status,
      decidedBy: by,
      decidedAt: clock(),
      decisionNote: note,
    };
    items.set(id, decided);
    return decided;
  }

  return {
    async enqueue({ eventId, agent, action, priority }) {
      seq += 1;
      const item: QueuedItem = {
        id: `q-${seq}`,
        eventId,
        agent,
        action,
        priority,
        approver: action.approval?.approver ?? "owner",
        reasons: action.approval?.reasons ?? ["rule:unclassified"],
        summary: action.summary,
        queuedAt: clock(),
        status: "pending",
      };
      items.set(item.id, item);
      return item;
    },
    async get(id) {
      return items.get(id);
    },
    async pending(approver) {
      return [...items.values()]
        .filter((i) => i.status === "pending" && (approver === undefined || i.approver === approver))
        .sort(byUrgency);
    },
    async approve(id, by, note) {
      return decide(id, "approved", by, note);
    },
    async reject(id, by, note) {
      return decide(id, "rejected", by, note);
    },
    async markExecuted(id, at) {
      const item = items.get(id);
      if (!item) return undefined;
      const updated: QueuedItem = { ...item, executedAt: at };
      items.set(id, updated);
      return updated;
    },
    async all() {
      return [...items.values()];
    },
  };
}

/** One-screen digest of what is waiting, for the daily internal message. */
export async function formatPending(queue: ApprovalQueue): Promise<string> {
  const pending = await queue.pending();
  if (pending.length === 0) return "Rien en attente de validation.";
  return pending
    .map((i) => `${i.priority} · ${i.id} · ${i.action.type} — ${i.summary} [${i.reasons.join(", ")}]`)
    .join("\n");
}
