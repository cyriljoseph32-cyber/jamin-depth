import { describe, expect, it } from "vitest";
import { createJournal } from "./journal";
import {
  createTaskStore,
  needsAttention,
  openTask,
  settleTask,
  validateTask,
  VagueTaskError,
  type TaskDraft,
} from "./tasks";

const T0 = "2026-08-18T02:00:00.000Z"; // 09:00 Bangkok

function draft(over: Partial<TaskDraft> = {}): TaskDraft {
  return {
    venture: "RUGBY",
    assigned_agent: "communication",
    category: "sales",
    priority: "P2",
    level: 1,
    objective: "Relancer les cinq écoles de Lamai contactées en juillet",
    context: "Aucune réponse depuis trois semaines.",
    constraints: "Brouillons uniquement.",
    definition_of_done: "Cinq brouillons prêts et fiches pipeline à jour",
    requires_approval: false,
    next_step_if_success: "soumettre les brouillons à Cyril",
    next_step_if_failure: "remonter à Cyril",
    ...over,
  };
}

describe("validateTask", () => {
  it("refuse un objectif qui n'est qu'un thème", () => {
    const problems = validateTask(draft({ objective: "marketing" }));
    expect(problems.some((p) => p.startsWith("objective"))).toBe(true);
  });

  it("refuse une tâche sans condition de fin", () => {
    const problems = validateTask(draft({ definition_of_done: "   " }));
    expect(problems.some((p) => p.startsWith("definition_of_done"))).toBe(true);
  });

  it("interdit qu'un niveau A3 se dispense de validation", () => {
    const problems = validateTask(draft({ level: 3, requires_approval: false }));
    expect(problems.some((p) => p.startsWith("requires_approval"))).toBe(true);
  });

  it("laisse passer une tâche complète", () => {
    expect(validateTask(draft())).toEqual([]);
  });
});

describe("createTaskStore", () => {
  it("rejette la tâche vague plutôt que de la stocker", async () => {
    const store = createTaskStore(() => T0);
    await expect(store.create(draft({ objective: "seo" }))).rejects.toBeInstanceOf(VagueTaskError);
    expect(await store.list()).toHaveLength(0);
  });

  it("met en attente de validation ce qui l'exige, sans qu'on le demande", async () => {
    const store = createTaskStore(() => T0);
    const task = await store.create(draft({ level: 3, requires_approval: true }));
    expect(task.status).toBe("WAITING_APPROVAL");
  });

  it("trie par échéance la plus proche", async () => {
    const store = createTaskStore(() => T0);
    await store.create(draft({ objective: "Tâche lointaine à faire plus tard", deadline: "2026-09-30T00:00:00.000Z" }));
    await store.create(draft({ objective: "Tâche urgente à traiter en premier", deadline: "2026-08-19T00:00:00.000Z" }));
    const list = await store.list();
    expect(list[0]?.objective).toContain("urgente");
  });
});

describe("openTask", () => {
  it("écrit la tâche et son événement, liés", async () => {
    const journal = createJournal(() => T0);
    const tasks = createTaskStore(() => T0);
    const { task, event } = await openTask(draft(), { tasks, journal, by: "cyril", now: T0 });

    expect(event.task_id).toBe(task.task_id);
    expect(event.venture).toBe("RUGBY");
    expect(event.category).toBe("sales");
    expect(event.details).toContain(task.definition_of_done);
  });

  it("relie la tâche à l'événement de validation quand elle en demande une", async () => {
    const journal = createJournal(() => T0);
    const tasks = createTaskStore(() => T0);
    const { task, event } = await openTask(draft({ level: 3, requires_approval: true }), {
      tasks,
      journal,
      by: "cyril",
      now: T0,
    });

    expect(event.needs_owner).toBe(true);
    expect((await tasks.get(task.task_id))?.approval_event_id).toBe(event.event_id);
  });
});

describe("settleTask", () => {
  it("marque « non vérifié » une clôture sans preuve", async () => {
    const journal = createJournal(() => T0);
    const tasks = createTaskStore(() => T0);
    const { task } = await openTask(draft(), { tasks, journal, by: "cyril", now: T0 });

    const settled = await settleTask(task.task_id, { status: "DONE", detail: "envoyé" }, {
      tasks,
      journal,
      by: "cyril",
      now: T0,
    });
    expect(settled?.event.impact).toContain("non vérifié");
  });

  it("accepte la clôture quand la preuve est fournie", async () => {
    const journal = createJournal(() => T0);
    const tasks = createTaskStore(() => T0);
    const { task } = await openTask(draft(), { tasks, journal, by: "cyril", now: T0 });

    const settled = await settleTask(
      task.task_id,
      { status: "DONE", detail: "cinq brouillons", reference_id: "gmail:draft-42" },
      { tasks, journal, by: "cyril", now: T0 },
    );
    expect(settled?.event.impact).toBeUndefined();
    expect(settled?.event.reference_id).toBe("gmail:draft-42");
  });

  it("écrit une ERROR et rend la main à Cyril sur un échec", async () => {
    const journal = createJournal(() => T0);
    const tasks = createTaskStore(() => T0);
    const { task } = await openTask(draft(), { tasks, journal, by: "cyril", now: T0 });

    const settled = await settleTask(task.task_id, { status: "FAILED", detail: "Gmail indisponible" }, {
      tasks,
      journal,
      by: "cyril",
      now: T0,
    });
    expect(settled?.event.type).toBe("ERROR");
    expect(settled?.event.error_message).toBe("Gmail indisponible");
    expect(settled?.event.needs_owner).toBe(true);
  });
});

describe("needsAttention", () => {
  const soon = "2026-08-19T02:00:00.000Z"; // demain

  it("signale une échéance proche dont personne n'a écrit la suite", () => {
    const task = { ...draft(), next_step_if_success: "" };
    expect(needsAttention({ ...task, task_id: "t", created_at: T0, updated_at: T0, status: "PLANNED", deadline: soon }, T0)).toBe(true);
  });

  it("laisse tranquille une échéance proche qui a un plan", () => {
    const task = { ...draft(), task_id: "t", created_at: T0, updated_at: T0, status: "PLANNED" as const, deadline: soon };
    expect(needsAttention(task, T0)).toBe(false);
  });

  it("ignore une tâche close", () => {
    const task = { ...draft(), task_id: "t", created_at: T0, updated_at: T0, status: "DONE" as const, deadline: soon, next_step_if_success: "" };
    expect(needsAttention(task, T0)).toBe(false);
  });
});
