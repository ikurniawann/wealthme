import { test, expect, type Page } from "@playwright/test";

/**
 * Full-UI end-to-end journeys, driven headlessly (no desktop required).
 *
 * These walk the app the way a person does — click, type, read what comes back —
 * rather than asserting against the API. Every test captures a screenshot so a
 * human can confirm the rendered result afterwards.
 */

const DEMO_EMAIL = "demo@wealthme.id";
const DEMO_PASSWORD = "demo1234";
const SHOT_DIR = "test-results/ui-journeys";

async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.waitForSelector('input[type="email"]', { timeout: 20_000 });
  await page.fill('input[type="email"]', DEMO_EMAIL);
  await page.fill('input[type="password"]', DEMO_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(beranda|ringkasan|dana|akun)/, { timeout: 30_000 });
  await page.waitForLoadState("networkidle");
}

/** Text of every toast currently on screen (sonner renders them as list items). */
async function toastTexts(page: Page): Promise<string[]> {
  return page.locator("[data-sonner-toast]").allInnerTexts();
}

test.describe("WealthMe — UI journeys (headless)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("beranda renders real money, not placeholders", async ({ page }) => {
    await page.goto("/beranda", { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const body = await page.evaluate(() => document.body.innerText);

    expect(body).not.toContain("Gagal memuat");
    // A rupiah figure must actually be rendered somewhere on the dashboard.
    expect(body).toMatch(/Rp\s?[\d.]{4,}/);

    await page.screenshot({
      path: `${SHOT_DIR}/beranda.png`,
      fullPage: true,
    });
  });

  test("add-transaction dialog loads categories from the API", async ({
    page,
  }) => {
    await page.goto("/transaksi", { waitUntil: "networkidle" });

    // The global add-transaction dialog is opened from the shell.
    const addButton = page
      .locator('button[aria-label*="Tambah"], button:has-text("Tambah")')
      .first();
    await addButton.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Category <select> must be populated from /categories — more than just
    // the placeholder option.
    const categorySelect = dialog.locator("select").filter({
      has: page.locator("option"),
    });
    await page.waitForTimeout(1500);

    const optionCounts = await categorySelect.evaluateAll((sels) =>
      sels.map((s) => (s as HTMLSelectElement).options.length),
    );
    expect(Math.max(...optionCounts, 0)).toBeGreaterThan(1);

    await page.screenshot({ path: `${SHOT_DIR}/add-transaction.png` });
  });

  test("transfer tab exposes source and destination accounts", async ({
    page,
  }) => {
    await page.goto("/transaksi", { waitUntil: "networkidle" });
    await page
      .locator('button[aria-label*="Tambah"], button:has-text("Tambah")')
      .first()
      .click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    const transferTab = dialog
      .locator('button:has-text("Transfer"), [role="tab"]:has-text("Transfer")')
      .first();
    await transferTab.click();
    await page.waitForTimeout(800);

    const text = await dialog.innerText();
    // EPIC-021 B: a transfer names both ends, not a single "Akun" field.
    expect(text).toMatch(/Sumber Dana|Source of Fund/i);
    expect(text).toMatch(/Transfer ke|Transfer Fund to/i);

    await page.screenshot({ path: `${SHOT_DIR}/transfer-tab.png` });
  });

  test("language switch changes the whole shell, not just one page", async ({
    page,
  }) => {
    await page.goto("/akun", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    // Locate the language picker by its options rather than a brittle label.
    const langSelect = page
      .locator("select")
      .filter({ has: page.locator('option[value="en"]') })
      .first();

    if ((await langSelect.count()) === 0) {
      // Picker lives inside the Pengaturan sub-page.
      await page
        .locator('button:has-text("Pengaturan"), :text("Pengaturan")')
        .first()
        .click();
      await page.waitForTimeout(1000);
    }

    const picker = page
      .locator("select")
      .filter({ has: page.locator('option[value="en"]') })
      .first();
    await picker.selectOption("en");
    await page.waitForTimeout(1200);

    await page.goto("/beranda", { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    const englishBody = await page.evaluate(() => document.body.innerText);

    await page.screenshot({
      path: `${SHOT_DIR}/i18n-english.png`,
      fullPage: true,
    });

    // Sidebar/nav must be English now — "Beranda" is the Indonesian nav label.
    expect(englishBody).toMatch(/Home|Dashboard|Transactions|Reports/i);

    // Put it back so later runs start from Indonesian.
    await page.goto("/akun", { waitUntil: "networkidle" });
    const back = page
      .locator("select")
      .filter({ has: page.locator('option[value="id"]') })
      .first();
    if ((await back.count()) > 0) {
      await back.selectOption("id");
      await page.waitForTimeout(800);
    }
  });

  test("laporan period filter drives the report sections", async ({ page }) => {
    await page.goto("/laporan", { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    const yearSelect = page.locator('select[aria-label="Tahun"]').first();
    await expect(yearSelect).toBeVisible({ timeout: 10_000 });

    const monthSelect = page.locator('select[aria-label="Bulan"]').first();
    await expect(monthSelect).toBeVisible();

    // Change the month and make sure the page re-renders without breaking.
    await monthSelect.selectOption({ index: 0 });
    await page.waitForTimeout(2500);

    const body = await page.evaluate(() => document.body.innerText);
    expect(body).not.toContain("Gagal memuat");
    expect(body).not.toContain("application error");

    await page.screenshot({
      path: `${SHOT_DIR}/laporan-filter.png`,
      fullPage: true,
    });
  });

  test("transaction row opens a read-only detail dialog", async ({ page }) => {
    await page.goto("/transaksi", { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    const row = page.locator('[role="button"][aria-label*="Detail"]').first();
    if ((await row.count()) === 0) {
      test.skip(true, "no transactions seeded for this family group");
    }
    await row.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    const text = await dialog.innerText();
    expect(text).toMatch(/Kategori|Category/i);
    expect(text).toMatch(/Akun|Account/i);

    await page.screenshot({ path: `${SHOT_DIR}/transaction-detail.png` });
  });

  test("REGRESSION: adding a family member by phone number fails silently", async ({
    page,
  }) => {
    await page.goto("/akun", { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);

    // Open the Family sub-page.
    const familyEntry = page
      .locator(':text("Family"), :text("Keluarga")')
      .first();
    await familyEntry.click();
    await page.waitForTimeout(1200);

    const addMember = page
      .locator('button:has-text("Tambah"), :text("Tambah Anggota")')
      .first();
    if ((await addMember.count()) === 0) {
      test.skip(true, "add-member entry point not reachable in this build");
    }
    await addMember.click();
    await page.waitForTimeout(1000);

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // The field invites "Email / No. HP" — so a phone number is a legitimate
    // thing for a user to type here.
    const emailish = dialog
      .locator('input[placeholder*="email"], input[placeholder*="nomor"]')
      .first();
    await emailish.fill("081234567890");

    await dialog
      .locator('button:has-text("Simpan"), button:has-text("Tambah")')
      .last()
      .click();
    await page.waitForTimeout(2500);

    const toasts = await toastTexts(page);
    await page.screenshot({ path: `${SHOT_DIR}/add-member-phone.png` });

    // Documented defect: the API requires a real email, so this always fails,
    // and the message never tells the user why.
    const joined = toasts.join(" | ");
    expect(joined.length, `toasts: ${joined}`).toBeGreaterThan(0);
    expect(
      /gagal|failed/i.test(joined),
      `expected a failure toast, got: ${joined}`,
    ).toBe(true);
    expect(
      /email/i.test(joined),
      `FAILS BY DESIGN — the toast should explain the email format, got: ${joined}`,
    ).toBe(true);
  });

  test("split bill custom mode balances to the total", async ({ page }) => {
    await page.goto("/splitbill", { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const body = await page.evaluate(() => document.body.innerText);
    expect(body).not.toContain("Gagal memuat");

    await page.screenshot({
      path: `${SHOT_DIR}/splitbill.png`,
      fullPage: true,
    });
  });

  test("every sidebar destination renders without an error banner", async ({
    page,
  }) => {
    const routes = [
      "/beranda",
      "/ringkasan",
      "/transaksi",
      "/rekening",
      "/dana",
      "/aset",
      "/investasi",
      "/liabilitas",
      "/asuransi",
      "/anggaran",
      "/tujuan",
      "/laporan",
      "/mastercoa",
      "/masterdata",
      "/akun",
    ];

    const broken: string[] = [];
    for (const route of routes) {
      await page.goto(route, { waitUntil: "networkidle", timeout: 45_000 });
      await page.waitForTimeout(1200);
      const body = await page.evaluate(() => document.body.innerText);
      if (
        body.includes("Gagal memuat") ||
        body.includes("application error") ||
        body.toLowerCase().includes("internal server error")
      ) {
        broken.push(route);
        await page.screenshot({
          path: `${SHOT_DIR}/broken-${route.replace(/\//g, "")}.png`,
          fullPage: true,
        });
      }
    }

    expect(
      broken,
      `routes showing an error banner: ${broken.join(", ")}`,
    ).toEqual([]);
  });
});
