/**
 * EPIC-008 regression tests — verifies that dana, rekening, liabilitas, and
 * asuransi pages load without "Gagal memuat" after removing the legacy
 * JwtAuthGuard that was blocking Better Auth session tokens.
 */

import { test, expect, type Page } from "@playwright/test";

const DEMO_EMAIL = "demo@wealthme.id";
const DEMO_PASSWORD = "demo1234";

async function login(page: Page) {
  await page.goto("/login");
  await page.waitForSelector('input[type="email"]', { timeout: 15_000 });
  await page.fill('input[type="email"]', DEMO_EMAIL);
  await page.fill('input[type="password"]', DEMO_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(beranda|ringkasan|dana|akun)/, { timeout: 25_000 });
}

async function assertNoGagalMemuat(page: Page, url: string) {
  await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
  await page.waitForTimeout(2000);
  const bodyText = await page.evaluate(() => document.body.innerText);
  expect(bodyText).not.toContain("Gagal memuat");
  expect(bodyText).not.toContain("internal server error");
  expect(bodyText).not.toContain("application error");
}

test.describe("EPIC-008 Regression — JwtAuthGuard removal", () => {
  test("dana page loads without Gagal memuat", async ({ page }) => {
    await login(page);
    await assertNoGagalMemuat(page, "/dana");
  });

  test("rekening page loads without Gagal memuat", async ({ page }) => {
    await login(page);
    await assertNoGagalMemuat(page, "/rekening");
  });

  test("liabilitas page loads without Gagal memuat", async ({ page }) => {
    await login(page);
    await assertNoGagalMemuat(page, "/liabilitas");
  });

  test("asuransi page loads without Gagal memuat", async ({ page }) => {
    await login(page);
    await assertNoGagalMemuat(page, "/asuransi");
  });
});
