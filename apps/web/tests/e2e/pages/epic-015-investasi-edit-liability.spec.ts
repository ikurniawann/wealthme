/**
 * EPIC-015 regression — investasi edit/delete round-trips correctly (no
 * stale row after delete, even without reload), and liabilitas accepts a
 * comma-formatted interest rate (e.g. "2,5") instead of rejecting it.
 */

import { test, expect } from "@playwright/test";

test("investasi edit/delete works, liabilitas comma interest rate works", async ({
  page,
}) => {
  const stamp = Date.now();
  const email = `qa-verify2-${stamp}@example.com`;

  await page.goto("/register");
  await page.locator("#name").fill("QA Verify Two");
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
  await page.locator("#ticker").fill("BBRI");
  await page.locator("#name").fill("Bank Rakyat Indonesia");
  await page.locator("#quantity").fill("10");
  await page.locator("#costBasisPerUnit").fill("4500");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /simpan/i })
    .click();
  await expect(page.getByText("Bank Rakyat Indonesia")).toBeVisible({
    timeout: 5000,
  });

  await page.getByRole("button", { name: "Edit" }).first().click();
  await page.getByRole("dialog").waitFor({ state: "visible", timeout: 5000 });
  await expect(
    page.getByRole("dialog").getByText("Edit Investasi"),
  ).toBeVisible();
  await page.locator("#name").fill("BRI Edited");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /simpan/i })
    .click();
  await expect(page.getByText("BRI Edited")).toBeVisible({ timeout: 5000 });

  await page.getByRole("button", { name: "Hapus" }).first().click();
  await page.getByRole("button", { name: /ya, hapus/i }).click();
  await expect(page.getByText("BRI Edited")).toHaveCount(0, { timeout: 5000 });
  await page.reload();
  await expect(page.getByText("BRI Edited")).toHaveCount(0);

  await page.goto("/liabilitas");
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: /tambah liabilitas/i }).click();
  await page.waitForTimeout(500);
  await page.locator("#liability-name").fill("Kartu Kredit QA Verify");
  await page.locator("#liability-total-debt").fill("30000000");
  await page.locator("#liability-remaining").fill("8000000");
  await page.locator("#liability-interest-rate").fill("2,5");
  await page
    .getByRole("button", { name: /simpan|tambah/i })
    .last()
    .click();
  await expect(page.getByText("Kartu Kredit QA Verify")).toBeVisible({
    timeout: 5000,
  });
});
