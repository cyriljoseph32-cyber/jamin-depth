import type { Locale } from "@/content/i18n";
import { DIVE_CENTER } from "@/content/site";
import { AVAILABILITY, POLICIES, isTodo, requireVerified, verified } from "../config";
import { render } from "../templates";
import type { Lead } from "../adapters";
import type { QueuedItem } from "../queue";
import type {
  Agent,
  AgentOutcome,
  InboundEvent,
  LeadSignals,
  Priority,
  ProposedAction,
} from "../types";
import { PRICE_CAVEAT } from "../catalog";
import { actionFactory, daysUntil, formatDate, greetingName, priceFor, teamLocale } from "./shared";

/**
 * Booking & planning.
 *
 * The audit settled the one question that shapes this agent: availability is
 * held by the partner dive centre and released by a human reading a message.
 * So this agent never says yes. It does the work either side of the yes —
 * assembling a recap that is complete enough for the partner to answer in one
 * reply, and preparing the confirmation so that releasing it is one click.
 *
 * `AVAILABILITY.canSystemHold === false` is read by `policy.ts`, so even if
 * someone wired an availability API tomorrow, the confirmation would stay in
 * the queue until that flag is deliberately flipped.
 */

/**
 * Both the label AND the value are localised. A French client reading
 * "Activity : Baptême" or an English one reading "Activité : Beginner" is the
 * kind of seam that makes an operation look sloppy — and the partner needs the
 * same facts in English regardless.
 */
interface RecapLine {
  label: Record<Locale, string>;
  value: Record<Locale, string>;
}

const UNCONFIRMED: Record<Locale, string> = { fr: "à confirmer", en: "to be confirmed" };

/** Same value in both languages (dates, numbers, channel names). */
function same(value: string): Record<Locale, string> {
  return { fr: value, en: value };
}

/**
 * Build the recap once, render it in two languages: the client sees theirs, the
 * partner gets English. Same facts, no divergence between the two — a mismatch
 * there is how a diver ends up on the wrong boat.
 */
function recapLines(signals: LeadSignals, event: InboundEvent, gaps: string[]): RecapLine[] {
  const lines: RecapLine[] = [];
  const activityLabel: Record<string, Record<Locale, string>> = {
    discover_scuba: { fr: "Baptême (Discover Scuba Diving)", en: "Discover Scuba Diving" },
    certified_fun_dive: { fr: "Plongées d'exploration (certifiés)", en: "Fun dives (certified)" },
    course: { fr: "Formation PADI", en: "PADI course" },
    snorkeling: { fr: "Snorkeling", en: "Snorkelling" },
    recovery: { fr: "Récupération sous-marine", en: "Underwater recovery" },
    other: { fr: "À préciser", en: "To be specified" },
  };

  lines.push({
    label: { fr: "Activité", en: "Activity" },
    value: (signals.activity ? activityLabel[signals.activity] : undefined) ?? UNCONFIRMED,
  });

  const firstDate = signals.dates[0];
  lines.push({
    label: { fr: "Date", en: "Date" },
    value: firstDate
      ? { fr: formatDate(firstDate, "fr"), en: formatDate(firstDate, "en") }
      : UNCONFIRMED,
  });
  if (signals.dates.length > 1) {
    const others = signals.dates.slice(1);
    lines.push({
      label: { fr: "Autres dates évoquées", en: "Other dates mentioned" },
      value: {
        fr: others.map((d) => formatDate(d, "fr")).join(", "),
        en: others.map((d) => formatDate(d, "en")).join(", "),
      },
    });
  }

  lines.push({
    label: { fr: "Participants", en: "Participants" },
    value: signals.partySize !== undefined ? same(String(signals.partySize)) : UNCONFIRMED,
  });

  lines.push({
    label: { fr: "Niveau", en: "Level" },
    value:
      signals.certificationHint !== undefined
        ? same(signals.certificationHint)
        : signals.certified === false
          ? { fr: "Débutant", en: "Beginner" }
          : UNCONFIRMED,
  });

  // The price the client may already have seen, with the caveat attached so it
  // travels with the figure rather than being dropped in a paraphrase.
  const price = signals.activity ? priceFor(signals.activity) : null;
  if (price !== null) {
    lines.push({
      label: { fr: "Tarif indicatif", en: "Indicative price" },
      value: {
        fr: `${price} / pers. — ${PRICE_CAVEAT.fr}`,
        en: `${price} / person — ${PRICE_CAVEAT.en}`,
      },
    });
  }

  lines.push({
    label: { fr: "Langue du client", en: "Client language" },
    value: same(signals.locale.toUpperCase()),
  });

  // Operational facts the owner has not confirmed: shown as unconfirmed, on
  // purpose. The partner's reply is what fills them in.
  const pickup = requireVerified(POLICIES.pickupIncluded, "policies.pickupIncluded", gaps);
  lines.push({
    label: { fr: "Transport", en: "Transfer" },
    value:
      pickup === null
        ? UNCONFIRMED
        : pickup
          ? { fr: "Inclus", en: "Included" }
          : { fr: "Non inclus", en: "Not included" },
  });

  const meeting = requireVerified(POLICIES.meetingPoint, "policies.meetingPoint", gaps);
  lines.push({
    label: { fr: "Point de rendez-vous", en: "Meeting point" },
    value: meeting !== null ? same(meeting) : UNCONFIRMED,
  });

  const deposit = requireVerified(POLICIES.deposit, "policies.deposit", gaps);
  lines.push({
    label: { fr: "Acompte", en: "Deposit" },
    value: deposit !== null ? same(deposit) : UNCONFIRMED,
  });

  if (signals.sensitiveTopics.length > 0) {
    lines.push({
      label: { fr: "Points signalés", en: "Flagged" },
      value: same(signals.sensitiveTopics.join(", ")),
    });
  }

  if (signals.vagueDates.length > 0) {
    lines.push({
      label: { fr: "Dates imprécises (non interprétées)", en: "Vague dates (not interpreted)" },
      value: same(signals.vagueDates.join(", ")),
    });
  }

  lines.push({
    label: { fr: "Canal d'origine", en: "Source channel" },
    value: same(event.channel),
  });

  return lines;
}

