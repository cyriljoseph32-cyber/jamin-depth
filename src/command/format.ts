import type { CommandEvent, Venture } from "./types";
import { bangkokClock, bangkokDate } from "./types";
import { LEVEL_LABEL } from "./levels";
import { agentTag, tagsFor } from "./tags";

/**
 * Les messages Telegram, au format imposé — et rien d'autre.
 *
 * Fonctions pures : une notification doit pouvoir être relue dans un test sans
 * bot, sans réseau et sans horloge. Contrainte de fond : chaque message doit se
 * lire en moins de 20 secondes sur un téléphone. Pas d'introduction, pas de
 * jargon, une information par ligne.
 *
 * `details` est du texte libre, mais s'il contient des lignes étiquetées
 * (`Impact : …`, `Pourquoi : …`, `Action prise : …`), elles alimentent les
 * champs correspondants. C'est ce qui permet de garder le schéma d'événement
 * exactement tel qu'il est spécifié tout en remplissant des formats plus riches.
 */

const FACET_KEYS = [
  "résultat",
  "resultat",
  "impact",
  "pourquoi",
  "détail",
  "detail",
  "action prise",
  "décision",
  "decision",
  "problème",
  "probleme",
] as const;

export function facets(details: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const line of details.split("\n")) {
    const m = /^\s*([^:]{2,20})\s*:\s*(.+)$/.exec(line);
    if (!m) continue;
    const key = (m[1] ?? "").trim().toLowerCase();
    if ((FACET_KEYS as readonly string[]).includes(key) && !found.has(key)) {
      found.set(key, (m[2] ?? "").trim());
    }
  }
  return found;
}

/** Première valeur trouvée parmi des clés équivalentes (accentuées ou non). */
function facet(details: string, keys: readonly string[], fallback: string): string {
  const map = facets(details);
  for (const key of keys) {
    const value = map.get(key);
    if (value) return value;
  }
  return fallback;
}

/** Le texte brut, débarrassé des lignes étiquetées déjà affichées ailleurs. */
export function plainDetails(details: string): string {
  const kept = details
    .split("\n")
    .filter((line) => {
      const m = /^\s*([^:]{2,20})\s*:/.exec(line);
      return !m || !(FACET_KEYS as readonly string[]).includes((m[1] ?? "").trim().toLowerCase());
    })
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  return kept.join(" ");
}

function header(event: CommandEvent, label: string): string {
  return `${label} ${tagsFor(event)} ${agentTag(event.agent)}`;
}

const STATUS_RESULT: Readonly<Record<CommandEvent["status"], string>> = {
  PLANNED: "planifié",
  RUNNING: "en cours",
  WAITING_APPROVAL: "en attente de validation",
  DONE: "fait",
  FAILED: "échec",
  BLOCKED: "bloqué",
};

/** `[✅ ACTION]` — ce qui a été fait, sans validation à demander. */
export function formatAction(event: CommandEvent): string {
  return [
    header(event, "[✅ ACTION]"),
    `Action : ${event.summary}`,
    `Résultat : ${facet(event.details, ["résultat", "resultat"], STATUS_RESULT[event.status])}`,
    `Impact : ${facet(event.details, ["impact"], defaultImpact(event))}`,
    `Suite : ${event.next_action || "—"}`,
    `ID : ${event.event_id}`,
  ].join("\n");
}

/** `[⚠️ VALIDATION REQUISE]` — rien ne part avant un `/approve` portant cet id exact. */
export function formatApproval(event: CommandEvent): string {
  return [
    header(event, "[⚠️ VALIDATION REQUISE]"),
    `Proposition : ${event.summary}`,
    `Pourquoi : ${facet(event.details, ["pourquoi"], "demandé par l'agent")}`,
    `Impact : ${facet(event.details, ["impact"], defaultImpact(event))}`,
    `Détail : ${facet(event.details, ["détail", "detail"], plainDetails(event.details) || "—")}`,
    `Répondre : /approve ${event.event_id} ou /reject ${event.event_id}`,
    `ID : ${event.event_id}`,
  ].join("\n");
}

/** `[🚨 P0 — URGENT]` — un incident, envoyé seul et immédiatement. */
export function formatAlert(event: CommandEvent): string {
  return [
    `[🚨 ${event.priority} — URGENT] ${tagsFor(event)}`,
    `Problème : ${facet(event.details, ["problème", "probleme"], event.summary)}`,
    `Impact : ${facet(event.details, ["impact"], defaultImpact(event))}`,
    `Action prise : ${facet(event.details, ["action prise"], "aucune — automatisation arrêtée sur ce sujet")}`,
    `Décision requise : ${facet(event.details, ["décision", "decision"], event.next_action || "à trancher par Cyril")}`,
    `ID : ${event.event_id}`,
  ].join("\n");
}

