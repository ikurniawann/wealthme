/**
 * UI/UX gap-analysis capture — screenshots the LIVE app and the static demo
 * mockup side by side so divergences can be compared page-by-page.
 *
 * Artifacts (committed):
 *   docs/ui-audit/live/<id>-<desktop|mobile>.png   — live Next.js app
 *   docs/ui-audit/demo/<id>-<desktop|mobile>.png   — docs/WealthMe_Demo(1).html
 *   docs/ui-audit/manifest.json                    — capture metadata
 *
 * Preconditions (live capture): web on :3000, API on :4000, seeded DB.
 *   pnpm --filter web dev   (web)
 *   pnpm --filter api dev   (api)
 * The demo capture needs no running stack (it opens the HTML via file://).
 *
 * Run:  pnpm --filter web exec playwright test audit/ui-audit --reporter=list
 *       (demo only)  pnpm --filter web exec playwright test audit/ui-audit -g "demo"
 */

import { test, expect, type Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { pathToFileURL } from "url";

const DEMO_EMAIL = "demo@wealthme.id";
const DEMO_PASSWORD = "demo1234";

// audit dir -> e2e -> tests -> web -> apps -> repo root
const REPO_ROOT = path.resolve(__dirname, "../../../../..");
const OUT_DIR = path.join(REPO_ROOT, "docs", "ui-audit");
const LIVE_DIR = path.join(OUT_DIR, "live");
const DEMO_DIR = path.join(OUT_DIR, "demo");
const DEMO_HTML = path.join(REPO_ROOT, "docs", "WealthMe_Demo(1).html");

type Viewport = { name: "desktop" | "mobile"; width: number; height: number };
const VIEWPORTS: Viewport[] = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

/**
 * Representative page set. `id` is BOTH the live route (`/<id>`) and the demo
 * view (`#page-<id>` / `nav("<id>")`), which line up one-to-one for this set.
 */
const PAGES: { id: string; label: string }[] = [
  { id: "beranda", label: "Beranda (Dashboard)" },
  { id: "ringkasan", label: "Ringkasan" },
  { id: "transaksi", label: "Transaksi" },
  { id: "anggaran", label: "Anggaran" },
  { id: "laporan", label: "Laporan" },
  { id: "tujuan", label: "Tujuan Keuangan" },
  { id: "rekening", label: "Rekening" },
  { id: "investasi", label: "Investasi" },
  { id: "aset", label: "Aset" },
  { id: "liabilitas", label: "Liabilitas" },
  { id: "ai", label: "AI Advisor" },
  { id: "kalkulator", label: "Kalkulator" },
  { id: "notifikasi", label: "Notifikasi" },
  { id: "akun", label: "Akun" },
];

function ensureDirs() {
  for (const d of [OUT_DIR, LIVE_DIR, DEMO_DIR]) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  }
}

async function login(page: Page) {
  await page.goto("/login");
  await page.waitForSelector('input[type="email"]', { timeout: 15_000 });
  await page.fill('input[type="email"]', DEMO_EMAIL);
  await page.fill('input[type="password"]', DEMO_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(beranda|ringkasan|dana|akun)/, { timeout: 25_000 });
}

const manifest: {
  target: string;
  id: string;
  viewport: string;
  file: string;
}[] = [];

test.describe("WealthMe UI/UX gap-analysis capture", () => {
  // Serial + one shared login: the login endpoint is throttled (5/min), so we
  // authenticate once and reuse the page for every live screenshot.
  test.describe.configure({ mode: "serial" });

  test.beforeAll(() => ensureDirs());

  test.afterAll(() => {
    fs.writeFileSync(
      path.join(OUT_DIR, "manifest.json"),
      JSON.stringify(
        { pages: PAGES, viewports: VIEWPORTS, captures: manifest },
        null,
        2,
      ),
    );
  });

  test("live — capture every page at desktop + mobile", async ({ browser }) => {
    test.setTimeout(420_000);
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page);
    await expect(page).not.toHaveURL(/login/);

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      for (const p of PAGES) {
        try {
          // `domcontentloaded` (not `networkidle`): pages with polling/SSE
          // (ai, investasi, notifications) never go fully idle. Settle with a
          // load-state + fixed wait instead.
          await page.goto(`/${p.id}`, {
            waitUntil: "domcontentloaded",
            timeout: 30_000,
          });
          await page.waitForLoadState("load").catch(() => {});
          await page.waitForTimeout(2500); // let data + chart animations settle
          await page.evaluate(() => document.fonts.ready).catch(() => {});
          const file = path.join(LIVE_DIR, `${p.id}-${vp.name}.png`);
          // Long timeout: full-page shots wait for web fonts, which can exceed
          // the 10s default actionTimeout on data-heavy pages.
          await page.screenshot({
            path: file,
            fullPage: true,
            timeout: 30_000,
          });
          manifest.push({
            target: "live",
            id: p.id,
            viewport: vp.name,
            file: path.relative(REPO_ROOT, file),
          });
        } catch (err) {
          // Capture-and-continue: one bad page must not drop the rest.
          console.error(`live ${p.id} @ ${vp.name} failed:`, err);
        }
      }
    }
    await context.close();
  });

  test("demo — capture every page at desktop + mobile", async ({ browser }) => {
    test.setTimeout(120_000);
    expect(fs.existsSync(DEMO_HTML), `demo HTML missing at ${DEMO_HTML}`).toBe(
      true,
    );
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(pathToFileURL(DEMO_HTML).href, {
      waitUntil: "domcontentloaded",
    });

    // The demo boots on a fixed login overlay; reveal the app shell directly.
    await page.evaluate(() => {
      const lp = document.getElementById("loginPage");
      if (lp) lp.style.display = "none";
      const app =
        document.getElementById("mainApp") ??
        (document.querySelector(".app") as HTMLElement | null);
      app?.classList.add("visible");
    });

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      for (const p of PAGES) {
        try {
          // Drive the demo's own SPA navigation (global `nav(id, el)`).
          await page.evaluate((id) => {
            const w = window as unknown as {
              nav?: (id: string, el: null) => void;
            };
            if (typeof w.nav === "function") {
              w.nav(id, null);
            } else {
              document
                .querySelectorAll(".page")
                .forEach((el) => el.classList.remove("active"));
              document.getElementById(`page-${id}`)?.classList.add("active");
            }
            window.scrollTo(0, 0);
          }, p.id);
          await page.waitForTimeout(500);
          await page.evaluate(() => document.fonts.ready).catch(() => {});
          const file = path.join(DEMO_DIR, `${p.id}-${vp.name}.png`);
          await page.screenshot({
            path: file,
            fullPage: true,
            timeout: 30_000,
          });
          manifest.push({
            target: "demo",
            id: p.id,
            viewport: vp.name,
            file: path.relative(REPO_ROOT, file),
          });
        } catch (err) {
          console.error(`demo ${p.id} @ ${vp.name} failed:`, err);
        }
      }
    }
    await context.close();
  });
});
