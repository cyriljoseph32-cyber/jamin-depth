import { describe, expect, it } from "vitest";
import { emptyState, isPaused, pause, resume } from "./state";

const T0 = "2026-08-18T02:00:00.000Z";

describe("pause / resume", () => {
  it("distingue une activité d'un agent", () => {
    const paused = pause(pause(emptyState, "DIVING", T0), "marketing", T0);
    expect(paused.pausedVentures).toEqual(["DIVING"]);
    expect(paused.pausedAgents).toEqual(["marketing"]);
  });

  it("est idempotent", () => {
    const once = pause(emptyState, "diving", T0);
    expect(pause(once, "DIVING", T0).pausedVentures).toEqual(["DIVING"]);
  });

  it("rend la main", () => {
    const state = pause(emptyState, "RUGBY", T0);
    expect(resume(state, "RUGBY", T0).pausedVentures).toEqual([]);
  });
});

describe("isPaused", () => {
  const state = pause(pause(emptyState, "DIVING", T0), "marketing", T0);

  it("retient les automatisations de la cible", () => {
    expect(isPaused(state, { venture: "DIVING", agent: "reception", priority: "P2" })).toBe(true);
    expect(isPaused(state, { venture: "RUGBY", agent: "marketing", priority: "P2" })).toBe(true);
    expect(isPaused(state, { venture: "RUGBY", agent: "coach", priority: "P2" })).toBe(false);
  });

  /**
   * La règle qui compte : une pause ne doit jamais transformer une urgence en
   * silence. Mettre une activité en sourdine, c'est arrêter le travail de fond,
   * pas éteindre l'alarme incendie.
   */
  it("laisse toujours passer un P0", () => {
    expect(isPaused(state, { venture: "DIVING", agent: "marketing", priority: "P0" })).toBe(false);
  });
});
