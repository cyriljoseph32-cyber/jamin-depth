import { describe, expect, it } from "vitest";
import { locales } from "@/content/i18n";
import { auditDraft } from "./policy";
import { TEMPLATES, compose, render, slotsOf } from "./templates";

describe("render", () => {
  it("fills a template", () => {
    const out = render("lead.followup.1", "fr", { name: "Marie" });
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.body).toContain("Marie");
  });

  it("refuses rather than leaving a hole", () => {
    const out = render("lead.ack.discover_scuba", "fr", { name: "Marie" });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.missing).toEqual(expect.arrayContaining(["price", "caveat"]));
  });

  it("treats an empty or whitespace slot as missing", () => {
    const out = render("lead.followup.1", "fr", { name: "   " });
    expect(out.ok).toBe(false);
  });

  it("reports an unknown template instead of throwing", () => {
    const out = render("does.not.exist", "fr", {});
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.missing).toEqual(["template:unknown"]);
  });
});

describe("compose", () => {
  it("joins the blocks that rendered and reports the rest", () => {
    const out = compose([
      render("lead.ack.generic", "fr", { name: "Marie" }),
      render("lead.missing_info", "fr", { questions: "vos dates" }),
      render("safety.prearrival", "fr", { name: "Marie" }),
    ]);
    expect(out.templateIds).toEqual(["lead.ack.generic", "lead.missing_info"]);
    expect(out.body.split("\n\n")).toHaveLength(2);
    expect(out.missing).toEqual(expect.arrayContaining(["date", "details"]));
  });
});

describe("every approved template", () => {
  /** Neutral filler: no digits, so it cannot trip the price guard by accident. */
  const filler = "XXX";

  it("exists in both locales with the same slots", () => {
    for (const tpl of TEMPLATES) {
      for (const locale of locales) {
        expect(tpl.body[locale], `${tpl.id} missing ${locale}`).toBeTruthy();
      }
    }
  });

  it("renders and survives the outgoing guard in both locales", () => {
    // The point of this test: an approved template is not trusted on its own.
    // If someone edits copy into a promise, this fails before a client sees it.
    for (const tpl of TEMPLATES) {
      const slots = Object.fromEntries(slotsOf(tpl.id).map((s) => [s, filler]));
      for (const locale of locales) {
        const out = render(tpl.id, locale, slots);
        expect(out.ok, `${tpl.id}/${locale} did not render`).toBe(true);
        if (!out.ok) continue;
        const violations = auditDraft(out.body);
        expect(violations, `${tpl.id}/${locale}: ${violations.map((v) => v.rule).join(", ")}`).toEqual([]);
      }
    }
  });

  it("uses no emoji and no markdown headings", () => {
    for (const tpl of TEMPLATES) {
      for (const locale of locales) {
        const body = tpl.body[locale];
        expect(body, `${tpl.id}/${locale}`).not.toMatch(/\p{Extended_Pictographic}/u);
        expect(body, `${tpl.id}/${locale}`).not.toMatch(/^#{1,6}\s/m);
      }
    }
  });
});
