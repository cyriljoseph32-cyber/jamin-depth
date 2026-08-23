import { describe, expect, it } from "vitest";
import type { ContentPillar } from "@/agents/roles/content";
import { composeDivingDraft, pillarForDay } from "./content-draft";
import { validateContent } from "./content";

const PILLARS: readonly ContentPillar[] = [
  {
    id: "pillar-a",
    pageKey: "baptism",
    angle: { fr: "Angle A", en: "Angle A EN" },
    outline: { fr: ["étape 1", "étape 2"], en: ["step 1", "step 2"] },
    mustNotClaim: ["aucune espèce garantie"],
  },
  {
    id: "pillar-b",
    pageKey: "diving",
    angle: { fr: "Angle B", en: "Angle B EN" },
    outline: { fr: ["étape 1"], en: ["step 1"] },
    mustNotClaim: [],
  },
];

describe("pillarForDay", () => {
  it("choisit un pilier existant, sans état à retenir", () => {
    const pillar = pillarForDay("2026-08-22T01:15:00.000Z", PILLARS);
    expect(PILLARS).toContain(pillar);
  });

  it("tourne sur les piliers d'un jour à l'autre", () => {
    const day0 = pillarForDay("2026-08-22T01:15:00.000Z", PILLARS);
    const day1 = pillarForDay("2026-08-23T01:15:00.000Z", PILLARS);
    expect(day0.id).not.toBe(day1.id);
  });

  it("redonne le même pilier pour le même jour", () => {
    const a = pillarForDay("2026-08-22T01:15:00.000Z", PILLARS);
    const b = pillarForDay("2026-08-22T23:00:00.000Z", PILLARS);
    expect(a.id).toBe(b.id);
  });
});

describe("composeDivingDraft", () => {
  it("utilise le texte généré quand il est propre", async () => {
    const draft = await composeDivingDraft(PILLARS[0]!, "fr", async () => ({
      hook: "Prêt pour ta première plongée ?",
      caption: "Un briefing, une mise à l'eau, une équipe avec toi.",
      cta: "Écris-nous sur WhatsApp",
    }));
    expect(draft.hook).toBe("Prêt pour ta première plongée ?");
    expect(draft.key_message).toContain("Généré depuis le pilier pillar-a");
    expect(validateContent(draft)).toEqual([]);
  });

  it("bascule sur l'habillage déterministe si le générateur rend null", async () => {
    const draft = await composeDivingDraft(PILLARS[0]!, "fr", async () => null);
    expect(draft.hook).toBe("Angle A");
    expect(draft.caption_draft).toBe("étape 1 étape 2");
    expect(draft.key_message).toContain("Repli automatique");
    expect(validateContent(draft)).toEqual([]);
  });

  it("bascule sur l'habillage déterministe si le générateur lève une erreur", async () => {
    const draft = await composeDivingDraft(PILLARS[0]!, "fr", async () => {
      throw new Error("panne API");
    });
    expect(draft.hook).toBe("Angle A");
    expect(draft.key_message).toContain("Repli automatique");
  });

  it("rejette un texte généré qui contient un interdit, et bascule sur le repli", async () => {
    const draft = await composeDivingDraft(PILLARS[0]!, "fr", async () => ({
      hook: "On voit toujours le requin-baleine ici",
      caption: "Garanti à 100%.",
      cta: "Réserve maintenant",
    }));
    expect(draft.hook).toBe("Angle A");
    expect(draft.key_message).toContain("Repli automatique");
  });

  it("le CTA du repli pointe vers WhatsApp, jamais un lien inventé", async () => {
    const draft = await composeDivingDraft(PILLARS[1]!, "fr", async () => null);
    expect(draft.cta).toContain("WhatsApp");
  });
});
