import { expect, test, type Page } from "@playwright/test";
import { resolveEffectiveAccess } from "@wealthme/contracts";

// Deterministic UI checks against the real shell. No database or real writes.
async function mockSession(page: Page) {
  await page.context().addCookies([
    {
      name: "better-auth.session_token",
      value: "ux-test-session",
      domain: "localhost",
      path: "/",
    },
  ]);
  await page.addInitScript(() => {
    localStorage.setItem("wealthme_onboarded_ux-user", "1");
    localStorage.setItem("wealthme-locale", "id");
  });
  await page.route("**/api/auth/get-session**", (route) =>
    route.fulfill({
      json: {
        session: {
          id: "ux-session",
          token: "ux-test-session",
          userId: "ux-user",
          familyGroupId: "ux-family",
          expiresAt: "2099-01-01T00:00:00.000Z",
        },
        user: {
          id: "ux-user",
          name: "UX Test",
          email: "ux@example.com",
          emailVerified: true,
          image: null,
        },
      },
    }),
  );
  const api = async (route: import("@playwright/test").Route) => {
    const path = new URL(route.request().url()).pathname;
    let json: unknown = [];
    if (path.endsWith("/dashboard/summary"))
      json = {
        recentTransactions: [],
        netWorth: 0,
        currentMonth: { income: 0, expense: 0 },
      };
    if (path.endsWith("/password-status")) json = { mustChangePassword: false };
    else if (path.endsWith("/auth/me"))
      json = {
        id: "ux-user",
        name: "UX Test",
        familyGroupId: "ux-family",
        avatarUrl: null,
      };
    else if (path.endsWith("/auth/profile")) json = { displayCurrency: "IDR" };
    else if (path.endsWith("/family-groups/mine"))
      json = [{ id: "ux-family", name: "UX Family", myRole: "owner" }];
    else if (path.endsWith("/access/me"))
      json = resolveEffectiveAccess({ role: "owner" });
    else if (path.endsWith("/unread-count")) json = { count: 1 };
    else if (path.endsWith("/notifications"))
      json = [
        {
          id: "n1",
          title: "Test notifikasi",
          body: "Pesan pengujian",
          isRead: false,
          createdAt: new Date().toISOString(),
        },
      ];
    else if (path.endsWith("/ai-key")) json = { configured: false };
    await route.fulfill({ json });
  };
  await page.route("**/family-groups/**", api);
  await page.route("**/auth/me", api);
  await page.route("**/auth/profile", api);
  await page.route("**/auth/password-status", api);
}

test.beforeEach(async ({ page }) => mockSession(page));

