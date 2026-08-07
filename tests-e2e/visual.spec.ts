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
      await page.goto(p.path, { waitUntil: "networkidle" });
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
        window.scrollTo(0, 0);
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
