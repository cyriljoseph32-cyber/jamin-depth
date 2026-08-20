import type { Lead } from "@/agents/adapters";
import type { QueuedItem } from "@/agents/queue";
import { PRIORITY_ORDER } from "@/agents/queue";
import type { Journal } from "./journal";
import { bangkokDate, ventures, type CommandEvent, type Venture } from "./types";
import type { EveningReport, MorningBrief } from "./format";

/**
 * Le brief du matin et le bilan du soir.
 *
 * Tout vient du journal, de la file de validation et du CRM. Rien n'est
 * extrapolé : un chiffre que le système ne peut pas établir sort en
 * `[À COMPLÉTER PAR CYRIL]` — c'est la règle commune à tous les agents de
 * Cyril, et c'est aussi la seule façon qu'un bilan quotidien reste crédible au
 * bout de trois semaines.
 */

const DAY_MS = 86_400_000;

export interface BriefDeps {
  journal: Journal;
  pending: readonly QueuedItem[];
  leads: readonly Lead[];
  now: string;
}

/** Les statuts qui veulent dire « ce n'est pas fini ». */
const OPEN: readonly CommandEvent["status"][] = ["PLANNED", "RUNNING", "WAITING_APPROVAL", "BLOCKED", "FAILED"];

function isOpen(event: CommandEvent): boolean {
  return OPEN.includes(event.status);
}

function since(now: string, ms: number): string {
  return new Date(new Date(now).getTime() - ms).toISOString();
}

function byPriority(a: CommandEvent, b: CommandEvent): number {
  return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.timestamp.localeCompare(b.timestamp);
}

export async function buildMorningBrief(deps: BriefDeps): Promise<MorningBrief> {
  const recent = await deps.journal.list({ since: since(deps.now, 3 * DAY_MS), limit: 300 });
  const open = recent.filter(isOpen).sort(byPriority);
  const today = bangkokDate(deps.now);
  const tomorrow = bangkokDate(new Date(new Date(deps.now).getTime() + DAY_MS).toISOString());

  const priorities = [
    ...deps.pending.map((item) => `Valider : ${item.summary} (${item.id})`),
    ...open.filter((e) => e.status !== "WAITING_APPROVAL").map((e) => `${e.venture} · ${e.summary}`),
  ].slice(0, 5);

  // L'agenda ne s'invente pas : il vient des dates que les clients ont
  // eux-mêmes données. Pas de calendrier connecté = pas de rendez-vous affiché.
  const agenda = deps.leads
    .filter((lead) => lead.dates.some((d) => d === today || d === tomorrow))
    .map((lead) => {
      const date = lead.dates.find((d) => d === today || d === tomorrow);
      return `${date === today ? "Aujourd'hui" : "Demain"} — ${lead.contact.name ?? lead.key}${
        lead.activity ? ` (${lead.activity})` : ""
      }`;
    });

  const active = deps.leads.filter((l) => ["new", "qualified", "awaiting_client"].includes(l.stage));
  const leadActions = active
    .slice(0, 5)
    .map((lead) => `${lead.contact.name ?? lead.key} — ${lead.stage}${lead.followUps > 0 ? `, ${lead.followUps} relance(s)` : ""}`);

  const blockers = [
    ...open.filter((e) => e.status === "BLOCKED" || e.status === "FAILED").map((e) => `${e.venture} · ${e.summary}`),
    ...open.filter((e) => e.needs_owner && e.status === "WAITING_APPROVAL").map((e) => `Décision : ${e.summary} (${e.event_id})`),
  ].slice(0, 3);

  const opportunities = deps.leads
    .filter((l) => l.stage === "qualified" && l.followUps === 0)
    .slice(0, 3)
    .map((l) => `Relancer ${l.contact.name ?? l.key} — qualifié, jamais relancé`);

  const plan = ventures
    .map((venture) => ({ venture, action: firstActionFor(venture, open) }))
    .filter((p): p is { venture: Venture; action: string } => p.action !== null);

  return {
    now: deps.now,
    priorities,
    agenda,
    leads: { count: active.length, actions: leadActions },
    blockers,
    opportunities,
    plan,
  };
}

function firstActionFor(venture: Venture, open: readonly CommandEvent[]): string | null {
  const event = open.find((e) => e.venture === venture);
  if (!event) return null;
  return event.next_action || event.summary;
}

export async function buildEveningReport(deps: BriefDeps): Promise<EveningReport> {
  const day = await deps.journal.list({ since: since(deps.now, DAY_MS), limit: 300 });
  const done = day.filter((e) => e.status === "DONE");

  const openToday = day.filter(isOpen).sort(byPriority);
  const wonToday = deps.leads.filter((l) => l.stage === "won" && l.updatedAt >= since(deps.now, DAY_MS));
  const newLeads = deps.leads.filter((l) => l.createdAt >= since(deps.now, DAY_MS));

  return {
    now: deps.now,
    done: done.map((e) => `${e.venture} · ${e.summary}`).slice(0, 10),
    numbers: {
      leads: newLeads.length,
      bookings: wonToday.length,
      // Aucun encaissement ne transite par ce système : il ne peut pas connaître
      // le chiffre d'affaires, donc il ne le prétend pas.
      revenueTHB: "[À COMPLÉTER PAR CYRIL]",
      contentPublished: done.filter((e) => /publi/i.test(e.summary) || e.agent === "content").length,
      ticketsHandled: done.length,
    },
    watch: [
      ...openToday.filter((e) => e.status === "BLOCKED" || e.status === "FAILED").map((e) => `${e.venture} · ${e.summary}`),
      ...deps.pending.map((i) => `En attente de validation : ${i.summary} (${i.id})`),
    ].slice(0, 5),
    tomorrow: openToday.slice(0, 3).map((e) => `${e.venture} · ${e.next_action || e.summary}`),
  };
}
