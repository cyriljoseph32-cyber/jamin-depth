import { eq, request, type SupabaseConfig } from "@/agents/adapters/supabase";
import { systemClock, type Clock } from "@/agents/audit";
import {
  buildContent,
  bySchedule,
  EmptyContentError,
  OPEN_CONTENT_STATUSES,
  validateContent,
  type ContentFilter,
  type ContentItem,
  type ContentStore,
} from "../content";
import type {
  ContentChannel,
  ContentFormat,
  ContentGoal,
  ContentStatus,
  Venture,
} from "../types";

/**
 * Le calendrier éditorial, persistant.
 *
 * Même canal que le reste : PostgREST et `fetch`. Schéma dans
 * `supabase/schema.sql` (`command_content`).
 *
 * Serveur uniquement — la clé `service_role` contourne RLS.
 */

interface ContentRow {
  content_id: string;
  created_at: string;
  venture: string;
  channel: string;
  format: string;
  goal: string;
  target_audience: string;
  hook: string;
  key_message: string | null;
  cta: string;
  asset_needed: string | null;
  caption_draft: string;
  status: string;
  scheduled_at: string | null;
  published_url: string | null;
  updated_at: string;
}

function toContent(row: ContentRow): ContentItem {
  return {
    content_id: row.content_id,
    created_at: row.created_at,
    venture: row.venture as Venture,
    channel: row.channel as ContentChannel,
    format: row.format as ContentFormat,
    goal: row.goal as ContentGoal,
    target_audience: row.target_audience,
    hook: row.hook,
    key_message: row.key_message ?? "",
    cta: row.cta,
    asset_needed: row.asset_needed ?? "",
    caption_draft: row.caption_draft,
    status: row.status as ContentStatus,
    scheduled_at: row.scheduled_at ?? undefined,
    published_url: row.published_url ?? undefined,
    updated_at: row.updated_at,
  };
}

function fromContent(item: ContentItem): ContentRow {
  return {
    content_id: item.content_id,
    created_at: item.created_at,
    venture: item.venture,
    channel: item.channel,
    format: item.format,
    goal: item.goal,
    target_audience: item.target_audience,
    hook: item.hook,
    key_message: item.key_message,
    cta: item.cta,
    asset_needed: item.asset_needed,
    caption_draft: item.caption_draft,
    status: item.status,
    scheduled_at: item.scheduled_at ?? null,
    published_url: item.published_url ?? null,
    updated_at: item.updated_at,
  };
}

function query(filter: ContentFilter): string {
  const parts = [`order=scheduled_at.asc.nullslast`, `limit=${filter.limit ?? 100}`];
  if (filter.venture) parts.push(`venture=eq.${eq(filter.venture)}`);
  if (filter.channel) parts.push(`channel=eq.${eq(filter.channel)}`);
  if (filter.status) parts.push(`status=eq.${eq(filter.status)}`);
  if (filter.scheduledBefore) parts.push(`scheduled_at=lte.${eq(filter.scheduledBefore)}`);
  if (filter.openOnly) {
    parts.push(`status=in.(${encodeURIComponent(OPEN_CONTENT_STATUSES.join(","))})`);
  }
  return parts.join("&");
}

export function createSupabaseContentStore(
  cfg: SupabaseConfig,
  clock: Clock = systemClock,
): ContentStore {
  const patch = async (contentId: string, body: Record<string, unknown>) => {
    const rows = await request<ContentRow[]>(cfg, {
      method: "PATCH",
      path: `/command_content?content_id=eq.${eq(contentId)}`,
      body,
      prefer: "return=representation",
    });
    const row = rows[0];
    return row ? toContent(row) : undefined;
  };

  return {
    async create(draft, now = clock()) {
      // La validation vit du côté métier et s'applique quel que soit le
      // stockage : un contenu creux ne devient pas publiable parce qu'il a
      // trouvé une base de données.
      const problems = validateContent(draft);
      if (problems.length > 0) throw new EmptyContentError(problems);

      const item = buildContent(draft, now);
      const rows = await request<ContentRow[]>(cfg, {
        method: "POST",
        path: "/command_content",
        body: [fromContent(item)],
        prefer: "resolution=merge-duplicates,return=representation",
      });
      const row = rows[0];
      return row ? toContent(row) : item;
    },

    async get(contentId) {
      const rows = await request<ContentRow[]>(cfg, {
        path: `/command_content?content_id=eq.${eq(contentId)}&limit=1`,
      });
      const row = rows[0];
      return row ? toContent(row) : undefined;
    },

    async list(filter = {}) {
      const rows = await request<ContentRow[]>(cfg, { path: `/command_content?${query(filter)}` });
      return rows.map(toContent).sort(bySchedule);
    },

    async setStatus(contentId, status, now) {
      return patch(contentId, { status, updated_at: now });
    },

    async schedule(contentId, at, now) {
      return patch(contentId, { scheduled_at: at, status: "SCHEDULED", updated_at: now });
    },

    async publish(contentId, url, now) {
      return patch(contentId, { status: "PUBLISHED", published_url: url, updated_at: now });
    },
  };
}