/**
 * `[✅ TERMINÉ]` — une tâche close, avec sa preuve.
 *
 * Distinct de `formatAction`, qui rend compte d'un geste isolé : celui-ci clôt
 * quelque chose qui avait été annoncé, et la ligne « Résultat » porte la
 * référence vérifiable plutôt qu'un adjectif.
 */
export function formatCompleted(event: CommandEvent): string {
  const reference = referenceOf(event);
  return [
    header(event, "[✅ TERMINÉ]"),
    `Action : ${event.summary}`,
    `Résultat : ${reference ?? facet(event.details, ["résultat", "resultat"], "fait — aucune référence fournie")}`,
    `Impact : ${defaultImpact(event)}`,
    `Suite : ${event.next_action || "—"}`,
    `ID : ${event.event_id}`,
  ].join("\n");
}

export interface Decision {
  question: string;
  optionA: string;
  optionB: string;
  recommendation: "A" | "B";
  because: string;
  eventId: string;
}

/**
 * Le format d'arbitrage : deux options, une recommandation, une raison.
 *
 * Une question ouverte posée à quelqu'un qui gère trois activités depuis son
 * téléphone coûte plus cher qu'elle ne rapporte. Deux options et un avis se
 * tranchent en une lettre.
 */
export function formatDecision(decision: Decision): string {
  return [
    `Décision nécessaire : ${decision.question}`,
    "",
    `Option A : ${decision.optionA}`,
    `Option B : ${decision.optionB}`,
    `Recommandation Coco : ${decision.recommendation} — ${decision.because}`,
    "",
    `Répondre : A / B / /approve ${decision.eventId}`,
  ].join("\n");
}

/**
 * L'impact par défaut.
 *
 * Volontairement factuel : le niveau et la priorité sont des faits du système,
 * là où une phrase inventée sur les conséquences business serait exactement le
 * genre de remplissage que ce mandat interdit.
 */
function defaultImpact(event: CommandEvent): string {
  if (event.impact) return event.impact;
  return `${LEVEL_LABEL[event.level]} · ${event.priority}${event.needs_owner ? " · décision de Cyril attendue" : ""}`;
}

/** La preuve, telle qu'elle se lit sur un téléphone. */
export function referenceOf(event: CommandEvent): string | null {
  return event.reference_url ?? event.reference_id ?? null;
}

/** Le message qui convient à l'événement, sans avoir à choisir au point d'appel. */
export function formatEvent(event: CommandEvent): string {
  if (event.priority === "P0" || event.type === "ALERT" || event.type === "ERROR") return formatAlert(event);
  if (event.status === "WAITING_APPROVAL" || event.needs_owner) return formatApproval(event);
  if (event.status === "DONE" && (event.type === "RESULT" || event.task_id)) return formatCompleted(event);
  return formatAction(event);
}

/* ------------------------------------------------------------------ *
 * Groupage des P2/P3
 * ------------------------------------------------------------------ */

/** Un seul message pour tout ce qui n'était pas urgent, groupé par activité. */
export function formatDigest(events: readonly CommandEvent[], now: string): string {
  if (events.length === 0) return "";
  const byVenture = new Map<Venture, CommandEvent[]>();
  for (const event of events) {
    const list = byVenture.get(event.venture) ?? [];
    list.push(event);
    byVenture.set(event.venture, list);
  }

  const lines = [`[📋 SUIVI — ${bangkokClock(now)}] ${events.length} événement(s)`];
  for (const [venture, list] of byVenture) {
    lines.push("", `#${venture}`);
    for (const event of list) {
      lines.push(`· ${event.priority} ${event.summary} — ${STATUS_RESULT[event.status]} (${event.event_id})`);
    }
  }
  return lines.join("\n");
}

/* ------------------------------------------------------------------ *
 * Brief et bilan
 * ------------------------------------------------------------------ */

export interface MorningBrief {
  now: string;
  /** 5 maximum. */
  priorities: readonly string[];
  agenda: readonly string[];
  leads: { count: number; actions: readonly string[] };
  /** 3 maximum — ce qui ne peut avancer sans Cyril. */
  blockers: readonly string[];
  /** 3 maximum. */
  opportunities: readonly string[];
  /** Une action principale par activité. */
  plan: readonly { venture: Venture; action: string }[];
}

const COMMANDS_FOOTER = "Commandes : /today | /approve ID | /priority [sujet] | /status [projet]";

