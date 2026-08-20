import type { Priority } from "@/agents/types";
import { systemClock, type Clock } from "@/agents/audit";
import {
  fingerprintOf,
  newEventId,
  type CommandEvent,
  type CommandEventInput,
  type CommandStatus,
  type Venture,
} from "./types";
import { levelFor, levelForIngested } from "./levels";

/**
 * Le journal opérationnel.
 *
 * La règle absolue du mandat : toute action d'un agent crée un événement ici,
 * PUIS est notifiée sur Telegram selon sa priorité. Le journal est donc la
 * source de vérité — pas Telegram, qui n'en est que l'affichage. Un message
 * perdu, un chat supprimé, un bot recréé : le journal, lui, tient.
 *
 * Asynchrone de bout en bout, comme `agents/queue.ts` : l'implémentation réelle
 * est une table Supabase (`adapters/journal-supabase.ts`), celle d'ici sert aux
 * tests et aux déploiements sans credentials.
 */

export interface JournalFilter {
  venture?: Venture;
  /** ISO : ne renvoie que ce qui est postérieur. */
  since?: string;
  status?: CommandStatus;
  priority?: Priority;
  /** Défaut : 100. */
  limit?: number;
}

export interface Journal {
  /** Écrit l'événement, ou renvoie le doublon récent s'il y en a un. */
  append(input: CommandEventInput, now?: string): Promise<CommandEvent>;
  get(eventId: string): Promise<CommandEvent | undefined>;
  list(filter?: JournalFilter): Promise<readonly CommandEvent[]>;
  setStatus(eventId: string, status: CommandStatus, details?: string): Promise<CommandEvent | undefined>;
  /** Événements jamais notifiés — ce que ramasse le digest de 30 minutes. */
  pendingNotification(): Promise<readonly CommandEvent[]>;
  markNotified(eventIds: readonly string[], at: string): Promise<void>;
}

/**
 * Fenêtre de déduplication. Deux agents qui rapportent la même chose à quelques
 * minutes d'écart, c'est un seul fait ; au-delà, c'est une répétition — et une
 * répétition mérite d'être vue, parce qu'elle signale une boucle.
 */
export const DEDUPE_WINDOW_MS = 10 * 60 * 1000;

/** Construit l'événement complet à partir d'une entrée partielle. Pur, testable seul. */
export function buildEvent(input: CommandEventInput, now: string, id: string = newEventId(now)): CommandEvent {
  const level =
    input.action_type !== undefined
      ? levelFor({ type: input.action_type, draft: undefined })
      : levelForIngested({ level: input.level, needs_owner: input.needs_owner });

  return {
    event_id: input.event_id ?? id,
    timestamp: input.timestamp ?? now,
    venture: input.venture,
    agent: input.agent,
    type: input.type,
    priority: input.priority,
    status: input.status,
    summary: input.summary,
    details: input.details,
    links: input.links ?? [],
    next_action: input.next_action,
    needs_owner: input.needs_owner,
    task_id: input.task_id,
    category: input.category,
    impact: impactOf(input),
    reference_url: input.reference_url,
    reference_id: input.reference_id,
    error_message: input.error_message,
    repo: input.repo,
    level,
    queue_item_id: input.queue_item_id,
    fingerprint: fingerprintOf(input),
  };
}

/**
 * « Fait » sans preuve reste « fait, non vérifié ».
 *
 * L'interdit du mandat est clair : aucun agent ne peut affirmer qu'une action a
 * été exécutée sans référence vérifiable. Plutôt que d'en faire une consigne de
 * prompt — que le premier agent distrait ignorera — la contrainte vit ici, sur
 * le chemin qu'empruntent tous les écrivains du journal, interne comme ingéré.
 *
 * Ne concerne que ce qui prétend agir : un brief ou une alerte n'ont rien à
 * prouver.
 */
export const UNVERIFIED = "non vérifié — aucune référence fournie";

export function isUnverifiedClaim(
  input: Pick<CommandEventInput, "type" | "status" | "reference_url" | "reference_id">,
): boolean {
  const claimsAction = input.type === "ACTION" || input.type === "RESULT";
  if (!claimsAction || input.status !== "DONE") return false;
  return !input.reference_url && !input.reference_id;
}

/**
 * L'impact final.
 *
 * L'impact déclaré par l'agent est conservé — c'est lui qui porte le sens
 * business — mais la mention se **surajoute** au lieu de s'effacer devant lui.
 * Un agent qui écrit « impact : réservation confirmée » sans fournir de
 * référence ne doit pas pouvoir faire disparaître le doute en remplissant le
 * champ lui-même.
 */
export function impactOf(
  input: Pick<CommandEventInput, "type" | "status" | "reference_url" | "reference_id" | "impact">,
): string | undefined {
  if (!isUnverifiedClaim(input)) return input.impact;
  return input.impact ? `${input.impact} (${UNVERIFIED})` : UNVERIFIED;
}

export function matches(event: CommandEvent, filter: JournalFilter = {}): boolean {
  if (filter.venture && event.venture !== filter.venture) return false;
  if (filter.status && event.status !== filter.status) return false;
  if (filter.priority && event.priority !== filter.priority) return false;
  if (filter.since && event.timestamp <= filter.since) return false;
  return true;
}

/** Le plus récent en premier — l'ordre dans lequel Cyril lit. */
export function byRecency(a: CommandEvent, b: CommandEvent): number {
  return b.timestamp.localeCompare(a.timestamp) || b.event_id.localeCompare(a.event_id);
}

export function createJournal(clock: Clock = systemClock): Journal {
  const events = new Map<string, CommandEvent>();

  return {
    async append(input, now = clock()) {
      const fingerprint = fingerprintOf(input);
      const floor = new Date(new Date(now).getTime() - DEDUPE_WINDOW_MS).toISOString();
      const duplicate = [...events.values()].find(
        (e) => e.fingerprint === fingerprint && e.timestamp > floor,
      );
      if (duplicate) return duplicate;

      const event = buildEvent(input, now);
      events.set(event.event_id, event);
      return event;
    },

    async get(eventId) {
      return events.get(eventId);
    },

    async list(filter = {}) {
      return [...events.values()]
        .filter((e) => matches(e, filter))
        .sort(byRecency)
        .slice(0, filter.limit ?? 100);
    },

    async setStatus(eventId, status, details) {
      const event = events.get(eventId);
      if (!event) return undefined;
      const updated: CommandEvent = {
        ...event,
        status,
        details: details ? `${event.details}\n${details}`.trim() : event.details,
      };
      events.set(eventId, updated);
      return updated;
    },

    async pendingNotification() {
      return [...events.values()].filter((e) => e.notified_at === undefined).sort(byRecency);
    },

    async markNotified(eventIds, at) {
      for (const id of eventIds) {
        const event = events.get(id);
        if (event) events.set(id, { ...event, notified_at: at });
      }
    },
  };
}
