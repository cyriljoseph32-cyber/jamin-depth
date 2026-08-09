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

/** The FAQPage block on a page, or undefined when the page declares none. */
async function faqPageLd(page: import("@playwright/test").Page) {
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  return blocks.map((b) => JSON.parse(b)).find((j) => j["@type"] === "FAQPage");
}

test("the home page shows the FAQ without claiming it in structured data", async ({ page }) => {
  await page.goto("/fr");

  const faq = page.locator("#faq");
  await expect(faq.getByRole("heading", { name: /Questions de débutants/i })).toBeVisible();
  await faq.getByRole("group").filter({ hasText: /savoir nager/i }).first().locator("summary").click();
  await expect(faq.getByText(/dépendent de la formation/i).first()).toBeVisible();

  // The diving and beginner pages own these answers. Declaring them here too
  // would leave the same FAQPage asserted on three URLs.
  expect(await faqPageLd(page), "home should declare no FAQPage").toBeUndefined();
});

test("each FAQ page declares its own URL and only settled answers", async ({ page }) => {
  for (const [path, heading] of [
    ["/fr/plongee", /Questions de débutants/i],
    ["/fr/recuperation-sous-marine", /Questions sur la récupération/i],
  ] as const) {
    await page.goto(path);
    await expect(page.locator("#faq").getByRole("heading", { name: heading })).toBeVisible();

    const faqLd = await faqPageLd(page);
    expect(faqLd, `${path} should declare a FAQPage`).toBeTruthy();
    // The fix this exists for: the entity has to say which page it describes.
    expect(faqLd.mainEntityOfPage).toContain(path);

    // Placeholder text must never reach a search result, whatever the page.
    expect(JSON.stringify(faqLd)).not.toMatch(/À confirmer/i);

    // Every declared question is also visible on the page — a FAQPage whose
    // content is hidden is invalid markup, not just poor practice.
    for (const { name } of faqLd.mainEntity) {
      await expect(page.locator("#faq").getByText(name, { exact: true }).first()).toBeVisible();
    }
  }
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

test("the French form answers in French, not English", async ({ page }) => {
  await page.goto("/fr/recuperation-sous-marine");
  // Clear the anti-spam time window (min 1.2s on-form).
  await page.waitForTimeout(1400);

  await page.getByRole("button", { name: /ouvrir whatsapp avec ma demande/i }).click();

  const form = page.locator("form");
  await expect(form.getByRole("alert").first()).toBeVisible();
  // Target the error elements by id: "Qu'avez-vous perdu ?" is also the field's
  // own label, so matching on text alone is ambiguous.
  await expect(form.locator("#name-error")).toHaveText("Indiquez-nous votre nom.");
  await expect(form.locator("#object-error")).toHaveText("Qu'avez-vous perdu ?");

  // The English wording these replaced must not survive anywhere on the page.
  await expect(page.getByText(/Please tell us your name|What did you lose\?/i)).toHaveCount(0);
});
