import type { Locale } from "@/content/i18n";
import { POLICIES, isTodo, languageName, staffSpeaks, type Verified } from "../config";
import { findAnswer } from "../knowledge";
import { compose, render } from "../templates";
import type {
  Agent,
  AgentOutcome,
  Activity,
  InboundEvent,
  LeadSignals,
  Priority,
  ProposedAction,
} from "../types";
import {
  actionFactory,
  followUpAt,
  greetingName,
  joinList,
  priceCaveat,
  priceFor,
  whatsappLink,
} from "./shared";

/**
 * Reception & leads — the agent that answers first.
 *
 * What it optimises for, in order: reply fast, be useful in one message, and
 * ask at most two questions. A holiday diver who gets a fifteen-question
 * intake form books with someone else; a diver who gets one clear paragraph
 * and two questions answers them.
 *
 * What it will not do: quote a price that is not in the catalogue, answer a
 * policy the owner has not confirmed, or handle anything medical (the
 * orchestrator routes those to the safety agent before this one runs).
 */

/** The three facts that actually change what we can prepare. */
type MissingFact = "dates" | "partySize" | "level";

const QUESTION_COPY: Record<MissingFact, Record<Locale, string>> = {
  dates: { fr: "vos dates", en: "your dates" },
  partySize: { fr: "le nombre de personnes", en: "how many of you" },
  level: {
    fr: "votre niveau (jamais plongé, ou déjà breveté)",
    en: "your level (never dived, or already certified)",
  },
};

/** Which ack template fits the activity. */
function ackTemplate(activity: Activity | undefined): string {
  switch (activity) {
    case "discover_scuba":
      return "lead.ack.discover_scuba";
    case "certified_fun_dive":
      return "lead.ack.certified_fun_dive";
    case "course":
      return "lead.ack.course";
    case "snorkeling":
      return "lead.ack.snorkeling";
    case "recovery":
      return "lead.ack.recovery";
    default:
      return "lead.ack.generic";
  }
}

/**
 * At most two questions, ordered by what unblocks the booking soonest.
 * Level only matters when the activity does not already imply it.
 */
function missingFacts(signals: LeadSignals): MissingFact[] {
  const missing: MissingFact[] = [];
  if (signals.dates.length === 0) missing.push("dates");
  if (signals.partySize === undefined) missing.push("partySize");
  const levelImplied =
    signals.certified !== undefined ||
    signals.activity === "discover_scuba" ||
    signals.activity === "snorkeling" ||
    signals.activity === "recovery";
  if (!levelImplied) missing.push("level");
  return missing.slice(0, 2);
}

/** Policy questions the owner has not confirmed — we hand those off, never guess. */
function unconfirmedPolicyQuestions(keys: readonly string[]): string[] {
  const policies = POLICIES as Readonly<Record<string, Verified<unknown>>>;
  return keys.filter((key) => {
    const value = policies[key];
    return value === undefined || isTodo(value);
  });
}

/** A date inside the next week is a live booking window, not a browse. */
function priority(signals: LeadSignals, event: InboundEvent): Priority {
  if (signals.sensitiveTopics.length > 0) return "P1";
  const soon = signals.dates.some((d) => {
    const days = Math.round(
      (new Date(`${d}T00:00:00Z`).getTime() - new Date(event.receivedAt).getTime()) / 86_400_000,
    );
    return days <= 7;
  });
  return soon ? "P1" : "P2";
}

