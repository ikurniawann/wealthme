/**
 * Accessibility audit (EPIC-007 T-709) — scans /login plus a representative
 * set of authenticated pages with axe-core and fails on any serious/critical
 * WCAG violation.
 *
 * Preconditions: web on :3000, API on :4000, seeded DB (same as
 * tests/e2e/pages/menu-audit.spec.ts).
 *
 * Run:  pnpm --filter web exec playwright test audit/a11y --reporter=list
 */

import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const DEMO_EMAIL = "demo@wealthme.id";
const DEMO_PASSWORD = "demo1234";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const SEVERE_IMPACTS = new Set(["critical", "serious"]);

// Prefer zero exclusions — only add a rule here if it actually fires on a
// known, already-accepted issue (documented inline with the reason).
const RULE_EXCLUSIONS: string[] = [];

// Derived (not imported directly) so this file doesn't need its own
// dependency on the transitive `axe-core` package — the type flows through
// @axe-core/playwright's own resolved declarations instead.
type AxeViolation = Awaited<
  ReturnType<AxeBuilder["analyze"]>
>["violations"][number];

async function login(page: Page) {
  await page.goto("/login");
  await page.waitForSelector('input[type="email"]', { timeout: 15_000 });
  await page.fill('input[type="email"]', DEMO_EMAIL);
  await page.fill('input[type="password"]', DEMO_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(beranda|ringkasan|dana|akun)/, { timeout: 25_000 });
}

async function scanForSevereViolations(
  page: Page,
  url: string,
): Promise<AxeViolation[]> {
  const builder = new AxeBuilder({ page }).withTags(WCAG_TAGS);
  if (RULE_EXCLUSIONS.length > 0) builder.disableRules(RULE_EXCLUSIONS);
  const results = await builder.analyze();

  const severe = results.violations.filter(
    (v) => v.impact != null && SEVERE_IMPACTS.has(v.impact),
  );

  if (severe.length > 0) {
    console.log(`\nAccessibility violations on ${url}:`);
    for (const v of severe) {
      const targets = v.nodes.map((n) => JSON.stringify(n.target)).join(", ");
      console.log(
        `  [${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} node(s): ${targets})`,
      );
    }
  }

  return severe;
}

test.describe("Accessibility audit — no serious/critical violations", () => {
  test("[a11y] /login", async ({ page }) => {
    await page.goto("/login");
    await page.waitForSelector('input[type="email"]', { timeout: 15_000 });

    const severe = await scanForSevereViolations(page, "/login");
    expect(
      severe,
      `${severe.length} serious/critical violation(s) on /login`,
    ).toEqual([]);
  });

  test.describe("authenticated pages", () => {
    // Serial + one shared logged-in page: the login endpoint is throttled
    // (5/min), so logging in per-test would 429 — same rationale as
    // tests/e2e/pages/menu-audit.spec.ts.
    test.describe.configure({ mode: "serial" });

    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
      const context = await browser.newContext();
      sharedPage = await context.newPage();
      await login(sharedPage);
    });

    test.afterAll(async () => {
      await sharedPage?.context().close();
    });

    const AUTHENTICATED_PAGES = ["/beranda", "/transaksi", "/laporan", "/akun"];

    for (const url of AUTHENTICATED_PAGES) {
      test(`[a11y] ${url}`, async () => {
        await sharedPage.goto(url, {
          waitUntil: "networkidle",
          timeout: 30_000,
        });
        await sharedPage.waitForTimeout(1000);

        const severe = await scanForSevereViolations(sharedPage, url);
        expect(
          severe,
          `${severe.length} serious/critical violation(s) on ${url}`,
        ).toEqual([]);
      });
    }
  });
});
