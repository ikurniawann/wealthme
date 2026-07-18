/**
 * EPIC-015 regression — verifies apiFetch treats a 204 No Content DELETE
 * response as a successful mutation, so list queries refresh without a
 * manual page reload (investasi and rekening delete flows).
 */

import { test, expect } from "@playwright/test";

test("investasi and rekening deletes refresh without a reload", async ({
  page,
}) => {
  const stamp = Date.now();
  const email = `qa-204fix-${stamp}@example.com`;

  await page.goto("/register");
  await page.locator("#name").fill("QA 204 Fix");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill("Password123!");
  await page.locator("#confirmPassword").fill("Password123!");
  await page.locator('button[type="submit"]').click();
  await page.waitForURL("**/beranda", { timeout: 15000 });
  await page
    .getByText("Lewati")
    .click()
    .catch(() => {});

  await page.goto("/investasi");
  await page.waitForTimeout(1000);
  await page.locator('[data-tour="add-investasi"]').click();
  await page.getByRole("dialog").waitFor({ state: "visible", timeout: 5000 });
  await page.locator("#ticker").fill("TLKM");
  await page.locator("#name").fill("Telkom Indonesia");
  await page.locator("#quantity").fill("5");
  await page.locator("#costBasisPerUnit").fill("3000");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /simpan/i })
    .click();
  await expect(page.getByText("Telkom Indonesia")).toBeVisible({
    timeout: 5000,
  });

  await page.getByRole("button", { name: "Hapus" }).first().click();
  await page.getByRole("button", { name: /ya, hapus/i }).click();
  await expect(page.getByText("Telkom Indonesia")).toHaveCount(0, {
    timeout: 5000,
  });

  await page.goto("/rekening");
  await page.waitForTimeout(1000);
  await page.locator('[data-tour="add-rekening"]').click();
  const dialog = page.getByRole("dialog");
  await dialog.locator("input").first().fill("Rekening 204 Test");
  await dialog.getByRole("button", { name: /simpan/i }).click();
  await expect(page.getByText("Rekening 204 Test")).toBeVisible({
    timeout: 5000,
  });

  const accountCard = page
    .getByText("Rekening 204 Test")
    .locator("xpath=ancestor::div[contains(@class,'gap-0')][1]");
  await accountCard.getByLabel("Opsi rekening").click();
  await page.getByRole("menuitem", { name: /hapus/i }).click();
  await page.getByRole("button", { name: /ya, hapus/i }).click();
  await expect(page.getByText("Rekening 204 Test")).toHaveCount(0, {
    timeout: 5000,
  });
});
