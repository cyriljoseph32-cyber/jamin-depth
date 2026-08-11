import type { Locale } from "@/content/i18n";
import { pathFor, type PageKey } from "@/content/routes";
import { DIVE_CENTER, SITE } from "@/content/site";
import { OPS } from "../config";
import type { Agent, AgentOutcome, InboundEvent, ProposedAction } from "../types";
import { actionFactory, teamLocale } from "./shared";

/**
 * Content.
 *
 * Two deliberate limits. First, nothing is published without a human: a post is
 * the brand speaking in public, and `policy.ts` puts every `publish_content` in
 * the queue. Second, this agent writes *briefs and drafts*, not facts. It cannot
 * add a species seen last week, a testimonial, a water temperature or a
 * five-star claim — so what it produces is a structure plus the verified
 * material, with the human touches marked as slots to fill.
 *
 * Audience order comes from the audit: francophone travellers first, then
 * international English (notably Indian travellers), never a machine
 * translation of French idiom.
 */

export interface ContentPillar {
  id: string;
  /** The page the piece should send traffic to — real routes only. */
  pageKey: PageKey;
  angle: Record<Locale, string>;
  /** The spine of the piece. Facts only where the site already states them. */
  outline: Record<Locale, string[]>;
  /** Written into every brief so the writer — human or model — sees the fence. */
  mustNotClaim: readonly string[];
}

const NEVER_CLAIM = [
  "aucune espèce garantie (requin-baleine, raie manta…)",
  "aucune météo, visibilité ni température annoncée",
  "aucun délai de réponse",
  "aucun tarif hors catalogue vérifié",
  "aucun avis client inventé, aucune note, aucun classement",
  `Jammin's Depths n'est pas une école PADI (formations avec ${DIVE_CENTER.shortName})`,
  "aucune compétence linguistique de l'équipe non confirmée",
] as const;

/**
 * The content pillars. Each one maps to a page that already exists, because a
 * post that lands nowhere converts nothing.
 */
export const CONTENT_PILLARS: readonly ContentPillar[] = [
  {
    id: "first-dive-koh-samui",
    pageKey: "baptism",
    angle: {
      fr: "Première plongée à Koh Samui : à quoi ça ressemble vraiment, minute par minute",
      en: "Your first dive in Koh Samui: what the day actually looks like",
    },
    outline: {
      fr: [
        "Ce que le baptême est et n'est pas (une journée, encadrée, sans brevet)",
        "Le déroulé honnête : briefing, mise à l'eau, premières respirations",
        "Ce qui est inclus (matériel) et ce qu'il faut apporter",
        "Ce qui peut annuler une sortie — et pourquoi c'est une bonne nouvelle",
        "SLOT : une photo du propriétaire, pas une banque d'images",
      ],
      en: [
        "What Discover Scuba Diving is and isn't (one day, guided, no certification)",
        "The honest run-through: briefing, entry, first breaths",
        "What's included (equipment) and what to bring",
        "What can cancel a trip — and why that's good news",
        "SLOT: one of the owner's own photos, not stock",
      ],
    },
    mustNotClaim: NEVER_CLAIM,
  },
  {
    id: "certified-sites-gulf",
    pageKey: "diving",
    angle: {
      fr: "Sail Rock, Koh Tao, Chumphon Pinnacle : ce que chaque site demande vraiment",
      en: "Sail Rock, Koh Tao, Chumphon Pinnacle: what each site actually asks of you",
    },
    outline: {
      fr: [
        "Les trois sites que les sorties atteignent réellement",
        "Niveau et expérience utiles pour chacun, sans dramatiser",
        "Pourquoi partir en petit comité change la plongée",
        "Comment se préparer la veille",
      ],
      en: [
        "The three sites trips actually reach",
        "The level and experience each one rewards, without drama",
        "Why a small group changes the dive",
        "How to prepare the day before",
      ],
    },
    mustNotClaim: NEVER_CLAIM,
  },
  {
    id: "recovery-how-it-works",
    pageKey: "recovery",
    angle: {
      fr: "Objet tombé à l'eau à Koh Samui : les quatre étapes, et ce qui change les chances",
      en: "Dropped something in the water in Koh Samui: the four steps, and what shifts the odds",
    },
    outline: {
      fr: [
        "Les quatre étapes : contact, localisation, évaluation, intervention possible",
        "Les trois informations qui font la différence : objet, endroit exact, heure",
        "Pourquoi la vitesse compte (courant, sable)",
        "Ce qui n'est pas promis, et pourquoi c'est plus honnête",
      ],
      en: [
        "The four steps: contact, locating, assessment, possible intervention",
        "The three details that matter: object, exact spot, time",
        "Why speed counts (current, shifting sand)",
        "What is not promised, and why that's the honest answer",
      ],
    },
    mustNotClaim: NEVER_CLAIM,
  },
  {
    id: "diving-for-indian-travellers",
    pageKey: "diving",
    angle: {
      fr: "Voyageurs indiens à Koh Samui : plonger sans expérience, en anglais simple",
      en: "Indian travellers in Koh Samui: diving with no experience, in plain English",
    },
    outline: {
      fr: [
        "Plain English, phrases courtes, pas d'argot de plongée",
        "Ce qui rassure vraiment : encadrement, petit groupe, rythme",
        "Nager : ce qui se discute avant, jamais par message automatique",
        "SLOT : à confirmer avec le propriétaire — végétarien/halal à bord, transferts",
      ],
      en: [
        "Plain English, short sentences, no dive jargon",
        "What actually reassures: guiding, small group, unhurried pace",
        "Swimming: discussed before, never settled by an automated message",
        "SLOT: confirm with the owner — vegetarian/halal on board, transfers",
      ],
    },
    mustNotClaim: NEVER_CLAIM,
  },
];

