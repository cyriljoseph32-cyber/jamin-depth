import { describe, expect, it } from "vitest";
import { createAuditLog } from "./audit";
import { createMockPorts, type MessagingPort } from "./adapters";
import { createApprovalQueue } from "./queue";
import { createOrchestrator, release } from "./orchestrator";
import type { InboundEvent, MessageDraft, ProposedAction } from "./types";

/**
 * Releasing an approved action — the path the Telegram buttons take.
 *
 * The promise under test: approving sends exactly what was shown, once, and
 * only if it is still safe to send.
 */

const NOW = "2026-03-11T09:00:00.000Z";

function harness() {
  const clock = () => NOW;
  const ports = createMockPorts(clock);
  const queue = createApprovalQueue(clock);
  const log = createAuditLog(clock);
  const bus = createOrchestrator({ ports, queue, log, clock });
  const sent = (ports.messaging as MessagingPort & { sent: MessageDraft[] }).sent;
  return { bus, ports, queue, log, sent, deps: { queue, ports, log, clock } };
}

const event: InboundEvent = {
  id: "wa:1",
  channel: "whatsapp",
  receivedAt: NOW,
  from: { name: "Marie", phone: "+33612345678" },
  // Complete enough to reach the booking agent: date, activity, party, level.
  text: "Bonjour, nous sommes 2, jamais plongé, un baptême le 14/03 ?",
};

describe("release", () => {
  it("sends the drafted reply when the owner approves", async () => {
    const { bus, queue, sent, deps } = harness();
    await bus.handle(event);

    const pending = await queue.pending();
    const reply = pending.find((p) => p.action.type === "send_message");
    if (!reply) throw new Error("expected a queued reply");

    // Nothing went out while it was waiting.
    expect(sent.filter((m) => m.channel === "whatsapp")).toEqual([]);

    const result = await release(reply.id, "approve", "telegram:cyril", deps);
    expect(result.status).toBe("sent");

    const delivered = sent.filter((m) => m.channel === "whatsapp");
    expect(delivered).toHaveLength(1);
    // What was approved is what was sent, byte for byte.
    expect(delivered[0]?.body).toBe(reply.action.draft?.body);

    const stored = await queue.get(reply.id);
    expect(stored?.status).toBe("approved");
    expect(stored?.decidedBy).toBe("telegram:cyril");
    expect(stored?.executedAt).toBe(NOW);
  });

  it("refuses a second tap instead of sending twice", async () => {
    const { bus, queue, sent, deps } = harness();
    await bus.handle(event);
    const reply = (await queue.pending()).find((p) => p.action.type === "send_message");
    if (!reply) throw new Error("expected a queued reply");

    await release(reply.id, "approve", "telegram:cyril", deps);
    const again = await release(reply.id, "approve", "telegram:cyril", deps);

    expect(again.status).toBe("already_decided");
    expect(sent.filter((m) => m.channel === "whatsapp")).toHaveLength(1);
  });

  it("records a rejection and sends nothing", async () => {
    const { bus, queue, sent, deps } = harness();
    await bus.handle(event);
    const reply = (await queue.pending()).find((p) => p.action.type === "send_message");
    if (!reply) throw new Error("expected a queued reply");

    const result = await release(reply.id, "reject", "telegram:cyril", deps);
    expect(result.status).toBe("rejected");
    expect(sent.filter((m) => m.channel === "whatsapp")).toEqual([]);
    expect((await queue.get(reply.id))?.status).toBe("rejected");
  });

  it("records — never performs — money and seat decisions", async () => {
    const { bus, queue, deps } = harness();
    await bus.handle(event);
    const confirm = (await queue.pending()).find((p) => p.action.type === "confirm_booking");
    if (!confirm) throw new Error("expected a queued confirmation");

    const result = await release(confirm.id, "approve", "telegram:cyril", deps);
    // Approving logs the decision; the act happens in the partner's system.
    expect(result.status).toBe("recorded");
    expect(result.detail).toMatch(/human-performed/);
    expect((await queue.get(confirm.id))?.executedAt).toBeUndefined();
  });

  it("re-checks the draft at send time and refuses to send a stale promise", async () => {
    // A draft can sit in the queue for hours. This one would now promise a seat.
    const { queue, sent, deps } = harness();
    const rogue: ProposedAction = {
      id: "rogue",
      type: "send_message",
      summary: "réponse trop confiante",
      risk: "low",
      draft: {
        channel: "whatsapp",
        to: { name: "Marie", phone: "+33612345678" },
        locale: "fr",
        body: "C'est confirmé pour samedi.",
        templateId: "rogue",
      },
      approval: { required: true, reasons: ["rule:channel-draft-only"], approver: "owner" },
    };
    const item = await queue.enqueue({ eventId: "wa:1", agent: "reception", action: rogue, priority: "P1" });

    const result = await release(item.id, "approve", "telegram:cyril", deps);
    expect(result.status).toBe("blocked");
    expect(result.detail).toMatch(/guard:availability/);
    expect(sent).toEqual([]);
  });

  it("reports an unknown id rather than failing silently", async () => {
    const { deps } = harness();
    expect((await release("does-not-exist", "approve", "telegram:cyril", deps)).status).toBe("not_found");
  });
});

describe("queue notification", () => {
  it("keeps the item when the notification fails", async () => {
    // A Telegram outage must not lose the queue.
    const clock = () => NOW;
    const ports = createMockPorts(clock);
    const queue = createApprovalQueue(clock);
    const bus = createOrchestrator({
      ports,
      queue,
      clock,
      log: createAuditLog(clock),
      onQueued: async () => {
        throw new Error("telegram down");
      },
    });

    const run = await bus.handle(event);
    expect(run.queued.length).toBeGreaterThan(0);
    expect((await queue.pending()).length).toBe(run.queued.length);
  });
});
