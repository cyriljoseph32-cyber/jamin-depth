import type { Locale } from "@/content/i18n";
import type { ContentPillar } from "@/agents/roles/content";
import { CONTENT_PILLARS } from "@/agents/roles/content";
import { contactLine } from "@/agents/roles/shared";
import type { ContentDraft } from "./content";

/**
 * Le brouillon automatique DIVING.
 *
 * Le contenu vient toujours d'un `ContentPillar` existant — un sujet réel,
 * avec sa page cible et sa liste d'interdits (`mustNotClaim`). Ce module ne
 * fait qu'habiller ce pilier en légende Instagram, jamais l'inverse : il ne
 * doit jamais pouvoir inventer un sujet.
 */

export interface DraftGeneratorInput {
  pillar: ContentPillar;
  locale: Locale;
}

export interface DraftGeneratorOutput {
  hook: string;
  caption: string;
  cta: string;
}

/** Le générateur réel (Claude) est injecté — jamais appelé en dur ici. */
export type DraftGenerator = (input: DraftGeneratorInput) => Promise<DraftGeneratorOutput | null>;

/**
 * Le pilier du jour, choisi sans état à retenir.
 *
 * Un jour du calendrier (UTC, stable) modulo le nombre de piliers fait tourner
 * les quatre sujets sans base de données ni compteur à faire vivre.
 */
export function pillarForDay(now: string, pillars: readonly ContentPillar[] = CONTENT_PILLARS): ContentPillar {
  const dayIndex = Math.floor(new Date(now).getTime() / 86_400_000);
  const pillar = pillars[dayIndex % pillars.length];
  if (!pillar) throw new Error("content-draft: aucun pilier disponible");
  return pillar;
}

/** Le CTA de repli : toujours le même canal réel, jamais un lien inventé. */
function fallbackCta(): string {
  return `Écris-nous sur WhatsApp — ${contactLine()}`;
}

/**
 * L'habillage déterministe, sans appel modèle.
 *
 * Construit directement depuis l'angle et le plan du pilier — aucune matière
 * hors de ce qui est déjà vérifié dans `content.ts`. Sert de repli quand
 * `generate` échoue, et de test de référence : un brouillon dans ce format
 * ne peut jamais contenir un interdit puisqu'il ne fait que recopier le
 * pilier.
 */
function deterministicDraft(pillar: ContentPillar, locale: Locale): DraftGeneratorOutput {
  return {
    hook: pillar.angle[locale],
    caption: pillar.outline[locale].join(" "),
    cta: fallbackCta(),
  };
}

/**
 * Une sous-chaîne d'un interdit se retrouve-t-elle dans le texte produit ?
 *
 * Grossier par construction : mieux vaut rejeter un brouillon sûr par excès
 * de prudence que laisser passer un interdit parce que la formulation exacte
 * ne correspondait pas mot pour mot.
 */
function breaksRule(text: string, mustNotClaim: readonly string[]): boolean {
  const lower = text.toLowerCase();
  const banned = [
    "requin-baleine",
    "raie manta",
    "école padi",
    "padi school",
    "météo garantie",
    "visibilité garantie",
  ];
  return banned.some((word) => lower.includes(word)) || mustNotClaim.some((rule) => lower.includes(rule.toLowerCase()));
}

/**
 * Compose le brouillon d'un pilier pour un jour donné.
 *
 * `generate` peut échouer (API en panne, JSON invalide) ou glisser un
 * interdit malgré la consigne : les deux cas basculent sur l'habillage
 * déterministe plutôt que de laisser le créneau vide ou de publier une
 * légende fautive.
 */
export async function composeDivingDraft(
  pillar: ContentPillar,
  locale: Locale,
  generate: DraftGenerator,
): Promise<ContentDraft> {
  let output: DraftGeneratorOutput | null = null;
  try {
    const generated = await generate({ pillar, locale });
    if (generated && !breaksRule(`${generated.hook} ${generated.caption}`, pillar.mustNotClaim)) {
      output = generated;
    }
  } catch {
    output = null;
  }
  const degraded = output === null;
  if (!output) output = deterministicDraft(pillar, locale);

  return {
    venture: "DIVING",
    channel: "instagram",
    format: "post",
    goal: "lead_generation",
    target_audience:
      locale === "fr"
        ? "Voyageurs francophones envisageant une sortie plongée à Koh Samui"
        : "Travellers considering a dive trip from Koh Samui",
    hook: output.hook,
    key_message: degraded
      ? `Repli automatique (${pillar.id}) — la génération n'a pas produit de texte exploitable, à relire avant validation.`
      : `Généré depuis le pilier ${pillar.id}.`,
    cta: output.cta,
    asset_needed: "",
    caption_draft: output.caption,
  };
}
