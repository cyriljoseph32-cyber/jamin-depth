import { describe, expect, it } from "vitest";
import { createAuditLog } from "./audit";
import { createMockPorts, type MessagingPort } from "./adapters";
import { nextDayBrief } from "./roles/booking";
import { weeklyReport } from "./roles/ops";
import { createOrchestrator } from "./orchestrator";
import type { InboundEvent, MessageDraft } from "./types";

/**
 * End-to-end journeys.
 *
 * This file doubles as the readable specification: each test is one real
 * situation the dive centre lives through, and the assertions are the promises
 * the system makes to the owner. If a future change breaks one of these, it
 * broke a promise, not a detail.
 */

const NOW = "2026-03-11T09:00:00.000Z";

function harness() {
  const clock = () => NOW;
  const ports = createMockPorts(clock);
  const bus = createOrchestrator({ ports, log: createAuditLog(clock), clock });
  const messaging = ports.messaging as MessagingPort & { sent: MessageDraft[] };
  return { bus, ports, sent: messaging.sent };
}

function event(over: Partial<InboundEvent> & Pick<InboundEvent, "id" | "text">): InboundEvent {
  return {
    channel: "whatsapp",
    receivedAt: NOW,
    from: { name: "Client", phone: "+33600000000" },
    ...over,
  };
}

describe("scénario 1 — baptême francophone complet sur WhatsApp", () => {
  it("prépare tout, ne confirme rien", async () => {
    const { bus, sent } = harness();
    const run = await bus.handle(
      event({
        id: "s1",
        text: "Bonjour ! Nous sommes 2, on n'a jamais plongé. Un baptême serait possible le 14/03 ?",
        from: { name: "Marie Dupont", phone: "+33612345678" },
      }),
    );

    expect(run.kind).toBe("booking");
    expect(run.signals).toMatchObject({ locale: "fr", partySize: 2, certified: false, dates: ["2026-03-14"] });

    // The partner is asked, in English, with the full recap.
    const supplier = run.queued.find((q) => q.action.type === "supplier_message");
    expect(supplier?.action.draft?.locale).toBe("en");
    expect(supplier?.action.draft?.body).toContain("Discover Scuba Diving");

    // The client gets a French recap that says the seat is not held.
    const reply = run.queued.find((q) => q.action.type === "send_message");
    expect(reply?.action.draft?.locale).toBe("fr");
    expect(reply?.action.draft?.body).toContain("pas encore acquise");
    expect(reply?.action.draft?.body).toContain("Baptême");
    expect(reply?.action.draft?.body).toContain("฿5,850");

    // Confirmation and calendar write wait for a human, with the reason stated.
    const confirm = run.queued.find((q) => q.action.type === "confirm_booking");
    expect(confirm?.reasons).toContain("rule:unverified-availability");

    // Nothing at all reached the client automatically.
    expect(sent.filter((m) => m.channel === "whatsapp")).toEqual([]);
  });
});

describe("scénario 2 — voyageur indien anglophone sur Instagram", () => {
  it("répond en anglais simple, avec le tarif vérifié et deux questions au maximum", async () => {
    const { bus } = harness();
    const run = await bus.handle(
      event({
        id: "s2",
        channel: "instagram",
        text: "Hi! We are Open Water certified. Interested in a fun dive at Sail Rock. How much?",
        from: { name: "Arjun", handle: "@arjun" },
      }),
    );

    expect(run.kind).toBe("lead");
    const reply = run.queued.find((q) => q.action.type === "send_message");
    const body = reply?.action.draft?.body ?? "";
    expect(reply?.action.draft?.locale).toBe("en");
    expect(body).toContain("฿4,550");
    expect(body).toContain("Sail Rock");
    // One question block, and it asks for at most two things.
    expect(body.match(/\?/g)?.length ?? 0).toBeLessThanOrEqual(1);
    expect(body).toMatch(/your dates/);
  });
});

