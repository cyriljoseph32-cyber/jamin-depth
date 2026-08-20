import { describe, expect, it } from "vitest";
import { createKpiStore, displayFor, parseKpi, totalFor, NOT_PROVIDED } from "./kpi";

const T0 = "2026-08-18T02:00:00.000Z";

describe("parseKpi", () => {
  it("lit projet, métrique, valeur et note", () => {
    const parsed = parseKpi("diving bookings 3 deux Open Water");
    expect(parsed).toEqual({
      ok: true,
      draft: { venture: "DIVING", metric: "bookings", value: 3, note: "deux Open Water" },
    });
  });

  it("accepte l'absence de note", () => {
    const parsed = parseKpi("RUGBY signups 2");
    expect(parsed.ok && parsed.draft.note).toBe("");
  });

  it("explique plutôt que d'échouer en silence", () => {
    const bad = parseKpi("plongée réservations trois");
    expect(bad.ok).toBe(false);
    expect(bad.ok === false && bad.message).toContain("Métriques :");
  });

  it("refuse une valeur qui n'est pas un nombre positif", () => {
    expect(parseKpi("DIVING bookings trois").ok).toBe(false);
    expect(parseKpi("DIVING bookings -2").ok).toBe(false);
  });
});

describe("totalFor", () => {
  it("distingue « rien saisi » de « zéro constaté »", async () => {
    const store = createKpiStore(() => T0);
    expect(totalFor(await store.list(), "bookings")).toBeNull();
    expect(displayFor(await store.list(), "bookings")).toBe(NOT_PROVIDED);

    await store.record({ venture: "DIVING", metric: "bookings", value: 0, note: "", by: "cyril" });
    expect(totalFor(await store.list(), "bookings")).toBe(0);
    expect(displayFor(await store.list(), "bookings")).toBe("0");
  });

  it("additionne les saisies de la période", async () => {
    const store = createKpiStore(() => T0);
    await store.record({ venture: "DIVING", metric: "bookings", value: 3, note: "", by: "cyril" });
    await store.record({ venture: "RUGBY", metric: "bookings", value: 2, note: "", by: "cyril" });

    expect(totalFor(await store.list(), "bookings")).toBe(5);
    expect(totalFor(await store.list(), "bookings", "DIVING")).toBe(3);
  });
});
