import { describe, expect, it } from "vitest";
import {
  actionRisk,
  auditDraft,
  detectSensitiveTopics,
  hasHardStop,
  isDraftSafe,
  requiresHumanApproval,
} from "./policy";
import type { ActionType, ProposedAction } from "./types";

function action(type: ActionType, body?: string): ProposedAction {
  return {
    id: `test:${type}`,
    type,
    summary: `test ${type}`,
    risk: actionRisk(type),
    draft: body
      ? { channel: "whatsapp", to: { name: "Test" }, locale: "fr", body, templateId: "test" }
      : undefined,
  };
}

describe("detectSensitiveTopics", () => {
  it("catches medical wording in both languages", () => {
    expect(detectSensitiveTopics("je suis asthmatique, ça pose problème ?")).toContain("medical");
    expect(detectSensitiveTopics("can I dive with diabetes?")).toContain("medical");
  });

  it("catches accented French, which a naive \\b would miss", () => {
    // These are the exact words that made the first version of this file useless.
    expect(detectSensitiveTopics("j'ai de l'épilepsie")).toContain("medical");
    expect(detectSensitiveTopics("mon fils s'est blessé hier")).toContain("incident");
    expect(detectSensitiveTopics("j'ai beaucoup d'anxiété sous l'eau")).toContain("panic_anxiety");
    expect(detectSensitiveTopics("j'ai été opéré du genou")).toContain("medical");
  });

  it("catches pregnancy, medication, panic and swimming", () => {
    expect(detectSensitiveTopics("je suis enceinte de 4 mois")).toContain("pregnancy");
    expect(detectSensitiveTopics("je prends un médicament pour la tension")).toContain("medication");
    expect(detectSensitiveTopics("I'm claustrophobic")).toContain("panic_anxiety");
    expect(detectSensitiveTopics("je ne sais pas nager")).toContain("cannot_swim");
  });

  it("catches commercial and legal pressure", () => {
    expect(detectSensitiveTopics("vous pouvez faire une réduction ?")).toContain("price_negotiation");
    expect(detectSensitiveTopics("je veux un remboursement")).toContain("refund_request");
    expect(detectSensitiveTopics("je vais contacter mon avocat")).toContain("legal");
  });

  it("stays silent on an ordinary enquiry", () => {
    expect(detectSensitiveTopics("Bonjour, un baptême pour deux le 14 mars ?")).toEqual([]);
  });

  it("treats safety topics as hard stops, commercial ones as not", () => {
    expect(hasHardStop(["medical"])).toBe(true);
    expect(hasHardStop(["cannot_swim"])).toBe(true);
    expect(hasHardStop(["price_negotiation"])).toBe(false);
  });
});

describe("requiresHumanApproval", () => {
  it("lets a purely internal, reversible action through", () => {
    const verdict = requiresHumanApproval(action("create_lead"));
    expect(verdict.required).toBe(false);
    expect(verdict.approver).toBe("none");
  });

  it("never releases money", () => {
    for (const type of ["send_payment_link", "record_payment", "refund"] as const) {
      const verdict = requiresHumanApproval(action(type));
      expect(verdict.required).toBe(true);
      expect(verdict.approver).toBe("owner");
    }
  });

  it("blocks a booking confirmation twice over", () => {
    const verdict = requiresHumanApproval(action("confirm_booking"));
    expect(verdict.reasons).toContain("rule:booking-confirmation");
    // Availability is held by the partner, so this reason is always present too.
    expect(verdict.reasons).toContain("rule:unverified-availability");
  });

  it("queues calendar writes, publications and review replies", () => {
    for (const type of ["create_calendar_event", "publish_content", "reply_review"] as const) {
      expect(requiresHumanApproval(action(type)).required).toBe(true);
    }
  });

  it("holds a WhatsApp message because the channel is draft-only", () => {
    const verdict = requiresHumanApproval(action("send_message", "Bonjour, on regarde ça."));
    expect(verdict.reasons).toContain("rule:channel-draft-only");
  });

  it("lets the site chat answer by itself", () => {
    const chat = action("send_message", "Bonjour, on regarde ça.");
    const draft = chat.draft;
    if (!draft) throw new Error("draft expected");
    const verdict = requiresHumanApproval({ ...chat, draft: { ...draft, channel: "site_chat" } });
    expect(verdict.required).toBe(false);
  });

  it("stops everything when a safety topic is in play", () => {
    const verdict = requiresHumanApproval(action("send_message", "ok"), {
      signals: { sensitiveTopics: ["medical"] },
    });
    expect(verdict.reasons).toContain("rule:safety-topic");
  });

  it("stops a reply in a language nobody confirmed we speak", () => {
    const verdict = requiresHumanApproval(action("send_message", "ok"), {
      signals: { sensitiveTopics: [], foreignLanguage: "de" },
    });
    expect(verdict.reasons).toContain("rule:foreign-language");
  });

  it("records an unverified fact as its own reason on anything the client reads", () => {
    const verdict = requiresHumanApproval(action("send_message", "L'acompte est de ..."), {
      unverified: ["policies.deposit"],
    });
    expect(verdict.required).toBe(true);
    expect(verdict.reasons).toContain("rule:unverified-fact");
  });

  it("does not let a missing policy or a safety flag slow down internal work", () => {
    // Writing the lead down and paging the owner must never wait for a human:
    // gating those would make a safety flag delay the very alert it triggers.
    for (const type of ["create_lead", "update_lead", "notify_staff"] as const) {
      const verdict = requiresHumanApproval(action(type), {
        unverified: ["policies.deposit"],
        signals: { sensitiveTopics: ["medical"] },
      });
      expect(verdict.required, type).toBe(false);
    }
  });
});

