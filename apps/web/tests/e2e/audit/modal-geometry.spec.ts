/**
 * EPIC-022 Group G — mobile modal geometry regression harness.
 *
 * Measures dialog/submit-button geometry with real bounding boxes (not "by
 * eye") at 390x844 (mobile) and 1440x900 (desktop) against the live app.
 *
 * G1 (VERIFIED BLOCKER): the warisan "Tambah Aset Warisan" dialog grows
 * unbounded as heirs are added — empty it already fills ~843/844px with no
 * internal scroll; after 3 heirs it grows to ~1220px tall, clipped at
 * `y < 0`, with "Simpan Aset Warisan" ending ~164px below the fold and
 * unreachable. The same growth shape applies to the insurance beneficiary
 * editor and split-bill participants. Fix: bound every dialog body to
 * `max-h-[85dvh]` with `overflow-y-auto` (apps/web/src/components/ui/dialog.tsx)
 * so the header and the submit action stay reachable at any content length.
 *
 * G2: the onboarding welcome dialog must stay dismissible ("Lewati" always
 * in-viewport at 390px) and must never re-appear for a returning session.
 *
 * G3: the onboarding language picker must not depend on an emoji-flag font
 * (🇮🇩/🇬🇧 render as tofu boxes on systems without one) — text labels only.
 *
 * Run against the DEPLOYED site to reproduce the pre-fix failure:
 *   BASE_URL=https://wealthme.demo-wit.id pnpm --filter web exec playwright test audit/modal-geometry
 * Run against a local dev server to prove the fix:
 *   pnpm --filter web dev   (in one shell)
 *   BASE_URL=http://localhost:3000 pnpm --filter web exec playwright test audit/modal-geometry
 */

import { test, expect, type Page, type Locator } from "@playwright/test";

const DEMO_EMAIL = "demo@wealthme.id";
const DEMO_PASSWORD = "demo1234";

type Viewport = { name: string; width: number; height: number };
const VIEWPORTS: Viewport[] = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
];

async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.waitForSelector("#email", { timeout: 15_000 });
  await page.fill("#email", DEMO_EMAIL);
  await page.fill("#password", DEMO_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(beranda|ringkasan)/, { timeout: 25_000 });
}

/**
 * Dismisses the first-run onboarding welcome dialog if it is showing. The
 * dialog's `useEffect` resolves the session/userId asynchronously, so it can
 * mount slightly after `page.goto` resolves — this actively waits for it
 * (instead of an instant, racy visibility check) and is a no-op once the
 * session is already marked onboarded.
 */
async function dismissOnboardingIfPresent(
  page: Page,
  timeoutMs = 8_000,
): Promise<void> {
  const lewati = page.getByRole("button", { name: "Lewati", exact: true });
  const appeared = await lewati
    .waitFor({ state: "visible", timeout: timeoutMs })
    .then(() => true)
    .catch(() => false);
  if (appeared) {
    await lewati.click();
    await expect(lewati).toBeHidden();
  }
}

interface ModalScenario {
  /** Human-readable label used in assertion messages and test titles. */
  label: string;
  route: string;
  /** Opens the dialog from the page (outside the dialog itself). */
  openTrigger: (page: Page) => Locator;
  /**
   * Locator for the actual bounded/scrollable content box. For the shadcn
   * `Dialog` primitive this IS the `role="dialog"` element. The asuransi
   * insurance modal is a custom component whose `role="dialog"` wrapper is a
   * full-viewport backdrop — its actual bounded box is the first child.
   */
  content: (dialog: Locator) => Locator;
  /** Button that adds one more row (heir/beneficiary/participant), if any. */
  addRowButtonName: string | null;
  addRowClicks: number;
  submitButtonName: string;
}

const SCENARIOS: ModalScenario[] = [
  {
    label: "warisan — Tambah Aset Warisan (HeirEditor)",
    route: "/warisan",
    openTrigger: (page) =>
      page.getByRole("button", { name: "Tambah Aset Warisan", exact: true }),
    content: (dialog) => dialog,
    addRowButtonName: "+ Tambah Ahli Waris",
    addRowClicks: 3,
    submitButtonName: "Simpan Aset Warisan",
  },
  {
    label: "asuransi — Tambah Asuransi (BeneficiaryEditor)",
    route: "/asuransi",
    openTrigger: (page) => page.locator('[data-tour="add-asuransi"]'),
    // InsuranceModal's role="dialog" element is the fixed inset-0 backdrop;
    // the actual bounded/scrollable card is its first child.
    content: (dialog) => dialog.locator("> div").first(),
    addRowButtonName: "+ Tambah Ahli Waris",
    addRowClicks: 3,
    submitButtonName: "Simpan Asuransi",
  },
  {
    label: "splitbill — Buat Split Bill (participants)",
    route: "/splitbill",
    openTrigger: (page) =>
      page.getByRole("button", { name: "Buat Split Bill", exact: true }),
    content: (dialog) => dialog,
    addRowButtonName: "Tambah Peserta",
    addRowClicks: 3,
    submitButtonName: "Buat & Bagikan Link",
  },
];

/**
 * Real-measurement assertions (not "by eye"): the dialog body must be fully
 * inside the viewport, must declare an internal scroll container, and the
 * submit action must be reachable (in-viewport after scrolling to it).
 */
