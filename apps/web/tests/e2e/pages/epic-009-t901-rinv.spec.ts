/**
 * EPIC-009 T-901 regression — verifies the Laporan "Investasi" tab
 * (/laporan?tab=rinv) renders its portfolio content without a 404 / error /
 * empty state.
 *
 * Root cause of the original audit "404": the tab was already wired correctly
 * in laporan/page.tsx; the failure was the legacy JwtAuthGuard blocking Better
 * Auth tokens on the investments API (same class of bug fixed in EPIC-008).
 * This test guards against regression of the end-to-end rinv path.
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

test.describe("EPIC-009 T-901 — Laporan Investasi tab", () => {
  test("rinv tab renders portfolio content (no 404 / error)", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/laporan?tab=rinv", {
      waitUntil: "networkidle",
      timeout: 30_000,
    });
    await page.waitForTimeout(2000);

    const bodyText = await page.evaluate(() => document.body.innerText);

    // Not a 404 / error / placeholder
    expect(bodyText).not.toContain("Gagal memuat");
    expect(bodyText).not.toContain("internal server error");
    expect(bodyText).not.toContain("application error");
    expect(bodyText.toLowerCase()).not.toContain("404 not found");

    // Investment-specific content is rendered (the tab actually mounted)
    expect(bodyText).toContain("Portofolio Investasi");
    expect(bodyText).toContain("Total Portofolio");
  });
});
