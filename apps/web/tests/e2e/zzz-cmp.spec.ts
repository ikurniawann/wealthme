import { test } from "@playwright/test";
import path from "path";

const OUT =
  "/tmp/claude-1000/-home-wit-WORK-vibes-wealthme-web/701e730d-ed0e-4f62-81cc-7cfeb6123dd8/scratchpad/cmp";
const PROTO = "/home/wit/WORK/vibes/wealthme-web/docs/prototype/pages";
const PAGES = [
  "beranda",
  "ringkasan",
  "transaksi",
  "anggaran",
  "laporan",
  "aset",
  "investasi",
  "liabilitas",
  "tujuan",
  "rekening",
];

test("compare live vs prototype", async ({ page, context }) => {
  test.setTimeout(300000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("https://wealthme.demo-wit.id/login");
  await page.waitForLoadState("networkidle");
  await page.locator("#email").fill("demo@wealthme.id");
  await page.locator("#password").fill("demo1234");
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.includes("/login"), {
    timeout: 20000,
  });
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
  }

  for (const p of PAGES) {
    await page.goto(`https://wealthme.demo-wit.id/${p}`);
    await page.waitForLoadState("networkidle");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${OUT}/live-${p}.png`, fullPage: false });
  }

  const proto = await context.newPage();
  await proto.setViewportSize({ width: 1440, height: 900 });
  for (const p of PAGES) {
    await proto.goto(`file://${path.join(PROTO, `${p}.html`)}`);
    await proto.waitForTimeout(1200);
    await proto.screenshot({ path: `${OUT}/proto-${p}.png`, fullPage: false });
  }
});
