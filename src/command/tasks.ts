import type { Priority } from "@/agents/types";
import { systemClock, type Clock } from "@/agents/audit";
import type { Journal } from "./journal";
import {
  newTaskId,
  type ActionLevel,
  type CommandEvent,
  type CommandStatus,
  type TaskCategory,
  type Venture,
} from "./types";

/**
 * Les tâches — ce qui doit arriver.
 *
 * Le journal dit ce qui s'est passé ; il ne suffit pas. Un événement `PLANNED`
 * n'a ni objectif mesurable, ni condition de réussite, ni échéance, ni plan de
 * secours : personne ne peut donc constater qu'il a été oublié. C'est ce trou
 * que cette table ferme, et c'est lui qui portait la promesse « zéro lead,
 * demande client, partenaire ou échéance oubliée ».
 *
 * Les deux restent liés : une tâche ne s'écrit jamais sans son événement
 * (`openTask`), et chaque changement d'état en écrit un autre. Le journal garde
 * son rôle de source de vérité ; la table des tâches n'est que la liste de ce
 * qui reste ouvert.
 */

export interface CommandTask {
  task_id: string;
  created_at: string;
  venture: Venture;
  assigned_agent: string;
  category: TaskCategory;
  priority: Priority;
  /** Le niveau de l'action visée, 0–4. Affiché A0–A4. */
  level: ActionLevel;
  /** Le résultat attendu, concret et mesurable. */
  objective: string;
  context: string;
  constraints: string;
  /** À quoi on reconnaît que c'est fini. Jamais vide. */
  definition_of_done: string;
  deadline?: string;
  status: CommandStatus;
  requires_approval: boolean;
  /** L'événement qui porte la demande de validation, une fois émise. */
  approval_event_id?: string;
  next_step_if_success: string;
  next_step_if_failure: string;
  updated_at: string;
}

export type TaskDraft = Omit<CommandTask, "task_id" | "created_at" | "updated_at" | "status"> &
  Partial<Pick<CommandTask, "task_id" | "status">>;

export interface TaskFilter {
  venture?: Venture;
  status?: CommandStatus;
  assigned_agent?: string;
  /** Échéance antérieure à cet instant ISO — la requête de la veille. */
  dueBefore?: string;
  /** Ne renvoie que ce qui est encore ouvert. */
  openOnly?: boolean;
  /** Défaut : 100. */
  limit?: number;
}

export interface TaskStore {
  create(draft: TaskDraft, now?: string): Promise<CommandTask>;
  get(taskId: string): Promise<CommandTask | undefined>;
  list(filter?: TaskFilter): Promise<readonly CommandTask[]>;
  setStatus(taskId: string, status: CommandStatus, now: string): Promise<CommandTask | undefined>;
  /** Rattache la tâche à l'événement de validation qui la débloque. */
  link(taskId: string, approvalEventId: string, now: string): Promise<CommandTask | undefined>;
}

/** Les statuts qui veulent dire « ce n'est pas fini ». */
export const OPEN_STATUSES: readonly CommandStatus[] = [
  "PLANNED",
  "RUNNING",
  "WAITING_APPROVAL",
  "BLOCKED",
  "FAILED",
];

export function isOpenTask(task: CommandTask): boolean {
  return OPEN_STATUSES.includes(task.status);
}

/** En dessous, un « objectif » n'est qu'un mot-clé : « marketing », « relances ». */
export const MIN_OBJECTIVE_CHARS = 15;

/** L'horizon à partir duquel une échéance mérite d'être remontée. */
export const DEADLINE_SOON_MS = 72 * 3_600_000;

/**
 * Ce qui rend une tâche exécutable.
 *
 * « Fais du marketing pour Jammin's Depths » n'est pas une tâche : personne ne
 * peut dire si elle est finie, donc personne ne peut la clore, donc elle
 * pourrira dans la liste. Le refus est volontairement mécanique — un contrôle
 * qu'on peut contourner en insistant ne contrôle rien.
 */
