/**
 * Full-menu E2E audit — visits every sidebar page, captures screenshots,
 * checks for error banners and empty states, and writes a JSON report.
 *
 * Run:  npx playwright test menu-audit --reporter=list
 */

import { test, expect, type Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const DEMO_EMAIL = "demo@wealthme.id";
const DEMO_PASSWORD = "demo1234";

const MENUS = [
  { id: "beranda", label: "Beranda", url: "/beranda" },
  { id: "ringkasan", label: "Ringkasan", url: "/ringkasan" },
  { id: "transaksi", label: "Transaksi", url: "/transaksi" },
  { id: "anggaran", label: "Anggaran", url: "/anggaran" },
  { id: "laporan-rsum", label: "Laporan: Ringkasan", url: "/laporan?tab=rsum" },
  {
    id: "laporan-rharian",
    label: "Laporan: Harian",
    url: "/laporan?tab=rharian",
  },
  {
    id: "laporan-rbulanan",
    label: "Laporan: Bulanan",
    url: "/laporan?tab=rbulanan",
  },
  {
    id: "laporan-rtahunan",
    label: "Laporan: Tahunan",
    url: "/laporan?tab=rtahunan",
  },
  {
    id: "laporan-rfamily",
    label: "Laporan: Group Family",
    url: "/laporan?tab=rfamily",
  },
  { id: "laporan-rbank", label: "Laporan: Bank", url: "/laporan?tab=rbank" },
  {
    id: "laporan-rdetail",
    label: "Laporan: Detail",
    url: "/laporan?tab=rdetail",
  },
  {
    id: "laporan-raliran",
    label: "Laporan: Aliran Dana",
    url: "/laporan?tab=raliran",
  },
  { id: "laporan-rpnl", label: "Laporan: PNL", url: "/laporan?tab=rpnl" },
  {
    id: "laporan-rbalance",
    label: "Laporan: Balance Sheet",
    url: "/laporan?tab=rbalance",
  },
  {
    id: "laporan-rcashflow",
    label: "Laporan: Cashflow",
    url: "/laporan?tab=rcashflow",
  },
  { id: "laporan-rkas", label: "Laporan: Arus Kas", url: "/laporan?tab=rkas" },
  { id: "laporan-rinv", label: "Laporan: Investasi", url: "/laporan?tab=rinv" },
  {
    id: "laporan-rasl",
    label: "Laporan: Aset & Liabilitas",
    url: "/laporan?tab=rasl",
  },
  {
    id: "laporan-rperf",
    label: "Laporan: Performa",
    url: "/laporan?tab=rperf",
  },
  { id: "laporan-rpajak", label: "Laporan: Pajak", url: "/laporan?tab=rpajak" },
  { id: "tujuan", label: "Tujuan Keuangan", url: "/tujuan" },
  { id: "notifikasi", label: "Notifikasi", url: "/notifikasi" },
  { id: "dana", label: "Dana", url: "/dana" },
  { id: "rekening", label: "Rekening", url: "/rekening" },
  { id: "investasi", label: "Investasi", url: "/investasi" },
  { id: "aset", label: "Aset", url: "/aset" },
  { id: "liabilitas", label: "Liabilitas", url: "/liabilitas" },
  { id: "asuransi", label: "Asuransi", url: "/asuransi" },
  { id: "warisan", label: "Warisan", url: "/warisan" },
  { id: "donasi", label: "Donasi & Zakat", url: "/donasi" },
  { id: "tax-center", label: "Tax Center", url: "/tax-center" },
  { id: "split-bill", label: "Split Bill", url: "/split-bill" },
  { id: "rekonsiliasi", label: "Rekonsiliasi Bank", url: "/rekonsiliasi" },
  { id: "ai-advisor", label: "AI Advisor", url: "/ai-advisor" },
  { id: "kalkulator", label: "Kalkulator", url: "/kalkulator" },
  { id: "quick-input", label: "Quick Input", url: "/quick-input" },
  { id: "setup", label: "Setup Master Data", url: "/setup" },
  { id: "akun", label: "Akun", url: "/akun" },
];

const ERROR_PATTERNS = [
  "Gagal memuat",
  "Coba muat ulang",
  "Terjadi kesalahan",
  "Error loading",
  "internal server error",
  "application error",
  "page not found",
  "404 not found",
];
const PLACEHOLDER_PATTERNS = [
  "dalam pengembangan",
  "belum tersedia",
  "Coming Soon",
  "Segera Hadir",
  "Fitur ini",
  "🚧",
];

type MenuResult = {
  id: string;
  label: string;
  url: string;
  status: "ok" | "error" | "placeholder" | "empty";
  issues: string[];
  consoleErrors: string[];
  screenshot: string;
};

const REPORT_DIR = "/tmp/wealthme-e2e-audit";

async function login(page: Page) {
  await page.goto("/login");
  await page.waitForSelector('input[type="email"]', { timeout: 15_000 });
  await page.fill('input[type="email"]', DEMO_EMAIL);
  await page.fill('input[type="password"]', DEMO_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(beranda|ringkasan|dana|akun)/, { timeout: 25_000 });
}

async function auditPage(
  page: Page,
  menu: (typeof MENUS)[number],
): Promise<MenuResult> {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 250));
  });

  await page.goto(menu.url, { waitUntil: "networkidle", timeout: 30_000 });
  await page.waitForTimeout(2000);

  const bodyText = await page.evaluate(() => document.body.innerText);
  const issues: string[] = [];

  for (const p of ERROR_PATTERNS) {
    if (bodyText.toLowerCase().includes(p.toLowerCase()))
      issues.push(`ERROR: "${p}"`);
  }
  for (const p of PLACEHOLDER_PATTERNS) {
    if (bodyText.toLowerCase().includes(p.toLowerCase()))
      issues.push(`PLACEHOLDER: "${p}"`);
  }

  const hasContent = await page.evaluate(() => {
    const main = document.querySelector("main") ?? document.body;
    const interactive = main.querySelectorAll(
      "[class*='card'], table, ul li, [class*='row'], [class*='item']",
    ).length;
    return (
      interactive > 1 || (main as HTMLElement).innerText.trim().length > 400
    );
  });
  if (!hasContent) issues.push("EMPTY: no meaningful content");

  const ssFile = path.join(REPORT_DIR, `${menu.id}.png`);
  await page.screenshot({ path: ssFile, fullPage: true });

  let status: MenuResult["status"] = "ok";
  if (issues.some((i) => i.startsWith("ERROR"))) status = "error";
  else if (issues.some((i) => i.startsWith("PLACEHOLDER")))
    status = "placeholder";
  else if (issues.some((i) => i.startsWith("EMPTY"))) status = "empty";

  return {
    id: menu.id,
    label: menu.label,
    url: menu.url,
    status,
    issues,
    consoleErrors: consoleErrors.slice(0, 5),
    screenshot: ssFile,
  };
}

