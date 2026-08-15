import type { AuditEntry } from "../audit";
import type { ApprovalQueue, QueuedItem, QueueStatus } from "../queue";
import { byUrgency } from "../queue";
import type { AgentName, ApproverRole, Activity, Channel, Contact, Priority, ProposedAction, SensitiveTopic } from "../types";
import {
  contactKey,
  mergeLead,
  DUPLICATE_WINDOW_MS,
  type CrmPort,
  type Lead,
  type LeadStage,
  type LeadUpsert,
  type SeenStore,
} from "./index";

/**
 * Supabase persistence, over PostgREST with plain `fetch`.
 *
 * No `@supabase/supabase-js`: the client would pull a dependency tree for four
 * tables' worth of CRUD, and this repo already documents (in
 * `src/lib/analytics.ts`) why it avoids dependencies it can do without. What we
 * need is a REST call with two headers.
 *
 * The service-role key bypasses row-level security, so these functions must only
 * ever run server-side — they are imported by API routes, never by a component.
 *
 * Schema lives in `supabase/schema.sql`.
 */

export interface SupabaseConfig {
  url: string;
  serviceRoleKey: string;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
}

/** Reads the environment; returns `null` when unconfigured so callers can fall back to mocks. */
export function supabaseFromEnv(): SupabaseConfig | null {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) return null;
  return { url, serviceRoleKey };
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  body?: unknown;
  /** `return=representation` to get rows back, `resolution=merge-duplicates` to upsert. */
  prefer?: string;
}

class PostgrestError extends Error {
  constructor(
    readonly status: number,
    readonly detail: string,
  ) {
    super(`Supabase ${status}: ${detail}`);
    this.name = "PostgrestError";
  }
}

