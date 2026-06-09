import { test, expect } from "@playwright/test";

const PROTECTED_ROUTES = [
  "/beranda",
  "/akun",
  "/anggaran",
  "/transaksi",
  "/rekening",
] as const;

test.describe("Route protection — unauthenticated user", () => {
  for (const route of PROTECTED_ROUTES) {
    test(`${route} redirects to /login`, async ({ page }) => {
      await page.goto(route);
      await page.waitForURL("**/login");
      expect(page.url()).toContain("/login");
    });
  }

  test("/login does not redirect when unauthenticated", async ({ page }) => {
    await page.goto("/login");
    // Allow networkidle to settle so any redirect would have fired
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/login");
    // Must not have been bounced to a third location
    expect(page.url()).not.toMatch(
      /\/(beranda|akun|anggaran|transaksi|rekening)/,
    );
  });
});
