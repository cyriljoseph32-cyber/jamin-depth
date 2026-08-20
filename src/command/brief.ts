import type { Lead } from "@/agents/adapters";
import type { QueuedItem } from "@/agents/queue";
import { PRIORITY_ORDER } from "@/agents/queue";
import type { Journal } from "./journal";
import { bangkokDate, ventures, type CommandEvent, type Venture } from "./types";
import type { EveningReport, MorningBrief, WeeklyReport } from "./format";
import { displayFor, NOT_PROVIDED, type KpiEntry } from "./kpi";
import { needsAttention, type CommandTask } from "./tasks";

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
  /** Tâches ouvertes — ce qui doit encore arriver. */
  tasks: readonly CommandTask[];
  /** Chiffres saisis par Cyril. Vide = rien de déclaré, pas « zéro ». */
  kpis: readonly KpiEntry[];
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
  const agenda: string[] = deps.leads
    .filter((lead) => lead.dates.some((d) => d === today || d === tomorrow))
    .map((lead) => {
      const date = lead.dates.find((d) => d === today || d === tomorrow);
      return `${date === today ? "Aujourd'hui" : "Demain"} — ${lead.contact.name ?? lead.key}${
        lead.activity ? ` (${lead.activity})` : ""
      }`;
    });

  const dueSoon = deps.tasks
    .filter((t) => t.deadline && bangkokDate(t.deadline) <= tomorrow)
    .map((t) => `Échéance ${bangkokDate(t.deadline as string) === today ? "aujourd'hui" : "demain"} — ${t.objective} (${t.assigned_agent})`);
  agenda.push(...dueSoon);

  const active = deps.leads.filter((l) => ["new", "qualified", "awaiting_client"].includes(l.stage));
  const leadActions = active
    .slice(0, 5)
    .map((lead) => `${lead.contact.name ?? lead.key} — ${lead.stage}${lead.followUps > 0 ? `, ${lead.followUps} relance(s)` : ""}`);

  const blockers = [
    ...open.filter((e) => e.status === "BLOCKED" || e.status === "FAILED").map((e) => `${e.venture} · ${e.summary}`),
    ...open.filter((e) => e.needs_owner && e.status === "WAITING_APPROVAL").map((e) => `Décision : ${e.summary} (${e.event_id})`),
    // Une échéance proche sans suite écrite est un oubli en préparation.
    ...deps.tasks
      .filter((t) => needsAttention(t, deps.now))
      .map((t) => `Échéance ${t.deadline?.slice(0, 10)} sans plan : ${t.objective} (${t.task_id})`),
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
  // Un brief est un rapport, pas un travail accompli : le compter gonflerait le
  // bilan d'une unité par jour sans que rien n'ait avancé.
  const done = day.filter((e) => e.status === "DONE" && e.type !== "BRIEF");

  const openToday = day.filter(isOpen).sort(byPriority);
  const wonToday = deps.leads.filter((l) => l.stage === "won" && l.updatedAt >= since(deps.now, DAY_MS));
  const newLeads = deps.leads.filter((l) => l.createdAt >= since(deps.now, DAY_MS));
  const dayKpis = deps.kpis.filter((k) => k.recorded_at >= since(deps.now, DAY_MS));

  return {
    now: deps.now,
    done: done.map((e) => `${e.venture} · ${e.summary}`).slice(0, 10),
    numbers: {
      leads: newLeads.length,
      contentPublished: done.filter((e) => /publi/i.test(e.summary) || e.agent === "content").length,
      ticketsHandled: done.length,

      // Ce que Cyril a saisi prime sur ce que le CRM plongée sait compter : il
      // voit les réservations prises au comptoir, le CRM non. À défaut de
      // saisie, le compte du CRM ; à défaut des deux, l'aveu.
      bookings: declared(dayKpis, "bookings") ?? (wonToday.length > 0 ? String(wonToday.length) : NOT_PROVIDED),
      revenueTHB: displayFor(dayKpis, "revenue_thb"),
      signups: displayFor(dayKpis, "signups"),
      prospects: displayFor(dayKpis, "prospects"),
    },
    watch: [
      ...openToday.filter((e) => e.status === "BLOCKED" || e.status === "FAILED").map((e) => `${e.venture} · ${e.summary}`),
      ...deps.pending.map((i) => `En attente de validation : ${i.summary} (${i.id})`),
    ].slice(0, 5),
    tomorrow: openToday.slice(0, 3).map((e) => `${e.venture} · ${e.next_action || e.summary}`),
  };
}

