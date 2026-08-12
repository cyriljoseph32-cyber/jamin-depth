import type { Locale } from "@/content/i18n";
import { DIVE_CENTER } from "@/content/site";
import { POLICIES, verified } from "../config";
import { HARD_STOP_TOPICS, hasHardStop } from "../policy";
import { render } from "../templates";
import type { Lead } from "../adapters";
import type { Agent, AgentOutcome, InboundEvent, LeadSignals, ProposedAction } from "../types";
import { actionFactory, formatDate, greetingName, whatsappLink } from "./shared";

/**
 * Safety & client preparation.
 *
 * This agent has one hard rule that overrides every efficiency argument: it
 * never gives a medical opinion, and it never decides that someone is fit to
 * dive. Not a cautious version of one, not a "generally speaking" one. A
 * message mentioning asthma, medication, pregnancy, panic or not being able to
 * swim produces exactly two things — an empathetic acknowledgement that commits
 * to nothing, and a P0 escalation to a human.
 *
 * The reason is not legal squeamishness. Fitness to dive depends on facts a
 * chat cannot establish, and the cost of being wrong is measured in lives.
 *
 * Its second, quieter job is the one that saves the most time: sending the
 * approved pre-activity information and chasing documents.
 */

/**
 * What to bring. Taken verbatim in substance from the site's own confirmed FAQ
 * (`src/content/fr.ts` → `faq`), which states dive equipment is included with
 * the partner and suggests sun protection and water. Nothing added.
 */
const APPROVED_BRING: Record<Locale, string> = {
  fr: `Le matériel de plongée est inclus avec ${DIVE_CENTER.shortName}, rien à louer. Prévoyez une protection solaire, de l'eau, et de quoi vous sécher.`,
  en: `Dive equipment is included with ${DIVE_CENTER.shortName}, so nothing to rent. Bring sun protection, water, and a towel.`,
};

/** Only confirmed operational facts make it into a pre-arrival message. */
function preArrivalDetails(locale: Locale, gaps: string[]): string {
  const bullets: string[] = [APPROVED_BRING[locale]];

  const meeting = verified(POLICIES.meetingPoint);
  if (meeting === null) gaps.push("policies.meetingPoint");
  else bullets.push(locale === "fr" ? `Rendez-vous : ${meeting}.` : `Meeting point: ${meeting}.`);

  const schedule = verified(POLICIES.boatSchedule);
  if (schedule === null) gaps.push("policies.boatSchedule");
  else bullets.push(locale === "fr" ? `Horaires : ${schedule}.` : `Schedule: ${schedule}.`);

  const docs = verified(POLICIES.requiredDocuments);
  if (docs === null) gaps.push("policies.requiredDocuments");
  else {
    bullets.push(
      locale === "fr" ? `À apporter : ${docs.join(", ")}.` : `Please bring: ${docs.join(", ")}.`,
    );
  }

  return bullets.map((b) => `- ${b}`).join("\n");
}

export const safetyAgent: Agent = {
  name: "safety",

  handle(event: InboundEvent, signals: LeadSignals): AgentOutcome {
    const action = actionFactory(event.id);
    const actions: ProposedAction[] = [];
    const gaps: string[] = [];
    const notes: string[] = [];
    const locale = signals.locale;
    const name = greetingName(event.from, locale);

    const flagged = signals.sensitiveTopics.filter((t) => HARD_STOP_TOPICS.includes(t));
    const stop = hasHardStop(signals.sensitiveTopics);

    // Record the person and the flag before anything else — an escalation that
    // loses the lead has only moved the problem.
    actions.push(
      action({
        type: "update_lead",
        summary: `Signalement santé/sécurité — ${flagged.join(", ") || "à qualifier"}`,
        payload: { stage: "escalated", sensitiveTopics: signals.sensitiveTopics, channel: event.channel },
      }),
    );

    if (stop) {
      const ack = render("safety.sensitive_ack", locale, { name });
      if (ack.ok) {
        actions.push(
          action({
            type: "send_message",
            summary: "Accusé de réception empathique — aucun avis médical, transfert humain",
            draft: {
              channel: event.channel,
              to: event.from,
              locale,
              body: ack.body,
              templateId: ack.templateId,
            },
          }),
        );
      }

      const protocol = verified(POLICIES.medicalProtocol);
      if (protocol === null) {
        gaps.push("policies.medicalProtocol");
        notes.push(
          "Aucun protocole médical écrit n'est configuré : tout cas santé part au propriétaire tel quel.",
        );
      }

      actions.push(
        action({
          type: "notify_staff",
          summary: `URGENT — cas santé/sécurité à traiter (${flagged.join(", ")})`,
          payload: {
            channel: event.channel,
            topics: flagged,
            protocol: protocol ?? "non défini",
            excerpt: event.text.slice(0, 400),
          },
        }),
      );

      // An incident report is a legal act: prepared, never filed automatically.
      if (signals.sensitiveTopics.includes("incident")) {
        actions.push(
          action({
            type: "report_incident",
            summary: "Signalement d'incident à valider et déclarer par un humain",
            payload: { excerpt: event.text.slice(0, 400), channel: event.channel },
          }),
        );
      }

      return {
        agent: "safety",
        eventId: event.id,
        kind: signals.sensitiveTopics.includes("incident") ? "incident" : "safety",
        priority: "P0",
        signals,
        actions,
        gaps,
        notes,
        escalation: {
          to: "owner",
          reason: `Sujet santé/sécurité : ${flagged.join(", ")}`,
          urgency: "P0",
          briefing: [
            `Message ${event.channel} nécessitant une réponse humaine immédiate.`,
            `Sujets détectés : ${flagged.join(", ")}.`,
            `Aucun avis médical n'a été donné, rien n'est réservé.`,
            `Extrait : « ${event.text.slice(0, 300)} »`,
            protocol === null
              ? "Protocole médical non configuré (POLICIES.medicalProtocol)."
              : `Protocole à appliquer : ${protocol}`,
          ].join("\n"),
        },
      };
    }

    // Non-blocking flags (a lost certification card, a refresher question):
    // answerable by a human, no medical dimension, no emergency.
    const handoff = render("handoff.human", locale, { name, whatsapp: whatsappLink() });
    if (handoff.ok) {
      actions.push(
        action({
          type: "send_message",
          summary: `Transfert humain — ${signals.sensitiveTopics.join(", ") || "point à vérifier"}`,
          draft: {
            channel: event.channel,
            to: event.from,
            locale,
            body: handoff.body,
            templateId: handoff.templateId,
          },
        }),
      );
    }

    return {
      agent: "safety",
      eventId: event.id,
      kind: "safety",
      priority: "P1",
      signals,
      actions,
      gaps,
      notes,
      escalation: {
        to: "instructor",
        reason: `Point de préparation à vérifier : ${signals.sensitiveTopics.join(", ")}`,
        urgency: "P1",
        briefing: `Message ${event.channel}. Extrait : « ${event.text.slice(0, 300)} »`,
      },
    };
  },
};

