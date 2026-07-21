import { test, expect } from "@playwright/test";

const WA = "wa.me/66633753316";

test("home renders hero, slogan and WhatsApp FAB", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Lost something underwater");
  await expect(page.getByText("You drop it. We dive for it.").first()).toBeVisible();

  const fab = page.getByRole("link", { name: /request a recovery on whatsapp/i });
  await expect(fab).toBeVisible();
  await expect(fab).toHaveAttribute("href", new RegExp(WA));
});

test("primary nav reaches every page", async ({ page }) => {
  for (const path of ["/recovery", "/diving", "/about", "/contact", "/privacy"]) {
    const res = await page.goto(path);
    expect(res?.status(), `status for ${path}`).toBeLessThan(400);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
});

test("recovery form validates and builds a WhatsApp link", async ({ page }) => {
  await page.goto("/recovery");
  // Prevent the real WhatsApp tab from opening during the test
  await page.evaluate(() => {
    window.open = () => null;
  });
  // Clear the lightweight anti-spam time window (min 1.2s on-form)
  await page.waitForTimeout(1400);

  const form = page.locator("form");
  // Submit empty → validation error surfaces
  await page.getByRole("button", { name: /open whatsapp with my request/i }).click();
  await expect(form.getByRole("alert")).toBeVisible();

  // Fill required fields
  await page.fill("#name", "Alex");
  await page.fill("#contact", "+66 63 375 3316");
  await page.fill("#object", "Gold ring");
  await page.fill("#location", "Chaweng pier, north side");
  await page.fill("#lostAt", "Today around 14:00");

  await page.getByRole("button", { name: /open whatsapp with my request/i }).click();

  const success = page.getByRole("status");
  await expect(success).toBeVisible();
  const openLink = success.getByRole("link", { name: /open whatsapp/i });
  await expect(openLink).toHaveAttribute("href", new RegExp(WA));
});

test("contact page exposes tel and wa links", async ({ page }) => {
  await page.goto("/contact");
  await expect(page.locator('main a[href^="tel:+66633753316"]').first()).toBeVisible();
  await expect(page.locator(`main a[href*="${WA}"]`).first()).toBeVisible();
});

test("assistant widget opens and degrades gracefully without a key", async ({ page }) => {
  await page.goto("/");
  const launcher = page.getByRole("button", { name: /open the assistant/i });
  await expect(launcher).toBeVisible();
  await launcher.click();

  const dialog = page.getByRole("dialog", { name: /assistant/i });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/Jammin's Depths assistant/i)).toBeVisible();

  // Sending with no ANTHROPIC_API_KEY configured returns a friendly 503 message.
  await page.fill("#jd-chat-input", "I lost my ring off a boat");
  await page.getByRole("button", { name: /send message/i }).click();
  await expect(dialog.getByText(/assistant isn't configured|WhatsApp/i).last()).toBeVisible();
});

test("404 page is branded", async ({ page }) => {
  const res = await page.goto("/this-does-not-exist");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("came up empty");
});
