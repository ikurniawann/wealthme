/**
 * EPIC-015 regression — a freshly registered user's family group must
 * resolve from /auth/me instead of a stale null session, add-actions must
 * not be permanently disabled, and calculators/reconciliation must not
 * present seeded-looking demo data as the new user's own data.
 */

import { test, expect } from "@playwright/test";

test("new-user journey: session resolves, adds work, no demo data leaks", async ({
  page,
}) => {
  const stamp = Date.now();
  const email = `qa-bugfix-${stamp}@example.com`;

  await page.goto("/register");
  await page.locator("#name").fill("QA Bugfix");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill("Password123!");
  await page.locator("#confirmPassword").fill("Password123!");
  await page.locator('button[type="submit"]').click();
  await page.waitForURL("**/beranda", { timeout: 15000 });
  await page.getByText("Lewati").click();

  await page.goto("/rekening");
  // EPIC-023 Task H fix round (MEDIUM 15) — `data-tour` markers were dead
  // attributes left over from the removed button-spotlight tour; select by
  // the button's own accessible name instead.
  const addRekening = page.getByRole("button", {
    name: "Tambah",
    exact: true,
  });
  await expect(addRekening).toBeEnabled({ timeout: 10000 });
  await addRekening.click();
  const dialog = page.getByRole("dialog");
  await dialog.locator("input").first().waitFor({ state: "visible" });
  await dialog.locator("input").first().fill("Rekening QA Test");
  await dialog.getByRole("button", { name: /simpan/i }).click();
  await expect(page.getByText("Rekening QA Test")).toBeVisible({
    timeout: 10000,
  });

  await page.goto("/investasi");
  await page.waitForTimeout(1500);
  const addInvestasi = page.getByRole("button", {
    name: "+ Tambah Investasi",
    exact: true,
  });
  await addInvestasi.click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });
  await page.keyboard.press("Escape");

  for (const [path, label] of [
    ["/aset", /tambah/i],
    ["/liabilitas", /tambah/i],
    ["/asuransi", /tambah/i],
    ["/splitbill", /buat|tambah/i],
  ] as const) {
    await page.goto(path);
    await page.waitForTimeout(1000);
    await expect(page.getByRole("button", { name: label }).first()).toBeEnabled(
      {
        timeout: 10000,
      },
    );
  }

  await page.goto("/mastercoa");
  await page.waitForTimeout(1000);
  await expect(page.getByRole("button", { name: /tambah akun/i })).toBeEnabled({
    timeout: 10000,
  });

  await page.goto("/donation");
  await expect(page.getByText(/23\.787\.000|Rp 23/)).toHaveCount(0);

  await page.goto("/tax");
  await expect(page.getByText(/300\.000\.000/)).toHaveCount(0);

  await page.goto("/rekonsiliasi");
  await expect(page.getByText("BCA Rekening Koran Mei 2025.pdf")).toHaveCount(
    0,
  );
  await expect(page.getByText("Mandiri Rekon April 2025.xlsx")).toHaveCount(0);
});
