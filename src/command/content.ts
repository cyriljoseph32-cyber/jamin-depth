import { systemClock, type Clock } from "@/agents/audit";
import type { Journal } from "./journal";
import {
  newContentId,
  type CommandEvent,
  type ContentChannel,
  type ContentFormat,
  type ContentGoal,
  type ContentStatus,
  type Venture,
} from "./types";

/**
 * Le calendrier éditorial.
 *
 * Deux questions du mandat sont indécidables sans ce registre : « qu'est-ce qui
 * est prévu dans les 7 prochains jours ? » et « quelle activité est silencieuse
 * depuis 72 heures ? ». Toutes deux exigent de connaître les contenus *prévus*,
 * pas seulement ceux qui ont été publiés — et rien, jusqu'ici, ne les tenait.
 *
 * Comme les tâches : implémentation mémoire ici, adaptateur Supabase à côté,
 * et rien n'entre dans la table sans passer par le journal.
 */

export interface ContentItem {
  content_id: string;
  created_at: string;
  venture: Venture;
  channel: ContentChannel;
  format: ContentFormat;
  goal: ContentGoal;
  /** À qui ça s'adresse. Une audience vague donne un contenu vague. */
  target_audience: string;
  /** La première phrase ou l'idée visuelle. */
  hook: string;
  key_message: string;
  cta: string;
  /** Photo, vidéo, témoignage… ou rien. Ce qui manque pour publier. */
  asset_needed: string;
  caption_draft: string;
  status: ContentStatus;
  /** Quand ça doit sortir. Absent tant que ce n'est pas arbitré. */
  scheduled_at?: string;
  /** L'URL du post une fois publié — la preuve, comme partout ailleurs. */
  published_url?: string;
  updated_at: string;
}

export type ContentDraft = Omit<
  ContentItem,
  "content_id" | "created_at" | "updated_at" | "status"
> &
  Partial<Pick<ContentItem, "content_id" | "status">>;

export interface ContentFilter {
  venture?: Venture;
  channel?: ContentChannel;
  status?: ContentStatus;
  /** Programmé avant cet instant ISO — la fenêtre des 7 jours. */
  scheduledBefore?: string;
  /** Ne renvoie que ce qui n'est ni publié ni abandonné. */
  openOnly?: boolean;
  /** Défaut : 100. */
  limit?: number;
}

export interface ContentStore {
  create(draft: ContentDraft, now?: string): Promise<ContentItem>;
  get(contentId: string): Promise<ContentItem | undefined>;
  list(filter?: ContentFilter): Promise<readonly ContentItem[]>;
  setStatus(contentId: string, status: ContentStatus, now: string): Promise<ContentItem | undefined>;
  schedule(contentId: string, at: string, now: string): Promise<ContentItem | undefined>;
  /** Marque publié et enregistre l'URL — sans elle, la publication reste invérifiable. */
  publish(contentId: string, url: string, now: string): Promise<ContentItem | undefined>;
}

/** Ce qui n'est ni sorti ni enterré. */
export const OPEN_CONTENT_STATUSES: readonly ContentStatus[] = [
  "DRAFT",
  "WAITING_APPROVAL",
  "APPROVED",
  "SCHEDULED",
];

export function isOpenContent(item: ContentItem): boolean {
  return OPEN_CONTENT_STATUSES.includes(item.status);
}

/** Au-delà, une activité est muette et ça se voit. Seuil du mandat. */
export const SILENCE_AFTER_MS = 72 * 3_600_000;

/** L'horizon du calendrier montré par `/contenu`. */
export const CALENDAR_HORIZON_MS = 7 * 86_400_000;

/**
 * Ce qui rend un contenu publiable.
 *
 * Un brouillon sans légende ni appel à l'action n'est pas un contenu, c'est une
 * intention — et une intention rangée dans le calendrier fait croire que le
 * créneau est couvert alors qu'il ne l'est pas. Même logique que
 * `validateTask` : le refus est mécanique.
 */
export function validateContent(draft: ContentDraft): string[] {
  const problems: string[] = [];
  if (draft.caption_draft.trim().length === 0) {
    problems.push("caption_draft : obligatoire — un créneau sans texte n'est pas couvert");
  }
  if (draft.hook.trim().length === 0) {
    problems.push("hook : obligatoire — la première phrase décide si la suite est lue");
  }
  if (draft.cta.trim().length === 0) {
    problems.push("cta : obligatoire — un contenu sans action demandée ne convertit rien");
  }
  if (draft.target_audience.trim().length === 0) {
    problems.push("target_audience : obligatoire — « tout le monde » n'est pas une audience");
  }
  if (draft.scheduled_at && Number.isNaN(new Date(draft.scheduled_at).getTime())) {
    problems.push("scheduled_at : ISO-8601 ou absent");
  }
  return problems;
}

export function buildContent(
  draft: ContentDraft,
  now: string,
  id: string = newContentId(now),
): ContentItem {
  return {
    content_id: draft.content_id ?? id,
    created_at: now,
    venture: draft.venture,
    channel: draft.channel,
    format: draft.format,
    goal: draft.goal,
    target_audience: draft.target_audience.trim(),
    hook: draft.hook.trim(),
    key_message: draft.key_message,
    cta: draft.cta.trim(),
    asset_needed: draft.asset_needed,
    caption_draft: draft.caption_draft.trim(),
    status: draft.status ?? "DRAFT",
    scheduled_at: draft.scheduled_at,
    published_url: draft.published_url,
    updated_at: now,
  };
}

