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
 * `max-h-[85dvh]` with `overflow-y-auto` (apps/web/src/components/ui/dialog.tsx).
 *
 * Coverage note (this spec is NOT uniformly 1:1 with the code fix):
 *   - warisan and splitbill use the shadcn `DialogContent` primitive with no
 *     className override, so those two scenarios directly exercise the base
 *     primitive's new `max-h-[85dvh] overflow-y-auto` default.
 *   - The `asuransi` scenario opens a HAND-ROLLED `role="dialog"` component
 *     (InsuranceModal) that never inherited the primitive — it carries its
 *     OWN independent `max-h-[85dvh]` (fixed from a pre-existing `85vh`).
 *     It was already governed by that cap before this change, so this
 *     scenario passing does not exercise `components/ui/dialog.tsx` at all;
 *     it only guards the hand-rolled modal's own cap.
 *   - The `tujuan` and `akun` (category allow-list) scenarios below open
 *     dialogs that carry their OWN `className` override
 *     (`crud-modal.tsx` / `akun/page.tsx`'s `CategoryLimitDialog`), which
 *     tailwind-merge lets fully replace the primitive's default — those
 *     two overrides were fixed from `vh` to `dvh` directly at the source,
 *     independently of the primitive change, and these scenarios exist to
 *     guard THAT fix specifically (see the per-file comments for why).
 *
 * G2: the onboarding welcome dialog must stay dismissible ("Lewati" always
 * in-viewport at 390px) and must never re-appear for a returning session.
 *
 * G3: the onboarding language picker must not depend on an emoji-flag font
 * (🇮🇩/🇬🇧 render as tofu boxes on systems without one) — text labels only.
 *
 * IMPORTANT — what this spec CANNOT prove in this environment: the entire
 * `vh` vs `dvh` defect (mobile browser chrome shrinking the *visible*
 * viewport below the *layout* viewport that `vh` uses) is invisible to
 * Playwright's desktop Chromium with an emulated/resized viewport — Chromium
 * reports `dvh === vh` there (no browser chrome is actually simulated). Every
 * assertion below that references `dvh`-bounded dialogs will measure
 * IDENTICALLY whether the source used `vh` or `dvh` in this test run; this
 * spec only proves the dialogs are bounded/scrollable/reachable at all
 * (which they already were, for the pre-existing `vh`-capped dialogs). The
 * `vh` -> `dvh` correctness itself is a source-level fix verified by
 * reading, not by this harness — proving it empirically needs WebKit or a
 * real device with the address bar visible.
 *
 * Run against the DEPLOYED site to reproduce the pre-fix failure:
 *   BASE_URL=https://wealthme.demo-wit.id pnpm --filter web exec playwright test audit/modal-geometry
 * Run against a local dev server to prove the fix:
 *   pnpm --filter web dev   (in one shell)
 *   BASE_URL=http://localhost:3000 pnpm --filter web exec playwright test audit/modal-geometry
 */

import {
  test,
  expect,
  type Page,
  type Locator,
  type Browser,
} from "@playwright/test";

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
    // EPIC-023 Task H fix round (MEDIUM 15) — `data-tour` markers were dead
    // attributes left over from the removed button-spotlight tour; select
    // by the button's own accessible name instead.
    openTrigger: (page) =>
      page.getByRole("button", { name: "Tambah", exact: true }),
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
  {
    // Review finding (HIGH) — the generic CrudModal (components/crud/crud-modal.tsx)
    // carries its own `max-h-[85vh]` (now `85dvh`) className that fully
    // replaces the DialogContent primitive default via tailwind-merge, so a
    // scenario that only ever opens primitive-default dialogs never exercises
    // that override. "tujuan" (financial goal) is a simple, always-reachable
    // CrudModal-backed add flow with no extra setup — it has no dynamically
    // growing rows, so `addRowButtonName` is null; it exists to guard
    // crud-modal.tsx's own max-h/overflow className, not row growth.
    label: "tujuan — Tambah Tujuan (CrudModal add flow)",
    route: "/tujuan",
    openTrigger: (page) =>
      page.getByRole("button", { name: "Tambah Tujuan", exact: true }),
    content: (dialog) => dialog,
    addRowButtonName: null,
    addRowClicks: 0,
    submitButtonName: "Simpan",
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
        const titleSuffix = scenario.addRowButtonName
          ? ` with ${scenario.addRowClicks} added rows`
          : "";
        test(`${scenario.label} stays reachable${titleSuffix}`, async () => {
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

// ---------------------------------------------------------------------------
// akun — CategoryLimitDialog (EPIC-019 per-member category allow-list)
// ---------------------------------------------------------------------------
//
// Review finding (HIGH) — akun/page.tsx's CategoryLimitDialog carries its own
// `max-h-[80vh]` (now `80dvh`) className, another override the primitive fix
// alone cannot reach. This dialog's checkbox list grows with the family's
// EXPENSE category count (20 in the seeded demo data — comfortably "8+"),
// and it only renders for a family member whose role is exactly "member"
// (never the owner's own row, never "admin_staff"). The seeded demo family
// has no such member by default, so reaching this dialog requires creating
// one through the app's own invite -> register -> accept flow first.

const QA_FIXTURE_MEMBER_NAME = "QA Modal Geometry Fixture";
const QA_FIXTURE_MEMBER_PASSWORD = "QaFixture1234!";
// A fixed email would collide with the same fixture created by a concurrent
// agent/run against this shared demo DB (already observed once — "invalid
// email or password" on login because a differently-seeded run owned the
// account under that exact address). Generated fresh per invocation instead,
// trading run-to-run idempotency (each run that needs to create one adds a
// new fixture member) for collision-safety — cheap on a disposable demo DB.
function newFixtureMemberEmail(): string {
  return `qa-modal-geometry-fixture+${Date.now()}-${Math.floor(Math.random() * 1e6)}@wealthme.id`;
}

/** Opens the family group management panel from the /akun hub. */
async function openFamilyPanel(page: Page): Promise<void> {
  await page.goto("/akun", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("load").catch(() => {});
  await dismissOnboardingIfPresent(page, 2_000);
  // The family card is a <button> whose accessible name is the dynamic
  // family name + role + member count — not stable across seed data. The
  // "Group Family" heading right above it IS stable; the button is the next
  // interactive element after it in document order.
  const heading = page.getByText("👨‍👩‍👧‍👦 Group Family", { exact: true });
  await heading.waitFor({ state: "visible", timeout: 15_000 });
  await heading.locator("xpath=following::button[1]").click();
  await page
    .getByRole("button", { name: "Undang Anggota", exact: true })
    .waitFor({ state: "visible", timeout: 15_000 });
}

/**
 * Returns the "Batasi Kategori" trigger for a family member whose role is
 * exactly "member", creating one via the app's own invite/register/accept
 * flow if none exists yet. Reuses ANY existing qualifying member first
 * (idempotent across runs when one is already present, from this helper or
 * otherwise); only creates a fresh, uniquely-emailed fixture member when
 * none exists at all.
 */
async function ensureCategoryLimitTrigger(
  page: Page,
  browser: Browser,
): Promise<Locator> {
  await openFamilyPanel(page);
  const existingTrigger = page
    .locator('button[aria-label^="Batasi Kategori"]')
    .first();
  if (await existingTrigger.count()) return existingTrigger;

  // No "member"-role user yet — invite one (placeholders read straight from
  // components/crud/crud-config.ts's "member" entity fields).
  const fixtureEmail = newFixtureMemberEmail();
  await page
    .getByRole("button", { name: "Undang Anggota", exact: true })
    .click();
  await page.getByPlaceholder("cth: Siti Arsandi").fill(QA_FIXTURE_MEMBER_NAME);
  await page.getByPlaceholder("email atau nomor").fill(fixtureEmail);

  const [inviteResponse] = await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url().includes("/invitations") && r.request().method() === "POST",
      { timeout: 15_000 },
    ),
    page.getByRole("button", { name: "Simpan", exact: true }).click(),
  ]);
  const invitation = (await inviteResponse.json()) as { token: string };

  // Accept the invite as a brand-new account, in an isolated context so the
  // demo/owner session on `page` is never touched.
  const inviteeContext = await browser.newContext();
  const inviteePage = await inviteeContext.newPage();
  await inviteePage.goto("/register", { waitUntil: "domcontentloaded" });
  await inviteePage.locator("#name").fill(QA_FIXTURE_MEMBER_NAME);
  await inviteePage.locator("#email").fill(fixtureEmail);
  await inviteePage.locator("#password").fill(QA_FIXTURE_MEMBER_PASSWORD);
  await inviteePage
    .locator("#confirmPassword")
    .fill(QA_FIXTURE_MEMBER_PASSWORD);
  await inviteePage
    .getByRole("button", { name: "Daftar", exact: true })
    .click();
  await inviteePage.waitForURL(/\/beranda/, { timeout: 20_000 });

  await inviteePage.goto(`/join/${invitation.token}`, {
    waitUntil: "domcontentloaded",
  });
  const acceptButton = inviteePage.getByRole("button", {
    name: "Terima Undangan",
    exact: true,
  });
  // Already-accepted-on-a-prior-run is fine — the member row already exists
  // for the owner to see below regardless.
  const canAccept = await acceptButton
    .waitFor({ state: "visible", timeout: 10_000 })
    .then(() => true)
    .catch(() => false);
  if (canAccept) {
    await acceptButton.click();
    await inviteePage.waitForTimeout(2_000); // signOut() fires on a 1.5s timer
  }
  await inviteeContext.close();

  // Reload the owner's family panel — the invited member should now appear.
  await openFamilyPanel(page);
  return page.locator('button[aria-label^="Batasi Kategori"]').first();
}

test.describe("EPIC-022 Group G — akun CategoryLimitDialog (crud override coverage)", () => {
  // Single viewport: the setup cost (invite + register + accept) is high and
  // — per this file's header note — a viewport-emulated Chromium run cannot
  // distinguish `vh` from `dvh` regardless, so a second (desktop) run adds
  // cost without adding coverage. 390x844 is where G1 actually bites.
  test("akun — Batasi Kategori category allow-list (8+ categories) stays reachable", async ({
    page,
    browser,
  }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);

    const trigger = await ensureCategoryLimitTrigger(page, browser);
    await expect(
      trigger,
      'a member with role "member" should exist (seeded or fixture-created) so Batasi Kategori is visible',
    ).toBeVisible({ timeout: 15_000 });
    await trigger.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // The seeded family has 20 expense categories, comfortably above the
    // "8+" the review asked this scenario to cover — no per-row clicking
    // needed, the list is already long from live data. The category list and
    // the member's current selections load via two independent queries, so
    // wait for the first checkbox to actually mount instead of racing an
    // instant `.count()` against whichever query resolves second.
    await expect(dialog.locator('input[type="checkbox"]').first()).toBeVisible({
      timeout: 10_000,
    });
    const categoryCheckboxCount = await dialog
      .locator('input[type="checkbox"]')
      .count();
    expect(
      categoryCheckboxCount,
      "expected the seeded family's expense category list to already be 8+ long",
    ).toBeGreaterThanOrEqual(8);

    const submitButton = dialog.getByRole("button", {
      name: "Simpan Batasan",
      exact: true,
    });
    await assertDialogFitsViewport(
      dialog,
      submitButton,
      844,
      "akun CategoryLimitDialog @ mobile",
    );
  });
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