test("command palette supports all routes, actions and keyboard navigation", async ({
  page,
}) => {
  await page.goto("/notifikasi");
  await expect(
    page.getByText("Test notifikasi", { exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Control+k");
  const input = page.getByRole("combobox");
  await expect(input).toBeVisible();
  await expect(page.getByRole("option", { name: /Akun/ })).toBeVisible();
  await input.fill("Ganti tema");
  await page.keyboard.press("Enter");
  await expect(input).toBeHidden();
  await expect(page.locator("html")).toHaveClass(/dark/);
});

test("shortcuts ignore typing fields", async ({ page }) => {
  await page.goto("/notifikasi");
  await expect(
    page.getByText("Test notifikasi", { exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Control+k");
  const input = page.getByRole("combobox");
  await input.fill("akun");
  await page.keyboard.press("Control+Shift+Enter");
  await expect(input).toBeVisible();
  await expect(input).toHaveValue("akun");
  await page.keyboard.press("Escape");
  await expect(input).toBeHidden();
});

test("notification view transitions honor reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/notifikasi");
  await expect(
    page.getByText("Test notifikasi", { exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: () => {
        throw new Error("Reduced motion must not start a transition");
      },
    });
  });
  await page.locator(".nf-head .wm-seg button").last().click();
  await expect(page.getByText("Test notifikasi", { exact: true })).toBeHidden();
  await expect(page.locator(".nf-empty")).toBeVisible();
});

test.describe("Mobile sheets", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  test("sheet follows the finger, dismisses on swipe, and keeps a close button", async ({
    page,
  }) => {
    await page.goto("/notifikasi");
    await expect(
      page.getByText("Test notifikasi", { exact: true }),
    ).toBeVisible();
    await page.addStyleTag({
      content: ".tsqd-parent-container { display: none !important; }",
    });
    await page.getByRole("button", { name: "Semua menu", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
    const head = await dialog.locator(".wm-panel-head").boundingBox();
    expect(head).not.toBeNull();
    const x = head!.x + head!.width / 2;
    const y = head!.y + 30;
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    for (let step = 1; step <= 10; step++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x, y: y + step * 50 }],
      });
    }
    expect(
      await dialog.evaluate(
        (element) => new DOMMatrix(getComputedStyle(element).transform).m42,
      ),
    ).toBeGreaterThan(30);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect(dialog).toBeHidden();
    await cdp.detach();
    await page.getByRole("button", { name: "Semua menu", exact: true }).click();
    await dialog.locator(".wm-panel-x").click();
    await expect(dialog).toBeHidden();
  });
  test("touch controls reserve 48px and the dock targets do not overlap", async ({
    page,
  }) => {
    await page.goto("/notifikasi");
    await expect(
      page.getByText("Test notifikasi", { exact: true }),
    ).toBeVisible();
    await page.addStyleTag({
      content: ".tsqd-parent-container { display: none !important; }",
    });
    const undersized = await page
      .locator(".wm-app")
      .locator(
        'button:visible, [role="button"]:visible, a.wm-dock-item:visible',
      )
      .evaluateAll((elements) =>
        elements
          .map((element) => ({
            label: element.getAttribute("aria-label") || element.textContent,
            width: element.getBoundingClientRect().width,
            height: element.getBoundingClientRect().height,
          }))
          .filter((box) => box.width < 47.99 || box.height < 47.99),
      );
    expect(undersized).toEqual([]);
    const boxes = await page
      .locator(".wm-dock > button, .wm-dock > a")
      .evaluateAll((elements) =>
        elements.map((element) => {
          const { x, width } = element.getBoundingClientRect();
          return { x, width };
        }),
      );
    for (let i = 1; i < boxes.length; i++)
      expect(boxes[i].x).toBeGreaterThanOrEqual(
        boxes[i - 1].x + boxes[i - 1].width,
      );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
});

test("headlines balance and prose wraps prettily without changing numeric heroes", async ({
  page,
}) => {
  await page.goto("/notifikasi");
  await expect(
    page.getByText("Test notifikasi", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".nf-group-title").first()).toHaveCSS(
    "text-wrap-style",
    "balance",
  );
  await expect(page.locator(".nf-hero .wm-cap").first()).toHaveCSS(
    "text-wrap-style",
    "pretty",
  );
  await expect(page.locator(".nf-hero .wm-big")).toHaveCSS(
    "text-wrap-style",
    "auto",
  );
});

test("squircle surfaces retain their existing radii", async ({ page }) => {
  await page.goto("/notifikasi");
  await expect(
    page.getByText("Test notifikasi", { exact: true }),
  ).toBeVisible();
  if (await page.evaluate(() => CSS.supports("corner-shape", "squircle"))) {
    await expect(page.locator(".nf-list")).toHaveCSS(
      "corner-shape",
      "squircle",
    );
  }
  expect(
    await page
      .locator(".nf-list")
      .evaluate((element) =>
        parseFloat(getComputedStyle(element).borderTopLeftRadius),
      ),
  ).toBeGreaterThan(0);
});

test("Mac shortcuts show the command symbol", async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "platform", { get: () => "MacIntel" }),
  );
  await page.goto("/notifikasi");
  await expect(page.locator(".wm-search .wm-kbd")).toHaveText("⌘ K");
  await page.keyboard.press("Meta+k");
  await expect(page.getByRole("combobox")).toBeVisible();
  await expect(
    page.getByRole("option", { name: /Catat transaksi/ }).locator("kbd"),
  ).toHaveText("⌘ ⇧ ↵");
});

