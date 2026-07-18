/**
 * EPIC-016 Task A regression — verifies that editing profile fields
 * (phone, birthDate, gender, jobTitle, monthlyIncome) and clicking
 * "Simpan Perubahan" actually persists those values to the backend.
 *
 * Currently FAILS because the profile page only saves the name field
 * and shows a success toast even though other fields are silently dropped.
 */

import { test, expect } from "@playwright/test";

test("FAILS: profile page persists all fields (phone, birthDate, gender, jobTitle, monthlyIncome) on save", async ({
  page,
}) => {
  // Arrange — register a new user
  const stamp = Date.now();
  const email = `epic-016-profile-${stamp}@example.com`;
  const updatedName = `Profile Tester ${stamp}`;
  const updatedPhone = "+62 812 5555 6666";
  const updatedBirthDate = "1992-06-20";
  const updatedGender = "Perempuan";
  const updatedJobTitle = "Principal Engineer";
  const updatedMonthlyIncome = "Rp 50.000.000";

  // Register
  await page.goto("/register");
  await page.locator("#name").fill("Initial User");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill("Password123!");
  await page.locator("#confirmPassword").fill("Password123!");
  await page.locator('button[type="submit"]').click();
  await page.waitForURL("**/beranda", { timeout: 15000 });

  // Skip onboarding if present
  await page
    .getByText("Lewati")
    .click()
    .catch(() => {});

  // Act — navigate to profile page (/akun)
  await page.goto("/akun");
  await page.waitForTimeout(1000);

  // Locate and verify the Profil tab exists
  const profilTab = page.getByText("Profil Saya");
  await expect(profilTab).toBeVisible({ timeout: 5000 });
  await profilTab.click();

  // Fill in all profile fields
  // Note: `.fill()` already clears the field before typing, so a preceding
  // `.clear()` on this same value-matched locator is not just redundant —
  // it actively breaks re-querying, since the locator match criteria
  // (`[value="Initial User"]`) stops matching the instant `.clear()` empties
  // the field, leaving `.fill()` unable to find the element again.
  const nameInput = page.locator('input[value="Initial User"]').first();
  await nameInput.fill(updatedName);

  // `hasText` matches an element's rendered text content, not an <input>'s
  // `value` attribute, so it never matched these inputs — use the actual
  // placeholders from page.tsx instead. No isVisible/count guards: a real
  // failure here must surface as a real test failure, not get silently
  // skipped.
  const phoneInput = page.getByPlaceholder("+62 8xx xxxx xxxx");
  await phoneInput.clear();
  await phoneInput.fill(updatedPhone);

  // Find birthDate input (date type)
  const birthDateInput = page.locator("input[type='date']").first();
  await birthDateInput.fill(updatedBirthDate);

  // Find gender select
  const genderSelect = page.locator("select").first();
  await genderSelect.selectOption(updatedGender);

  // Find job title input
  const jobTitleInput = page.getByPlaceholder("cth: Software Engineer");
  await jobTitleInput.clear();
  await jobTitleInput.fill(updatedJobTitle);

  // Find monthly income input
  const incomeInput = page.getByPlaceholder("cth: Rp 25.000.000");
  await incomeInput.clear();
  await incomeInput.fill(updatedMonthlyIncome);

  // Click Simpan Perubahan button
  const saveButton = page.getByRole("button", { name: /simpan perubahan/i });
  await expect(saveButton).toBeVisible({ timeout: 5000 });
  await saveButton.click();

  // Wait for success toast
  await expect(page.getByText(/profil berhasil disimpan/i)).toBeVisible({
    timeout: 5000,
  });

  // Assert — reload page and verify ALL fields persisted
  // CURRENTLY FAILS: only name is persisted; other fields revert to defaults
  await page.reload();
  await page.waitForTimeout(1000);

  // The Profil Saya sub-page is a client-side Sheet, not a route — a full
  // page reload resets that open/closed state, so it must be re-opened
  // before any of its fields are visible again.
  const profilTabAfterReload = page.getByText("Profil Saya");
  await expect(profilTabAfterReload).toBeVisible({ timeout: 5000 });
  await profilTabAfterReload.click();

  // Verify name persisted
  await expect(page.locator(`input[value="${updatedName}"]`)).toBeVisible({
    timeout: 5000,
  });

  // Verify phone persisted
  const phoneValue = await page
    .getByPlaceholder("+62 8xx xxxx xxxx")
    .inputValue();
  expect(phoneValue).toBe(updatedPhone);

  // Verify birthDate persisted
  const birthDateAfterReload = page.locator("input[type='date']").first();
  const birthDateValue = await birthDateAfterReload.inputValue();
  expect(birthDateValue).toBe(updatedBirthDate);

  // Verify gender persisted
  const genderAfterReload = page.locator("select").first();
  const genderValue = await genderAfterReload.inputValue();
  expect(genderValue).toBe(updatedGender);

  // Verify jobTitle persisted
  const jobValue = await page
    .getByPlaceholder("cth: Software Engineer")
    .inputValue();
  expect(jobValue).toBe(updatedJobTitle);

  // Verify monthlyIncome persisted
  const incomeValue = await page
    .getByPlaceholder("cth: Rp 25.000.000")
    .inputValue();
  expect(incomeValue).toBe(updatedMonthlyIncome);
});