async function request<T>(cfg: SupabaseConfig, options: RequestOptions): Promise<T> {
  const doFetch = cfg.fetchImpl ?? fetch;
  const res = await doFetch(`${cfg.url}/rest/v1${options.path}`, {
    method: options.method ?? "GET",
    headers: {
      apikey: cfg.serviceRoleKey,
      Authorization: `Bearer ${cfg.serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(options.prefer ? { Prefer: options.prefer } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
  });

  if (!res.ok) throw new PostgrestError(res.status, await res.text().catch(() => "<no body>"));
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text.length > 0 ? JSON.parse(text) : undefined) as T;
}

/** PostgREST filter-safe encoding for a value used in `col=eq.<value>`. */
function eq(value: string): string {
  return encodeURIComponent(value);
}

/* ------------------------------------------------------------------ *
 * Leads
 * ------------------------------------------------------------------ */

interface LeadRow {
  id: string;
  key: string;
  contact: Contact;
  channel: string;
  locale: string;
  activity: string | null;
  dates: string[] | null;
  party_size: number | null;
  certified: boolean | null;
  stage: string;
  sensitive_topics: string[] | null;
  follow_ups: number;
  last_follow_up_at: string | null;
  notes: string[] | null;
  created_at: string;
  updated_at: string;
}

function toLead(row: LeadRow): Lead {
  return {
    id: row.id,
    key: row.key,
    contact: row.contact ?? {},
    channel: row.channel as Channel,
    locale: row.locale,
    activity: (row.activity ?? undefined) as Activity | undefined,
    dates: row.dates ?? [],
    partySize: row.party_size ?? undefined,
    certified: row.certified ?? undefined,
    stage: row.stage as LeadStage,
    sensitiveTopics: (row.sensitive_topics ?? []) as SensitiveTopic[],
    followUps: row.follow_ups,
    lastFollowUpAt: row.last_follow_up_at ?? undefined,
    notes: row.notes ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function fromLead(lead: Lead): LeadRow {
  return {
    id: lead.id,
    key: lead.key,
    contact: lead.contact,
    channel: lead.channel,
    locale: lead.locale,
    activity: lead.activity ?? null,
    dates: lead.dates,
    party_size: lead.partySize ?? null,
    certified: lead.certified ?? null,
    stage: lead.stage,
    sensitive_topics: lead.sensitiveTopics,
    follow_ups: lead.followUps,
    last_follow_up_at: lead.lastFollowUpAt ?? null,
    notes: lead.notes,
    created_at: lead.createdAt,
    updated_at: lead.updatedAt,
  };
}

export function createSupabaseCrm(cfg: SupabaseConfig, now: () => string = () => new Date().toISOString()): CrmPort {
  async function byKey(key: string): Promise<Lead | undefined> {
    const rows = await request<LeadRow[]>(cfg, { path: `/leads?key=eq.${eq(key)}&limit=1` });
    const row = rows[0];
    return row ? toLead(row) : undefined;
  }

  async function patch(key: string, patchBody: Partial<LeadRow>): Promise<Lead | undefined> {
    const rows = await request<LeadRow[]>(cfg, {
      method: "PATCH",
      path: `/leads?key=eq.${eq(key)}`,
      body: patchBody,
      prefer: "return=representation",
    });
    const row = rows[0];
    return row ? toLead(row) : undefined;
  }

  return {
    name: "crm:supabase",
    status: "connected",

    async upsert(input: LeadUpsert) {
      const key = contactKey(input.contact, input.channel);
      const at = now();
      const existing = await byKey(key);

      if (existing) {
        const merged = mergeLead(existing, input, at);
        const updated = await patch(key, fromLead(merged));
        return updated ?? merged;
      }

      const lead: Lead = {
        id: crypto.randomUUID(),
        key,
        followUps: input.followUps ?? 0,
        createdAt: at,
        updatedAt: at,
        notes: [],
        ...input,
      };
      // `merge-duplicates` covers the race where two webhooks for the same
      // person land at once: the second becomes an update instead of a 409.
      const rows = await request<LeadRow[]>(cfg, {
        method: "POST",
        path: "/leads",
        body: [fromLead(lead)],
        prefer: "resolution=merge-duplicates,return=representation",
      });
      const row = rows[0];
      return row ? toLead(row) : lead;
    },

    async find(key) {
      return byKey(key);
    },

    async addNote(key, note) {
      const lead = await byKey(key);
      if (!lead) return undefined;
      return patch(key, { notes: [...lead.notes, note], updated_at: now() });
    },

    async setStage(key, stage) {
      return patch(key, { stage, updated_at: now() });
    },

    async countFollowUp(key, at) {
      const lead = await byKey(key);
      if (!lead) return undefined;
      return patch(key, { follow_ups: lead.followUps + 1, last_follow_up_at: at, updated_at: now() });
    },

    async all() {
      const rows = await request<LeadRow[]>(cfg, { path: "/leads?order=created_at.desc&limit=500" });
      return rows.map(toLead);
    },
  };
}

/* ------------------------------------------------------------------ *
 * Approval queue
 * ------------------------------------------------------------------ */

interface QueueRow {
  id: string;
  event_id: string;
  agent: string;
  action: ProposedAction;
  priority: string;
  approver: string;
  reasons: string[] | null;
  summary: string;
  queued_at: string;
  status: string;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  executed_at: string | null;
}

function toItem(row: QueueRow): QueuedItem {
  return {
    id: row.id,
    eventId: row.event_id,
    agent: row.agent as AgentName,
    action: row.action,
    priority: row.priority as Priority,
    approver: row.approver as ApproverRole,
    reasons: row.reasons ?? [],
    summary: row.summary,
    queuedAt: row.queued_at,
    status: row.status as QueueStatus,
    decidedBy: row.decided_by ?? undefined,
    decidedAt: row.decided_at ?? undefined,
    decisionNote: row.decision_note ?? undefined,
    executedAt: row.executed_at ?? undefined,
  };
}

export function createSupabaseQueue(
  cfg: SupabaseConfig,
  now: () => string = () => new Date().toISOString(),
): ApprovalQueue {
  /**
   * Decide, but only if still pending.
   *
   * The `status=eq.pending` filter is the important part: it makes the
   * transition atomic in the database. Two taps on the Telegram button arriving
   * together cannot both succeed, so an approved message cannot be sent twice.
   */
  async function decide(
    id: string,
    status: QueueStatus,
    by: string,
    note?: string,
  ): Promise<QueuedItem | undefined> {
    const rows = await request<QueueRow[]>(cfg, {
      method: "PATCH",
      path: `/queue_items?id=eq.${eq(id)}&status=eq.pending`,
      body: { status, decided_by: by, decided_at: now(), decision_note: note ?? null },
      prefer: "return=representation",
    });
    const row = rows[0];
    return row ? toItem(row) : undefined;
  }

  return {
    async enqueue({ eventId, agent, action, priority }) {
      const item: QueuedItem = {
        id: crypto.randomUUID(),
        eventId,
        agent,
        action,
        priority,
        approver: action.approval?.approver ?? "owner",
        reasons: action.approval?.reasons ?? ["rule:unclassified"],
        summary: action.summary,
        queuedAt: now(),
        status: "pending",
      };
      await request<QueueRow[]>(cfg, {
        method: "POST",
        path: "/queue_items",
        body: [
          {
            id: item.id,
            event_id: item.eventId,
            agent: item.agent,
            action: item.action,
            priority: item.priority,
            approver: item.approver,
            reasons: item.reasons,
            summary: item.summary,
            queued_at: item.queuedAt,
            status: item.status,
          },
        ],
      });
      return item;
    },

    async get(id) {
      const rows = await request<QueueRow[]>(cfg, { path: `/queue_items?id=eq.${eq(id)}&limit=1` });
      const row = rows[0];
      return row ? toItem(row) : undefined;
    },

    async pending(approver) {
      const filter = approver === undefined ? "" : `&approver=eq.${eq(approver)}`;
      const rows = await request<QueueRow[]>(cfg, {
        path: `/queue_items?status=eq.pending${filter}&order=queued_at.asc&limit=200`,
      });
      return rows.map(toItem).sort(byUrgency);
    },

    async approve(id, by, note) {
      return decide(id, "approved", by, note);
    },

    async reject(id, by, note) {
      return decide(id, "rejected", by, note);
    },

    async markExecuted(id, at) {
      const rows = await request<QueueRow[]>(cfg, {
        method: "PATCH",
        path: `/queue_items?id=eq.${eq(id)}`,
        body: { executed_at: at },
        prefer: "return=representation",
      });
      const row = rows[0];
      return row ? toItem(row) : undefined;
    },

    async all() {
      const rows = await request<QueueRow[]>(cfg, { path: "/queue_items?order=queued_at.desc&limit=500" });
      return rows.map(toItem);
    },
  };
}

/* ------------------------------------------------------------------ *
 * De-duplication
 * ------------------------------------------------------------------ */

export function createSupabaseSeenStore(cfg: SupabaseConfig): SeenStore {
  return {
    name: "seen:supabase",
    status: "connected",

    async claim(eventId, fingerprint, receivedAt) {
      // The primary key does the work: a duplicate delivery collides here.
      try {
        await request(cfg, {
          method: "POST",
          path: "/processed_events",
          body: [{ event_id: eventId, fingerprint, received_at: receivedAt }],
        });
      } catch (err) {
        if (err instanceof PostgrestError && err.status === 409) return false;
        throw err;
      }

      // Same text, same thread, minutes apart: a person sending twice, not a retry.
      const since = new Date(new Date(receivedAt).getTime() - DUPLICATE_WINDOW_MS).toISOString();
      const rows = await request<{ event_id: string }[]>(cfg, {
        path: `/processed_events?fingerprint=eq.${eq(fingerprint)}&received_at=gte.${eq(since)}&select=event_id&limit=5`,
      });
      return rows.filter((r) => r.event_id !== eventId).length === 0;
    },
  };
}

/* ------------------------------------------------------------------ *
 * Audit journal
 * ------------------------------------------------------------------ */

/**
 * Batched writer for the journal — one insert per run, not one per line.
 * Returned as a plain function because that is what the orchestrator's
 * `persistAudit` hook expects.
 */
export function createSupabaseAuditSink(cfg: SupabaseConfig) {
  return async function persistAudit(entries: readonly AuditEntry[]): Promise<void> {
    if (entries.length === 0) return;
    await request(cfg, {
      method: "POST",
      path: "/audit_log",
      body: entries.map((e) => ({
        at: e.at,
        event_id: e.eventId,
        agent: e.agent,
        step: e.step,
        detail: e.detail,
      })),
    });
  };
}

export { PostgrestError };