export function matchesContent(item: ContentItem, filter: ContentFilter = {}): boolean {
  if (filter.venture && item.venture !== filter.venture) return false;
  if (filter.channel && item.channel !== filter.channel) return false;
  if (filter.status && item.status !== filter.status) return false;
  if (filter.openOnly && !isOpenContent(item)) return false;
  if (filter.scheduledBefore) {
    if (!item.scheduled_at || item.scheduled_at > filter.scheduledBefore) return false;
  }
  return true;
}

/** Le plus proche de sa sortie d'abord ; les non programmés à la fin. */
export function bySchedule(a: ContentItem, b: ContentItem): number {
  const sa = a.scheduled_at ?? "9999";
  const sb = b.scheduled_at ?? "9999";
  return sa.localeCompare(sb) || a.created_at.localeCompare(b.created_at);
}

export function createContentStore(clock: Clock = systemClock): ContentStore {
  const items = new Map<string, ContentItem>();

  const patch = (contentId: string, change: Partial<ContentItem>, now: string) => {
    const item = items.get(contentId);
    if (!item) return undefined;
    const updated = { ...item, ...change, updated_at: now };
    items.set(contentId, updated);
    return updated;
  };

  return {
    async create(draft, now = clock()) {
      const problems = validateContent(draft);
      if (problems.length > 0) throw new EmptyContentError(problems);
      const item = buildContent(draft, now);
      items.set(item.content_id, item);
      return item;
    },

    async get(contentId) {
      return items.get(contentId);
    },

    async list(filter = {}) {
      return [...items.values()]
        .filter((i) => matchesContent(i, filter))
        .sort(bySchedule)
        .slice(0, filter.limit ?? 100);
    },

    async setStatus(contentId, status, now) {
      return patch(contentId, { status }, now);
    },

    async schedule(contentId, at, now) {
      return patch(contentId, { scheduled_at: at, status: "SCHEDULED" }, now);
    },

    async publish(contentId, url, now) {
      return patch(contentId, { status: "PUBLISHED", published_url: url }, now);
    },
  };
}

/** Le refus d'un contenu creux, avec ce qu'il faut compléter. */
export class EmptyContentError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(`contenu incomplet : ${problems.join(" ; ")}`);
    this.name = "EmptyContentError";
  }
}

/* ------------------------------------------------------------------ *
 * Le silence
 * ------------------------------------------------------------------ */

export interface SilenceReport {
  venture: Venture;
  /** Dernière publication connue, ou `undefined` si aucune n'est enregistrée. */
  lastPublishedAt?: string;
  /** Contenus prêts mais pas encore sortis — le silence est-il évitable ? */
  readyToPublish: number;
}

/**
 * Les activités muettes depuis plus de 72 heures.
 *
 * `readyToPublish` change complètement la lecture : une activité silencieuse
 * avec trois contenus validés en attente est un problème de publication, pas de
 * production, et ces deux-là ne se règlent pas de la même façon.
 */
export function silentVentures(
  items: readonly ContentItem[],
  ventures: readonly Venture[],
  now: string,
): SilenceReport[] {
  const floor = new Date(new Date(now).getTime() - SILENCE_AFTER_MS).toISOString();

  return ventures
    .map((venture) => {
      const mine = items.filter((i) => i.venture === venture);
      const published = mine
        .filter((i) => i.status === "PUBLISHED")
        .map((i) => i.updated_at)
        .sort();
      const lastPublishedAt = published.at(-1);
      const readyToPublish = mine.filter(
        (i) => i.status === "APPROVED" || i.status === "SCHEDULED",
      ).length;
      return { venture, lastPublishedAt, readyToPublish };
    })
    .filter((r) => r.lastPublishedAt === undefined || r.lastPublishedAt < floor);
}

/* ------------------------------------------------------------------ *
 * Contenu + journal, indissociables
 * ------------------------------------------------------------------ */

export interface ContentDeps {
  content: ContentStore;
  journal: Journal;
  /** L'agent qui propose le contenu. */
  agent: string;
  now: string;
}

export interface DraftedContent {
  item: ContentItem;
  event: CommandEvent;
}

/**
 * Enregistre un brouillon et l'événement qui le soumet à validation.
 *
 * Un contenu part toujours en `WAITING_APPROVAL` : publier est une action A3,
 * et rien dans ce système ne sort sans un `/approve` portant l'identifiant
 * exact. Le brouillon, lui, est du A1 — il ne coûte rien s'il est rejeté.
 */
export async function draftContent(
  draft: ContentDraft,
  deps: ContentDeps,
): Promise<DraftedContent> {
  const item = await deps.content.create({ ...draft, status: "WAITING_APPROVAL" }, deps.now);

  const event = await deps.journal.append(
    {
      venture: item.venture,
      agent: deps.agent,
      type: "ACTION",
      priority: "P2",
      status: "WAITING_APPROVAL",
      category: "content",
      summary: `${item.format} ${item.channel} — ${item.hook}`,
      details: [
        `Pourquoi : ${item.goal} · ${item.target_audience}`,
        `Détail : ${item.caption_draft}`,
        `Décision : publier ou non — CTA « ${item.cta} »`,
        item.asset_needed ? `Contraintes : à fournir — ${item.asset_needed}` : "",
      ]
        .filter((line) => line.length > 0)
        .join("\n"),
      links: [item.content_id],
      next_action: item.asset_needed
        ? `fournir ${item.asset_needed}, puis programmer`
        : "programmer la publication",
      needs_owner: true,
      // Publier sort de la maison : A3, quelle que soit l'urgence.
      level: 3,
    },
    deps.now,
  );

  return { item, event };
}