/** La valeur saisie, ou `null` — distinct d'un zéro constaté. */
function declared(kpis: readonly KpiEntry[], metric: KpiEntry["metric"]): string | null {
  const value = displayFor(kpis, metric);
  return value === NOT_PROVIDED ? null : value;
}

/* ------------------------------------------------------------------ *
 * Bilan hebdomadaire
 * ------------------------------------------------------------------ */

const WEEK_MS = 7 * DAY_MS;

/** À partir de combien de répétitions une tâche mérite d'être automatisée. */
const REPETITION_THRESHOLD = 3;

export async function buildWeeklyReport(deps: BriefDeps): Promise<WeeklyReport> {
  const floor = since(deps.now, WEEK_MS);
  const week = await deps.journal.list({ since: floor, limit: 500 });
  const kpis = deps.kpis.filter((k) => k.recorded_at >= floor);

  const done = week.filter((e) => e.status === "DONE" && e.type !== "BRIEF");
  const failed = week.filter((e) => e.status === "FAILED" || e.status === "BLOCKED" || e.type === "ERROR");

  // « Ce qui a généré le plus de valeur » : seulement ce qui a laissé une
  // preuve. Une action dont personne ne peut vérifier le résultat n'a pas sa
  // place dans un bilan de valeur.
  const valuable = done
    .filter((e) => e.reference_url || e.reference_id)
    .map((e) => `${e.venture} · ${e.summary} → ${e.reference_url ?? e.reference_id}`);

  return {
    now: deps.now,
    numbers: {
      revenueTHB: displayFor(kpis, "revenue_thb"),
      leads: displayFor(kpis, "leads"),
      bookings: displayFor(kpis, "bookings"),
      signups: displayFor(kpis, "signups"),
      prospects: displayFor(kpis, "prospects"),
      contentPublished: done.filter((e) => e.category === "content" || /publi/i.test(e.summary)).length,
      actionsDone: done.length,
    },
    valuable,
    failed: failed.map((e) => `${e.venture} · ${e.summary}${e.error_message ? ` — ${e.error_message}` : ""}`),
    automations: repetitions(week),
    opportunities: deps.leads
      .filter((l) => l.stage === "qualified" && l.followUps === 0)
      .slice(0, 3)
      .map((l) => `Relancer ${l.contact.name ?? l.key} — qualifié, jamais relancé`),
    decision: decisionFor(week, deps.tasks),
  };
}

/**
 * Les gestes qui reviennent.
 *
 * L'empreinte de déduplication (`venture|agent|type|summary`) sert ici une
 * seconde fois : au-delà de la fenêtre de 10 minutes elle ne signale plus un
 * doublon mais une habitude — et une habitude est ce qu'on automatise. C'est la
 * seule façon honnête de répondre à « quelles tâches répétitives automatiser »
 * sans deviner à la place de Cyril.
 */
function repetitions(events: readonly CommandEvent[]): string[] {
  const counts = new Map<string, { count: number; label: string }>();
  for (const event of events) {
    const entry = counts.get(event.fingerprint) ?? { count: 0, label: `${event.venture} · ${event.summary}` };
    entry.count += 1;
    counts.set(event.fingerprint, entry);
  }
  return [...counts.values()]
    .filter((e) => e.count >= REPETITION_THRESHOLD)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((e) => `${e.label} — ${e.count}× cette semaine`);
}

/**
 * La décision de la semaine : la plus ancienne qui attend encore.
 *
 * Une seule, parce que dix décisions présentées ensemble n'en font trancher
 * aucune. `null` quand rien n'attend — et il faut alors le dire plutôt que
 * d'en fabriquer une.
 */
function decisionFor(events: readonly CommandEvent[], tasks: readonly CommandTask[]): string | null {
  const waiting = events
    .filter((e) => e.status === "WAITING_APPROVAL" && e.needs_owner)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const oldest = waiting[0];
  if (oldest) return `${oldest.summary} — /approve ${oldest.event_id}`;

  const blocked = tasks.find((t) => t.status === "BLOCKED");
  if (blocked) return `Débloquer : ${blocked.objective} (${blocked.task_id})`;
  return null;
}
