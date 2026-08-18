import { describe, expect, it } from "vitest";
import { createApprovalQueue } from "@/agents/queue";
import { createMockPorts } from "@/agents/adapters";
import { createAuditLog } from "@/agents/audit";
import { createJournal } from "./journal";
import { createStateStore } from "./state";
import { parseCommand, runCommand, type CommandDeps } from "./commands";
import type { CommandEventInput } from "./types";

const T0 = "2026-08-18T02:00:00.000Z";

function deps(over: Partial<CommandDeps> = {}): CommandDeps {
  const queue = createApprovalQueue(() => T0);
  const ports = createMockPorts(() => T0);
  return {
    journal: createJournal(() => T0),
    queue,
    state: createStateStore(),
    release: { queue, ports, log: createAuditLog(() => T0) },
    leads: () => ports.crm.all(),
    by: "telegram:cyril",
    now: T0,
    ...over,
  };
}

function waiting(over: Partial<CommandEventInput> = {}): CommandEventInput {
  return {
    venture: "COCO",
    agent: "commercial-coco",
    type: "APPROVAL",
    priority: "P2",
    status: "WAITING_APPROVAL",
    summary: "Envoyer le pitch à un hôtel",
    details: "Détail : email à [À COMPLÉTER PAR CYRIL]",
    links: [],
    next_action: "envoi après validation",
    needs_owner: true,
    level: 3,
    ...over,
  };
}

describe("parseCommand", () => {
  it("lit la commande, ses arguments, et le suffixe du bot", () => {
    expect(parseCommand("/status DIVING")).toEqual({ name: "status", args: "DIVING" });
    expect(parseCommand("/tasks@coco_command_bot")).toEqual({ name: "tasks", args: "" });
    expect(parseCommand("/approve evt_1 raison longue")).toEqual({ name: "approve", args: "evt_1 raison longue" });
  });

  it("ignore ce qui n'est pas une commande connue", () => {
    expect(parseCommand("bonjour")).toBeNull();
    expect(parseCommand("/inconnue")).toBeNull();
  });
});

describe("/approve et /reject", () => {
  it("refuse un identifiant inconnu plutôt que de deviner", async () => {
    const d = deps();
    const reply = await runCommand({ name: "approve", args: "evt_inexistant" }, d);
    expect(reply).toContain("Introuvable");
  });

  it("refuse un événement qui n'attend pas de décision", async () => {
    const d = deps();
    const event = await d.journal.append(waiting({ status: "DONE", needs_owner: false }));
    const reply = await runCommand({ name: "approve", args: event.event_id }, d);
    expect(reply).toContain("n'attend pas de décision");
  });

  it("enregistre la décision d'un événement poussé par un autre projet", async () => {
    const d = deps();
    const event = await d.journal.append(waiting());
    const reply = await runCommand({ name: "approve", args: event.event_id }, d);
    expect(reply).toContain("approuvé");
    expect((await d.journal.get(event.event_id))?.status).toBe("DONE");
  });

  it("passe par la file de validation quand l'action y vit", async () => {
    const d = deps();
    const item = await d.queue.enqueue({
      eventId: "wa:1",
      agent: "reception",
      action: {
        id: "a1",
        type: "internal_report",
        summary: "Note interne",
        risk: "none",
        approval: { required: true, reasons: ["rule:test"], approver: "owner" },
      },
      priority: "P2",
    });
    const event = await d.journal.append(waiting({ queue_item_id: item.id, summary: "Note interne" }));

    const reply = await runCommand({ name: "approve", args: event.event_id }, d);
    expect(reply).toContain("✅");
    expect((await d.queue.get(item.id))?.status).toBe("approved");
    expect((await d.journal.get(event.event_id))?.status).toBe("DONE");
  });

  it("ne décide pas deux fois", async () => {
    const d = deps();
    const event = await d.journal.append(waiting());
    await runCommand({ name: "approve", args: event.event_id }, d);
    const second = await runCommand({ name: "reject", args: `${event.event_id} trop cher` }, d);
    expect(second).toContain("n'attend pas de décision");
  });

  it("archive la raison d'un rejet", async () => {
    const d = deps();
    const event = await d.journal.append(waiting());
    await runCommand({ name: "reject", args: `${event.event_id} hors budget` }, d);
    const settled = await d.journal.get(event.event_id);
    expect(settled?.status).toBe("BLOCKED");
    expect(settled?.details).toContain("hors budget");
  });
});

describe("pilotage", () => {
  it("/tasks trie par priorité et propose la commande de validation", async () => {
    const d = deps();
    await d.journal.append(waiting({ priority: "P3", summary: "Tâche basse" }));
    await d.journal.append(waiting({ priority: "P0", summary: "Tâche urgente" }));
    const reply = await runCommand({ name: "tasks", args: "" }, d);
    const lines = reply.split("\n");
    expect(lines[1]).toContain("Tâche urgente");
    expect(reply).toContain("/approve evt_");
  });

  it("/delegate route vers l'agent de l'activité", async () => {
    const d = deps();
    const reply = await runCommand({ name: "delegate", args: "RUGBY relancer les écoles" }, d);
    expect(reply).toContain("Délégué à assistant-cyril (#RUGBY)");
    expect((await d.journal.list({ venture: "RUGBY" }))[0]?.summary).toBe("relancer les écoles");
  });

  it("/focus n'accepte qu'une activité connue", async () => {
    const d = deps();
    expect(await runCommand({ name: "focus", args: "PLONGEE" }, d)).toContain("Projet inconnu");
    expect(await runCommand({ name: "focus", args: "diving" }, d)).toContain("Focus sur #DIVING");
    expect((await d.state.read()).focus).toBe("DIVING");
  });

  it("/pause suspend l'activité et le dit sans ambiguïté", async () => {
    const d = deps();
    const reply = await runCommand({ name: "pause", args: "DIVING" }, d);
    expect(reply).toContain("en pause");
    expect(reply).toContain("Les P0 continuent de remonter");
    expect((await d.state.read()).pausedVentures).toEqual(["DIVING"]);
    await runCommand({ name: "resume", args: "DIVING" }, d);
    expect((await d.state.read()).pausedVentures).toEqual([]);
  });

  it("/audit compte les actions, les erreurs et le niveau 4", async () => {
    const d = deps();
    await d.journal.append(waiting({ type: "ERROR", status: "FAILED", summary: "Cron en échec", needs_owner: false }));
    await d.journal.append(waiting({ summary: "Remboursement", level: 4 }));
    const reply = await runCommand({ name: "audit", args: "" }, d);
    expect(reply).toContain("Erreurs / échecs : 1");
    expect(reply).toContain("Niveau 4");
  });

  it("/status résume chaque activité", async () => {
    const d = deps();
    await d.journal.append(waiting({ venture: "COCO", status: "BLOCKED", summary: "Import bloqué" }));
    const reply = await runCommand({ name: "status", args: "COCO" }, d);
    expect(reply).toContain("#COCO");
    expect(reply).toContain("blocages : Import bloqué");
  });
});
