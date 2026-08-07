import { test, expect } from "@playwright/test";

/** Locale routing, translation and bilingual SEO. */

test("root redirects to a locale and honours Accept-Language", async ({ browser }) => {
  const fr = await browser.newContext({ locale: "fr-FR" });
  const frPage = await fr.newPage();
  await frPage.goto("/");
  await expect(frPage).toHaveURL(/\/fr$/);
  await fr.close();

  const en = await browser.newContext({ locale: "en-GB" });
  const enPage = await en.newPage();
  await enPage.goto("/");
  await expect(enPage).toHaveURL(/\/en$/);
  await en.close();
});

test("French home is translated and targets the local keyword", async ({ page }) => {
  await page.goto("/fr");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  // The H1 must carry "plongée à Koh Samui" for local SEO.
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/plongée à Koh Samui/i);
  await expect(page.getByText("Vous l'avez perdu. On plonge le chercher.").first()).toBeVisible();
});

test("localised slugs resolve per language and cross-language slugs 404", async ({ page }) => {
  for (const path of [
    "/fr/plongee",
    "/fr/recuperation-sous-marine",
    "/fr/le-plongeur",
    "/fr/confidentialite",
    "/en/diving",
    "/en/recovery",
  ]) {
    const res = await page.goto(path);
    expect(res?.status(), `status for ${path}`).toBeLessThan(400);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }

  // A French slug must not resolve under /en (and vice versa) — that would
  // create duplicate content across locales.
  expect((await page.goto("/en/plongee"))?.status()).toBe(404);
  expect((await page.goto("/fr/diving"))?.status()).toBe(404);
});

test("every page declares canonical + hreflang for both locales", async ({ page }) => {
  await page.goto("/fr/plongee");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/fr\/plongee$/);
  await expect(page.locator('link[rel="alternate"][hreflang="fr"]')).toHaveAttribute(
    "href",
    /\/fr\/plongee$/,
  );
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute(
    "href",
    /\/en\/diving$/,
  );
});

test("language switcher keeps the visitor on the same page", async ({ page }) => {
  await page.goto("/fr/plongee");
  await page.getByRole("link", { name: "English" }).first().click();
  await expect(page).toHaveURL(/\/en\/diving$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("WhatsApp pre-fill is written in the visitor's language", async ({ page }) => {
  await page.goto("/fr");
  const fab = page.getByRole("link", { name: /demander une récupération sur whatsapp/i });
  await expect(fab).toHaveAttribute("href", /Bonjour/);

  await page.goto("/en");
  const enFab = page.getByRole("link", { name: /request a recovery on whatsapp/i });
  await expect(enFab).toHaveAttribute("href", /Hello/);
});

test("sitemap lists both locales with alternates", async ({ request }) => {
  const res = await request.get("/sitemap.xml");
  expect(res.status()).toBe(200);
  const xml = await res.text();
  for (const path of ["/fr", "/en", "/fr/plongee", "/en/diving"]) {
    expect(xml, `sitemap should list ${path}`).toContain(`${path}<`);
  }
  expect(xml).toContain('hreflang="fr"');
  expect(xml).toContain('hreflang="en"');
});
