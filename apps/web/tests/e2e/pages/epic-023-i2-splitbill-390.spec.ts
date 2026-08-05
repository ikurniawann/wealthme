/**
 * EPIC-023 Task I (I2) — measurement harness for the split-bill dialog at
 * 390x844. Reports numbers; deliberately asserts no fix.
 *
 * SKIPPED, and not because the measurement is unwanted: this suite cannot hold
 * a session against DEV. Signing in returns 200 and `get-session` reports a
 * valid session, but the app bounces back to /login on client hydration. That
 * is not specific to this file — `tests/e2e/pages/epic-009-t901-rinv.spec.ts`
 * fails at the identical `login()` step, so the whole e2e suite is currently
 * unable to authenticate. It compounds what the epic already records: e2e is
 * not wired into `scripts/test.sh` and has drifted.
 *
 * The I2 question was answered without it, by reading what the code actually
 * constrains and verifying the merge behaviour directly:
 *
 *   twMerge("… max-h-[85dvh] max-w-[calc(100%-2rem)] overflow-y-auto …",
 *           "max-w-[480px] p-6 sm:max-w-[480px]")
 *     → max-h-[85dvh] and overflow-y-auto SURVIVE  (EPIC-022 G's fix holds)
 *     → max-w-[calc(100%-2rem)] is DROPPED         (the 2rem gutter is lost)
 *
 * So at 390px the dialog was full-bleed with no side margin, while the
 * vertical axis was already covered. Fixed by wrapping the width in `min()`.
 * Un-skip this once the suite can log in, to confirm the numbers at runtime.
 */
import { test, expect, type Page } from "@playwright/test";

const DEMO_EMAIL = "demo@wealthme.id";
const DEMO_PASSWORD = "demo1234";

async function login(page: Page): Promise<void> {
  // Fill the real form, matching every other spec in this suite
  // (tests/e2e/pages/menu-audit.spec.ts and friends). An earlier revision
  // POSTed to /api/auth/sign-in/email from the request context to sidestep the
  // form's rate limiter; the Set-Cookie did not end up driving the app's
  // session, so the run landed back on /login and the measurement never ran.
  await page.goto("/login");
  await page.waitForSelector('input[type="email"]', { timeout: 15_000 });
  await page.fill('input[type="email"]', DEMO_EMAIL);
  await page.fill('input[type="password"]', DEMO_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(beranda|ringkasan|dana|akun)/, { timeout: 25_000 });
}

async function dismissOnboardingIfPresent(page: Page): Promise<void> {
  const lewati = page.getByRole("button", { name: "Lewati", exact: true });
  const appeared = await lewati
    .waitFor({ state: "visible", timeout: 8_000 })
    .then(() => true)
    .catch(() => false);
  if (appeared) await lewati.click();
}

test.use({ viewport: { width: 390, height: 844 } });

test.skip("MEASURE splitbill create dialog @ 390x844", async ({ page }) => {
  await login(page);
  await dismissOnboardingIfPresent(page);
  await page.goto("/splitbill");
  await dismissOnboardingIfPresent(page);

  await page
    .getByRole("button", { name: "Buat Split Bill", exact: true })
    .first()
    .click();

  const dialog = page.locator('[data-slot="dialog-content"]').first();
  await dialog.waitFor({ state: "visible", timeout: 15_000 });

  const report = async (label: string) => {
    const box = await dialog.boundingBox();
    const css = await dialog.evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        maxHeight: s.maxHeight,
        maxWidth: s.maxWidth,
        width: s.width,
        overflowY: s.overflowY,
        padding: s.padding,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      };
    });
    const submit = page.getByRole("button", {
      name: "Buat & Bagikan Link",
      exact: true,
    });
    await submit.scrollIntoViewIfNeeded().catch(() => {});
    const sBox = await submit.boundingBox();
    const docOverflowX = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    // Narrowest participant-name input inside the dialog.
    const nameInputs = dialog.locator("input[type=text]");
    const widths: number[] = [];
    for (let i = 0; i < (await nameInputs.count()); i++) {
      const b = await nameInputs.nth(i).boundingBox();
      if (b) widths.push(Math.round(b.width));
    }
    console.log(
      `\n=== ${label} ===\n` +
        `dialog box            : x=${box?.x} y=${box?.y} w=${box?.width} h=${box?.height}\n` +
        `left gutter / right   : ${box?.x} / ${390 - (box!.x + box!.width)}\n` +
        `computed max-width    : ${css.maxWidth}   width: ${css.width}\n` +
        `computed max-height   : ${css.maxHeight}  overflow-y: ${css.overflowY}\n` +
        `scrollH/clientH       : ${css.scrollHeight}/${css.clientHeight}  (vertical scroll needed: ${css.scrollHeight > css.clientHeight})\n` +
        `scrollW/clientW       : ${css.scrollWidth}/${css.clientWidth}  (horizontal overflow: ${css.scrollWidth > css.clientWidth})\n` +
        `submit btn            : y=${sBox?.y} h=${sBox?.height} bottom=${sBox ? sBox.y + sBox.height : "?"} (viewport 844)\n` +
        `page horizontal overflow: ${docOverflowX}px\n` +
        `text input widths     : ${widths.join(", ")}`,
    );
    return { box, css, sBox, docOverflowX, widths };
  };

  const empty = await report("3 participants (default)");

  // Grow it the way a real user would.
  for (let i = 0; i < 5; i++) {
    await page
      .getByRole("button", { name: "Tambah Peserta", exact: true })
      .click();
  }
  const grown = await report("8 participants");

  // Switch to the custom-amount mode, whose rows are widest.
  await page
    .getByRole("button", { name: /Kustom/i })
    .first()
    .click();
  const custom = await report("8 participants, custom amounts");

  expect(empty.box).not.toBeNull();
  expect(grown.box).not.toBeNull();
  expect(custom.box).not.toBeNull();
});
