import { describe, expect, it } from "vitest";
import { createApprovalQueue } from "@/agents/queue";
import { createMockPorts } from "@/agents/adapters";
import { createAuditLog } from "@/agents/audit";
import { createJournal } from "./journal";
import { createStateStore } from "./state";
import { createTaskStore } from "./tasks";
import { createKpiStore } from "./kpi";
import { createContentStore } from "./content";
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
    tasks: createTaskStore(() => T0),
    kpis: createKpiStore(() => T0),
    content: createContentStore(() => T0),
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

  it("approuver un événement de contenu fait avancer le contenu lié en APPROVED", async () => {
    const d = deps();
    const item = await d.content.create({
      venture: "DIVING",
      channel: "instagram",
      format: "post",
      goal: "awareness",
      target_audience: "voyageurs",
      hook: "hook",
      key_message: "",
      cta: "cta",
      asset_needed: "",
      caption_draft: "légende",
      status: "WAITING_APPROVAL",
    });
    const event = await d.journal.append(waiting({ links: [item.content_id] }));

    const reply = await runCommand({ name: "approve", args: event.event_id }, d);

    expect(reply).toContain("Contenu passé en APPROVED");
    expect((await d.content.get(item.content_id))?.status).toBe("APPROVED");
  });

  it("rejeter un événement de contenu abandonne le contenu lié", async () => {
    const d = deps();
    const item = await d.content.create({
      venture: "DIVING",
      channel: "instagram",
      format: "post",
      goal: "awareness",
      target_audience: "voyageurs",
      hook: "hook",
      key_message: "",
      cta: "cta",
      asset_needed: "",
      caption_draft: "légende",
      status: "WAITING_APPROVAL",
    });
    const event = await d.journal.append(waiting({ links: [item.content_id] }));

    const reply = await runCommand({ name: "reject", args: `${event.event_id} pas le bon ton` }, d);

    expect(reply).toContain("Contenu abandonné");
    expect((await d.content.get(item.content_id))?.status).toBe("ABANDONED");
  });

  it("ne touche pas un contenu déjà programmé ou publié entre-temps", async () => {
    const d = deps();
    const item = await d.content.create({
      venture: "DIVING",
      channel: "instagram",
      format: "post",
      goal: "awareness",
      target_audience: "voyageurs",
      hook: "hook",
      key_message: "",
      cta: "cta",
      asset_needed: "",
      caption_draft: "légende",
      status: "WAITING_APPROVAL",
    });
    await d.content.schedule(item.content_id, "2026-08-25T00:00:00.000Z", T0);
    const event = await d.journal.append(waiting({ links: [item.content_id] }));

    await runCommand({ name: "approve", args: event.event_id }, d);

    expect((await d.content.get(item.content_id))?.status).toBe("SCHEDULED");
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
    expect(reply).toContain("Délégué à communication — #RUGBY · sales");
    expect(reply).toContain("Fini quand :");
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

describe("/delegate", () => {
  it("crée une vraie tâche, liée à son événement", async () => {
    const d = deps();
    await runCommand({ name: "delegate", args: "DIVING répondre aux deux Français du 26 août" }, d);

    const [task] = await d.tasks.list();
    expect(task?.assigned_agent).toBe("reception");
    expect(task?.category).toBe("support");

    const events = await d.journal.list({ venture: "DIVING" });
    expect(events[0]?.task_id).toBe(task?.task_id);
  });

  it("accepte un rôle du mandat à la place du projet", async () => {
    const d = deps();
    await runCommand({ name: "delegate", args: "rugby_growth_agent préparer trois reels pour la rentrée" }, d);
    const [task] = await d.tasks.list();
    expect(task?.venture).toBe("RUGBY");
    expect(task?.assigned_agent).toBe("marketing");
  });

  it("lit la condition de fin et l'échéance quand elles sont données", async () => {
    const d = deps();
    const reply = await runCommand(
      { name: "delegate", args: "COCO démarcher cinq hôtels de Chaweng | fini quand cinq fiches créées | avant 2026-09-01" },
      d,
    );
    const [task] = await d.tasks.list();
    expect(task?.definition_of_done).toBe("cinq fiches créées");
    expect(task?.deadline?.startsWith("2026-09-01")).toBe(true);
    expect(reply).toContain("Échéance : 2026-09-01");
  });

  it("écrit une condition de fin par défaut et le dit", async () => {
    const d = deps();
    const reply = await runCommand({ name: "delegate", args: "GLOBAL préparer le point mensuel des trois activités" }, d);
    expect(reply).toContain("Fini quand : objectif atteint et résultat journalisé");
  });

  it("refuse un objectif qui n'est qu'un mot, sans rien stocker", async () => {
    const d = deps();
    const reply = await runCommand({ name: "delegate", args: "RUGBY marketing" }, d);
    expect(reply).toContain("Tâche refusée");
    expect(await d.tasks.list()).toHaveLength(0);
  });

  it("prévient quand personne ne couvre la catégorie", async () => {
    const d = deps();
    const reply = await runCommand({ name: "delegate", args: "DIVING vérifier la facture du compresseur de janvier" }, d);
    expect(reply).toContain("Aucun agent titulaire");
  });
});

describe("/kpi", () => {
  it("enregistre une saisie", async () => {
    const d = deps();
    const reply = await runCommand({ name: "kpi", args: "DIVING bookings 3 deux Open Water" }, d);
    expect(reply).toContain("Réservations : 3");
    expect(await d.kpis.list()).toHaveLength(1);
  });

  it("explique l'usage quand rien n'a été saisi", async () => {
    const reply = await runCommand({ name: "kpi", args: "" }, deps());
    expect(reply).toContain("Utilisation : /kpi");
  });

  it("relit les saisies du jour", async () => {
    const d = deps();
    await runCommand({ name: "kpi", args: "RUGBY signups 2" }, d);
    expect(await runCommand({ name: "kpi", args: "" }, d)).toContain("Inscriptions : 2");
  });

  it("refuse une métrique inconnue", async () => {
    const d = deps();
    expect(await runCommand({ name: "kpi", args: "DIVING sourires 12" }, d)).toContain("Métriques :");
    expect(await d.kpis.list()).toHaveLength(0);
  });
});

describe("/week", () => {
  it("répond un bilan hebdomadaire, même vide", async () => {
    const reply = await runCommand({ name: "week", args: "" }, deps());
    expect(reply).toContain("BILAN HEBDOMADAIRE");
    expect(reply).toContain("CA confirmé : [À COMPLÉTER PAR CYRIL]");
  });
});

describe("/tasks", () => {
  it("liste les tâches et les validations qui n'en dépendent pas", async () => {
    const d = deps();
    await runCommand({ name: "delegate", args: "RUGBY relancer les écoles de Lamai" }, d);
    await d.journal.append(waiting(), d.now);

    const reply = await runCommand({ name: "tasks", args: "" }, d);
    expect(reply).toContain("relancer les écoles de Lamai");
    expect(reply).toContain("Envoyer le pitch à un hôtel");
    expect(reply).toContain("[📌 TÂCHES OUVERTES] 2");
  });
});

describe("/contenu", () => {
  it("liste ce qui sort dans les 7 jours et ce qui attend une date", async () => {
    const content = createContentStore(() => T0);
    const d = deps({ content });
    const soon = await content.create(
      {
        venture: "DIVING",
        channel: "instagram",
        format: "reel",
        goal: "conversion",
        target_audience: "Voyageurs français",
        hook: "Ton premier souffle sous l'eau",
        key_message: "Baptême encadré",
        cta: "Réserve ton créneau",
        asset_needed: "",
        caption_draft: "Le baptême, du début à la fin.",
      },
      T0,
    );
    await content.schedule(soon.content_id, "2026-08-20T03:00:00.000Z", T0);

    const out = await runCommand(parseCommand("/contenu")!, d);
    expect(out).toContain("CALENDRIER");
    expect(out).toContain("Ton premier souffle sous l'eau");
  });

  it("refuse une activité inconnue en la nommant", async () => {
    const out = await runCommand(parseCommand("/contenu HELMETIK")!, deps());
    expect(out).toContain("Activité inconnue");
  });

  it("dit clairement qu'il n'y a rien plutôt que d'afficher un tableau vide", async () => {
    const out = await runCommand(parseCommand("/contenu")!, deps());
    expect(out).toContain("Rien de prévu");
  });
});

describe("/silence", () => {
  it("distingue « rien de prêt » de « prêt mais pas publié »", async () => {
    const content = createContentStore(() => T0);
    const item = await content.create(
      {
        venture: "RUGBY",
        channel: "instagram",
        format: "post",
        goal: "engagement",
        target_audience: "Familles de Lamai",
        hook: "La séance de samedi en images",
        key_message: "Esprit d'équipe",
        cta: "Viens essayer",
        asset_needed: "",
        caption_draft: "Retour sur la séance.",
      },
      T0,
    );
    await content.setStatus(item.content_id, "APPROVED", T0);

    const out = await runCommand(parseCommand("/silence")!, deps({ content }));
    expect(out).toContain("#RUGBY");
    expect(out).toContain("il manque la publication");
    expect(out).toContain("il manque la production");
  });
});
