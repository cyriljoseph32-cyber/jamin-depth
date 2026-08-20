import { chatFor, sendText } from "@/agents/adapters/telegram";
import { buildEveningReport, buildMorningBrief } from "./brief";
import { formatEveningReport, formatMorningBrief } from "./format";
import type { CommandRuntime } from "./runtime";

/**
 * Le travail à heure fixe de COCO COMMAND.
 *
 * Volontairement ici et non dans `agents/schedule.ts` : les tâches du système
 * plongée ne doivent pas dépendre de cette couche. La route cron essaie
 * d'abord les tâches agents, puis celles-ci — un seul point d'entrée, deux
 * catalogues indépendants.
 *
 * Heures locales (Asia/Bangkok) : brief 08 h, bilan 19 h, récapitulatif toutes
 * les 30 minutes. Les expressions cron de `vercel.json` sont en UTC.
 */

export const commandJobs = ["morning-brief", "evening-report", "command-digest"] as const;
export type CommandJob = (typeof commandJobs)[number];

export function isCommandJob(value: string): value is CommandJob {
  return (commandJobs as readonly string[]).includes(value);
}

export interface CommandJobResult {
  job: CommandJob;
  /** Une ligne par chose faite, ou délibérément pas faite. */
  details: string[];
  sent: number;
}

export async function runCommandJob(
  job: CommandJob,
  rt: CommandRuntime,
  now: string,
): Promise<CommandJobResult> {
  const result: CommandJobResult = { job, details: [], sent: 0 };

  if (job === "command-digest") {
    const sent = await rt.notifier.flush(now);
    result.sent = sent;
    result.details.push(sent === 0 ? "Rien à récapituler." : `${sent} événement(s) notifié(s).`);
    return result;
  }

  const deps = {
    journal: rt.journal,
    pending: await rt.agents.queue.pending(),
    leads: await rt.agents.ports.crm.all(),
    now,
  };

  const text =
    job === "morning-brief"
      ? formatMorningBrief(await buildMorningBrief(deps))
      : formatEveningReport(await buildEveningReport(deps));

  // Le brief est écrit au journal AVANT d'être envoyé : si Telegram est en
  // panne, il reste consultable par `/brief` au lieu d'avoir disparu.
  const event = await rt.journal.append(
    {
      venture: "GLOBAL",
      agent: "coco-command",
      type: "BRIEF",
      priority: "P3",
      status: "DONE",
      summary: job === "morning-brief" ? "Brief opérationnel du matin" : "Bilan du soir",
      details: text,
      links: [],
      next_action: job === "morning-brief" ? "traiter les priorités du jour" : "préparer demain",
      needs_owner: false,
      level: 0,
    },
    now,
  );

  const telegram = rt.agents.telegram;
  if (!telegram) {
    result.details.push(`Telegram non configuré — ${event.event_id} écrit au journal seulement.`);
    return result;
  }

  const send = await sendText(telegram, chatFor(telegram, "daily"), text);
  if (send.ok) {
    await rt.journal.markNotified([event.event_id], now);
    result.sent = 1;
    result.details.push(`Envoyé (${event.event_id}).`);
  } else {
    result.details.push(`Non envoyé (${send.detail ?? "erreur telegram"}) — ${event.event_id} reste au journal.`);
  }
  return result;
}
