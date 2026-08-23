import Anthropic from "@anthropic-ai/sdk";
import type { Locale } from "@/content/i18n";
import type { DraftGenerator, DraftGeneratorOutput } from "@/command/content-draft";

/**
 * Rédaction du brouillon — Claude, sous contrainte.
 *
 * Même logique que `api/chat/route.ts` : la clé vient de l'environnement, et
 * son absence dégrade proprement (`null`) plutôt que de faire échouer le cron.
 * Le prompt système reproduit les interdits du pilier mot pour mot — le
 * modèle rédige, il n'invente pas de nouveaux faits.
 */

const MODEL = "claude-haiku-4-5-20251001";

function systemPrompt(mustNotClaim: readonly string[], locale: Locale): string {
  const lang = locale === "fr" ? "français" : "anglais";
  return [
    `Tu rédiges une légende Instagram en ${lang} pour Jammin's Depths, centre de plongée à Koh Samui.`,
    "Réponds UNIQUEMENT avec un JSON valide : {\"hook\": string, \"caption\": string, \"cta\": string}.",
    "hook : la première phrase, celle qui arrête le défilement.",
    "caption : 3 à 5 phrases courtes, ton chaleureux et honnête, pas de superlatifs vides.",
    "cta : une phrase d'appel à l'action vers WhatsApp.",
    "Interdits stricts — ne jamais écrire, suggérer ou impliquer l'un de ces éléments :",
    ...mustNotClaim.map((rule) => `- ${rule}`),
    "N'invente aucun fait qui ne figure pas dans le message de l'utilisateur.",
  ].join("\n");
}

function userPrompt(angle: string, outline: readonly string[]): string {
  return [`Angle : ${angle}`, "", "Plan à suivre :", ...outline.map((s, i) => `${i + 1}. ${s}`)].join("\n");
}

function parseOutput(text: string): DraftGeneratorOutput | null {
  try {
    const parsed = JSON.parse(text) as Partial<DraftGeneratorOutput>;
    if (
      typeof parsed.hook === "string" &&
      parsed.hook.trim().length > 0 &&
      typeof parsed.caption === "string" &&
      parsed.caption.trim().length > 0 &&
      typeof parsed.cta === "string" &&
      parsed.cta.trim().length > 0
    ) {
      return { hook: parsed.hook.trim(), caption: parsed.caption.trim(), cta: parsed.cta.trim() };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Construit le générateur, ou `null` sans clé configurée.
 *
 * `null` n'est pas une erreur : `composeDivingDraft` bascule alors sur
 * l'habillage déterministe, exactement comme en cas de panne d'API.
 */
export function anthropicDraftGenerator(apiKey = process.env.ANTHROPIC_API_KEY?.trim()): DraftGenerator | null {
  if (!apiKey) return null;
  const client = new Anthropic({ apiKey });

  return async ({ pillar, locale }) => {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 400,
      system: systemPrompt(pillar.mustNotClaim, locale),
      messages: [{ role: "user", content: userPrompt(pillar.angle[locale], pillar.outline[locale]) }],
    });
    const block = message.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") return null;
    return parseOutput(block.text);
  };
}