export function validateTask(draft: TaskDraft): string[] {
  const problems: string[] = [];
  if (draft.objective.trim().length < MIN_OBJECTIVE_CHARS) {
    problems.push(
      `objective : ${MIN_OBJECTIVE_CHARS} caractères minimum — un résultat attendu, pas un thème`,
    );
  }
  if (draft.definition_of_done.trim().length === 0) {
    problems.push("definition_of_done : obligatoire — à quoi reconnaît-on que c'est fini ?");
  }
  if (draft.deadline && Number.isNaN(new Date(draft.deadline).getTime())) {
    problems.push("deadline : ISO-8601 ou absente");
  }
  if (draft.level >= 3 && !draft.requires_approval) {
    // Le niveau et la validation ne peuvent pas se contredire : c'est
    // exactement la porte qu'un agent pressé emprunterait.
    problems.push("requires_approval : obligatoire à partir du niveau A3");
  }
  return problems;
}

export function buildTask(draft: TaskDraft, now: string, id: string = newTaskId(now)): CommandTask {
  return {
    task_id: draft.task_id ?? id,
    created_at: now,
    venture: draft.venture,
    assigned_agent: draft.assigned_agent,
    category: draft.category,
    priority: draft.priority,
    level: draft.level,
    objective: draft.objective.trim(),
    context: draft.context,
    constraints: draft.constraints,
    definition_of_done: draft.definition_of_done.trim(),
    deadline: draft.deadline,
    status: draft.status ?? (draft.requires_approval ? "WAITING_APPROVAL" : "PLANNED"),
    requires_approval: draft.requires_approval,
    approval_event_id: draft.approval_event_id,
    next_step_if_success: draft.next_step_if_success,
    next_step_if_failure: draft.next_step_if_failure,
    updated_at: now,
  };
}

export function matchesTask(task: CommandTask, filter: TaskFilter = {}): boolean {
  if (filter.venture && task.venture !== filter.venture) return false;
  if (filter.status && task.status !== filter.status) return false;
  if (filter.assigned_agent && task.assigned_agent !== filter.assigned_agent) return false;
  if (filter.openOnly && !isOpenTask(task)) return false;
  if (filter.dueBefore) {
    if (!task.deadline || task.deadline > filter.dueBefore) return false;
  }
  return true;
}

/** L'échéance la plus proche d'abord, puis la priorité. L'ordre de l'urgence. */
export function byUrgency(a: CommandTask, b: CommandTask): number {
  const da = a.deadline ?? "9999";
  const db = b.deadline ?? "9999";
  return da.localeCompare(db) || a.priority.localeCompare(b.priority);
}

export function createTaskStore(clock: Clock = systemClock): TaskStore {
  const tasks = new Map<string, CommandTask>();

  return {
    async create(draft, now = clock()) {
      const problems = validateTask(draft);
      if (problems.length > 0) throw new VagueTaskError(problems);
      const task = buildTask(draft, now);
      tasks.set(task.task_id, task);
      return task;
    },

    async get(taskId) {
      return tasks.get(taskId);
    },

    async list(filter = {}) {
      return [...tasks.values()]
        .filter((t) => matchesTask(t, filter))
        .sort(byUrgency)
        .slice(0, filter.limit ?? 100);
    },

    async setStatus(taskId, status, now) {
      const task = tasks.get(taskId);
      if (!task) return undefined;
      const updated = { ...task, status, updated_at: now };
      tasks.set(taskId, updated);
      return updated;
    },

    async link(taskId, approvalEventId, now) {
      const task = tasks.get(taskId);
      if (!task) return undefined;
      const updated = { ...task, approval_event_id: approvalEventId, updated_at: now };
      tasks.set(taskId, updated);
      return updated;
    },
  };
}

/** Le refus d'une tâche vague, avec ce qu'il faut corriger. */
export class VagueTaskError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(`tâche incomplète : ${problems.join(" ; ")}`);
    this.name = "VagueTaskError";
  }
}

