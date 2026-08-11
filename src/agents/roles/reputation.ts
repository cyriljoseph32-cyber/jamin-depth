import { render } from "../templates";
import type { Agent, AgentOutcome, InboundEvent, LeadSignals, ProposedAction } from "../types";
import { actionFactory, contactLine, greetingName } from "./shared";

/**
 * Reputation — reviews and public feedback.
 *
 * A published reply is permanent and quotable, so `policy.ts` queues every
 * `reply_review` regardless of tone. What changes with tone is the urgency and
 * who is told: a warm review can wait for the daily pass, a bad one goes to the
 * owner the same day, with the draft written but never sent.
 *
 * The draft for a negative review deliberately does not argue, does not explain,
 * and does not offer compensation — it thanks, apologises for the experience,
 * and moves the conversation off the public page. Anything beyond that is the
 * owner's call, in the owner's words.
 */

/** A rating out of five, if the channel supplied one. */
function ratingOf(event: InboundEvent): number | undefined {
  const raw = event.meta?.rating;
  if (raw === undefined) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 && n <= 5 ? n : undefined;
}

function isNegative(event: InboundEvent, signals: LeadSignals): boolean {
  const rating = ratingOf(event);
  if (rating !== undefined) return rating <= 3;
  return (
    signals.sensitiveTopics.includes("complaint") ||
    signals.sensitiveTopics.includes("refund_request") ||
    signals.sensitiveTopics.includes("legal")
  );
}

export const reputationAgent: Agent = {
  name: "reputation",

  handle(event: InboundEvent, signals: LeadSignals): AgentOutcome {
    const action = actionFactory(event.id);
    const actions: ProposedAction[] = [];
    const notes: string[] = [];
    const gaps: string[] = [];
    const locale = signals.locale;
    const name = greetingName(event.from, locale);
    const rating = ratingOf(event);
    const negative = isNegative(event, signals);

    if (rating === undefined) {
      notes.push("Aucune note fournie par le canal : tonalité déduite du texte uniquement.");
    }

    const draft = negative
      ? render("reputation.negative_draft", locale, { name, contact: contactLine() })
      : render("reputation.thanks", locale, { name });

    if (draft.ok) {
      actions.push(
        action({
          type: "reply_review",
          summary: negative
            ? `Brouillon de réponse à un avis négatif${rating ? ` (${rating}/5)` : ""} — validation obligatoire`
            : `Brouillon de remerciement${rating ? ` (${rating}/5)` : ""}`,
          draft: {
            channel: event.channel,
            to: event.from,
            locale,
            body: draft.body,
            templateId: draft.templateId,
          },
          payload: { rating, negative },
        }),
      );
    } else {
      notes.push(`Brouillon non rendu : ${draft.missing.join(", ")}`);
    }

    if (negative) {
      actions.push(
        action({
          type: "notify_staff",
          summary: "Avis négatif à traiter par le propriétaire",
          payload: { channel: event.channel, rating, excerpt: event.text.slice(0, 400) },
        }),
      );
      notes.push(
        "Le brouillon ne propose ni geste commercial ni explication publique : c'est une décision du propriétaire.",
      );
      if (signals.sensitiveTopics.includes("refund_request")) {
        gaps.push("policies.cancellation — demande de remboursement dans un avis public");
      }
    }

    return {
      agent: "reputation",
      eventId: event.id,
      kind: "review",
      priority: negative ? "P1" : "P3",
      signals,
      actions,
      gaps,
      notes,
      escalation: negative
        ? {
            to: "owner",
            reason: `Avis négatif${rating ? ` (${rating}/5)` : ""} sur ${event.channel}`,
            urgency: "P1",
            briefing: [
              `Avis négatif reçu sur ${event.channel}.`,
              `Extrait : « ${event.text.slice(0, 300)} »`,
              "Un brouillon de réponse est prêt dans la file : à relire, corriger et publier vous-même.",
            ].join("\n"),
          }
        : undefined,
    };
  },
};
