import { describe, expect, it } from "vitest";
import { createAuditLog } from "./audit";
import { createMockPorts, type Lead, type MessagingPort } from "./adapters";
import { createApprovalQueue } from "./queue";
import { dueFollowUps, runJob, tomorrowInBangkok, weekStartInBangkok } from "./schedule";
import type { MessageDraft } from "./types";

/** 09:00 UTC = 16:00 in Bangkok — inside working hours. */
const NOW = "2026-03-11T09:00:00.000Z";
/** 15:00 UTC = 22:00 in Bangkok — inside the quiet window. */
const NIGHT = "2026-03-11T15:00:00.000Z";

function lead(over: Partial<Lead> = {}): Lead {
  return {
    id: "lead-1",
    key: "phone:33612345678",
    contact: { name: "Marie", phone: "+33612345678" },
    channel: "whatsapp",
    locale: "fr",
    dates: [],
    stage: "qualified",
    sensitiveTopics: [],
    followUps: 0,
    notes: [],
    createdAt: "2026-03-09T09:00:00.000Z",
    updatedAt: "2026-03-09T09:00:00.000Z",
    ...over,
  };
}

function harness(now = NOW) {
  const clock = () => now;
  const ports = createMockPorts(clock);
  const queue = createApprovalQueue(clock);
  const log = createAuditLog(clock);
  const sent = (ports.messaging as MessagingPort & { sent: MessageDraft[] }).sent;
  return { deps: { ports, queue, log, now }, ports, queue, sent };
}

describe("dueFollowUps", () => {
  it("nudges a lead that has gone quiet past the first threshold", () => {
    // Last touched 48 h ago, threshold is 24 h.
    const due = dueFollowUps([lead()], NOW);
    expect(due).toHaveLength(1);
    expect(due[0]?.attempt).toBe(1);
  });

  it("waits for the threshold", () => {
    expect(dueFollowUps([lead({ updatedAt: "2026-03-11T06:00:00.000Z" })], NOW)).toEqual([]);
  });

  it("uses the longer wait for the second nudge", () => {
    const oneDone = lead({ followUps: 1, lastFollowUpAt: "2026-03-10T09:00:00.000Z" });
    // 24 h since the first nudge, but the second waits 72 h.
    expect(dueFollowUps([oneDone], NOW)).toEqual([]);
    expect(dueFollowUps([oneDone], "2026-03-14T09:00:00.000Z")).toHaveLength(1);
  });

  it("stops at two, forever", () => {
    expect(dueFollowUps([lead({ followUps: 2, lastFollowUpAt: "2026-01-01T00:00:00.000Z" })], NOW)).toEqual([]);
  });

  it("never chases someone with a flagged safety topic", () => {
    // Somebody waiting on a medical answer must not get "still interested?".
    expect(dueFollowUps([lead({ sensitiveTopics: ["medical"] })], NOW)).toEqual([]);
  });

  it("leaves alone the stages where the ball is not in the client's court", () => {
    for (const stage of ["awaiting_partner", "won", "lost", "escalated"] as const) {
      expect(dueFollowUps([lead({ stage })], NOW), stage).toEqual([]);
    }
  });
});

describe("runJob('follow-ups')", () => {
  it("says nothing at 22:00 local", async () => {
    const { deps } = harness(NIGHT);
    const result = await runJob("follow-ups", deps);
    expect(result.queued).toBe(0);
    expect(result.details.join(" ")).toMatch(/Heures calmes/);
  });

  it("queues the nudge for approval rather than sending it", async () => {
    const { deps, ports, queue } = harness();
    await ports.crm.upsert({
      contact: { name: "Marie", phone: "+33612345678" },
      channel: "whatsapp",
      locale: "fr",
      dates: [],
      stage: "qualified",
      sensitiveTopics: [],
    });
    // Age the lead past the threshold.
    const stored = (await ports.crm.all())[0];
    if (!stored) throw new Error("lead expected");
    Object.assign(stored, { updatedAt: "2026-03-09T09:00:00.000Z" });

    const result = await runJob("follow-ups", deps);
    expect(result.queued).toBe(1);
    const pending = await queue.pending();
    expect(pending[0]?.action.type).toBe("send_message");
    expect(pending[0]?.reasons).toContain("rule:channel-draft-only");
  });

  it("counts the nudge even while it waits, so the hourly run does not re-queue it", async () => {
    const { deps, ports, queue } = harness();
    await ports.crm.upsert({
      contact: { name: "Marie", phone: "+33612345678" },
      channel: "whatsapp",
      locale: "fr",
      dates: [],
      stage: "qualified",
      sensitiveTopics: [],
    });
    const stored = (await ports.crm.all())[0];
    if (!stored) throw new Error("lead expected");
    Object.assign(stored, { updatedAt: "2026-03-09T09:00:00.000Z" });

    await runJob("follow-ups", deps);
    await runJob("follow-ups", deps);
    expect((await queue.pending()).length).toBe(1);
  });
});

describe("runJob('daily-brief')", () => {
  it("delivers the brief internally, without asking anyone", async () => {
    const { deps, sent } = harness();
    const result = await runJob("daily-brief", deps);
    // Internal, staff-facing, reversible: it executes.
    expect(result.executed).toBeGreaterThan(0);
    expect(sent.some((m) => m.channel === "internal")).toBe(true);
  });
});

describe("runJob('weekly-report')", () => {
  it("delivers the report and queues the message to the partner", async () => {
    const { deps, queue } = harness();
    const result = await runJob("weekly-report", deps);
    expect(result.executed).toBeGreaterThan(0);

    // The gap list travels with the message that closes it — and that message is
    // an external commitment, so it waits for a human.
    const pending = await queue.pending();
    const supplier = pending.find((p) => p.action.type === "supplier_message");
    expect(supplier).toBeDefined();
    expect(supplier?.reasons).toContain("rule:external-commitment");
    expect(supplier?.action.draft?.body).toMatch(/medical condition/i);
  });
});

describe("Bangkok dates", () => {
  it("reads tomorrow and the week start in local time, not UTC", () => {
    // 20:00 UTC is already the next day in Bangkok.
    expect(tomorrowInBangkok("2026-03-11T20:00:00.000Z")).toBe("2026-03-13");
    expect(tomorrowInBangkok("2026-03-11T09:00:00.000Z")).toBe("2026-03-12");
    // 11 March 2026 is a Wednesday; the week starts on Monday the 9th.
    expect(weekStartInBangkok(NOW)).toBe("2026-03-09");
    // Sunday must resolve back to the Monday before, not forward.
    expect(weekStartInBangkok("2026-03-15T09:00:00.000Z")).toBe("2026-03-09");
  });
});
