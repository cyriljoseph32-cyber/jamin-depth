import { describe, expect, it, vi } from "vitest";
import type { TelegramConfig } from "@/agents/adapters/telegram";
import { createJournal } from "./journal";
import { chatForEvent, createNotifier, isImmediate, isStuck } from "./notify";
import { createTaskStore, type CommandTask } from "./tasks";
import type { CommandEvent, CommandEventInput } from "./types";

const T0 = "2026-08-18T02:00:00.000Z";

function telegram(over: Partial<TelegramConfig> = {}): TelegramConfig {
  return {
    botToken: "bot123",
    chatId: "1000",
    allowedChatIds: ["1000"],
    chats: { command: "2000", alerts: "3000", daily: "4000", project: { DIVING: "5000" } },
    ...over,
  };
}

function event(over: Partial<CommandEvent> = {}): CommandEvent {
  return {
    event_id: "evt_1",
    timestamp: T0,
    venture: "DIVING",
    agent: "reception",
    type: "ACTION",
    priority: "P2",
    status: "DONE",
    summary: "Lead enregistré",
    details: "",
    links: [],
    next_action: "",
    needs_owner: false,
    level: 2,
    fingerprint: "f",
    ...over,
  };
}

function input(over: Partial<CommandEventInput> = {}): CommandEventInput {
  return {
    venture: "DIVING",
    agent: "reception",
    type: "ACTION",
    priority: "P2",
    status: "DONE",
    summary: "Lead enregistré",
    details: "",
    links: [],
    next_action: "",
    needs_owner: false,
    level: 2,
    ...over,
  };
}

describe("isImmediate", () => {
  it("laisse passer tout de suite ce qui coûte cher à attendre", () => {
    expect(isImmediate(event({ priority: "P0" }), T0)).toBe(true);
    expect(isImmediate(event({ type: "ERROR" }), T0)).toBe(true);
    expect(isImmediate(event({ status: "WAITING_APPROVAL" }), T0)).toBe(true);
    expect(isImmediate(event({ status: "FAILED" }), T0)).toBe(true);
    expect(isImmediate(event({ needs_owner: true }), T0)).toBe(true);
  });

  it("laisse le reste au récapitulatif", () => {
    expect(isImmediate(event(), T0)).toBe(false);
    expect(isImmediate(event({ priority: "P3" }), T0)).toBe(false);
  });

  it("considère coincée une tâche qui tourne depuis plus de 30 minutes", () => {
    const later = new Date(new Date(T0).getTime() + 31 * 60_000).toISOString();
    expect(isStuck(event({ status: "RUNNING" }), later)).toBe(true);
    expect(isStuck(event({ status: "RUNNING" }), T0)).toBe(false);
  });
});

describe("chatForEvent", () => {
  it("route selon la nature de l'événement", () => {
    const cfg = telegram();
    expect(chatForEvent(cfg, event({ type: "BRIEF" }))).toBe("4000");
    expect(chatForEvent(cfg, event({ priority: "P0" }))).toBe("3000");
    expect(chatForEvent(cfg, event({ needs_owner: true }))).toBe("3000");
    expect(chatForEvent(cfg, event())).toBe("5000");
  });

  it("retombe sur le chat unique quand rien n'est configuré", () => {
    const cfg = telegram({ chats: undefined });
    expect(chatForEvent(cfg, event({ type: "BRIEF" }))).toBe("1000");
    expect(chatForEvent(cfg, event({ venture: "RUGBY" }))).toBe("1000");
  });
});

