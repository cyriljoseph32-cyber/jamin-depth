import { describe, expect, it } from "vitest";
import { readIngestEvent } from "./ingest";

const valid = {
  venture: "RUGBY",
  agent: "marketing",
  type: "ACTION",
  priority: "P2",
  status: "DONE",
  summary: "Post Instagram publié",
  details: "Impact : visibilité locale",
  links: ["https://instagram.com/p/xyz"],
  next_action: "mesurer l'engagement à J+2",
  needs_owner: false,
};

describe("readIngestEvent", () => {
  it("accepte un événement au format imposé", () => {
    const result = readIngestEvent(valid);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.event.venture).toBe("RUGBY");
      expect(result.event.level).toBe(0);
    }
  });

  it("nomme précisément chaque champ fautif", () => {
    const result = readIngestEvent({ ...valid, venture: "PLONGEE", priority: "P9", summary: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problems).toContain("venture : COCO | DIVING | RUGBY | GLOBAL");
      expect(result.problems).toContain("priority : P0 | P1 | P2 | P3");
      expect(result.problems).toContain("summary : une phrase, obligatoire");
    }
  });

  it("refuse un corps qui n'est pas un objet", () => {
    expect(readIngestEvent("bonjour").ok).toBe(false);
    expect(readIngestEvent(null).ok).toBe(false);
  });

  /**
   * Le point qui compte : un dépôt tiers détient un jeton d'écriture, pas un
   * pouvoir de décision. Déclarer `needs_owner` le met en attente, quoi qu'il
   * ait mis dans `status` ou dans `level`.
   */
  it("met en attente de validation dès qu'une décision est demandée", () => {
    const result = readIngestEvent({ ...valid, needs_owner: true, status: "DONE", level: 0 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.event.status).toBe("WAITING_APPROVAL");
      expect(result.event.level).toBe(3);
    }
  });

  it("borne un niveau fantaisiste", () => {
    const result = readIngestEvent({ ...valid, level: 99 });
    expect(result.ok && result.event.level).toBe(4);
  });

  it("refuse un horodatage illisible", () => {
    const result = readIngestEvent({ ...valid, timestamp: "hier soir" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems).toContain("timestamp : ISO-8601");
  });
});
