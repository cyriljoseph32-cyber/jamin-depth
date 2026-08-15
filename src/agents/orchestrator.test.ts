import { describe, expect, it } from "vitest";
import { createAuditLog } from "./audit";
import { createMockPorts, type MessagingPort } from "./adapters";
import { classify, createOrchestrator, readSignals } from "./orchestrator";
import type { Agent, Channel, InboundEvent } from "./types";

const NOW = "2026-03-11T09:00:00.000Z";
let counter = 0;

function event(text: string, over: Partial<InboundEvent> = {}): InboundEvent {
  counter += 1;
  return {
    id: `evt-${counter}`,
    channel: "whatsapp",
    receivedAt: NOW,
    from: { name: "Marie Dupont", phone: "+33612345678" },
    text,
    ...over,
  };
}

/** A stable clock keeps queue ids and audit lines comparable across runs. */
function harness(deps: Parameters<typeof createOrchestrator>[0] = {}) {
  const clock = () => NOW;
  const ports = createMockPorts(clock);
  return {
    bus: createOrchestrator({ ports, log: createAuditLog(clock), clock, ...deps }),
    ports,
    sent: () => (ports.messaging as MessagingPort & { sent: { body: string; channel: Channel }[] }).sent,
  };
}

describe("classify", () => {
  const kindOf = (text: string, over?: Partial<InboundEvent>) => {
    const e = event(text, over);
    return classify(e, readSignals(e));
  };

  it("puts safety above everything else", () => {
    // A complete booking request that also mentions asthma is a safety event.
    expect(kindOf("Baptême pour 2 le 14/03, je suis asthmatique")).toBe("safety");
  });

  it("separates an incident from an ordinary safety question", () => {
    expect(kindOf("il y a eu un accident, on a besoin de secours")).toBe("incident");
    expect(kindOf("je ne sais pas nager, est-ce grave ?")).toBe("safety");
  });

  it("recognises a review by channel or by rating", () => {
    expect(kindOf("Superbe journée", { channel: "google_business" })).toBe("review");
    expect(kindOf("Great dive", { meta: { rating: "5" } })).toBe("review");
  });

  it("routes internal messages by their subject", () => {
    expect(kindOf("prépare un article pour la page plongée", { channel: "internal" })).toBe("content");
    expect(kindOf("sors le rapport de la semaine", { channel: "internal" })).toBe("report");
    expect(kindOf("penser à réparer le détendeur", { channel: "internal" })).toBe("internal_task");
  });

  it("only calls it a booking when the partner could actually answer", () => {
    // Complete: date, activity, party size, level implied by the activity.
    expect(kindOf("Baptême le 14/03 pour 2 personnes")).toBe("booking");
    // Explicit intent is enough on its own.
    expect(kindOf("On réserve Sail Rock le 14/03")).toBe("booking");
    // Incomplete: no party size, no level → still qualification.
    expect(kindOf("une sortie plongée le 14/03 ?")).toBe("lead");
  });

  it("keeps a recovery request out of the booking flow", () => {
    expect(kindOf("j'ai perdu mon alliance le 14/03, 2 personnes étaient là")).toBe("lead");
  });
});