describe("auditDraft", () => {
  it("refuses to confirm a place", () => {
    expect(auditDraft("Parfait, c'est confirmé pour samedi.").map((v) => v.rule)).toContain(
      "guard:availability",
    );
    expect(auditDraft("Votre place est réservée.").map((v) => v.rule)).toContain("guard:availability");
    expect(auditDraft("Your spot is confirmed for Saturday.").map((v) => v.rule)).toContain(
      "guard:availability",
    );
  });

  it("refuses to promise weather, sea state or wildlife", () => {
    expect(auditDraft("La météo sera parfaite.").map((v) => v.rule)).toContain("guard:weather");
    expect(auditDraft("Vous verrez des requins-baleines.").map((v) => v.rule)).toContain("guard:wildlife");
    expect(auditDraft("You will see whale sharks.").map((v) => v.rule)).toContain("guard:wildlife");
  });

  it("refuses a response-time promise", () => {
    expect(auditDraft("We reply within 2 hours.").map((v) => v.rule)).toContain("guard:response-time");
  });

  it("refuses any judgement of fitness to dive", () => {
    expect(auditDraft("Aucun problème pour plonger avec de l'asthme.").map((v) => v.rule)).toContain(
      "guard:medical-advice",
    );
    expect(auditDraft("You're fit to dive, no worries.").map((v) => v.rule)).toContain(
      "guard:medical-advice",
    );
  });

  it("refuses to claim Jammin's Depths is a PADI school", () => {
    expect(auditDraft("Notre école PADI vous accueille.").map((v) => v.rule)).toContain(
      "guard:padi-school-claim",
    );
  });

  it("refuses to guarantee a recovery", () => {
    expect(auditDraft("Ne vous inquiétez pas, nous le retrouverons.").map((v) => v.rule)).toContain(
      "guard:recovery-guarantee",
    );
  });

  it("allows a catalogue price and refuses an invented one", () => {
    expect(isDraftSafe("Le baptême est à partir de ฿5,850, matériel inclus.")).toBe(true);
    const violations = auditDraft("Je vous fais ça à ฿4,000.");
    expect(violations.map((v) => v.rule)).toContain("guard:price");
  });

  it("catches an invented price written in baht", () => {
    expect(auditDraft("C'est 3 200 bahts par personne.").map((v) => v.rule)).toContain("guard:price");
  });

  it("allows the one language that is confirmed, and refuses the others", () => {
    // French is owner-confirmed (see POLICIES.staffLanguages). Nothing else is —
    // and a diver who books believing they'll be briefed in their own language
    // has been misled about the thing that matters most underwater.
    expect(isDraftSafe("Nous parlons français, donc on peut tout expliquer tranquillement.")).toBe(true);
    expect(auditDraft("Nous parlons français et hindi à bord.").map((v) => v.rule)).toContain(
      "guard:staff-languages",
    );
    expect(auditDraft("We speak Thai and German on the boat.").map((v) => v.rule)).toContain(
      "guard:staff-languages",
    );
  });

  it("passes an honest, useful message", () => {
    expect(
      isDraftSafe(
        "Bonjour Marie, le baptême Discover Scuba Diving se fait sur une journée, sans brevet requis, à partir de ฿5,850, matériel inclus. Dites-moi vos dates et le nombre de personnes et on prépare ça.",
      ),
    ).toBe(true);
  });
});