async function assertDialogFitsViewport(
  content: Locator,
  submitButton: Locator,
  viewportHeight: number,
  label: string,
): Promise<void> {
  await expect(
    content,
    `${label}: dialog content should be visible`,
  ).toBeVisible();

  const box = await content.boundingBox();
  expect(box, `${label}: dialog should report a bounding box`).not.toBeNull();
  expect(
    box!.y,
    `${label}: dialog top must not be clipped above the viewport (measured y=${box!.y})`,
  ).toBeGreaterThanOrEqual(0);
  expect(
    box!.y + box!.height,
    `${label}: dialog bottom (y=${box!.y}, height=${box!.height}) must fit within the ${viewportHeight}px viewport`,
  ).toBeLessThanOrEqual(viewportHeight + 1);

  const overflowY = await content.evaluate(
    (el) => getComputedStyle(el).overflowY,
  );
  expect(
    ["auto", "scroll"],
    `${label}: dialog body must declare an internal scroll container (overflow-y was "${overflowY}")`,
  ).toContain(overflowY);

  await submitButton.scrollIntoViewIfNeeded();
  const btnBox = await submitButton.boundingBox();
  expect(
    btnBox,
    `${label}: submit button should report a bounding box`,
  ).not.toBeNull();
  expect(
    btnBox!.y,
    `${label}: submit button top must be reachable inside the viewport (measured y=${btnBox!.y})`,
  ).toBeGreaterThanOrEqual(0);
  expect(
    btnBox!.y + btnBox!.height,
    `${label}: submit button bottom (y=${btnBox!.y}, height=${btnBox!.height}) must be reachable inside the ${viewportHeight}px viewport`,
  ).toBeLessThanOrEqual(viewportHeight + 1);
}

test.describe("EPIC-022 Group G — mobile modal geometry", () => {
  test.describe.configure({ mode: "serial" });

  for (const vp of VIEWPORTS) {
    test.describe(`${vp.name} (${vp.width}x${vp.height})`, () => {
      let page: Page;

      test.beforeAll(async ({ browser }) => {
        const context = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
        });
        page = await context.newPage();
        await login(page);
        await dismissOnboardingIfPresent(page);
      });

      test.afterAll(async () => {
        await page.close();
      });

      for (const scenario of SCENARIOS) {
        test(`${scenario.label} stays reachable with 3 added rows`, async () => {
          await page.goto(scenario.route, {
            waitUntil: "domcontentloaded",
            timeout: 30_000,
          });
          await page.waitForLoadState("load").catch(() => {});
          // Defensive: the welcome dialog's mount can lag a route change on
          // a slow connection; re-check so it never blocks the trigger below.
          await dismissOnboardingIfPresent(page, 2_000);

          await scenario.openTrigger(page).click();
          const dialog = page.getByRole("dialog");
          await expect(dialog).toBeVisible();
          const content = scenario.content(dialog);

          if (scenario.addRowButtonName) {
            const addRow = content.getByRole("button", {
              name: scenario.addRowButtonName,
              exact: true,
            });
            for (let i = 0; i < scenario.addRowClicks; i += 1) {
              await addRow.click();
            }
          }

          const submitButton = content.getByRole("button", {
            name: scenario.submitButtonName,
            exact: true,
          });
          await assertDialogFitsViewport(
            content,
            submitButton,
            vp.height,
            `${scenario.label} @ ${vp.name}`,
          );
        });
      }
    });
  }
});

test.describe("EPIC-022 Group G — onboarding welcome dialog (G2 + G3)", () => {
  test("welcome dialog: no emoji-flag tofu risk, Lewati reachable at 390px, never reappears for a returning session", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    await login(page);

    const welcomeDialog = page.getByRole("dialog");
    await expect(welcomeDialog).toBeVisible();

    // G3 — no flag emoji anywhere in the dialog (tofu-box risk on systems
    // without an emoji-flag font); the locale picker must be text-only.
    const dialogText = (await welcomeDialog.innerText()).normalize();
    expect(
      dialogText,
      "welcome dialog must not contain flag emoji",
    ).not.toMatch(/\u{1F1EE}\u{1F1E9}|\u{1F1EC}\u{1F1E7}/u);
    await expect(welcomeDialog.getByText("Bahasa Indonesia")).toBeVisible();
    await expect(welcomeDialog.getByText("English")).toBeVisible();

    // G2 — "Lewati" must be reachable inside the 390x844 viewport.
    const lewati = welcomeDialog.getByRole("button", {
      name: "Lewati",
      exact: true,
    });
    await expect(lewati).toBeVisible();
    const box = await lewati.boundingBox();
    expect(box, "Lewati button should report a bounding box").not.toBeNull();
    expect(
      box!.y,
      "Lewati top must be inside the 844px viewport",
    ).toBeGreaterThanOrEqual(0);
    expect(
      box!.y + box!.height,
      "Lewati bottom must be inside the 844px viewport",
    ).toBeLessThanOrEqual(845);

    await lewati.click();
    await expect(welcomeDialog).toBeHidden();

    // G2 — a returning session (same browser/localStorage) must not see the
    // welcome dialog again on a fresh full page load.
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForLoadState("load").catch(() => {});
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 5_000 });

    await context.close();
  });
});