function renderRecap(lines: readonly RecapLine[], locale: Locale): string {
  return lines.map((l) => `${l.label[locale]} : ${l.value[locale]}`).join("\n");
}

function priority(signals: LeadSignals, event: InboundEvent): Priority {
  const first = signals.dates[0];
  if (first === undefined) return "P2";
  return daysUntil(event.receivedAt, first) <= 3 ? "P1" : "P2";
}

export const bookingAgent: Agent = {
  name: "booking",

  handle(event: InboundEvent, signals: LeadSignals): AgentOutcome {
    const action = actionFactory(event.id);
    const gaps: string[] = [];
    const notes: string[] = [];
    const actions: ProposedAction[] = [];
    const locale = signals.locale;
    const name = greetingName(event.from, locale);

    const lines = recapLines(signals, event, gaps);
    const teamRecap = renderRecap(lines, teamLocale);
    const clientRecap = renderRecap(lines, locale);
    const partnerRecap = renderRecap(lines, "en");

    // Record the prospect first, whatever happens next. Every channel funnels
    // into one CRM entry — the whole point of the exercise is that nobody is
    // lost in a chat history.
    actions.push(
      action({
        type: "update_lead",
        summary: `Prospect en attente du centre partenaire — ${signals.activity ?? "activité à préciser"}`,
        payload: {
          channel: event.channel,
          locale,
          activity: signals.activity,
          dates: signals.dates,
          partySize: signals.partySize,
          certified: signals.certified,
        },
      }),
    );

    // Internal recap next: it exists even when nothing can be sent out.
    actions.push(
      action({
        type: "draft_booking_recap",
        summary: `Récap demande — ${signals.activity ?? "activité à préciser"}${
          signals.dates[0] ? ` le ${signals.dates[0]}` : " (date à préciser)"
        }`,
        payload: { recap: teamRecap, dates: signals.dates, partySize: signals.partySize },
      }),
    );

    const hasDate = signals.dates.length > 0;

    if (!hasDate) {
      // Nothing to ask the partner yet — reception is already chasing the date.
      notes.push("Pas de date exploitable : aucune demande envoyée au centre partenaire.");
      gaps.push("date de sortie non fournie par le client");
      return {
        agent: "booking",
        eventId: event.id,
        kind: "booking",
        priority: priority(signals, event),
        signals,
        actions,
        gaps,
        notes,
      };
    }

    // Ask the partner. This is an outbound commitment to a third party, so
    // `policy.ts` marks it for approval too (`rule:external-commitment`).
    const partnerRequest = render("booking.partner_request", "en", {
      partner: DIVE_CENTER.name,
      recap: partnerRecap,
    });
    if (partnerRequest.ok) {
      actions.push(
        action({
          type: "supplier_message",
          summary: `Demande de dispo à ${DIVE_CENTER.shortName} — ${signals.dates[0]}`,
          draft: {
            channel: "internal",
            to: { name: DIVE_CENTER.name },
            locale: "en",
            body: partnerRequest.body,
            templateId: partnerRequest.templateId,
          },
          payload: { partner: DIVE_CENTER.name, date: signals.dates[0] },
        }),
      );
    }

    // Tell the client where things stand — explicitly not a confirmation.
    const clientNote = render("booking.recap_pending", locale, {
      name,
      recap: clientRecap,
      partner: DIVE_CENTER.name,
    });
    if (clientNote.ok) {
      actions.push(
        action({
          type: "send_message",
          summary: `Récap client ${locale.toUpperCase()} — place non garantie`,
          draft: {
            channel: event.channel,
            to: event.from,
            locale,
            body: clientNote.body,
            templateId: clientNote.templateId,
          },
        }),
      );
    }

    // Prepared, not taken: both of these sit in the queue until a human has the
    // partner's answer in hand. Approving them is then a single decision.
    actions.push(
      action({
        type: "confirm_booking",
        summary: `Confirmer la place après réponse de ${DIVE_CENTER.shortName} — ${signals.dates[0]}`,
        payload: {
          awaiting: AVAILABILITY.source,
          partner: DIVE_CENTER.name,
          date: signals.dates[0],
          partySize: signals.partySize,
          recap: teamRecap,
        },
      }),
    );
    actions.push(
      action({
        type: "create_calendar_event",
        summary: `Créer l'événement agenda — ${signals.activity ?? "sortie"} ${signals.dates[0]}`,
        payload: { date: signals.dates[0], title: `${signals.activity ?? "sortie"} — ${name}`, description: teamRecap },
      }),
    );

    notes.push(
      `Disponibilité non vérifiable par le système (source : ${AVAILABILITY.source}). Aucune confirmation n'est envoyée.`,
    );

    return {
      agent: "booking",
      eventId: event.id,
      kind: "booking",
      priority: priority(signals, event),
      signals,
      actions,
      gaps,
      notes,
    };
  },
};