describe("orchestrator", () => {
  it("never sends a WhatsApp reply by itself — it queues the draft", async () => {
    const { bus, sent } = harness();
    const run = await bus.handle(event("Bonjour, un baptême pour 2 le 14/03 ?"));

    const message = run.queued.find((q) => q.action.type === "send_message");
    expect(message).toBeDefined();
    expect(message?.reasons).toContain("rule:channel-draft-only");
    // The only thing that left the building is the internal escalation, if any.
    expect(sent().filter((m) => m.channel === "whatsapp")).toEqual([]);
  });

  it("records the lead without asking anyone", async () => {
    const { bus, ports } = harness();
    await bus.handle(event("Bonjour, on aimerait plonger, on est 2 certifiés"));
    const leads = await ports.crm.all();
    expect(leads).toHaveLength(1);
    expect(leads[0]).toMatchObject({ partySize: 2, certified: true, channel: "whatsapp" });
  });

  it("gives every action a verdict — nothing escapes both gates", async () => {
    const { bus } = harness();
    const run = await bus.handle(event("Baptême le 14/03 pour 2 personnes"));
    const all = [...run.executed, ...run.queued.map((q) => q.action), ...run.skipped.map((s) => s.action)];
    expect(all.length).toBe(run.outcome?.actions.length);
    for (const action of all) expect(action.approval).toBeDefined();
  });

  it("queues the confirmation and the calendar write, and asks the partner", async () => {
    const { bus } = harness();
    const run = await bus.handle(event("Baptême le 14/03 pour 2 personnes"));
    const types = run.queued.map((q) => q.action.type);
    expect(types).toContain("supplier_message");
    expect(types).toContain("confirm_booking");
    expect(types).toContain("create_calendar_event");

    const confirm = run.queued.find((q) => q.action.type === "confirm_booking");
    expect(confirm?.reasons).toContain("rule:unverified-availability");
  });

  it("ignores a repeated event", async () => {
    const { bus } = harness();
    const first = event("Baptême pour 2 le 14/03");
    const again = await bus.handle(first).then(() => bus.handle(first));
    expect(again.duplicate).toBe(true);
    expect(again.queued).toEqual([]);
  });

  it("ignores the same text sent twice in one thread", async () => {
    const { bus } = harness();
    const text = "Bonjour, vous plongez demain ?";
    await bus.handle(event(text, { threadId: "t-1" }));
    const second = await bus.handle(event(text, { threadId: "t-1", receivedAt: "2026-03-11T09:02:00.000Z" }));
    expect(second.duplicate).toBe(true);
  });

  it("blocks a rogue draft instead of sending it", async () => {
    // A deliberately misbehaving agent: the guard, not the agent, is under test.
    const rogue: Agent = {
      name: "reception",
      handle: (e) => ({
        agent: "reception",
        eventId: e.id,
        kind: "lead",
        priority: "P2",
        actions: [
          {
            id: "rogue-1",
            type: "send_message",
            summary: "réponse trop confiante",
            risk: "low",
            draft: {
              channel: "site_chat",
              to: e.from,
              locale: "fr",
              body: "C'est confirmé pour samedi, et la météo sera parfaite.",
              templateId: "rogue",
            },
          },
        ],
        gaps: [],
        notes: [],
      }),
    };

    const { bus, sent } = harness({ routes: { lead: rogue, question: rogue, unknown: rogue } });
    const run = await bus.handle(event("une sortie plongée bientôt ?"));

    expect(run.blocked).toHaveLength(1);
    expect(run.blocked[0]?.violations.map((v) => v.rule)).toEqual(
      expect.arrayContaining(["guard:availability", "guard:weather"]),
    );
    // Blocked means queued for a human, never softened and never sent.
    expect(run.queued.map((q) => q.action.id)).toContain("rogue-1");
    expect(sent().some((m) => m.body.includes("météo"))).toBe(false);
  });

  it("caps follow-ups at two per lead", async () => {
    const { bus } = harness();
    const from = { name: "Paul", phone: "+33698765432" };
    const texts = ["vous plongez ?", "toujours dispo ?", "et finalement ?"];
    const results = [];
    for (const [i, text] of texts.entries()) {
      results.push(
        await bus.handle(
          event(text, { from, threadId: "t-cap", receivedAt: `2026-03-1${i + 1}T09:00:00.000Z` }),
        ),
      );
    }
    // First two schedule a nudge; the third is refused by the cap.
    const third = results[2];
    expect(third?.skipped.map((s) => s.reason).join(" ")).toMatch(/cap/);
  });

  it("writes an audit trail that names the rule", async () => {
    const { bus } = harness();
    await bus.handle(event("je suis enceinte, je peux faire un baptême ?"));
    const trail = bus.log.format();
    expect(trail).toMatch(/classified/);
    expect(trail).toMatch(/pregnancy/);
    expect(trail).toMatch(/escalated/);
  });
});
