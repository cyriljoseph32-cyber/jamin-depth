import { test, expect } from "@playwright/test";

const WA = "wa.me/66633753316";

/** Conversion surfaces, FAQ integrity and the beginner landing page. */

test("every priced offer has its own WhatsApp CTA", async ({ page }) => {
  await page.goto("/fr/plongee");

  const offerCtas = page.locator('a[data-analytics-event="whatsapp_click_offer"]');
  // 4 courses + 4 trips. Specialty has no published price, but "on request" is
  // precisely the case where a visitor needs to ask — so it gets a CTA too.
  await expect(offerCtas).toHaveCount(8);

  // The pre-fill names the specific offer and is written in French.
  const sailRock = offerCtas.filter({ hasText: /sortie/i }).first();
  const href = await sailRock.getAttribute("href");
  expect(href).toContain(WA);
  expect(decodeURIComponent(href ?? "")).toMatch(/Bonjour/);
});

test("FAQ marks unconfirmed answers and keeps them out of structured data", async ({ page }) => {
  await page.goto("/fr");

  const faq = page.locator("#faq");
  await expect(faq.getByRole("heading", { name: /Questions de débutants/i })).toBeVisible();

  // Answers awaiting the owner carry a visible badge once the item is expanded.
  await faq.getByRole("group").filter({ hasText: /savoir nager/i }).first().locator("summary").click();
  await expect(faq.getByText(/À confirmer par le propriétaire/i).first()).toBeVisible();

  // Structured data must only contain confirmed answers.
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  const faqLd = blocks.map((b) => JSON.parse(b)).find((j) => j["@type"] === "FAQPage");
  expect(faqLd, "FAQPage JSON-LD should be present").toBeTruthy();

  const questions = faqLd.mainEntity.map((q: { name: string }) => q.name);
  expect(questions).toContain("Puis-je plonger si je n'ai jamais plongé ?");
  // Unconfirmed ones are excluded.
  expect(questions).not.toContain("Faut-il savoir nager ?");
  const answers = JSON.stringify(faqLd);
  expect(answers).not.toMatch(/À confirmer/i);
});

test("beginner landing page resolves in both locales with real course data", async ({ page }) => {
  const res = await page.goto("/fr/bapteme-plongee-koh-samui");
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/baptême de plongée à Koh Samui/i);
  // Price and duration come from the verified course entry.
  await expect(page.getByText("฿5,850").first()).toBeVisible();

  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute(
    "href",
    /discover-scuba-diving-koh-samui$/,
  );

  expect((await page.goto("/en/discover-scuba-diving-koh-samui"))?.status()).toBe(200);
});

test("course catalogue is exposed as structured data with verified prices", async ({ page }) => {
  await page.goto("/en/diving");
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  const list = blocks.map((b) => JSON.parse(b)).find((j) => j["@type"] === "ItemList");
  expect(list, "course ItemList JSON-LD should be present").toBeTruthy();

  const ow = list.itemListElement.find(
    (e: { item: { name: string } }) => e.item.name === "Open Water",
  );
  expect(ow.item.offers.price).toBe(17900);
  expect(ow.item.offers.priceCurrency).toBe("THB");
  expect(ow.item.provider.name).toMatch(/Discovery Divers/);

  // The unpriced Specialty course must not carry a fabricated offer.
  const spec = list.itemListElement.find((e: { item: { name: string } }) =>
    /Special|Spécial/.test(e.item.name),
  );
  expect(spec.item.offers).toBeUndefined();
});

test("analytics events fire without a provider present", async ({ page }) => {
  await page.goto("/fr");
  // Stand in for a provider so we can observe what would be reported.
  await page.evaluate(() => {
    (window as unknown as { dataLayer: unknown[] }).dataLayer = [];
    window.open = () => null;
  });

  await page.locator('a[data-analytics-event="whatsapp_click_floating"]').click();
  const events = await page.evaluate(
    () => (window as unknown as { dataLayer: { event: string }[] }).dataLayer.map((e) => e.event),
  );
  expect(events).toContain("whatsapp_click_floating");
});