describe("createNotifier", () => {
  function withFetch() {
    const calls: { chat: string; text: string; hasButtons: boolean }[] = [];
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as {
        chat_id: string;
        text: string;
        reply_markup?: unknown;
      };
      calls.push({ chat: body.chat_id, text: body.text, hasButtons: body.reply_markup !== undefined });
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    return { calls, cfg: telegram({ fetchImpl }) };
  }

  it("envoie seul ce qui est urgent, et le marque notifié", async () => {
    const { calls, cfg } = withFetch();
    const journal = createJournal(() => T0);
    const notifier = createNotifier({ telegram: cfg, journal });

    const urgent = await journal.append(input({ priority: "P0", summary: "Incident" }), T0);
    expect(await notifier.announce(urgent, T0)).toBe(true);
    expect(calls[0]?.chat).toBe("3000");
    expect(await journal.pendingNotification()).toHaveLength(0);
  });

  it("laisse le reste au digest, groupé en un seul message", async () => {
    const { calls, cfg } = withFetch();
    const journal = createJournal(() => T0);
    const notifier = createNotifier({ telegram: cfg, journal });

    const calm = await journal.append(input({ summary: "Lead enregistré" }), T0);
    expect(await notifier.announce(calm, T0)).toBe(false);
    await journal.append(input({ summary: "Autre lead" }), T0);

    expect(await notifier.flush(T0)).toBe(2);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.chat).toBe("4000");
    expect(calls[0]?.text).toContain("SUIVI");
    expect(await journal.pendingNotification()).toHaveLength(0);
  });

  it("rattrape seule une alerte que le digest ramasse", async () => {
    const { calls, cfg } = withFetch();
    const journal = createJournal(() => T0);
    const notifier = createNotifier({ telegram: cfg, journal });

    await journal.append(input({ priority: "P0", summary: "Incident non notifié" }), T0);
    await journal.append(input({ summary: "Lead calme" }), T0);
    await notifier.flush(T0);

    expect(calls.map((c) => c.chat)).toEqual(["3000", "4000"]);
    expect(calls[0]?.text).toContain("🚨");
  });

  it("porte deux boutons plutôt qu'un /approve à retaper, pour tout ce qui attend une décision", async () => {
    const { calls, cfg } = withFetch();
    const journal = createJournal(() => T0);
    const notifier = createNotifier({ telegram: cfg, journal });

    const waiting = await journal.append(
      input({ status: "WAITING_APPROVAL", needs_owner: true, summary: "Brouillon Instagram" }),
      T0,
    );
    expect(await notifier.announce(waiting, T0)).toBe(true);
    expect(calls[0]?.hasButtons).toBe(true);
  });

  it("n'ajoute pas de boutons à une alerte — elle appelle une action, pas une décision réversible", async () => {
    const { calls, cfg } = withFetch();
    const journal = createJournal(() => T0);
    const notifier = createNotifier({ telegram: cfg, journal });

    // P0 et needs_owner en même temps : le texte d'alerte l'emporte quand même,
    // exactement comme formatEvent() choisit formatAlert avant formatApproval.
    const alert = await journal.append(
      input({ priority: "P0", needs_owner: true, type: "ALERT", summary: "Incident" }),
      T0,
    );
    expect(await notifier.announce(alert, T0)).toBe(true);
    expect(calls[0]?.hasButtons).toBe(false);
  });

  it("n'échoue pas quand Telegram n'est pas configuré", async () => {
    const journal = createJournal(() => T0);
    const notifier = createNotifier({ telegram: null, journal });
    const urgent = await journal.append(input({ priority: "P0" }), T0);
    expect(await notifier.announce(urgent, T0)).toBe(false);
    // L'événement reste en attente : rien n'est perdu, il ressortira plus tard.
    expect(await journal.pendingNotification()).toHaveLength(1);
  });
});

describe("veille des échéances", () => {
  const tomorrow = "2026-08-19T02:00:00.000Z";

  async function storeWith(over: Partial<CommandTask> = {}) {
    const tasks = createTaskStore(() => T0);
    await tasks.create(
      {
        venture: "RUGBY",
        assigned_agent: "communication",
        category: "sales",
        priority: "P1",
        level: 1,
        objective: "Relancer les écoles avant la rentrée scolaire",
        context: "",
        constraints: "",
        definition_of_done: "cinq brouillons prêts",
        deadline: tomorrow,
        requires_approval: false,
        next_step_if_success: "",
        next_step_if_failure: "",
        ...over,
      },
      T0,
    );
    return tasks;
  }

  it("alerte sur une échéance à moins de 72 h sans suite écrite", async () => {
    const send = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const notifier = createNotifier({
      telegram: telegram({ fetchImpl: send as unknown as typeof fetch }),
      journal: createJournal(() => T0),
      tasks: await storeWith(),
    });

    expect(await notifier.watchDeadlines(T0)).toBe(1);
    const body = String(send.mock.calls[0]?.[1]?.body ?? "");
    expect(body).toContain("ÉCHÉANCES");
    expect(body).toContain("3000"); // le chat des alertes
  });

  it("se tait quand l'échéance a un plan", async () => {
    const send = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const notifier = createNotifier({
      telegram: telegram({ fetchImpl: send as unknown as typeof fetch }),
      journal: createJournal(() => T0),
      tasks: await storeWith({ next_step_if_success: "envoyer lundi" }),
    });

    expect(await notifier.watchDeadlines(T0)).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });

  it("veille même un jour sans le moindre événement", async () => {
    const send = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const notifier = createNotifier({
      telegram: telegram({ fetchImpl: send as unknown as typeof fetch }),
      journal: createJournal(() => T0),
      tasks: await storeWith(),
    });

    // Journal vide : `flush` sortait autrefois immédiatement, et l'échéance
    // passait inaperçue exactement les jours calmes.
    expect(await notifier.flush(T0)).toBe(1);
  });

  it("ne veille pas quand aucune tâche n'est branchée", async () => {
    const notifier = createNotifier({ telegram: telegram(), journal: createJournal(() => T0) });
    expect(await notifier.watchDeadlines(T0)).toBe(0);
  });
});