/* ------------------------------------------------------------------ *
 * Outbound preparation (triggered by the schedule, not by a message)
 * ------------------------------------------------------------------ */

export interface PreArrivalInput {
  lead: Lead;
  /** ISO date of the activity. */
  date: string;
}

/**
 * The pre-activity message. Sends only confirmed information; every
 * unconfirmed field becomes a gap, and if nothing but the equipment line is
 * confirmed, that is what goes out — short and true beats complete and invented.
 */
export function preArrivalMessage(input: PreArrivalInput): AgentOutcome {
  const action = actionFactory(`prearrival-${input.lead.id}-${input.date}`);
  const gaps: string[] = [];
  const notes: string[] = [];
  const actions: ProposedAction[] = [];
  const locale: Locale = input.lead.locale === "en" ? "en" : "fr";

  const details = preArrivalDetails(locale, gaps);
  const message = render("safety.prearrival", locale, {
    name: greetingName(input.lead.contact, locale),
    date: formatDate(input.date, locale),
    details,
  });

  if (message.ok) {
    actions.push(
      action({
        type: "send_message",
        summary: `Infos pré-activité — ${input.lead.contact.name ?? input.lead.key} le ${input.date}`,
        draft: {
          channel: input.lead.channel,
          to: input.lead.contact,
          locale,
          body: message.body,
          templateId: message.templateId,
        },
      }),
    );
  } else {
    notes.push(`Message pré-activité non rendu : ${message.missing.join(", ")}`);
  }

  if (gaps.length > 0) {
    notes.push(
      "Informations pratiques manquantes : le message est volontairement partiel plutôt qu'approximatif.",
    );
  }

  return {
    agent: "safety",
    eventId: `prearrival-${input.lead.id}-${input.date}`,
    kind: "safety",
    priority: "P2",
    actions,
    gaps,
    notes,
  };
}

/** Chase the paperwork. Requires a confirmed document list — otherwise it asks nobody for nothing. */
export function documentsReminder(input: PreArrivalInput): AgentOutcome {
  const action = actionFactory(`docs-${input.lead.id}-${input.date}`);
  const gaps: string[] = [];
  const notes: string[] = [];
  const actions: ProposedAction[] = [];
  const locale: Locale = input.lead.locale === "en" ? "en" : "fr";

  const docs = verified(POLICIES.requiredDocuments);
  if (docs === null) {
    gaps.push("policies.requiredDocuments");
    notes.push("Aucune liste de documents confirmée : aucun rappel envoyé, à définir avec le propriétaire.");
    return {
      agent: "safety",
      eventId: `docs-${input.lead.id}-${input.date}`,
      kind: "safety",
      priority: "P3",
      actions,
      gaps,
      notes,
    };
  }

  const message = render("safety.documents_reminder", locale, {
    name: greetingName(input.lead.contact, locale),
    date: formatDate(input.date, locale),
    documents: docs.join(", "),
  });

  if (message.ok) {
    actions.push(
      action({
        type: "request_documents",
        summary: `Rappel documents — ${input.lead.contact.name ?? input.lead.key} avant le ${input.date}`,
        draft: {
          channel: input.lead.channel,
          to: input.lead.contact,
          locale,
          body: message.body,
          templateId: message.templateId,
        },
      }),
    );
  }

  return {
    agent: "safety",
    eventId: `docs-${input.lead.id}-${input.date}`,
    kind: "safety",
    priority: "P2",
    actions,
    gaps,
    notes,
  };
}