export const receptionAgent: Agent = {
  name: "reception",

  handle(event: InboundEvent, signals: LeadSignals): AgentOutcome {
    const action = actionFactory(event.id);
    const locale = signals.locale;
    const gaps: string[] = [];
    const notes: string[] = [];
    const actions: ProposedAction[] = [];

    const name = greetingName(event.from, locale);

    // Always record the lead: even a message we cannot answer is a person who
    // wrote to us, and losing them in a chat history is the current problem.
    actions.push(
      action({
        type: "create_lead",
        summary: `Nouveau prospect ${event.channel} — ${signals.activity ?? "intention à préciser"}`,
        payload: {
          channel: event.channel,
          locale,
          activity: signals.activity,
          dates: signals.dates,
          partySize: signals.partySize,
          certified: signals.certified,
          certificationHint: signals.certificationHint,
          vagueDates: signals.vagueDates,
        },
      }),
    );

    // A language nobody has confirmed we speak: no approximate reply goes out.
    if (signals.foreignLanguage) {
      const handoff = render("handoff.human", locale, { name, whatsapp: whatsappLink() });
      if (handoff.ok) {
        actions.push(
          action({
            type: "send_message",
            summary: `Handoff — message en ${signals.foreignLanguage}, langue non confirmée côté équipe`,
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
      // Two very different situations, and the briefing must say which one.
      // Someone on the team may well speak this language — the system simply has
      // no approved template beyond FR/EN. Telling the owner "nobody speaks
      // this" when they do would send a winnable lead to a polite brush-off.
      const spoken = staffSpeaks(signals.foreignLanguage);
      const language = languageName(signals.foreignLanguage);

      gaps.push(
        spoken
          ? `message en ${language} — parlé dans l'équipe, mais aucun gabarit approuvé dans cette langue`
          : `message en ${language} — aucune compétence linguistique confirmée`,
      );

      return {
        agent: "reception",
        eventId: event.id,
        kind: "lead",
        priority: "P1",
        signals,
        actions,
        gaps,
        notes,
        escalation: {
          to: "owner",
          reason: `Message en ${language}${spoken ? " — langue parlée dans l'équipe" : ""}`,
          urgency: "P1",
          briefing: [
            `Un prospect écrit en ${language} (${event.channel}).`,
            spoken
              ? `Cette langue est parlée dans l'équipe : répondez-lui directement, c'est un avantage à jouer. Le système n'a pas de gabarit approuvé au-delà du français et de l'anglais, il n'a donc rien envoyé.`
              : `Aucune compétence confirmée dans cette langue : le système n'a rien envoyé plutôt que de répondre approximativement.`,
            `Message : « ${event.text.slice(0, 200)} »`,
          ].join("\n"),
        },
      };
    }

    /* ---- The reply, block by block ---- */

    const activity = signals.activity;
    const price = activity ? priceFor(activity) : null;
    const ackId = ackTemplate(activity);
    const ack = render(ackId, locale, {
      name,
      price: price ?? undefined,
      caveat: price ? priceCaveat(locale) : undefined,
      partner: "Discovery Divers",
    });

    if (!ack.ok && ack.missing.includes("price")) {
      // No verified price for what they asked about — fall back to the generic
      // opener and let a human quote. This is the `TODO` discipline in action.
      gaps.push(`tarif non publié pour ${activity ?? "cette demande"}`);
      notes.push(`Template ${ackId} non rendu (tarif manquant) — repli sur lead.ack.generic.`);
    }

    const opener = ack.ok ? ack : render("lead.ack.generic", locale, { name });

    const missing = missingFacts(signals);
    const questions =
      missing.length > 0
        ? render("lead.missing_info", locale, {
            questions: joinList(
              missing.map((m) => QUESTION_COPY[m][locale]),
              locale,
            ),
          })
        : null;

    // The owner's own published FAQ, quoted verbatim when it fits the question.
    // This is the cheapest honest answer available: no model, no paraphrase, and
    // already reviewed by the person whose business it is.
    const known = findAnswer(event.text, locale);
    const knowledge = known
      ? { ok: true as const, templateId: `knowledge:${known.entry.id}`, body: known.entry.answer }
      : null;
    if (known) {
      notes.push(`Réponse reprise de la FAQ du site (${known.entry.id}) : « ${known.entry.question} »`);
    }

    const unanswerable = unconfirmedPolicyQuestions(signals.policyQuestions);
    const handoff =
      unanswerable.length > 0
        ? render("handoff.unverified_fact", locale, { name, whatsapp: whatsappLink() })
        : null;
    for (const key of unanswerable) gaps.push(`policies.${key} demandé par le client et non confirmé`);

    const message = compose([
      opener,
      ...(knowledge ? [knowledge] : []),
      ...(questions ? [questions] : []),
      ...(handoff ? [handoff] : []),
    ]);
    if (message.missing.length > 0) {
      notes.push(`Blocs non rendus, champs manquants : ${message.missing.join(", ")}`);
    }

    if (message.body.length > 0) {
      actions.push(
        action({
          type: "send_message",
          summary: `Réponse ${locale.toUpperCase()} — ${activity ?? "demande générale"}${
            missing.length > 0 ? ` (+${missing.length} question${missing.length > 1 ? "s" : ""})` : ""
          }`,
          draft: {
            channel: event.channel,
            to: event.from,
            locale,
            body: message.body,
            templateId: message.templateIds.join("+"),
          },
        }),
      );
    }

    // One nudge, scheduled — and only when the ball is in their court.
    if (missing.length > 0 || signals.dates.length === 0) {
      actions.push(
        action({
          type: "schedule_followup",
          summary: `Relance 1/${2} si pas de réponse`,
          payload: { attempt: 1, dueAt: followUpAt(event.receivedAt, 1), templateId: "lead.followup.1" },
        }),
      );
    }

    if (signals.vagueDates.length > 0) {
      notes.push(
        `Dates non résolues (jamais devinées) : ${signals.vagueDates.join(", ")} — à confirmer avec le client.`,
      );
    }

    // Negotiation, complaints, refunds and legal wording are the owner's voice,
    // never a template's.
    const escalate = (["price_negotiation", "complaint", "legal", "refund_request", "minor"] as const).some(
      (topic) => signals.sensitiveTopics.includes(topic),
    );

    return {
      agent: "reception",
      eventId: event.id,
      kind: "lead",
      priority: priority(signals, event),
      signals,
      actions,
      gaps,
      notes,
      escalation: escalate
        ? {
            to: "owner",
            reason: `Sujet à traiter par un humain : ${signals.sensitiveTopics.join(", ")}`,
            urgency: "P1",
            briefing: `Négociation, plainte ou point légal détecté sur ${event.channel}. Message : « ${event.text.slice(0, 200) } »`,
          }
        : undefined,
    };
  },
};
