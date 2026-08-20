import { eq, request, type SupabaseConfig } from "@/agents/adapters/supabase";
import { systemClock, type Clock } from "@/agents/audit";
import type { Priority } from "@/agents/types";
import { buildTask, byUrgency, OPEN_STATUSES, validateTask, VagueTaskError, type TaskFilter, type TaskStore } from "../tasks";
import type { CommandTask } from "../tasks";
import { createKpiStore, type KpiEntry, type KpiFilter, type KpiStore } from "../kpi";
import type { ActionLevel, CommandStatus, TaskCategory, Venture } from "../types";

/**
 * Tâches et chiffres, persistants.
 *
 * Même canal que le reste : PostgREST et `fetch`. Schéma dans
 * `supabase/schema.sql` (`command_tasks`, `command_kpis`).
 *
 * Serveur uniquement — la clé `service_role` contourne RLS.
 */

interface TaskRow {
  task_id: string;
  created_at: string;
  venture: string;
  assigned_agent: string;
  category: string;
  priority: string;
  level: number;
  objective: string;
  context: string | null;
  constraints: string | null;
  definition_of_done: string;
  deadline: string | null;
  status: string;
  requires_approval: boolean;
  approval_event_id: string | null;
  next_step_if_success: string | null;
  next_step_if_failure: string | null;
  updated_at: string;
}

function toTask(row: TaskRow): CommandTask {
  return {
    task_id: row.task_id,
    created_at: row.created_at,
    venture: row.venture as Venture,
    assigned_agent: row.assigned_agent,
    category: row.category as TaskCategory,
    priority: row.priority as Priority,
    level: row.level as ActionLevel,
    objective: row.objective,
    context: row.context ?? "",
    constraints: row.constraints ?? "",
    definition_of_done: row.definition_of_done,
    deadline: row.deadline ?? undefined,
    status: row.status as CommandStatus,
    requires_approval: row.requires_approval,
    approval_event_id: row.approval_event_id ?? undefined,
    next_step_if_success: row.next_step_if_success ?? "",
    next_step_if_failure: row.next_step_if_failure ?? "",
    updated_at: row.updated_at,
  };
}

function fromTask(task: CommandTask): TaskRow {
  return {
    task_id: task.task_id,
    created_at: task.created_at,
    venture: task.venture,
    assigned_agent: task.assigned_agent,
    category: task.category,
    priority: task.priority,
    level: task.level,
    objective: task.objective,
    context: task.context,
    constraints: task.constraints,
    definition_of_done: task.definition_of_done,
    deadline: task.deadline ?? null,
    status: task.status,
    requires_approval: task.requires_approval,
    approval_event_id: task.approval_event_id ?? null,
    next_step_if_success: task.next_step_if_success,
    next_step_if_failure: task.next_step_if_failure,
    updated_at: task.updated_at,
  };
}

function query(filter: TaskFilter): string {
  const parts = [`order=deadline.asc.nullslast`, `limit=${filter.limit ?? 100}`];
  if (filter.venture) parts.push(`venture=eq.${eq(filter.venture)}`);
  if (filter.status) parts.push(`status=eq.${eq(filter.status)}`);
  if (filter.assigned_agent) parts.push(`assigned_agent=eq.${eq(filter.assigned_agent)}`);
  if (filter.dueBefore) parts.push(`deadline=lte.${eq(filter.dueBefore)}`);
  if (filter.openOnly) {
    parts.push(`status=in.(${encodeURIComponent(OPEN_STATUSES.join(","))})`);
  }
  return parts.join("&");
}

export function createSupabaseTaskStore(cfg: SupabaseConfig, clock: Clock = systemClock): TaskStore {
  return {
    async create(draft, now = clock()) {
      // La validation vit du côté métier et s'applique quel que soit le
      // stockage : une tâche vague ne devient pas acceptable parce qu'elle a
      // trouvé une base de données.
      const problems = validateTask(draft);
      if (problems.length > 0) throw new VagueTaskError(problems);

      const task = buildTask(draft, now);
      const rows = await request<TaskRow[]>(cfg, {
        method: "POST",
        path: "/command_tasks",
        body: [fromTask(task)],
        prefer: "resolution=merge-duplicates,return=representation",
      });
      const row = rows[0];
      return row ? toTask(row) : task;
    },

    async get(taskId) {
      const rows = await request<TaskRow[]>(cfg, {
        path: `/command_tasks?task_id=eq.${eq(taskId)}&limit=1`,
      });
      const row = rows[0];
      return row ? toTask(row) : undefined;
    },

    async list(filter = {}) {
      const rows = await request<TaskRow[]>(cfg, { path: `/command_tasks?${query(filter)}` });
      return rows.map(toTask).sort(byUrgency);
    },

    async setStatus(taskId, status, now) {
      const rows = await request<TaskRow[]>(cfg, {
        method: "PATCH",
        path: `/command_tasks?task_id=eq.${eq(taskId)}`,
        body: { status, updated_at: now },
        prefer: "return=representation",
      });
      const row = rows[0];
      return row ? toTask(row) : undefined;
    },

    async link(taskId, approvalEventId, now) {
      const rows = await request<TaskRow[]>(cfg, {
        method: "PATCH",
        path: `/command_tasks?task_id=eq.${eq(taskId)}`,
        body: { approval_event_id: approvalEventId, updated_at: now },
        prefer: "return=representation",
      });
      const row = rows[0];
      return row ? toTask(row) : undefined;
    },
  };
}

/* ------------------------------------------------------------------ *
 * Chiffres saisis
 * ------------------------------------------------------------------ */

interface KpiRow {
  id: string;
  recorded_at: string;
  venture: string;
  metric: string;
  value: number;
  note: string | null;
  recorded_by: string;
}

function toKpi(row: KpiRow): KpiEntry {
  return {
    id: row.id,
    recorded_at: row.recorded_at,
    venture: row.venture as Venture,
    metric: row.metric as KpiEntry["metric"],
    value: Number(row.value),
    note: row.note ?? "",
    by: row.recorded_by,
  };
}

export function createSupabaseKpiStore(cfg: SupabaseConfig, clock: Clock = systemClock): KpiStore {
  return {
    async record(draft, now = clock()) {
      const recordedAt = draft.recorded_at ?? now;
      const rows = await request<KpiRow[]>(cfg, {
        method: "POST",
        path: "/command_kpis",
        body: [
          {
            id: `kpi_${new Date(recordedAt).getTime()}_${draft.metric}_${draft.venture}`,
            recorded_at: recordedAt,
            venture: draft.venture,
            metric: draft.metric,
            value: draft.value,
            note: draft.note,
            recorded_by: draft.by,
          },
        ],
        prefer: "resolution=merge-duplicates,return=representation",
      });
      const row = rows[0];
      return row ? toKpi(row) : { ...draft, id: "kpi_local", recorded_at: recordedAt };
    },

    async list(filter: KpiFilter = {}) {
      const parts = [`order=recorded_at.desc`, `limit=${filter.limit ?? 200}`];
      if (filter.venture) parts.push(`venture=eq.${eq(filter.venture)}`);
      if (filter.metric) parts.push(`metric=eq.${eq(filter.metric)}`);
      if (filter.since) parts.push(`recorded_at=gt.${eq(filter.since)}`);
      const rows = await request<KpiRow[]>(cfg, { path: `/command_kpis?${parts.join("&")}` });
      return rows.map(toKpi);
    },
  };
}

/** Repli mémoire, pour garder la même forme quand Supabase n'est pas configuré. */
export { createKpiStore };