test.describe("WealthMe Full-Menu E2E Audit", () => {
  test.beforeAll(() => {
    if (!fs.existsSync(REPORT_DIR))
      fs.mkdirSync(REPORT_DIR, { recursive: true });
  });

  test("login sanity — demo user can access app", async ({ page }) => {
    await login(page);
    await expect(page).not.toHaveURL(/login/);
  });

  for (const menu of MENUS) {
    test(`[audit] ${menu.label}`, async ({ page }) => {
      await login(page);
      const result = await auditPage(page, menu);
      // Write per-test file so parallel workers don't lose data
      fs.writeFileSync(
        path.join(REPORT_DIR, `result-${menu.id}.json`),
        JSON.stringify(result),
      );
      const icon =
        result.status === "ok"
          ? "✅"
          : result.status === "error"
            ? "❌"
            : result.status === "placeholder"
              ? "🚧"
              : "⬜";
      const detail = result.issues.length
        ? ` — ${result.issues.join("; ")}`
        : "";
      console.log(`${icon}  ${menu.label}${detail}`);
    });
  }

  test.afterAll(() => {
    // Aggregate all per-test result files
    const files = fs
      .readdirSync(REPORT_DIR)
      .filter((f) => f.startsWith("result-"));
    const results: MenuResult[] = files.map(
      (f) =>
        JSON.parse(
          fs.readFileSync(path.join(REPORT_DIR, f), "utf-8"),
        ) as MenuResult,
    );
    if (results.length === 0) return;

    const reportPath = path.join(REPORT_DIR, "audit-report.json");
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));

    const byStatus = { ok: 0, error: 0, placeholder: 0, empty: 0 };
    for (const r of results) byStatus[r.status]++;
    console.log("\n═══════ FINAL AUDIT SUMMARY ═══════");
    console.log(`✅  OK:          ${byStatus.ok}`);
    console.log(`❌  Errors:      ${byStatus.error}`);
    console.log(`🚧  Placeholder: ${byStatus.placeholder}`);
    console.log(`⬜  Empty:       ${byStatus.empty}`);
    console.log(`📄  ${reportPath}`);
  });
});
