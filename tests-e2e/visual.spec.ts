import { test } from "@playwright/test";
import fs from "node:fs";

/** Both locales are captured — the French build is what most visitors see. */
const pages = [
  { path: "/fr", name: "home-fr" },
  { path: "/fr/plongee", name: "diving-fr" },
  { path: "/fr/recuperation-sous-marine", name: "recovery-fr" },
  { path: "/fr/le-plongeur", name: "about-fr" },
  { path: "/fr/contact", name: "contact-fr" },
  { path: "/en", name: "home-en" },
  { path: "/en/diving", name: "diving-en" },
];

test.describe("visual capture", () => {
  for (const p of pages) {
    test(`capture ${p.name}`, async ({ page }, testInfo) => {
      const dir = "tests-e2e/screenshots";
      fs.mkdirSync(dir, { recursive: true });
      // Not `networkidle`: below-the-fold images are lazy, so the network only
      // settles once something scrolls past them — which happens below, and
      // waiting for quiet before that is a race these pages sometimes lose.
      await page.goto(p.path, { waitUntil: "load" });
      // Wait for hydration (JS tags <html class="js">) so reveal observers are
      // attached before we scroll — otherwise sections below the fold never fire.
      await page.waitForFunction(() => document.documentElement.classList.contains("js"));
      await page.waitForTimeout(600);
      // Force every reveal to its final visible state — the end state a real
      // user sees after scrolling. Deterministic regardless of page height.
      await page.evaluate(() => {
        document
          .querySelectorAll(".reveal")
          .forEach((el) => el.setAttribute("data-visible", "true"));
      });
      // Walk the page so every lazy image enters the viewport and starts
      // loading, then come back up. `fullPage` captures past the viewport, so
      // without this the lower half photographs empty.
      await page.evaluate(async () => {
        const step = window.innerHeight;
        for (let y = 0; y < document.body.scrollHeight; y += step) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 60));
        }
        window.scrollTo(0, 0);
      });
      // Now that they have all been requested, wait for them to decode.
      await page
        .waitForFunction(() => Array.from(document.images).every((img) => img.complete), null, {
          timeout: 15_000,
        })
        .catch(() => {
          // A capture with one slow image is still worth having; a hard failure
          // here would say nothing about the page under test.
        });
      // let reveal transitions settle
      await page.waitForTimeout(700);
      await page.screenshot({
        path: `${dir}/${p.name}-${testInfo.project.name}.png`,
        fullPage: true,
      });
    });
  }
});
