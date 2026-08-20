import { describe, expect, it } from "vitest";
import { createMockCrm } from "@/agents/adapters";
import { createJournal } from "./journal";
import { buildEveningReport, buildMorningBrief, buildWeeklyReport } from "./brief";
import { createTaskStore } from "./tasks";
import { createKpiStore } from "./kpi";
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
      tasks: [],
      kpis: [],
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
      tasks: [],
      kpis: [],
      now: T0,
    });
    expect(brief.agenda).toEqual(["Aujourd'hui — Marie"]);
  });

  it("reste vide plutôt que de remplir", async () => {
    const brief = await buildMorningBrief({
      journal: createJournal(() => T0),
      pending: [],
      leads: [],
      tasks: [],
      kpis: [],
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
    const brief = await buildMorningBrief({ journal, pending: [], leads: [], tasks: [], kpis: [], now: T0 });
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
      tasks: [],
      kpis: [],
      now: T0,
    });

    expect(report.done).toEqual(["DIVING · Réponse envoyée"]);
    expect(report.numbers.leads).toBe(1);
    // Aucune saisie et aucune réservation au CRM : le bilan l'avoue au lieu
    // d'afficher un zéro, qui se lirait comme un constat.
    expect(report.numbers.bookings).toBe("[À COMPLÉTER PAR CYRIL]");
    expect(report.numbers.revenueTHB).toBe("[À COMPLÉTER PAR CYRIL]");
  });
});

describe("buildWeeklyReport", () => {
  it("restitue les chiffres saisis et avoue les autres", async () => {
    const journal = createJournal(() => T0);
    const kpis = createKpiStore(() => T0);
    await kpis.record({ venture: "DIVING", metric: "bookings", value: 3, note: "", by: "cyril" }, T0);

    const report = await buildWeeklyReport({ journal, pending: [], leads: [], tasks: [], kpis: await kpis.list(), now: T0 });
    expect(report.numbers.bookings).toBe("3");
    expect(report.numbers.revenueTHB).toBe("[À COMPLÉTER PAR CYRIL]");
  });

  it("ne compte comme valeur que ce qui a laissé une preuve", async () => {
    const journal = createJournal(() => T0);
    await journal.append(input({ status: "DONE", type: "RESULT", summary: "Sans preuve" }), T0);
    await journal.append(
      input({ status: "DONE", type: "RESULT", summary: "Avec preuve", reference_url: "https://wa.me/msg/7" }),
      T0,
    );

    const report = await buildWeeklyReport({ journal, pending: [], leads: [], tasks: [], kpis: [], now: T0 });
    expect(report.valuable).toHaveLength(1);
    expect(report.valuable[0]).toContain("Avec preuve");
  });

  it("signale les gestes répétés comme candidats à l'automatisation", async () => {
    const journal = createJournal(() => T0);
    // Hors de la fenêtre de déduplication : trois faits distincts, pas un doublon.
    for (const h of [0, 2, 4]) {
      const at = new Date(new Date(T0).getTime() + h * 3_600_000).toISOString();
      await journal.append(input({ summary: "Relance hebdomadaire des écoles", timestamp: at }), at);
    }
    const report = await buildWeeklyReport({ journal, pending: [], leads: [], tasks: [], kpis: [], now: T0 });
    expect(report.automations[0]).toContain("3× cette semaine");
  });

  it("propose la validation la plus ancienne comme décision, ou rien", async () => {
    const journal = createJournal(() => T0);
    const empty = await buildWeeklyReport({ journal, pending: [], leads: [], tasks: [], kpis: [], now: T0 });
    expect(empty.decision).toBeNull();

    await journal.append(input({ status: "WAITING_APPROVAL", needs_owner: true, summary: "Envoyer le devis" }), T0);
    const report = await buildWeeklyReport({ journal, pending: [], leads: [], tasks: [], kpis: [], now: T0 });
    expect(report.decision).toContain("Envoyer le devis");
  });
});

describe("buildMorningBrief — échéances", () => {
  it("remonte une échéance proche sans suite écrite", async () => {
    const journal = createJournal(() => T0);
    const store = createTaskStore(() => T0);
    const task = await store.create(
      {
        venture: "RUGBY",
        assigned_agent: "communication",
        category: "sales",
        priority: "P2",
        level: 1,
        objective: "Relancer les écoles avant la rentrée scolaire",
        context: "",
        constraints: "",
        definition_of_done: "cinq brouillons prêts",
        deadline: "2026-08-19T02:00:00.000Z",
        requires_approval: false,
        next_step_if_success: "",
        next_step_if_failure: "",
      },
      T0,
    );

    const brief = await buildMorningBrief({
      journal,
      pending: [],
      leads: [],
      tasks: [task],
      kpis: [],
      now: T0,
    });
    expect(brief.blockers.join(" ")).toContain("sans plan");
    expect(brief.agenda.join(" ")).toContain("Échéance demain");
  });
});

describe("les rapports ne se comptent pas eux-mêmes", () => {
  it("exclut les briefs du décompte des actions", async () => {
    const journal = createJournal(() => T0);
    await journal.append(input({ type: "BRIEF", status: "DONE", summary: "Bilan du soir", venture: "GLOBAL" }), T0);

    const evening = await buildEveningReport({ journal, pending: [], leads: [], tasks: [], kpis: [], now: T0 });
    expect(evening.numbers.ticketsHandled).toBe(0);

    const weekly = await buildWeeklyReport({ journal, pending: [], leads: [], tasks: [], kpis: [], now: T0 });
    expect(weekly.numbers.actionsDone).toBe(0);
  });
});
