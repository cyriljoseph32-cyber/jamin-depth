import { describe, expect, it } from "vitest";
import { createMockCrm, mergeLead, type Lead, type LeadUpsert } from "./adapters";
import { detectRefusal, isOptedOut, refusalNote } from "./refusal";
import { dueFollowUps } from "./schedule";
import { enabledLoops, isLoopEnabled, loopStatusLines } from "./loops";

/**
 * Risque R1 de l'audit : Samui Pro Nutrition a refusé le 09/08 et a été relancé
 * le 11/08 puis le 24/08. Le code avait la bonne garde, elle était inatteignable.
 * Ces tests vérifient que le circuit est refermé — et qu'il le reste.
 */

describe("detectRefusal", () => {
  it("reconnaît un refus net en français", () => {
    for (const m of [
      "Merci mais nous ne sommes pas intéressés",
      "Ne me recontactez plus s'il vous plaît",
      "Non merci",
      "Désabonnez-moi de votre liste",
      "On ne donnera pas suite",
    ]) {
      expect(detectRefusal(m).refused, m).toBe(true);
    }
  });

  it("reconnaît un refus net en anglais", () => {
    for (const m of [
      "Thanks, we're not interested",
      "Please stop contacting me",
      "Remove me from your list",
      "Unsubscribe",
      "Not a good fit for us",
    ]) {
      expect(detectRefusal(m).refused, m).toBe(true);
    }
  });

  it("reconnaît un refus en thaï", () => {
    expect(detectRefusal("ไม่สนใจ ขอบคุณ").refused).toBe(true);
  });

  it("ne prend PAS une hésitation pour un refus — c'est un lead à relancer", () => {
    for (const m of [
      "Je vais réfléchir et je reviens vers vous",
      "Pas maintenant, peut-être le mois prochain",
      "Can you send me the prices first?",
      "On est intéressés mais il faut qu'on en parle",
    ]) {
      expect(detectRefusal(m).refused, m).toBe(false);
    }
  });

  it("garde la formulation reconnue, pour que la décision soit auditable", () => {
    const v = detectRefusal("Bonjour, nous ne sommes pas intéressés par votre offre.");
    expect(v.matched).toBeTruthy();
    expect(refusalNote(v, "2026-09-12", { name: "Samui Pro Nutrition" })).toContain("Samui Pro Nutrition");
  });
});

describe("le refus est indélébile", () => {
  const base: Lead = {
    id: "lead-1",
    key: "email:refus@exemple.com",
    contact: { email: "refus@exemple.com" },
    channel: "email",
    locale: "fr",
    dates: [],
    stage: "lost",
    optedOut: true,
    sensitiveTopics: [],
    followUps: 1,
    notes: [],
    createdAt: "2026-08-09T00:00:00.000Z",
    updatedAt: "2026-08-09T00:00:00.000Z",
  };

  const upsert: LeadUpsert = {
    contact: { email: "refus@exemple.com" },
    channel: "email",
    locale: "fr",
    dates: [],
    stage: "new",
    sensitiveTopics: [],
  };

  it("LE scénario R1 : un événement ultérieur ne ramène pas le lead en « new »", () => {
    const after = mergeLead(base, upsert, "2026-09-12T00:00:00.000Z");
    expect(after.stage).toBe("lost");
    expect(after.optedOut).toBe(true);
  });

  it("l'ingestion inter-projets ne peut pas effacer un refus", async () => {
    const crm = createMockCrm(() => "2026-09-12T00:00:00.000Z");
    await crm.upsert({ ...upsert, stage: "new", optedOut: true });
    // coco2 ou CSRA pousse un nouvel événement pour la même personne
    const reopened = await crm.upsert({ ...upsert, stage: "new" });
    expect(isOptedOut(reopened)).toBe(true);
  });

  it("une conversion non plus ne se perd pas", () => {
    const won = mergeLead({ ...base, stage: "won", optedOut: undefined }, upsert, "2026-09-12T00:00:00.000Z");
    expect(won.stage).toBe("won");
  });

  it("un lead ordinaire garde un stade modifiable", () => {
    const ordinary = mergeLead(
      { ...base, stage: "new", optedOut: undefined },
      { ...upsert, stage: "qualified" },
      "2026-09-12T00:00:00.000Z",
    );
    expect(ordinary.stage).toBe("qualified");
  });

  it("aucune relance n'est due pour quelqu'un qui a refusé", () => {
    const vieux = { ...base, updatedAt: "2026-01-01T00:00:00.000Z", followUps: 0 };
    expect(dueFollowUps([vieux], "2026-09-12T09:00:00.000Z")).toHaveLength(0);
  });

  it("le drapeau seul suffit, même si le stade a été mal écrit ailleurs", () => {
    const incoherent = {
      ...base,
      stage: "qualified" as const,
      optedOut: true,
      followUps: 0,
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    expect(dueFollowUps([incoherent], "2026-09-12T09:00:00.000Z")).toHaveLength(0);
  });
});

describe("interrupteurs de boucles", () => {
  it("tout est éteint par défaut — un oubli laisse le système silencieux", () => {
    expect(enabledLoops("")).toEqual(new Set());
    expect(enabledLoops(undefined)).toEqual(new Set());
    expect(isLoopEnabled("B2", "")).toBe(false);
  });

  it("allume exactement ce qui est listé, une boucle à la fois", () => {
    expect(isLoopEnabled("B2", "B2")).toBe(true);
    expect(isLoopEnabled("B1", "B2")).toBe(false);
    expect(enabledLoops(" b1 , B2 ")).toEqual(new Set(["B1", "B2"]));
  });

  it("ignore un identifiant inconnu plutôt que d'allumer par erreur", () => {
    expect(enabledLoops("B9,TOUT,B2")).toEqual(new Set(["B2"]));
  });

  it("le brief montre l'état de chaque boucle", () => {
    const lines = loopStatusLines("B2");
    expect(lines.find((l) => l.includes("B2"))).toContain("🟢");
    expect(lines.find((l) => l.includes("B1"))).toContain("⚪");
  });
});
