import { chatFor, sendText, type TelegramConfig } from "@/agents/adapters/telegram";
import type { Journal } from "./journal";
import { formatDigest, formatEvent } from "./format";
import type { CommandEvent } from "./types";

/**
 * Qui est prévenu, où, et quand.
 *
 * Deux cadences, et une seule règle pour choisir : est-ce que dormir dessus
 * 30 minutes coûte quelque chose ? Si oui, ça part maintenant, seul. Sinon, ça
 * attend le récapitulatif — parce qu'un fil qui vibre toutes les trois minutes
 * finit en mode silencieux, et c'est alors le P0 qu'on ne voit plus.
 */

/**
 * Les déclencheurs d'exception, repris tels quels du mandat : urgence, échec,
 * validation en attente, tâche coincée, échéance proche sans plan.
 */
export function isImmediate(event: CommandEvent, now: string): boolean {
  if (event.priority === "P0" || event.priority === "P1") return true;
  if (event.type === "ALERT" || event.type === "ERROR") return true;
  if (event.status === "WAITING_APPROVAL" || event.status === "FAILED" || event.status === "BLOCKED") return true;
  if (event.needs_owner) return true;
  return isStuck(event, now);
}

/** Une tâche qui « tourne » depuis plus de 30 minutes ne tourne probablement plus. */
export const STUCK_AFTER_MS = 30 * 60 * 1000;

export function isStuck(event: CommandEvent, now: string): boolean {
  if (event.status !== "RUNNING") return false;
  const started = new Date(event.timestamp).getTime();
  if (Number.isNaN(started)) return false;
  return new Date(now).getTime() - started >= STUCK_AFTER_MS;
}

/** Le chat qui correspond à l'événement. */
export function chatForEvent(cfg: TelegramConfig, event: CommandEvent): string {
  if (event.type === "BRIEF") return chatFor(cfg, "daily");
  if (event.priority === "P0" || event.type === "ALERT" || event.type === "ERROR" || event.needs_owner) {
    return chatFor(cfg, "alerts");
  }
  return chatFor(cfg, "project", event.venture);
}

export interface Notifier {
  /** Envoie tout de suite si l'événement l'exige ; sinon le laisse au digest. */
  announce(event: CommandEvent, now: string): Promise<boolean>;
  /** Vide la file d'attente en un message groupé. Renvoie le nombre traité. */
  flush(now: string): Promise<number>;
  /** Réponse à une commande, dans le chat d'où elle vient. */
  reply(chatId: string, text: string): Promise<void>;
}

export interface NotifierDeps {
  telegram: TelegramConfig | null;
  journal: Journal;
}

export function createNotifier({ telegram, journal }: NotifierDeps): Notifier {
  return {
    async announce(event, now) {
      if (!isImmediate(event, now)) return false;
      // Sans Telegram, l'événement reste simplement non notifié : il sortira
      // dans le prochain digest ou dans `/tasks`. Jamais perdu, jamais bloquant.
      if (!telegram) return false;
      const result = await sendText(telegram, chatForEvent(telegram, event), formatEvent(event));
      if (!result.ok) {
        console.error("coco-command: notification telegram échouée:", result.detail);
        return false;
      }
      await journal.markNotified([event.event_id], now);
      return true;
    },

    async flush(now) {
      const pending = await journal.pendingNotification();
      if (pending.length === 0) return 0;
      if (!telegram) return 0;

      // Ce qui aurait dû partir seul mais ne l'a pas fait (Telegram indisponible
      // au moment des faits) repart seul : le groupage ne doit pas devenir la
      // porte de sortie discrète d'une alerte ratée.
      const urgent = pending.filter((e) => isImmediate(e, now));
      const rest = pending.filter((e) => !isImmediate(e, now));

      let sent = 0;
      for (const event of urgent) {
        const result = await sendText(telegram, chatForEvent(telegram, event), formatEvent(event));
        if (result.ok) {
          await journal.markNotified([event.event_id], now);
          sent += 1;
        }
      }

      if (rest.length > 0) {
        const result = await sendText(telegram, chatFor(telegram, "daily"), formatDigest(rest, now));
        if (result.ok) {
          await journal.markNotified(
            rest.map((e) => e.event_id),
            now,
          );
          sent += rest.length;
        }
      }

      return sent;
    },

    async reply(chatId, text) {
      if (!telegram) return;
      const result = await sendText(telegram, chatId, text);
      if (!result.ok) console.error("coco-command: réponse telegram échouée:", result.detail);
    },
  };
}