test("notification skeleton waits 300ms and uses the loaded row geometry", async ({
  page,
}) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    "**/family-groups/ux-family/notifications",
    async (route) => {
      await pending;
      await route.fulfill({
        json: [
          {
            id: "n1",
            title: "Test notifikasi",
            body: "Pesan pengujian",
            isRead: false,
            createdAt: new Date().toISOString(),
          },
        ],
      });
    },
  );
  await page.goto("/notifikasi");
  await expect(page.locator('.nf-groups [role="status"]')).toBeVisible();
  const before = await page.locator(".nf-row .nf-ic").first().boundingBox();
  release();
  await expect(
    page.getByText("Test notifikasi", { exact: true }),
  ).toBeVisible();
  const after = await page.locator(".nf-row .nf-ic").first().boundingBox();
  expect(after?.width).toBe(before?.width);
  expect(after?.height).toBe(before?.height);
});

test("notification filters start native view transitions when motion is allowed", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/notifikasi");
  await expect(
    page.getByText("Test notifikasi", { exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    const original = document.startViewTransition.bind(document);
    const state = { calls: 0 };
    Object.assign(window, { uxTransitions: state });
    document.startViewTransition = (
      ...args: Parameters<Document["startViewTransition"]>
    ) => {
      state.calls++;
      return original(...args);
    };
  });
  await page.locator(".nf-head .wm-seg button").last().click();
  await page.locator(".nf-head .wm-seg button").first().click();
  await expect(
    page.getByText("Test notifikasi", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { uxTransitions: { calls: number } })
          .uxTransitions.calls,
    ),
  ).toBe(2);
});

test.describe("Mobile calendar targets", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  test("calendar cells have independent 48px targets without page overflow", async ({
    page,
  }) => {
    await page.goto("/notifikasi");
    await expect(
      page.getByText("Test notifikasi", { exact: true }),
    ).toBeVisible();
    await page.addStyleTag({
      content: ".tsqd-parent-container { display: none !important; }",
    });
    await page.locator(".wm-dock-fab").click();
    await page.getByRole("dialog").locator(".date-range__trigger").click();
    const calendar = page.locator(".date-range__pop");
    await page
      .locator('[data-slot="dialog-content"]')
      .evaluate(async (element) => {
        await Promise.all(
          element
            .getAnimations()
            .map((animation) => animation.finished.catch(() => {})),
        );
      });
    await expect(calendar).toBeVisible();
    await calendar.evaluate(async (element) => {
      await Promise.all(
        element
          .getAnimations()
          .map((animation) => animation.finished.catch(() => {})),
      );
    });
    const boxes = await calendar
      .locator("button.dr-day")
      .evaluateAll((elements) =>
        elements.map((element) => {
          const { width, height } = element.getBoundingClientRect();
          return { width, height };
        }),
      );
    expect(boxes.length).toBeGreaterThan(20);
    expect(
      boxes.filter((box) => box.width < 47.99 || box.height < 47.99),
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
});

test("AI history deletion is immediate, undoable, and delayed until the window expires", async ({
  page,
}) => {
  let removed = false;
  let deleteRequests = 0;
  await page.route("**/ai-key", (route) =>
    route.fulfill({
      json: {
        configured: true,
        provider: "openai",
        keyHint: "test",
        scanAvailable: false,
        model: null,
        defaultModel: null,
      },
    }),
  );
  await page.route("**/ai-advisor/conversations", (route) =>
    route.fulfill({
      json: removed
        ? []
        : [
            {
              id: "c1",
              title: "Undo test",
              messageCount: 2,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
    }),
  );
  await page.route("**/ai-advisor/conversations/c1", (route) => {
    if (route.request().method() === "DELETE") {
      deleteRequests++;
      removed = true;
      return route.fulfill({ status: 204 });
    }
    return route.fulfill({ json: { id: "c1", messages: [] } });
  });
  await page.goto("/ai");
  const remove = page.getByRole("button", {
    name: "Hapus percakapan: Undo test",
  });
  await expect(remove).toBeVisible();
  await page.clock.install();
  await remove.click();
  await expect(remove).toBeHidden();
  await expect(
    page.locator('[data-sonner-toast] [role="status"]'),
  ).toBeVisible();
  expect(deleteRequests).toBe(0);
  await page.getByRole("button", { name: "Urungkan", exact: true }).click();
  await expect(remove).toBeVisible();
  await page.clock.fastForward(8000);
  expect(deleteRequests).toBe(0);
  await remove.click();
  await page.clock.fastForward(6500);
  await expect.poll(() => deleteRequests).toBe(1);
  await expect(remove).toBeHidden();
});