/* ------------------------------------------------------------------ *
 * Next-day operations list
 * ------------------------------------------------------------------ */

export interface DailyBriefInput {
  /** The day being briefed, ISO date. */
  date: string;
  /** When the brief is produced, ISO instant. */
  now: string;
  leads: readonly Lead[];
  pending?: readonly QueuedItem[];
}

/**
 * The list the team reads the evening before: who is diving, at what level,
 * what is missing, and what still needs a decision.
 *
 * Unconfirmed operational facts appear as explicit alerts rather than blanks —
 * a missing meeting point is exactly the thing that must be noticed at 19:00,
 * not at 07:30 on the pier.
 */
export function nextDayBrief(input: DailyBriefInput): AgentOutcome {
  const action = actionFactory(`brief-${input.date}`);
  const gaps: string[] = [];
  const notes: string[] = [];

  const forDay = input.leads.filter((lead) => lead.dates.includes(input.date));

  const lines: string[] = [];
  if (forDay.length === 0) {
    lines.push("Aucun client attendu d'après le CRM (source non connectée — à vérifier à la main).");
  }

  for (const lead of forDay) {
    const parts = [
      lead.contact.name ?? "client sans nom",
      lead.activity ?? "activité à préciser",
      lead.partySize !== undefined ? `${lead.partySize} pers.` : "nombre à confirmer",
      lead.certified === undefined ? "niveau à confirmer" : lead.certified ? "certifié" : "débutant",
      `langue ${lead.locale.toUpperCase()}`,
      `canal ${lead.channel}`,
    ];
    if (lead.sensitiveTopics.length > 0) parts.push(`ALERTE : ${lead.sensitiveTopics.join(", ")}`);
    lines.push(`- ${parts.join(" · ")}`);
  }

  const docs = verified(POLICIES.requiredDocuments);
  if (docs === null) {
    gaps.push("policies.requiredDocuments");
    lines.push("- Documents à collecter : liste non définie (POLICIES.requiredDocuments).");
  } else if (forDay.length > 0) {
    lines.push(`- Documents à vérifier pour chaque client : ${docs.join(", ")}.`);
  }

  for (const [key, label] of [
    ["meetingPoint", "Point de rendez-vous"],
    ["boatSchedule", "Horaires bateau"],
    ["pickupIncluded", "Transport"],
  ] as const) {
    if (isTodo(POLICIES[key])) {
      gaps.push(`policies.${key}`);
      lines.push(`- ${label} : non confirmé, à valider avec ${DIVE_CENTER.shortName}.`);
    }
  }

  const pending = input.pending ?? [];
  if (pending.length > 0) {
    lines.push(`- ${pending.length} action(s) en attente de validation : ${pending.map((p) => p.id).join(", ")}.`);
  }

  const brief = render("ops.daily_brief", teamLocale, {
    date: formatDate(input.date, teamLocale),
    lines: lines.join("\n"),
  });

  const actions: ProposedAction[] = [];
  if (brief.ok) {
    actions.push(
      action({
        type: "internal_report",
        summary: `Brief opérationnel ${input.date} — ${forDay.length} client(s)`,
        draft: {
          channel: "internal",
          to: { name: "équipe" },
          locale: teamLocale,
          body: brief.body,
          templateId: brief.templateId,
        },
      }),
    );
  } else {
    notes.push(`Brief non rendu, champs manquants : ${brief.missing.join(", ")}`);
  }

  notes.push(`Brief généré le ${input.now} — CRM non connecté, à recouper avec ${DIVE_CENTER.shortName}.`);

  return {
    agent: "booking",
    eventId: `brief-${input.date}`,
    kind: "report",
    priority: "P3",
    actions,
    gaps: [...new Set(gaps)],
    notes,
  };
}