/* ------------------------------------------------------------------ *
 * Tâche + journal, indissociables
 * ------------------------------------------------------------------ */

export interface TaskDeps {
  tasks: TaskStore;
  journal: Journal;
  /** Qui ouvre la tâche — inscrit dans l'événement. */
  by: string;
  now: string;
}

export interface OpenedTask {
  task: CommandTask;
  event: CommandEvent;
}

/**
 * Ouvre une tâche ET l'événement qui en rend compte.
 *
 * Les deux écritures vont ensemble : c'est ce qui garantit qu'on ne perd jamais
 * le lien `task_id` ↔ `event_id` ↔ approbation. Une tâche créée sans trace au
 * journal serait invisible d'`/audit`, donc invérifiable.
 */
export async function openTask(draft: TaskDraft, deps: TaskDeps): Promise<OpenedTask> {
  const task = await deps.tasks.create(draft, deps.now);

  const event = await deps.journal.append(
    {
      venture: task.venture,
      agent: task.assigned_agent,
      type: "ACTION",
      priority: task.priority,
      status: task.status,
      category: task.category,
      task_id: task.task_id,
      summary: task.objective,
      details: [
        `Pourquoi : ${task.context || `délégué par ${deps.by}`}`,
        `Détail : fini quand — ${task.definition_of_done}`,
        task.constraints ? `Contraintes : ${task.constraints}` : "",
        task.deadline ? `Échéance : ${task.deadline}` : "",
      ]
        .filter((line) => line.length > 0)
        .join("\n"),
      links: [task.task_id],
      next_action: task.requires_approval
        ? `validation de Cyril avant exécution`
        : task.next_step_if_success || `${task.assigned_agent} prend la tâche`,
      needs_owner: task.requires_approval,
      level: task.level,
    },
    deps.now,
  );

  if (task.requires_approval) await deps.tasks.link(task.task_id, event.event_id, deps.now);
  return { task, event };
}

/**
 * Clôt une tâche et journalise le résultat.
 *
 * Un `RESULT` sans `reference_url` ni `reference_id` ressortira marqué « non
 * vérifié » par `buildEvent` — la clôture n'efface pas l'absence de preuve.
 */
export async function settleTask(
  taskId: string,
  outcome: { status: CommandStatus; detail: string; reference_url?: string; reference_id?: string },
  deps: TaskDeps,
): Promise<OpenedTask | undefined> {
  const task = await deps.tasks.setStatus(taskId, outcome.status, deps.now);
  if (!task) return undefined;

  const failed = outcome.status === "FAILED" || outcome.status === "BLOCKED";
  const event = await deps.journal.append(
    {
      venture: task.venture,
      agent: task.assigned_agent,
      type: failed ? "ERROR" : "RESULT",
      priority: task.priority,
      status: outcome.status,
      category: task.category,
      task_id: task.task_id,
      summary: task.objective,
      details: `Résultat : ${outcome.detail}`,
      links: [task.task_id],
      next_action: failed ? task.next_step_if_failure : task.next_step_if_success,
      needs_owner: failed,
      level: task.level,
      reference_url: outcome.reference_url,
      reference_id: outcome.reference_id,
      error_message: failed ? outcome.detail : undefined,
    },
    deps.now,
  );

  return { task, event };
}

/**
 * Ce qui doit remonter maintenant : une échéance dans moins de 72 heures dont
 * personne n'a écrit la suite. Une échéance avec un plan n'est pas un problème.
 */
export function needsAttention(task: CommandTask, now: string): boolean {
  if (!isOpenTask(task)) return false;
  if (!task.deadline) return false;
  const remaining = new Date(task.deadline).getTime() - new Date(now).getTime();
  if (Number.isNaN(remaining) || remaining > DEADLINE_SOON_MS) return false;
  return task.next_step_if_success.trim().length === 0 || task.status === "BLOCKED";
}
