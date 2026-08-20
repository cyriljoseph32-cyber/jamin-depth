import { systemClock, type Clock } from "@/agents/audit";
import { isVenture, type Venture } from "./types";

/**
 * Les chiffres — saisis, jamais devinés.
 *
 * Le mandat demande un CA confirmé, des réservations, des inscriptions. Aucun
 * paiement, aucune réservation et aucune inscription ne transitent par ce
 * système : il ne peut donc pas les connaître. Deux issues seulement — mentir,
 * ou demander. Cette table est la deuxième : Cyril saisit ce qu'il constate,
 * le bilan restitue ce qui a été saisi, et affiche `[À COMPLÉTER PAR CYRIL]`
 * partout ailleurs.
 *
 * Le jour où une vraie source existe (Stripe, un back-office), elle poussera
 * dans cette même table par l'API d'ingestion, sans rien changer aux rapports.
 */

export const kpiMetrics = [
  "leads",
  "bookings",
  "signups",
  "revenue_thb",
  "content_published",
  "prospects",
] as const;
export type KpiMetric = (typeof kpiMetrics)[number];

export function isKpiMetric(value: string): value is KpiMetric {
  return (kpiMetrics as readonly string[]).includes(value);
}

/** Ce qu'on affiche à la place d'un chiffre qu'on n'a pas. Jamais un zéro. */
export const NOT_PROVIDED = "[À COMPLÉTER PAR CYRIL]";

export const METRIC_LABEL: Readonly<Record<KpiMetric, string>> = {
  leads: "Leads",
  bookings: "Réservations",
  signups: "Inscriptions",
  revenue_thb: "CA confirmé (THB)",
  content_published: "Contenus publiés",
  prospects: "Prospects",
};

export interface KpiEntry {
  id: string;
  recorded_at: string;
  venture: Venture;
  metric: KpiMetric;
  value: number;
  note: string;
  /** Qui a saisi — c'est une déclaration humaine, elle est signée. */
  by: string;
}

export type KpiDraft = Omit<KpiEntry, "id" | "recorded_at"> & Partial<Pick<KpiEntry, "recorded_at">>;

export interface KpiFilter {
  venture?: Venture;
  metric?: KpiMetric;
  /** ISO : ne renvoie que ce qui est postérieur. */
  since?: string;
  limit?: number;
}

export interface KpiStore {
  record(draft: KpiDraft, now?: string): Promise<KpiEntry>;
  list(filter?: KpiFilter): Promise<readonly KpiEntry[]>;
}

export function createKpiStore(clock: Clock = systemClock): KpiStore {
  const entries: KpiEntry[] = [];

  return {
    async record(draft, now = clock()) {
      const entry: KpiEntry = {
        id: `kpi_${new Date(now).getTime()}_${entries.length}`,
        recorded_at: draft.recorded_at ?? now,
        venture: draft.venture,
        metric: draft.metric,
        value: draft.value,
        note: draft.note,
        by: draft.by,
      };
      entries.push(entry);
      return entry;
    },

    async list(filter = {}) {
      return entries
        .filter((e) => {
          if (filter.venture && e.venture !== filter.venture) return false;
          if (filter.metric && e.metric !== filter.metric) return false;
          if (filter.since && e.recorded_at <= filter.since) return false;
          return true;
        })
        .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))
        .slice(0, filter.limit ?? 200);
    },
  };
}

/**
 * Le total d'une métrique sur les entrées fournies.
 *
 * `null` quand rien n'a été saisi — et c'est toute la nuance : zéro saisie et
 * zéro réservation sont deux affirmations différentes, la seconde étant la
 * seule que le système ait le droit de faire.
 */
export function totalFor(entries: readonly KpiEntry[], metric: KpiMetric, venture?: Venture): number | null {
  const matching = entries.filter((e) => e.metric === metric && (!venture || e.venture === venture));
  if (matching.length === 0) return null;
  return matching.reduce((sum, e) => sum + e.value, 0);
}

/** La même chose, prête à afficher. */
export function displayFor(entries: readonly KpiEntry[], metric: KpiMetric, venture?: Venture): string {
  const total = totalFor(entries, metric, venture);
  return total === null ? NOT_PROVIDED : String(total);
}

export type KpiParse =
  | { ok: true; draft: Omit<KpiDraft, "by"> }
  | { ok: false; message: string };

/**
 * `/kpi diving bookings 3 deux Open Water` → une saisie.
 *
 * Volontairement positionnel et court : c'est tapé sur un téléphone, souvent
 * d'une main, souvent le soir.
 */
export function parseKpi(args: string): KpiParse {
  const [rawVenture, rawMetric, rawValue, ...rest] = args.split(/\s+/).filter((s) => s.length > 0);
  const usage = `Utilisation : /kpi [projet] [métrique] [valeur] [note]\nProjets : COCO, DIVING, RUGBY, GLOBAL\nMétriques : ${kpiMetrics.join(", ")}`;

  const venture = (rawVenture ?? "").toUpperCase();
  if (!isVenture(venture)) return { ok: false, message: usage };

  const metric = (rawMetric ?? "").toLowerCase();
  if (!isKpiMetric(metric)) return { ok: false, message: usage };

  const value = Number(rawValue);
  if (!Number.isFinite(value) || value < 0) {
    return { ok: false, message: `Valeur invalide : « ${rawValue ?? ""} ». Un nombre positif est attendu.` };
  }

  return { ok: true, draft: { venture, metric, value, note: rest.join(" ") } };
}
