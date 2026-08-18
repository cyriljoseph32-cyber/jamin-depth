import { eq, request, type SupabaseConfig } from "@/agents/adapters/supabase";
import { systemClock, type Clock } from "@/agents/audit";
import type { Priority } from "@/agents/types";
import { buildEvent, byRecency, DEDUPE_WINDOW_MS, type Journal, type JournalFilter } from "../journal";
import { emptyState, type CommandState, type StateStore } from "../state";
import type { ActionLevel, CommandEvent, CommandStatus, Venture } from "../types";

/**
 * Le journal, persistant.
 *
 * Même canal que le reste du système : PostgREST et `fetch`, pas de client
 * Supabase. Schéma dans `supabase/schema.sql` (`command_events`,
 * `command_state`).
 *
 * Serveur uniquement — la clé `service_role` contourne RLS.
 */

interface EventRow {
  event_id: string;
  timestamp: string;
  venture: string;
  agent: string;
  type: string;
  priority: string;
  status: string;
  summary: string;
  details: string;
  links: string[] | null;
  next_action: string;
  needs_owner: boolean;
  level: number;
  queue_item_id: string | null;
  notified_at: string | null;
  fingerprint: string;
}

function toEvent(row: EventRow): CommandEvent {
  return {
    event_id: row.event_id,
    timestamp: row.timestamp,
    venture: row.venture as Venture,
    agent: row.agent,
    type: row.type as CommandEvent["type"],
    priority: row.priority as Priority,
    status: row.status as CommandStatus,
    summary: row.summary,
    details: row.details ?? "",
    links: row.links ?? [],
    next_action: row.next_action ?? "",
    needs_owner: row.needs_owner,
    level: row.level as ActionLevel,
    queue_item_id: row.queue_item_id ?? undefined,
    notified_at: row.notified_at ?? undefined,
    fingerprint: row.fingerprint,
  };
}

function fromEvent(event: CommandEvent): EventRow {
  return {
    event_id: event.event_id,
    timestamp: event.timestamp,
    venture: event.venture,
    agent: event.agent,
    type: event.type,
    priority: event.priority,
    status: event.status,
    summary: event.summary,
    details: event.details,
    links: [...event.links],
    next_action: event.next_action,
    needs_owner: event.needs_owner,
    level: event.level,
    queue_item_id: event.queue_item_id ?? null,
    notified_at: event.notified_at ?? null,
    fingerprint: event.fingerprint,
  };
}

function query(filter: JournalFilter): string {
  const parts = [`order=timestamp.desc`, `limit=${filter.limit ?? 100}`];
  if (filter.venture) parts.push(`venture=eq.${eq(filter.venture)}`);
  if (filter.status) parts.push(`status=eq.${eq(filter.status)}`);
  if (filter.priority) parts.push(`priority=eq.${eq(filter.priority)}`);
  if (filter.since) parts.push(`timestamp=gt.${eq(filter.since)}`);
  return parts.join("&");
}

export function createSupabaseJournal(cfg: SupabaseConfig, clock: Clock = systemClock): Journal {
  return {
    async append(input, now = clock()) {
      const floor = new Date(new Date(now).getTime() - DEDUPE_WINDOW_MS).toISOString();
      const event = buildEvent(input, now);

      // Déduplication côté base : deux agents peuvent écrire en même temps
      // depuis deux invocations serverless différentes, donc la mémoire du
      // processus ne prouve rien.
      const existing = await request<EventRow[]>(cfg, {
        path: `/command_events?fingerprint=eq.${eq(event.fingerprint)}&timestamp=gt.${eq(floor)}&limit=1`,
      });
      const duplicate = existing[0];
      if (duplicate) return toEvent(duplicate);

      const rows = await request<EventRow[]>(cfg, {
        method: "POST",
        path: "/command_events",
        body: [fromEvent(event)],
        prefer: "resolution=merge-duplicates,return=representation",
      });
      const row = rows[0];
      return row ? toEvent(row) : event;
    },

    async get(eventId) {
      const rows = await request<EventRow[]>(cfg, {
        path: `/command_events?event_id=eq.${eq(eventId)}&limit=1`,
      });
      const row = rows[0];
      return row ? toEvent(row) : undefined;
    },

    async list(filter = {}) {
      const rows = await request<EventRow[]>(cfg, { path: `/command_events?${query(filter)}` });
      return rows.map(toEvent).sort(byRecency);
    },

    async setStatus(eventId, status, details) {
      const current = await request<EventRow[]>(cfg, {
        path: `/command_events?event_id=eq.${eq(eventId)}&limit=1`,
      });
      const row = current[0];
      if (!row) return undefined;
      const updated = await request<EventRow[]>(cfg, {
        method: "PATCH",
        path: `/command_events?event_id=eq.${eq(eventId)}`,
        body: {
          status,
          details: details ? `${row.details ?? ""}\n${details}`.trim() : row.details,
        },
        prefer: "return=representation",
      });
      const next = updated[0];
      return next ? toEvent(next) : undefined;
    },

    async pendingNotification() {
      const rows = await request<EventRow[]>(cfg, {
        path: "/command_events?notified_at=is.null&order=timestamp.desc&limit=200",
      });
      return rows.map(toEvent).sort(byRecency);
    },

    async markNotified(eventIds, at) {
      if (eventIds.length === 0) return;
      const list = eventIds.map((id) => `"${id}"`).join(",");
      await request<void>(cfg, {
        method: "PATCH",
        path: `/command_events?event_id=in.(${encodeURIComponent(list)})`,
        body: { notified_at: at },
      });
    },
  };
}

/* ------------------------------------------------------------------ *
 * État de pilotage
 * ------------------------------------------------------------------ */

interface StateRow {
  id: string;
  focus: string | null;
  paused_ventures: string[] | null;
  paused_agents: string[] | null;
  updated_at: string | null;
}

/** Une seule ligne, id fixe : il n'y a qu'un pilote. */
const STATE_ID = "singleton";

export function createSupabaseStateStore(cfg: SupabaseConfig): StateStore {
  return {
    async read() {
      const rows = await request<StateRow[]>(cfg, { path: `/command_state?id=eq.${STATE_ID}&limit=1` });
      const row = rows[0];
      if (!row) return emptyState;
      return {
        focus: (row.focus ?? undefined) as CommandState["focus"],
        pausedVentures: (row.paused_ventures ?? []) as Venture[],
        pausedAgents: row.paused_agents ?? [],
        updatedAt: row.updated_at ?? undefined,
      };
    },

    async write(state) {
      await request<void>(cfg, {
        method: "POST",
        path: "/command_state",
        body: [
          {
            id: STATE_ID,
            focus: state.focus ?? null,
            paused_ventures: state.pausedVentures,
            paused_agents: state.pausedAgents,
            updated_at: state.updatedAt ?? new Date().toISOString(),
          },
        ],
        prefer: "resolution=merge-duplicates",
      });
      return state;
    },
  };
}
