import { expect, test, type Page } from "@playwright/test";

const probe = "/legal/arc-probe";

async function openProbe(page: Page) {
  const response = await page.goto(probe);
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: "Arc Button probe" }),
  ).toBeVisible();
}

async function loginStyles(page: Page) {
  return page
    .locator('button[type="submit"]')
    .first()
    .evaluate((button) => {
      const style = getComputedStyle(button);
      const root = getComputedStyle(document.documentElement);
      return {
        background: style.backgroundColor,
        color: style.color,
        font: style.fontFamily,
        primary: root.getPropertyValue("--primary").trim(),
        ring: root.getPropertyValue("--ring").trim(),
      };
    });
}

test("desktop: real probe supports keyboard, disabled, and loading states", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openProbe(page);

  const active = page.getByRole("button", { name: "Simpan" });
  const disabled = page.getByRole("button", { name: "Tidak aktif" });
  const loading = page.getByRole("button", { name: "Memuat" });
  const count = page.getByTestId("activation-count");

  await expect(active).toBeVisible();
  await expect(disabled).toBeDisabled();
  await expect(loading).toHaveAttribute("aria-busy", "true");
  await expect(loading).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByRole("status")).toHaveText("Memproses Memuat");

  await page.keyboard.press("Tab");
  await expect(active).toBeFocused();
  expect(await active.evaluate((el) => getComputedStyle(el).outlineWidth)).toBe(
    "2px",
  );
  await page.keyboard.press("Enter");
  await page.keyboard.press("Space");
  await expect(count).toHaveText("Aktivasi: 2");

  await page.keyboard.press("Tab");
  await expect(loading).toBeFocused();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Space");
  await loading.dispatchEvent("click");
  await expect(count).toHaveText("Aktivasi: 2");
  await expect(disabled).toBeDisabled();
  await test.info().attach("arc-probe-desktop", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
});

test("narrow touch: targets fit and states remain legible", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await openProbe(page);
    const buttons = page
      .getByRole("region", { name: "Button states" })
      .getByRole("button");
    const metrics = await buttons.evaluateAll((nodes) =>
      nodes.map((node) => {
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return {
          label: node.textContent?.trim(),
          width: rect.width,
          height: rect.height,
          opacity: style.opacity,
          cursor: style.cursor,
        };
      }),
    );
    console.log(`Arc touch target metrics: ${JSON.stringify(metrics)}`);
    expect(metrics).toHaveLength(3);
    for (const metric of metrics)
      expect(metric.height).toBeGreaterThanOrEqual(44);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
    await expect(buttons.nth(1)).toBeDisabled();
    await expect(buttons.nth(2)).toHaveAttribute("aria-busy", "true");
    expect(Number(metrics[1].opacity)).toBeLessThan(1);
    expect(Number(metrics[2].opacity)).toBeLessThan(1);
    await buttons.first().tap();
    await expect(page.getByTestId("activation-count")).toHaveText(
      "Aktivasi: 1",
    );
    await test.info().attach("arc-probe-touch-390", {
      body: await page.screenshot(),
      contentType: "image/png",
    });
  } finally {
    await context.close();
  }
});

test("reduced motion removes label travel and spinner animation", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openProbe(page);
  const spinner = page
    .getByRole("button", { name: "Memuat" })
    .locator("span")
    .last();
  expect(
    await spinner.evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");

  await page.getByRole("button", { name: "Ganti label" }).click();
  const active = page.getByRole("button", { name: "Tersimpan" });
  await expect(active).toBeVisible();
  const label = active.locator("span[style*='transform']").last();
  const style = await label.getAttribute("style");
  console.log(`Arc reduced-motion label style: ${style}`);
  expect(style).not.toContain("translateY(4px)");
  expect(style).not.toContain("blur(4px)");
  await active.click();
  await expect(page.getByTestId("activation-count")).toHaveText("Aktivasi: 1");
});

test("probe CSS does not change /login after client navigation", async ({
  page,
}) => {
  await page.goto("/login");
  const before = await loginStyles(page);
  await openProbe(page);
  await page.getByRole("link", { name: "Kembali ke login" }).click();
  await expect(page).toHaveURL(/\/login$/);
  const after = await loginStyles(page);
  console.log(
    `Login styles before/after Arc probe: ${JSON.stringify({ before, after })}`,
  );
  expect(after).toEqual(before);
  expect(await page.locator('link[href*="arc-foundation"]').count()).toBe(0);
});
