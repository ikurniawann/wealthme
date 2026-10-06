import {
  expect,
  test,
  type BrowserContext,
  type Locator,
  type Page,
} from "@playwright/test";

const DEMO_EMAIL = "demo@wealthme.id";
const DEMO_PASSWORD = "demo1234";

async function dismissWelcomeIfVisible(page: Page) {
  const welcome = page
    .locator('[role="dialog"]')
    .filter({ hasText: /Selamat datang di WealthMe|Welcome to WealthMe/i });
  if (!(await welcome.count())) return;

  const closeWelcome = welcome.getByRole("button", { name: /close|tutup/i });
  await expect(closeWelcome).toBeVisible();
  await closeWelcome.click();
  await expect(welcome).toBeHidden();
}

async function expectTouchTargets44px(root: Page | Locator, surface: string) {
  const selector =
    surface === "login form"
      ? "input:visible, select:visible, textarea:visible, button:visible"
      : ".input:visible, .select:visible, .textarea:visible, .btn:visible, .btn--icon:visible, .segmented__item:visible, .date-range__trigger:visible";
  const targets = root.locator(selector);
  const dimensions = await targets.evaluateAll((elements) =>
    elements.map((element) => {
      const bounds = element.getBoundingClientRect();
      return {
        className: (element as HTMLElement).className,
        height: bounds.height,
        width: bounds.width,
      };
    }),
  );

  expect(dimensions.length, `${surface} has visible controls`).toBeGreaterThan(
    0,
  );
  expect(
    dimensions.filter((target) => target.height < 43.99),
    `${surface} controls below 44px: ${JSON.stringify(dimensions)}`,
  ).toEqual([]);
  expect(
    dimensions.filter(
      (target) =>
        String(target.className).split(" ").includes("btn--icon") &&
        target.width < 43.99,
    ),
  ).toEqual([]);
}

test.describe("Cross-page UX on mobile", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    page = await context.newPage();
    await page.goto("/login");
    await page.fill('input[type="email"]', DEMO_EMAIL);
    await page.fill('input[type="password"]', DEMO_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(beranda|ringkasan|dana|akun)/, {
      timeout: 25_000,
    });
    await dismissWelcomeIfVisible(page);
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test("transaction list starts within the first viewport and all totals remain visible", async () => {
    await page.goto("/transaksi");
    const summary = page
      .locator('[role="group"]')
      .filter({ hasText: "Total Pemasukan" });
    await expect(summary).toBeVisible({ timeout: 45_000 });
    await dismissWelcomeIfVisible(page);
    await expect(summary).toBeVisible();
    await expect(
      summary.getByText("Total Pemasukan", { exact: true }),
    ).toBeVisible();
    await expect(
      summary.getByText("Total Pengeluaran", { exact: true }),
    ).toBeVisible();
    await expect(summary.getByText("Selisih", { exact: true })).toBeVisible();

    const listTitle = page
      .getByText(/Daftar Transaksi|Transaction list/i)
      .first();
    await expect(listTitle).toBeVisible();
    expect((await listTitle.boundingBox())?.y).toBeLessThan(844);
  });

  test("profile action does not overlap identity", async () => {
    await page.goto("/akun");
    await expect(page.locator(".gradient-profile")).toBeVisible({
      timeout: 45_000,
    });
    await dismissWelcomeIfVisible(page);
    const hero = page.locator(".gradient-profile");
    const email = hero.getByText(/@/).first();
    const action = hero.getByRole("button").first();
    await expect(email).toBeVisible();
    await expect(action).toBeVisible();

    const emailBox = await email.boundingBox();
    const actionBox = await action.boundingBox();
    expect(emailBox).not.toBeNull();
    expect(actionBox).not.toBeNull();
    expect(
      emailBox!.x + emailBox!.width <= actionBox!.x ||
        actionBox!.x + actionBox!.width <= emailBox!.x ||
        emailBox!.y + emailBox!.height <= actionBox!.y ||
        actionBox!.y + actionBox!.height <= emailBox!.y,
    ).toBe(true);
  });

  test("Beranda keeps the main sections aligned in reading order", async () => {
    await page.goto("/beranda");
    const dashboard = page.locator(".bento-dashboard--ordered");
    await expect(dashboard).toBeVisible({ timeout: 45_000 });

    const layout = await dashboard.evaluate((element) => {
      const mainSections = Array.from(
        element.querySelectorAll(
          ":scope > .bento-hero, :scope > .bento-snapshot, :scope > .bento-chart, :scope > .bento-allocation, :scope > .bento-transactions, :scope > .bento-side, :scope > .bento-goals",
        ),
      ).map((section) => {
        const bounds = section.getBoundingClientRect();
        return {
          x: Math.round(bounds.x),
          y: Math.round(bounds.y),
          width: Math.round(bounds.width),
        };
      });
      const metrics = Array.from(
        element.querySelectorAll(":scope > .bento-stat"),
      ).map((metric) => {
        const bounds = metric.getBoundingClientRect();
        return { y: Math.round(bounds.y), width: Math.round(bounds.width) };
      });

      return { mainSections, metrics };
    });

    expect(layout.mainSections).toHaveLength(7);
    expect(layout.mainSections.map(({ y }) => y)).toEqual(
      [...layout.mainSections.map(({ y }) => y)].sort((a, b) => a - b),
    );
    expect(
      new Set(layout.mainSections.map(({ x, width }) => `${x}:${width}`)).size,
    ).toBe(1);
    expect(layout.metrics).toHaveLength(4);
    expect(layout.metrics.map(({ y }) => y)).toEqual(
      [...layout.metrics.map(({ y }) => y)].sort((a, b) => a - b),
    );
  });

  test("form fields and primary actions meet 44px on coarse pointers", async ({
    browser,
  }) => {
    const anonymousContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const anonymousPage = await anonymousContext.newPage();
    await anonymousPage.goto("/login");
    await expect(anonymousPage.locator('input[type="email"]')).toBeVisible();
    expect(
      await anonymousPage.evaluate(
        () => window.matchMedia("(pointer: coarse)").matches,
      ),
    ).toBe(true);
    await expectTouchTargets44px(anonymousPage.locator("form"), "login form");
    await anonymousContext.close();

    await page.goto("/transaksi");
    const addTransaction = page
      .locator(
        'button[aria-label*="Catat transaksi"]:visible, button:has-text("Catat transaksi"):visible',
      )
      .first();
    await expect(addTransaction).toBeAttached({ timeout: 45_000 });
    await dismissWelcomeIfVisible(page);
    await expect(addTransaction).toBeVisible();
    await addTransaction.click();
    const transactionDialog = page.getByRole("dialog").last();
    await expect(transactionDialog).toBeVisible();
    await page.waitForTimeout(300);
    await expectTouchTargets44px(transactionDialog, "transaction dialog");
    await page.keyboard.press("Escape");

    await page.goto("/liabilitas");
    const addLiability = page.getByRole("button", {
      name: /Tambah Liabilitas|Add Liability/i,
    });
    await expect(addLiability).toBeAttached({ timeout: 45_000 });
    await dismissWelcomeIfVisible(page);
    await expect(addLiability).toBeVisible();
    await addLiability.click();
    const liabilityDialog = page.getByRole("dialog").last();
    await expect(liabilityDialog).toBeVisible();
    await page.waitForTimeout(300);
    await expectTouchTargets44px(liabilityDialog, "liability dialog");
  });
});
