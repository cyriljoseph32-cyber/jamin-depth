import { describe, expect, it } from "vitest";
import {
  formatAction,
  formatAlert,
  formatApproval,
  formatDigest,
  formatEveningReport,
  formatEvent,
  formatMorningBrief,
} from "./format";
import type { CommandEvent } from "./types";

const T0 = "2026-08-18T02:00:00.000Z"; // 09:00 Bangkok

function event(over: Partial<CommandEvent> = {}): CommandEvent {
  return {
    event_id: "evt_20260818_0900_abcd1234",
    timestamp: T0,
    venture: "DIVING",
    agent: "reception",
    type: "ACTION",
    priority: "P2",
    status: "DONE",
    summary: "Réponse préparée pour Marie",
    details: "Impact : lead chaud conservé",
    links: [],
    next_action: "attendre la réponse",
    needs_owner: false,
    level: 1,
    fingerprint: "f",
    ...over,
  };
}

describe("formatAction", () => {
  it("suit le format imposé, ligne à ligne", () => {
    expect(formatAction(event())).toBe(
      [
        "[✅ ACTION] #COCO_COMMAND #DIVING #SALES #RECEPTION",
        "Action : Réponse préparée pour Marie",
        "Résultat : fait",
        "Impact : lead chaud conservé",
        "Suite : attendre la réponse",
        "ID : evt_20260818_0900_abcd1234",
      ].join("\n"),
    );
  });
});

describe("formatApproval", () => {
  it("porte les deux commandes avec l'identifiant exact", () => {
    const text = formatApproval(
      event({
        status: "WAITING_APPROVAL",
        needs_owner: true,
        level: 3,
        details: "Pourquoi : le client attend depuis 2 jours\nDétail : WhatsApp → Marie",
      }),
    );
    expect(text).toContain("[⚠️ VALIDATION REQUISE]");
    expect(text).toContain("Pourquoi : le client attend depuis 2 jours");
    expect(text).toContain("Détail : WhatsApp → Marie");
    expect(text).toContain("Répondre : /approve evt_20260818_0900_abcd1234 ou /reject evt_20260818_0900_abcd1234");
  });

  it("décrit l'impact par des faits du système quand rien n'est fourni", () => {
    const text = formatApproval(event({ details: "", needs_owner: true, level: 4 }));
    expect(text).toContain("Impact : N4 · critique · P2 · décision de Cyril attendue");
  });
});

describe("formatAlert", () => {
  it("marque l'urgence et pose une question précise", () => {
    const text = formatAlert(
      event({
        priority: "P0",
        type: "ALERT",
        summary: "Paiement refusé",
        details: "Problème : carte refusée\nImpact : plongée de demain non payée\nAction prise : réservation gelée\nDécision : relancer ou annuler ?",
      }),
    );
    expect(text.split("\n")[0]).toBe("[🚨 P0 — URGENT] #COCO_COMMAND #DIVING #SALES #URGENT");
    expect(text).toContain("Décision requise : relancer ou annuler ?");
  });
});

describe("formatEvent", () => {
  it("choisit l'alerte, la validation ou l'action dans cet ordre", () => {
    expect(formatEvent(event({ priority: "P0" }))).toContain("🚨");
    expect(formatEvent(event({ needs_owner: true }))).toContain("VALIDATION REQUISE");
    expect(formatEvent(event())).toContain("✅ ACTION");
  });
});

describe("formatDigest", () => {
  it("groupe par activité en un seul message", () => {
    const text = formatDigest(
      [event(), event({ venture: "RUGBY", agent: "marketing", summary: "Post prêt", event_id: "evt_2" })],
      T0,
    );
    expect(text).toContain("[📋 SUIVI — 09:00] 2 événement(s)");
    expect(text).toContain("#DIVING");
    expect(text).toContain("#RUGBY");
  });

  it("ne dit rien quand il n'y a rien", () => {
    expect(formatDigest([], T0)).toBe("");
  });
});

describe("brief et bilan", () => {
  it("rend le brief du matin dans l'ordre imposé", () => {
    const text = formatMorningBrief({
      now: T0,
      priorities: ["A", "B"],
      agenda: [],
      leads: { count: 3, actions: ["Marie — new"] },
      blockers: [],
      opportunities: [],
      plan: [{ venture: "DIVING", action: "répondre à Marie" }],
    });
    expect(text.startsWith("[☀️ BRIEF OPÉRATIONNEL — 2026-08-18]")).toBe(true);
    expect(text).toContain("3. Leads / clients : 3");
    expect(text).toContain("- rien à signaler");
    expect(text.trimEnd().endsWith("Commandes : /today | /approve ID | /priority [sujet] | /status [projet]")).toBe(true);
  });

  it("n'invente jamais le chiffre d'affaires", () => {
    const text = formatEveningReport({
      now: T0,
      done: ["Réponse envoyée"],
      numbers: {
        leads: 2,
        bookings: 0,
        revenueTHB: "[À COMPLÉTER PAR CYRIL]",
        contentPublished: 1,
        ticketsHandled: 4,
      },
      watch: [],
      tomorrow: ["Relancer Marie"],
    });
    expect(text).toContain("- CA confirmé : [À COMPLÉTER PAR CYRIL]");
    expect(text).toContain("🎯 Demain :");
  });
});
