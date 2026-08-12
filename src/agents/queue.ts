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
 * In-memory today (the audit chose a pure library with no store). The interface
 * is what a Supabase or Notion-backed queue would implement later; nothing in
 * the agents changes when that happens.
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
}

export interface EnqueueInput {
  eventId: string;
  agent: AgentName;
  action: ProposedAction;
  priority: Priority;
}

export interface ApprovalQueue {
  enqueue(input: EnqueueInput): QueuedItem;
  get(id: string): QueuedItem | undefined;
  /** Pending items, most urgent first, oldest first within a priority. */
  pending(approver?: ApproverRole): readonly QueuedItem[];
  approve(id: string, by: string, note?: string): QueuedItem | undefined;
  reject(id: string, by: string, note?: string): QueuedItem | undefined;
  all(): readonly QueuedItem[];
}

const PRIORITY_ORDER: Record<Priority, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };

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
    enqueue({ eventId, agent, action, priority }) {
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
    get(id) {
      return items.get(id);
    },
    pending(approver) {
      return [...items.values()]
        .filter((i) => i.status === "pending" && (approver === undefined || i.approver === approver))
        .sort(
          (a, b) =>
            PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
            a.queuedAt.localeCompare(b.queuedAt) ||
            a.id.localeCompare(b.id),
        );
    },
    approve(id, by, note) {
      return decide(id, "approved", by, note);
    },
    reject(id, by, note) {
      return decide(id, "rejected", by, note);
    },
    all() {
      return [...items.values()];
    },
  };
}

/** One-screen digest of what is waiting, for the daily internal message. */
export function formatPending(queue: ApprovalQueue): string {
  const pending = queue.pending();
  if (pending.length === 0) return "Rien en attente de validation.";
  return pending
    .map((i) => `${i.priority} · ${i.id} · ${i.action.type} — ${i.summary} [${i.reasons.join(", ")}]`)
    .join("\n");
}
