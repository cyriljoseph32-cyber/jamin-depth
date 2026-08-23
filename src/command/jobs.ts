import { anthropicDraftGenerator } from "@/agents/adapters/anthropic-content";
import { chatFor, sendText } from "@/agents/adapters/telegram";
import { CONTENT_PILLARS } from "@/agents/roles/content";
import { buildEveningReport, buildMorningBrief, buildWeeklyReport } from "./brief";
import { composeDivingDraft, pillarForDay } from "./content-draft";
import { draftContent } from "./content";
import { formatEveningReport, formatMorningBrief, formatWeeklyReport } from "./format";
import type { CommandRuntime } from "./runtime";

/**
 * Le travail à heure fixe de COCO COMMAND.
 *
 * Volontairement ici et non dans `agents/schedule.ts` : les tâches du système
 * plongée ne doivent pas dépendre de cette couche. La route cron essaie
 * d'abord les tâches agents, puis celles-ci — un seul point d'entrée, deux
 * catalogues indépendants.
 *
 * Heures locales (Asia/Bangkok) : brief 08 h, bilan 19 h, bilan hebdomadaire le
 * dimanche 18 h, récapitulatif toutes les 30 minutes. Les expressions cron de
 * `vercel.json` sont en UTC.
 */

export const commandJobs = [
  "morning-brief",
  "evening-report",
  "command-week",
  "command-digest",
  "coco-contenu",
] as const;
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

type BriefJob = Exclude<CommandJob, "command-digest" | "coco-contenu">;

/** Le titre du rapport au journal, par tâche planifiée. */
const BRIEF_SUMMARY: Readonly<Record<BriefJob, string>> = {
  "morning-brief": "Brief opérationnel du matin",
  "evening-report": "Bilan du soir",
  "command-week": "Bilan hebdomadaire",
};

const BRIEF_NEXT: Readonly<Record<BriefJob, string>> = {
  "morning-brief": "traiter les priorités du jour",
  "evening-report": "préparer demain",
  "command-week": "arbitrer les priorités de la semaine",
};

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

  if (job === "coco-contenu") {
    const pillar = pillarForDay(now, CONTENT_PILLARS);
    const generate = anthropicDraftGenerator();
    const draft = await composeDivingDraft(
      pillar,
      "fr",
      generate ?? (async () => null),
    );
    const { item } = await draftContent(draft, {
      content: rt.content,
      journal: rt.journal,
      agent: "content",
      now,
    });
    result.details.push(
      `Brouillon ${item.content_id} créé (pilier ${pillar.id}${generate ? "" : ", ANTHROPIC_API_KEY absente — habillage déterministe"}) — en attente de validation.`,
    );
    return result;
  }

  const deps = {
    journal: rt.journal,
    pending: await rt.agents.queue.pending(),
    leads: await rt.agents.ports.crm.all(),
    tasks: await rt.tasks.list({ openOnly: true, limit: 200 }),
    kpis: await rt.kpis.list({ limit: 500 }),
    content: await rt.content.list({ limit: 300 }),
    now,
  };

  const text =
    job === "morning-brief"
      ? formatMorningBrief(await buildMorningBrief(deps))
      : job === "command-week"
        ? formatWeeklyReport(await buildWeeklyReport(deps))
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
      summary: BRIEF_SUMMARY[job],
      details: text,
      links: [],
      next_action: BRIEF_NEXT[job],
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
