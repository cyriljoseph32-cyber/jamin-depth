import { DIVE_CENTER } from "@/content/site";
import { CHANNELS, openGaps } from "../config";
import type { Lead, Ports } from "../adapters";
import { missingPorts } from "../adapters";
import type { QueuedItem } from "../queue";
import type { Agent, AgentOutcome, Channel, InboundEvent, ProposedAction } from "../types";
import { actionFactory, formatDate, teamLocale } from "./shared";

/**
 * Internal operations: staff tasks, supplier messages, and the weekly report.
 *
 * The report is the part that earns its keep. It answers three questions the
 * owner otherwise answers from memory: where the leads came from, what is stuck
 * waiting for a decision, and which unconfirmed facts are actively costing
 * replies. That last list is the point — every `TODO` in the config shows up
 * here until it is filled in, so the system nags itself into completeness
 * instead of quietly degrading.
 */

export const opsAgent: Agent = {
  name: "ops",

  handle(event: InboundEvent): AgentOutcome {
    const action = actionFactory(event.id);
    const actions: ProposedAction[] = [];
    const notes: string[] = [];

    // A message aimed at the partner centre is an external commitment: drafted
    // here, released by a human (`rule:external-commitment`).
    const supplierBound = /\b(discovery\s*divers|centre|bateau|boat|fournisseur|supplier|partenaire)\b/i.test(
      event.text,
    );

    if (supplierBound) {
      actions.push(
        action({
          type: "supplier_message",
          summary: `Message fournisseur à valider — ${DIVE_CENTER.shortName}`,
          draft: {
            channel: "internal",
            to: { name: DIVE_CENTER.name },
            locale: "en",
            body: event.text.trim(),
            templateId: "ops.supplier_passthrough",
          },
        }),
      );
      notes.push("Le texte est repris tel quel : aucun engagement n'est reformulé par le système.");
    } else {
      actions.push(
        action({
          type: "notify_staff",
          summary: `Tâche interne — ${event.text.slice(0, 60)}`,
          payload: { source: event.channel, text: event.text.slice(0, 500) },
        }),
      );
    }

    return {
      agent: "ops",
      eventId: event.id,
      kind: supplierBound ? "supplier" : "internal_task",
      priority: "P3",
      actions,
      gaps: [],
      notes,
    };
  },
};

/**
 * The eleven unconfirmed policies, turned into one message to the partner.
 *
 * The owner asked for these to be taken from `discoverydivers.com`. They cannot
 * be: the site is unreachable from this environment, and search snippets
 * disagree with each other about something as basic as opening hours. More
 * importantly, a marketing page states the PARTNER's arrangements, and copying
 * them would put an unsourced sentence about medical fitness in front of a
 * diver — exactly what this system exists to prevent.
 *
 * So the gap becomes a question list instead of a guess. In English, because
 * that is the language the partner is dealt with in.
 */
const PARTNER_QUESTIONS: readonly { key: string; question: string }[] = [
  { key: "cancellation", question: "What is the cancellation and rescheduling policy, and up to when is it free?" },
  { key: "deposit", question: "Is a deposit required to hold a place, and how much?" },
  { key: "paymentMethods", question: "Which payment methods do you accept (cash, card, transfer, PromptPay)?" },
  { key: "meetingPoint", question: "What is the exact meeting point, and at what time should guests be there?" },
  { key: "pickupIncluded", question: "Is hotel pick-up included, and for which areas of Koh Samui?" },
  { key: "boatSchedule", question: "What are the usual departure and return times for each trip?" },
  {
    key: "requiredDocuments",
    question:
      "Which documents must a guest bring or complete before diving (medical statement, liability release, certification card, logbook)?",
  },
  { key: "minorMinimumAge", question: "What is the minimum age for Discover Scuba Diving and for certified dives?" },
  { key: "insurance", question: "Is dive insurance included, and what does it cover?" },
  {
    key: "staffLanguages",
    question: "Which languages can your guides and instructors actually brief in?",
  },
  {
    key: "medicalProtocol",
    question:
      "When a guest discloses a medical condition, medication or pregnancy, what is the procedure, and who decides whether they may dive?",
  },
];

/**
 * A ready-to-send request for the policies that are still `TODO`.
 * Only asks about what is genuinely missing, so it shrinks as `config.ts` fills in.
 */
