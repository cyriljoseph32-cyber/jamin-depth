import { describe, expect, it } from "vitest";
import { actionTypes, type ActionType } from "@/agents/types";
import { requiresHumanApproval } from "@/agents/policy";
import { levelFor, levelForActionType, levelForIngested, needsOwnerApproval } from "./levels";

describe("levelFor", () => {
  it("classe chaque type d'action, sans trou", () => {
    for (const type of actionTypes) {
      const level = levelForActionType(type as ActionType);
      expect(level).toBeGreaterThanOrEqual(0);
      expect(level).toBeLessThanOrEqual(4);
    }
  });

  it("relève un brouillon adressé à un client au niveau 3", () => {
    const level = levelFor({
      type: "internal_report",
      draft: {
        channel: "whatsapp",
        to: { phone: "+66812345678" },
        locale: "fr",
        body: "Bonjour",
        templateId: "t",
      },
    });
    expect(level).toBe(3);
  });

  it("laisse un rapport interne au niveau 2", () => {
    expect(levelFor({ type: "internal_report", draft: undefined })).toBe(2);
  });

  it("met l'argent et les sièges au niveau 4", () => {
    for (const type of ["refund", "record_payment", "send_payment_link", "confirm_booking", "cancel_booking"] as const) {
      expect(levelFor({ type, draft: undefined })).toBe(4);
    }
  });
});

describe("needsOwnerApproval", () => {
  /**
   * L'invariant du mandat : à partir du niveau 3, une décision humaine est
   * exigée. Le niveau peut durcir l'avis de la policy, jamais l'assouplir.
   */
  it("exige une validation dès le niveau 3, quoi que dise la policy", () => {
    for (const type of actionTypes) {
      const level = levelForActionType(type as ActionType);
      if (level < 3) continue;
      expect(needsOwnerApproval(level, { required: false, reasons: [], approver: "none" })).toBe(true);
    }
  });

  it("suit la policy en dessous du niveau 3", () => {
    expect(needsOwnerApproval(2, { required: true, reasons: ["rule:safety-topic"], approver: "owner" })).toBe(true);
    expect(needsOwnerApproval(2, { required: false, reasons: [], approver: "none" })).toBe(false);
  });

  it("n'assouplit jamais un verdict de la policy", () => {
    for (const type of actionTypes) {
      const verdict = requiresHumanApproval({ id: "a", type: type as ActionType, summary: "s", risk: "low" });
      if (!verdict.required) continue;
      expect(needsOwnerApproval(levelForActionType(type as ActionType), verdict)).toBe(true);
    }
  });
});

describe("levelForIngested", () => {
  it("force le niveau 3 quand un projet demande une décision", () => {
    expect(levelForIngested({ level: 0, needs_owner: true })).toBe(3);
    expect(levelForIngested({ level: 4, needs_owner: true })).toBe(4);
  });

  it("borne les valeurs fantaisistes", () => {
    expect(levelForIngested({ level: 42, needs_owner: false })).toBe(4);
    expect(levelForIngested({ level: -3, needs_owner: false })).toBe(0);
    expect(levelForIngested({ needs_owner: false })).toBe(0);
  });
});
