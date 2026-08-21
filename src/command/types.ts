import type { ActionType, Priority } from "@/agents/types";

/**
 * COCO COMMAND — le vocabulaire du chef d'état-major.
 *
 * Une couche AU-DESSUS de `src/agents/` : celui-ci fait tourner la plongée,
 * celle-ci pilote toutes les activités de Cyril et parle à un seul humain, par
 * Telegram. Rien ici n'a d'effet de bord — comme `agents/types.ts`, ce sont des
 * données.
 *
 * Les champs sont en `snake_case` : le format de l'événement est un contrat,
 * pas un détail d'implémentation. Un autre dépôt (assistant-ai, coco2, CSRA…)
 * pousse exactement cette forme sur `/api/command/events`, et `/audit` la
 * ressort telle quelle. Traduire entre deux conventions à chaque frontière ne
 * servirait qu'à créer des divergences silencieuses.
 */

/** Les activités pilotées. `GLOBAL` = transverse (admin, finances, arbitrages). */
export const ventures = ["COCO", "DIVING", "RUGBY", "GLOBAL"] as const;
export type Venture = (typeof ventures)[number];

export function isVenture(value: string): value is Venture {
  return (ventures as readonly string[]).includes(value);
}

export const eventTypes = ["ACTION", "BRIEF", "ALERT", "APPROVAL", "RESULT", "ERROR"] as const;
export type CommandEventType = (typeof eventTypes)[number];

export const eventStatuses = [
  "PLANNED",
  "RUNNING",
  "WAITING_APPROVAL",
  "DONE",
  "FAILED",
  "BLOCKED",
] as const;
export type CommandStatus = (typeof eventStatuses)[number];

/**
 * Le domaine d'une tâche ou d'un événement.
 *
 * Sert au routage (`routing.ts`) et aux tags Telegram. Volontairement fermé :
 * une catégorie libre finit en synonymes divergents (« marketing », « mktg »,
 * « comm »), et un routage sur des synonymes rate sa cible en silence.
 */
export const taskCategories = [
  "sales",
  "content",
  "marketing",
  "partner",
  "operations",
  "finance",
  "support",
  "product",
] as const;
export type TaskCategory = (typeof taskCategories)[number];

export function isTaskCategory(value: string): value is TaskCategory {
  return (taskCategories as readonly string[]).includes(value);
}

/**
 * Le niveau d'action, de l'observation à l'irréversible.
 *
 *  0 — Observer : lire, classer, analyser.
 *  1 — Préparer : brouillon, plan, proposition.
 *  2 — Réversible : écriture interne, planification non publique.
 *  3 — Externe/sensible : envoi, publication, modification client.
 *  4 — Critique : paiement, contrat, accès, incident.
 *
 * 3 et 4 ne s'exécutent jamais sans un `/approve <event_id>` exact.
 */
export type ActionLevel = 0 | 1 | 2 | 3 | 4;

/** Un événement du journal opérationnel. Le format imposé, plus quatre champs internes. */
export interface CommandEvent {
  event_id: string;
  /** ISO-8601. */
  timestamp: string;
  venture: Venture;
  agent: string;
  type: CommandEventType;
  priority: Priority;
  status: CommandStatus;
  /** Une phrase. C'est ce que Cyril lit en premier. */
  summary: string;
  details: string;
  /** URLs ou identifiants internes. */
  links: readonly string[];
  next_action: string;
  needs_owner: boolean;

  /* --- contexte facultatif : absent des événements de la v1 --- */

  /** La tâche dont cet événement rend compte, quand il y en a une. */
  task_id?: string;
  category?: TaskCategory;
  /** Revenu, temps gagné, risque évité, KPI. Alimente la ligne « Impact ». */
  impact?: string;
  /** La preuve : URL du message, du post, du commit, de la réservation. */
  reference_url?: string;
  /** La preuve, quand ce n'est pas une URL : message ID, ticket, booking. */
  reference_id?: string;
  /** Rempli sur FAILED / ERROR, vide partout ailleurs. */
  error_message?: string;
  /** Dépôt émetteur, pour les événements poussés par l'API d'ingestion. */
  repo?: string;

  /* --- champs internes : jamais affichés dans les formats Telegram --- */

  /** Niveau 0–4, dérivé par `levels.ts`. */
  level: ActionLevel;
  /** Item de `queue_items` que `/approve` doit libérer, quand il y en a un. */
  queue_item_id?: string;
  /** Horodatage de la notification Telegram. Nul = en attente du groupage 30 min. */
  notified_at?: string;
  /** Empreinte de déduplication : `venture|agent|type|summary`. */
  fingerprint: string;
}

/** Ce qu'un appelant fournit ; le reste est calculé (id, empreinte, niveau…). */
export type CommandEventInput = Omit<
  CommandEvent,
  "event_id" | "timestamp" | "fingerprint" | "level" | "notified_at"
> &
  Partial<Pick<CommandEvent, "event_id" | "timestamp" | "level">> & {
    /** Type d'action sous-jacent, quand il y en a un : il donne le niveau. */
    action_type?: ActionType;
  };

const BANGKOK_OFFSET_MS = 7 * 3_600_000;

/** Instant vu depuis Bangkok. Toutes les heures affichées à Cyril sont locales. */
export function bangkokTime(iso: string): Date {
  return new Date(new Date(iso).getTime() + BANGKOK_OFFSET_MS);
}

/** `YYYY-MM-DD` local. */
export function bangkokDate(iso: string): string {
  return bangkokTime(iso).toISOString().slice(0, 10);
}

/** `HH:MM` local. */
export function bangkokClock(iso: string): string {
  return bangkokTime(iso).toISOString().slice(11, 16);
}

/**
 * `evt_YYYYMMDD_HHMM_<8 hex>` — horodaté à Bangkok, comme tout ce que Cyril lit.
 * Le suffixe aléatoire est injectable pour que les tests soient reproductibles.
 */
export function newEventId(now: string, rand: () => string = randomSuffix): string {
  const local = bangkokTime(now).toISOString();
  return `evt_${local.slice(0, 10).replace(/-/g, "")}_${local.slice(11, 16).replace(":", "")}_${rand()}`;
}

/**
 * `task_YYYYMMDD_HHMMSS_<8 hex>` — les secondes, contrairement aux événements.
 * Deux tâches déléguées dans la même minute sont banales ; deux événements
 * identiques dans la même minute sont un doublon, que l'empreinte attrape.
 */
export function newTaskId(now: string, rand: () => string = randomSuffix): string {
  const local = bangkokTime(now).toISOString();
  return `task_${local.slice(0, 10).replace(/-/g, "")}_${local.slice(11, 19).replace(/:/g, "")}_${rand()}`;
}

function randomSuffix(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 8);
}

/** Ce qui rend deux événements « le même ». Volontairement grossier : mieux vaut grouper que répéter. */
export function fingerprintOf(input: {
  venture: Venture;
  agent: string;
  type: CommandEventType;
  summary: string;
}): string {
  return [input.venture, input.agent, input.type, input.summary.trim().toLowerCase()].join("|");
}