export function partnerPolicyQuestions(): ProposedAction | null {
  const missing = new Set(openGaps().map((g) => g.replace(/^policies\./, "")));
  const asks = PARTNER_QUESTIONS.filter((q) => missing.has(q.key));
  if (asks.length === 0) return null;

  const action = actionFactory("partner-policy-questions");
  const body = [
    `Hello,`,
    ``,
    `A few operational details we want to get exactly right before answering guests — we would rather say "I will check" than guess:`,
    ``,
    ...asks.map((q, i) => `${i + 1}. ${q.question}`),
    ``,
    `Thank you,`,
    `Jammin's Depths`,
  ].join("\n");

  return action({
    type: "supplier_message",
    summary: `Questions à ${DIVE_CENTER.shortName} — ${asks.length} point(s) non confirmé(s)`,
    draft: {
      channel: "internal",
      to: { name: DIVE_CENTER.name },
      locale: "en",
      body,
      templateId: "ops.partner_policy_questions",
    },
    payload: { keys: asks.map((q) => q.key) },
  });
}

export interface WeeklyReportInput {
  /** ISO instant the report is produced. */
  now: string;
  /** ISO date the reporting week starts. */
  weekStart: string;
  leads: readonly Lead[];
  queue: readonly QueuedItem[];
  ports: Ports;
}

function countBy<T extends string>(values: readonly T[]): Map<T, number> {
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return counts;
}

export function weeklyReport(input: WeeklyReportInput): AgentOutcome {
  const action = actionFactory(`weekly-${input.weekStart}`);
  const since = new Date(`${input.weekStart}T00:00:00Z`).getTime();
  const week = input.leads.filter((l) => new Date(l.createdAt).getTime() >= since);

  const byChannel = countBy(week.map((l) => l.channel as Channel));
  const byStage = countBy(week.map((l) => l.stage));
  const pending = input.queue.filter((q) => q.status === "pending");
  const escalated = week.filter((l) => l.sensitiveTopics.length > 0);

  const lines: string[] = [
    `Semaine du ${formatDate(input.weekStart, teamLocale)}`,
    "",
    `Prospects : ${week.length}`,
    ...[...byChannel.entries()].map(([channel, n]) => `- ${channel} : ${n}`),
    "",
    "Étapes :",
    ...[...byStage.entries()].map(([stage, n]) => `- ${stage} : ${n}`),
    "",
    `En attente de validation humaine : ${pending.length}`,
    ...pending.slice(0, 10).map((q) => `- ${q.priority} ${q.id} · ${q.action.type} — ${q.summary}`),
  ];

  if (pending.length > 10) lines.push(`- … et ${pending.length - 10} autre(s)`);

  if (escalated.length > 0) {
    lines.push("", `Dossiers sensibles de la semaine : ${escalated.length}`);
    for (const lead of escalated) {
      lines.push(`- ${lead.contact.name ?? lead.key} : ${lead.sensitiveTopics.join(", ")}`);
    }
  }

  const configGaps = openGaps();
  if (configGaps.length > 0) {
    lines.push(
      "",
      "Informations non confirmées qui bloquent des réponses (à combler dans src/agents/config.ts) :",
      ...configGaps.map((g) => `- ${g}`),
      "",
      `Un message prêt à envoyer à ${DIVE_CENTER.shortName} accompagne ce rapport.`,
    );
  }

  const missing = missingPorts(input.ports);
  if (missing.length > 0) {
    lines.push("", "Connexions manquantes :", ...missing.map((m) => `- ${m}`));
  }

  const disabled = (Object.entries(CHANNELS) as [Channel, (typeof CHANNELS)[Channel]][])
    .filter(([, c]) => !c.enabled)
    .map(([name, c]) => `- ${name} : ${c.note ?? "désactivé"}`);
  if (disabled.length > 0) lines.push("", "Canaux désactivés :", ...disabled);

  const actions: ProposedAction[] = [
    action({
      type: "internal_report",
      summary: `Rapport hebdo — ${week.length} prospect(s), ${pending.length} action(s) en attente`,
      draft: {
        channel: "internal",
        to: { name: "équipe" },
        locale: teamLocale,
        body: lines.join("\n"),
        templateId: "ops.weekly_report",
      },
      payload: { weekStart: input.weekStart, leads: week.length, pending: pending.length },
    }),
  ];

  // The gap list is only useful if it comes with the message that closes it.
  const questions = partnerPolicyQuestions();
  if (questions) actions.push(questions);

  return {
    agent: "ops",
    eventId: `weekly-${input.weekStart}`,
    kind: "report",
    priority: "P3",
    actions,
    gaps: configGaps,
    notes: [`Rapport généré le ${input.now}.`],
  };
}