describe("scénario 3 — question médicale", () => {
  it("ne donne aucun avis, n'envoie rien seul, et escalade en P0", async () => {
    const { bus, sent } = harness();
    const run = await bus.handle(
      event({
        id: "s3",
        text: "Bonjour, je suis asthmatique et je prends un traitement. Je peux faire un baptême le 14/03 ?",
        from: { name: "Luc", phone: "+33611111111" },
      }),
    );

    expect(run.kind).toBe("safety");
    expect(run.outcome?.priority).toBe("P0");

    // The promise: no customer-facing message goes out without a human.
    expect(run.executed.filter((a) => a.type === "send_message")).toEqual([]);
    expect(sent.filter((m) => m.channel === "whatsapp")).toEqual([]);

    // The queued acknowledgement is empathetic and commits to nothing.
    const ack = run.queued.find((q) => q.action.type === "send_message");
    expect(ack?.action.draft?.body).toMatch(/médical/);
    expect(ack?.action.draft?.body).toMatch(/Rien n'est réservé/);
    expect(ack?.reasons).toContain("rule:safety-topic");

    // The human is told immediately, on the internal channel.
    const escalation = sent.find((m) => m.templateId === "escalation");
    expect(escalation?.body).toMatch(/^\[P0\]/);
    expect(escalation?.body).toMatch(/medical|medication/);

    // The confirmed (partial) protocol travels with the escalation, including
    // what it does NOT cover — a partial protocol must not read as a complete one.
    expect(escalation?.body).toMatch(/Questionnaire médical/);
    expect(escalation?.body).toMatch(/NON COUVERT/);
  });
});

describe("scénario 4 — demande de remboursement", () => {
  it("ne touche pas à l'argent et remonte au propriétaire", async () => {
    const { bus, sent } = harness();
    const run = await bus.handle(
      event({
        id: "s4",
        text: "La sortie a été annulée hier, je demande un remboursement complet.",
        from: { name: "Chloé", phone: "+33622222222" },
      }),
    );

    const types = [...run.executed, ...run.queued.map((q) => q.action)].map((a) => a.type);
    expect(types).not.toContain("refund");
    expect(types).not.toContain("send_payment_link");

    expect(run.outcome?.escalation?.to).toBe("owner");
    expect(sent.find((m) => m.templateId === "escalation")?.body).toMatch(/refund_request|remboursement/);
  });
});

describe("scénario 5 — avis négatif", () => {
  it("rédige une réponse mais ne publie jamais", async () => {
    const { bus, sent } = harness();
    const run = await bus.handle(
      event({
        id: "s5",
        channel: "google_business",
        text: "Très mauvaise expérience, personne ne nous a expliqué le matériel. Inacceptable.",
        from: { name: "Sophie" },
        meta: { rating: "2" },
      }),
    );

    expect(run.kind).toBe("review");
    const reply = run.queued.find((q) => q.action.type === "reply_review");
    expect(reply).toBeDefined();
    expect(reply?.reasons).toContain("rule:review-reply");
    // The draft moves the conversation off the public page, offers nothing.
    expect(reply?.action.draft?.body).toMatch(/désolé/);
    expect(reply?.action.draft?.body).not.toMatch(/rembours|geste|gratuit/);

    expect(run.executed.some((a) => a.type === "reply_review")).toBe(false);
    expect(sent.find((m) => m.templateId === "escalation")?.body).toMatch(/\[P1\]/);
  });
});

describe("scénario 6 — la veille au soir et le bilan de la semaine", () => {
  it("sort la liste opérationnelle et nomme ce qui manque", async () => {
    const { bus, ports } = harness();
    await bus.handle(
      event({
        id: "s6a",
        text: "Nous sommes 2, jamais plongé, baptême le 12/03 ?",
        from: { name: "Marie", phone: "+33612345678" },
      }),
    );

    const brief = nextDayBrief({
      date: "2026-03-12",
      now: NOW,
      leads: await ports.crm.all(),
      pending: await bus.queue.pending(),
    });
    const body = brief.actions[0]?.draft?.body ?? "";

    expect(body).toContain("Marie");
    expect(body).toContain("2 pers.");
    expect(body).toContain("débutant");
    // The unconfirmed operational facts are surfaced, not silently skipped.
    expect(body).toMatch(/Point de rendez-vous : non confirmé/);
    // Documents are confirmed now, so the brief lists them instead of flagging a hole.
    expect(body).toMatch(/questionnaire médical complété/);
    expect(brief.gaps).not.toContain("policies.requiredDocuments");
    expect(body).toMatch(/en attente de validation/);
  });

  it("compte les prospects, les validations en attente et les trous de configuration", async () => {
    const { bus, ports } = harness();
    await bus.handle(event({ id: "s6b", text: "Un baptême pour 2 le 14/03 ?" }));
    await bus.handle(
      event({
        id: "s6c",
        channel: "instagram",
        text: "Hi, we are 3 certified divers, Koh Tao trip on 15/03?",
        from: { name: "Ravi", handle: "@ravi" },
      }),
    );

    const report = weeklyReport({
      now: NOW,
      weekStart: "2026-03-09",
      leads: await ports.crm.all(),
      queue: await bus.queue.all(),
      ports,
    });
    const body = report.actions[0]?.draft?.body ?? "";

    expect(body).toMatch(/Prospects : 2/);
    expect(body).toMatch(/- whatsapp : 1/);
    expect(body).toMatch(/- instagram : 1/);
    expect(body).toMatch(/En attente de validation humaine : \d+/);
    expect(body).toMatch(/policies\.cancellation/);
    expect(body).toMatch(/Canaux désactivés/);
    expect(report.gaps.length).toBeGreaterThan(0);
  });
});

describe("la file de validation", () => {
  it("ne s'auto-approuve jamais et garde la trace de la décision", async () => {
    const { bus } = harness();
    await bus.handle(event({ id: "s7", text: "Baptême le 14/03 pour 2 personnes" }));

    const pending = await bus.queue.pending();
    expect(pending.length).toBeGreaterThan(0);
    // P0/P1 first, so a human triaging from the top sees the urgent items.
    expect(pending[0]?.priority).toBe("P1");

    const first = pending[0];
    if (!first) throw new Error("expected a pending item");
    const decided = await bus.queue.approve(first.id, "owner");
    expect(decided?.status).toBe("approved");
    expect(decided?.decidedBy).toBe("owner");
    // Deciding twice is refused rather than silently accepted.
    expect(await bus.queue.approve(first.id, "owner")).toBeUndefined();
  });
});