export function formatMorningBrief(brief: MorningBrief): string {
  const lines = [
    `[☀️ BRIEF OPÉRATIONNEL — ${bangkokDate(brief.now)}]`,
    "",
    "1. Priorités du jour",
    ...bullets(brief.priorities.slice(0, 5)),
    "",
    "2. RDV, plongées, entraînements, échéances",
    ...bullets(brief.agenda),
    "",
    `3. Leads / clients : ${brief.leads.count}`,
    ...bullets(brief.leads.actions),
    "",
    "4. Blocages nécessitant Cyril",
    ...bullets(brief.blockers.slice(0, 3)),
    "",
    "5. Opportunités du jour",
    ...bullets(brief.opportunities.slice(0, 3)),
    "",
    "6. Plan proposé",
    ...bullets(brief.plan.map((p) => `${p.venture} : ${p.action}`)),
    "",
    COMMANDS_FOOTER,
  ];
  return lines.join("\n");
}

export interface EveningReport {
  now: string;
  done: readonly string[];
  numbers: {
    /** Comptés par le système. */
    leads: number;
    contentPublished: number;
    ticketsHandled: number;
    /**
     * Déclarés par Cyril (`/kpi`), ou `[À COMPLÉTER PAR CYRIL]`. Aucun
     * encaissement, aucune réservation et aucune inscription ne transitent par
     * ce système : il ne peut que restituer ce qu'on lui a dit.
     */
    bookings: string;
    revenueTHB: string;
    signups: string;
    prospects: string;
  };
  watch: readonly string[];
  /** 3 maximum. */
  tomorrow: readonly string[];
}

export function formatEveningReport(report: EveningReport): string {
  return [
    `[🌙 BILAN — ${bangkokDate(report.now)}]`,
    "",
    "✅ Réalisé :",
    ...bullets(report.done),
    "",
    "📈 Chiffres :",
    `- Leads : ${report.numbers.leads}`,
    `- Réservations : ${report.numbers.bookings}`,
    `- Inscriptions : ${report.numbers.signups}`,
    `- Prospects : ${report.numbers.prospects}`,
    `- CA confirmé : ${report.numbers.revenueTHB}`,
    `- Contenu publié : ${report.numbers.contentPublished}`,
    `- Tickets/requests traités : ${report.numbers.ticketsHandled}`,
    "",
    "⚠️ À suivre :",
    ...bullets(report.watch),
    "",
    "🎯 Demain :",
    ...bullets(report.tomorrow.slice(0, 3)),
  ].join("\n");
}

/** Une liste, ou une ligne honnête quand il n'y a rien. Jamais de remplissage. */
function bullets(items: readonly string[]): string[] {
  if (items.length === 0) return ["- rien à signaler"];
  return items.map((item) => `- ${item}`);
}

/* ------------------------------------------------------------------ *
 * Bilan hebdomadaire
 * ------------------------------------------------------------------ */

export interface WeeklyReport {
  now: string;
  numbers: {
    revenueTHB: string;
    leads: string;
    bookings: string;
    signups: string;
    prospects: string;
    contentPublished: number;
    actionsDone: number;
  };
  /** 3 maximum — ce qui a produit un résultat vérifiable. */
  valuable: readonly string[];
  /** 3 maximum. */
  failed: readonly string[];
  /** Tâches répétées assez souvent pour mériter une automatisation. */
  automations: readonly string[];
  /** 3 maximum. */
  opportunities: readonly string[];
  /** La seule décision qui mérite d'être posée. `null` s'il n'y en a pas. */
  decision: string | null;
}

export function formatWeeklyReport(report: WeeklyReport): string {
  return [
    `[📊 BILAN HEBDOMADAIRE — ${bangkokDate(report.now)}]`,
    "",
    "Résultats :",
    `- CA confirmé : ${report.numbers.revenueTHB}`,
    `- Leads : ${report.numbers.leads}`,
    `- Réservations : ${report.numbers.bookings}`,
    `- Inscriptions : ${report.numbers.signups}`,
    `- Prospects : ${report.numbers.prospects}`,
    `- Contenus publiés : ${report.numbers.contentPublished}`,
    `- Actions terminées : ${report.numbers.actionsDone}`,
    "",
    "Ce qui a généré le plus de valeur :",
    ...bullets(report.valuable.slice(0, 3)),
    "",
    "Ce qui a échoué ou ralenti :",
    ...bullets(report.failed.slice(0, 3)),
    "",
    "Automatisations à améliorer :",
    ...bullets(report.automations.slice(0, 3)),
    "",
    "Opportunités semaine prochaine :",
    ...bullets(report.opportunities.slice(0, 3)),
    "",
    `Décision fondateur recommandée : ${report.decision ?? "aucune — rien ne bloque de ton côté"}`,
  ].join("\n");
}