function briefBody(pillar: ContentPillar, locale: Locale): string {
  const lines = [
    `Angle (${locale.toUpperCase()}) : ${pillar.angle[locale]}`,
    `Page cible : ${pathFor(pillar.pageKey, locale)}`,
    `Appel à l'action : WhatsApp ${SITE.phoneInternationalDisplay}`,
    "",
    "Plan :",
    ...pillar.outline[locale].map((step, i) => `${i + 1}. ${step}`),
    "",
    "Interdits :",
    ...pillar.mustNotClaim.map((rule) => `- ${rule}`),
  ];
  return lines.join("\n");
}

/** Find the pillar a request refers to: explicit id, then page keyword. */
function matchPillar(text: string): ContentPillar | undefined {
  const lower = text.toLowerCase();
  return (
    CONTENT_PILLARS.find((p) => lower.includes(p.id)) ??
    CONTENT_PILLARS.find((p) => lower.includes(p.pageKey)) ??
    CONTENT_PILLARS.find((p) =>
      [p.angle.fr, p.angle.en].some((a) =>
        a
          .toLowerCase()
          .split(/[\s:,]+/)
          .filter((w) => w.length > 4)
          .some((w) => lower.includes(w)),
      ),
    )
  );
}

export const contentAgent: Agent = {
  name: "content",

  handle(event: InboundEvent): AgentOutcome {
    const action = actionFactory(event.id);
    const actions: ProposedAction[] = [];
    const notes: string[] = [];
    const gaps: string[] = [];

    const pillar = matchPillar(event.text);

    if (!pillar) {
      notes.push(
        `Aucun pilier de contenu ne correspond à « ${event.text.slice(0, 80)} ». Les sujets restent alignés sur les pages existantes.`,
      );
      actions.push(
        action({
          type: "internal_report",
          summary: "Demande de contenu hors piliers — à cadrer avec le propriétaire",
          draft: {
            channel: "internal",
            to: { name: "équipe" },
            locale: teamLocale,
            body: [
              `Demande reçue : ${event.text.slice(0, 300)}`,
              "",
              "Piliers disponibles :",
              ...CONTENT_PILLARS.map((p) => `- ${p.id} → ${p.angle[teamLocale]}`),
            ].join("\n"),
            templateId: "ops.content_unmatched",
          },
        }),
      );
      return { agent: "content", eventId: event.id, kind: "content", priority: "P3", actions, gaps, notes };
    }

    // Brief first, in the audience order set by the audit: FR, then EN.
    for (const locale of OPS.contentAudiences) {
      actions.push(
        action({
          type: "internal_report",
          summary: `Brief contenu ${locale.toUpperCase()} — ${pillar.id}`,
          draft: {
            channel: "internal",
            to: { name: "équipe" },
            locale: teamLocale,
            body: briefBody(pillar, locale),
            templateId: `content.brief.${pillar.id}.${locale}`,
          },
          payload: { pillar: pillar.id, locale, pageKey: pillar.pageKey },
        }),
      );

      actions.push(
        action({
          type: "publish_content",
          summary: `Publication ${locale.toUpperCase()} — ${pillar.angle[locale]}`,
          payload: {
            pillar: pillar.id,
            locale,
            target: pathFor(pillar.pageKey, locale),
            outline: pillar.outline[locale],
            mustNotClaim: pillar.mustNotClaim,
          },
        }),
      );
    }

    gaps.push("photos et témoignages réels à fournir par le propriétaire (jamais générés)");
    notes.push("Toute publication reste en file de validation humaine.");

    return {
      agent: "content",
      eventId: event.id,
      kind: "content",
      priority: "P3",
      actions,
      gaps,
      notes,
    };
  },
};
