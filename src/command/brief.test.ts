import { describe, expect, it } from "vitest";
import { createMockCrm } from "@/agents/adapters";
import { createJournal } from "./journal";
import { buildEveningReport, buildMorningBrief } from "./brief";
import { bangkokDate, type CommandEventInput } from "./types";

const T0 = "2026-08-18T02:00:00.000Z"; // 09:00 Bangkok

function input(over: Partial<CommandEventInput> = {}): CommandEventInput {
  return {
    venture: "DIVING",
    agent: "reception",
    type: "ACTION",
    priority: "P2",
    status: "PLANNED",
    summary: "Répondre à Marie",
    details: "",
    links: [],
    next_action: "envoyer la réponse",
    needs_owner: false,
    level: 1,
    ...over,
  };
}

async function crmWith(dates: string[]) {
  const crm = createMockCrm(() => T0);
  await crm.upsert({
    contact: { name: "Marie", phone: "+66812345678" },
    channel: "whatsapp",
    locale: "fr",
    dates,
    stage: "qualified",
    sensitiveTopics: [],
  });
  return crm;
}

describe("buildMorningBrief", () => {
  it("met les validations en tête des priorités", async () => {
    const journal = createJournal(() => T0);
    await journal.append(input(), T0);
    const brief = await buildMorningBrief({
      journal,
      pending: [
        {
          id: "q-1",
          eventId: "wa:1",
          agent: "reception",
          action: { id: "a", type: "send_message", summary: "Réponse", risk: "low" },
          priority: "P1",
          approver: "owner",
          reasons: ["rule:channel-draft-only"],
          summary: "Réponse à valider",
          queuedAt: T0,
          status: "pending",
        },
      ],
      leads: [],
      now: T0,
    });
    expect(brief.priorities[0]).toBe("Valider : Réponse à valider (q-1)");
    expect(brief.priorities).toHaveLength(2);
  });

  it("ne met à l'agenda que des dates données par les clients", async () => {
    const crm = await crmWith([bangkokDate(T0)]);
    const brief = await buildMorningBrief({
      journal: createJournal(() => T0),
      pending: [],
      leads: await crm.all(),
      now: T0,
    });
    expect(brief.agenda).toEqual(["Aujourd'hui — Marie"]);
  });

  it("reste vide plutôt que de remplir", async () => {
    const brief = await buildMorningBrief({
      journal: createJournal(() => T0),
      pending: [],
      leads: [],
      now: T0,
    });
    expect(brief.priorities).toEqual([]);
    expect(brief.agenda).toEqual([]);
    expect(brief.blockers).toEqual([]);
    expect(brief.plan).toEqual([]);
  });

  it("remonte les blocages, trois au maximum", async () => {
    const journal = createJournal(() => T0);
    for (const n of [1, 2, 3, 4]) {
      await journal.append(input({ status: "BLOCKED", summary: `Blocage ${n}` }), T0);
    }
    const brief = await buildMorningBrief({ journal, pending: [], leads: [], now: T0 });
    expect(brief.blockers).toHaveLength(3);
  });
});

describe("buildEveningReport", () => {
  it("compte ce qui est fait et n'invente pas le CA", async () => {
    const journal = createJournal(() => T0);
    await journal.append(input({ status: "DONE", summary: "Réponse envoyée" }), T0);
    const crm = await crmWith([]);

    const report = await buildEveningReport({
      journal,
      pending: [],
      leads: await crm.all(),
      now: T0,
    });

    expect(report.done).toEqual(["DIVING · Réponse envoyée"]);
    expect(report.numbers.leads).toBe(1);
    expect(report.numbers.bookings).toBe(0);
    expect(report.numbers.revenueTHB).toBe("[À COMPLÉTER PAR CYRIL]");
  });
});
