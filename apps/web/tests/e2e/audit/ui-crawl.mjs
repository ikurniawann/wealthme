// Deep UI audit crawler: logs in, visits every app route at 3 viewports,
// opens every dialog / menu / tab it can find, fills forms with sample data,
// screenshots each state and records layout defects (overflow, tiny text,
// small touch targets, console errors) into manifest.json.
//
// Usage: BASE_URL=https://wealthme.demo-wit.id node crawl.mjs [route ...]
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "https://wealthme.demo-wit.id";
const OUT = path.resolve(
  process.env.OUT_DIR ??
    path.join(path.dirname(new URL(import.meta.url).pathname), "shots"),
);
const ONLY = process.argv.slice(2);
const SUBMIT = process.env.SUBMIT !== "0";

const ROUTES = [
  "beranda",
  "ringkasan",
  "transaksi",
  "anggaran",
  "laporan",
  "tujuan",
  "rekening",
  "investasi",
  "aset",
  "liabilitas",
  "dana",
  "asuransi",
  "ai",
  "kalkulator",
  "notifikasi",
  "akun",
  "rekonsiliasi",
  "splitbill",
  "warisan",
  "donation",
  "tax",
  "quickinput",
  "masterdata",
  "mastercoa",
  "panduan",
  "persetujuan",
  "akses-saya",
  "iam",
];
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 834, height: 1112 },
  { name: "mobile", width: 390, height: 844 },
];
const POPUP =
  '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [data-slot="popover-content"], [data-slot="dropdown-menu-content"], .dialog, [data-slot="sheet-content"]';
const SKIP_TEXT =
  /keluar|logout|hapus akun|delete account|sign out|ganti tema|tema|theme/i;
const VP_ONLY = process.env.VIEWPORT;

const manifest = [];
let shotSeq = 0;

// The API allows 100 requests per IP per minute. Track every API response
// and pause before the next action whenever the last minute is nearly spent,
// so no page ever degrades into empty states because of a 429.
const apiHits = [];
function trackApi(page) {
  page.on("response", (r) => {
    if (r.url().includes("/api/")) apiHits.push(Date.now());
  });
}
async function budget(page, need = 12) {
  for (;;) {
    const now = Date.now();
    while (apiHits.length && now - apiHits[0] > 61000) apiHits.shift();
    if (apiHits.length + need <= 90) return;
    await page.waitForTimeout(2000);
  }
}

function slug(s) {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "x"
  );
}

async function metrics(page, vp) {
  return page.evaluate(
    ({ mobile }) => {
      const out = {
        overflowX: document.documentElement.scrollWidth - window.innerWidth,
        tinyText: 0,
        smallTargets: [],
        offscreen: [],
      };
      const seen = new Set();
      for (const el of document.querySelectorAll("body *")) {
        const cs = getComputedStyle(el);
        if (cs.visibility === "hidden" || cs.display === "none") continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const fs = parseFloat(cs.fontSize);
        if (
          el.childNodes.length &&
          [...el.childNodes].some(
            (n) => n.nodeType === 3 && n.textContent.trim(),
          ) &&
          fs < 11 &&
          !el.closest(".sr-only")
        )
          out.tinyText++;
        if (
          r.right > window.innerWidth + 1 &&
          r.left < window.innerWidth &&
          cs.position !== "fixed" &&
          !el.closest("[class*=scroll], .overflow-x-auto, table")
        ) {
          const k = el.className?.toString().slice(0, 40);
          if (!seen.has(k)) {
            seen.add(k);
            out.offscreen.push(k || el.tagName);
          }
        }
        if (
          mobile &&
          el.matches(
            "button, a[href], [role=button], input[type=checkbox], input[type=radio]",
          ) &&
          (r.width < 36 || r.height < 36) &&
          r.top >= 0 &&
          r.top < window.innerHeight
        ) {
          const label = (el.getAttribute("aria-label") || el.textContent || "")
            .trim()
            .slice(0, 30);
          if (label)
            out.smallTargets.push(
              `${label} ${Math.round(r.width)}x${Math.round(r.height)}`,
            );
        }
      }
      out.smallTargets = out.smallTargets.slice(0, 8);
      out.offscreen = out.offscreen.slice(0, 6);
      return out;
    },
    { mobile: vp.name === "mobile" },
  );
}

async function shot(page, route, vp, label, extra = {}) {
  const dir = path.join(OUT, route, vp.name);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(
    dir,
    `${String(++shotSeq).padStart(3, "0")}-${slug(label)}.png`,
  );
  try {
    await page.screenshot({
      path: file,
      fullPage: !!extra.fullPage,
      animations: "disabled",
      timeout: 15000,
    });
  } catch (e) {
    return;
  }
  const m = await metrics(page, vp).catch(() => ({}));
  manifest.push({
    route,
    viewport: vp.name,
    label,
    file: path.relative(OUT, file),
    ...m,
    ...extra,
  });
}

// The shell scrolls inside .wm-main on phones/tablets (document height stays
// at the viewport), so fullPage shots only ever show the first screen. Scroll
// whichever box actually scrolls, one viewport at a time, and shoot each stop.
async function scrolledShots(page, route, vp) {
  const info = await page
    .evaluate(() => {
      const cands = [
        document.scrollingElement,
        document.querySelector(".wm-main"),
        document.querySelector("main"),
      ].filter(Boolean);
      for (const el of cands)
        if (el.scrollHeight - el.clientHeight > 80)
          return {
            sel:
              el === document.scrollingElement
                ? "doc"
                : el.className
                  ? "." + el.className.split(" ")[0]
                  : el.tagName.toLowerCase(),
            h: el.clientHeight,
            sh: el.scrollHeight,
          };
      return null;
    })
    .catch(() => null);
  if (!info) return;
  const steps = Math.min(Math.ceil(info.sh / info.h) - 1, 6);
  for (let i = 1; i <= steps; i++) {
    await page.evaluate(
      ({ sel, y }) => {
        const el =
          sel === "doc"
            ? document.scrollingElement
            : document.querySelector(sel);
        el.scrollTo({ top: y, behavior: "instant" });
      },
      { sel: info.sel, y: i * (info.h - 60) },
    );
    await page.waitForTimeout(500);
    await shot(page, route, vp, `page scroll ${i}`);
  }
  await page
    .evaluate(
      ({ sel }) => {
        const el =
          sel === "doc"
            ? document.scrollingElement
            : document.querySelector(sel);
        el.scrollTo({ top: 0, behavior: "instant" });
      },
      { sel: info.sel },
    )
    .catch(() => {});
  await page.waitForTimeout(300);
}

async function dismissWalkthrough(page) {
  for (const t of ["Lewati", "Skip", "Mulai", "Tutup", "Selesai"]) {
    const b = page.locator(`[role=dialog] button:has-text("${t}")`).first();
    if (await b.isVisible().catch(() => false)) {
      await b.click().catch(() => {});
      await page.waitForTimeout(300);
    }
  }
}

async function closePopups(page) {
  for (let i = 0; i < 3; i++) {
    const open = await page.locator(POPUP).filter({ visible: true }).count();
    if (!open) return;
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(250);
  }
  const closeBtn = page
    .locator(
      '[role=dialog] button[aria-label*="utup" i], [role=dialog] button:has(.sr-only:has-text("Tutup"))',
    )
    .first();
  if (await closeBtn.isVisible().catch(() => false))
    await closeBtn.click().catch(() => {});
}

async function fillForm(scope) {
  const today = new Date().toISOString().slice(0, 10);
  const inputs = scope.locator(
    "input:visible:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]):not([readonly]):not([disabled])",
  );
  const n = await inputs.count();
  for (let i = 0; i < Math.min(n, 12); i++) {
    const el = inputs.nth(i);
    const type = (await el.getAttribute("type")) || "text";
    const name = (
      (await el.getAttribute("name")) ||
      (await el.getAttribute("placeholder")) ||
      (await el.getAttribute("aria-label")) ||
      ""
    ).toLowerCase();
    const mode = (await el.getAttribute("inputmode")) || "";
    let v = "Audit QA " + (i + 1);
    if (
      type === "number" ||
      mode === "numeric" ||
      mode === "decimal" ||
      /jumlah|nominal|amount|harga|saldo|rp|nilai|qty|persen|rate|bunga|tenor/.test(
        name,
      )
    )
      v = "1250000";
    if (type === "date" || /tanggal|date/.test(name)) v = today;
    if (type === "email" || /email/.test(name)) v = "qa@wealthme.id";
    if (type === "password") v = "Password123!";
    if (type === "tel" || /telepon|phone|hp/.test(name)) v = "081234567890";
    if (type === "month") v = today.slice(0, 7);
    if (type === "color" || type === "range") continue;
    await el.fill(v).catch(() => {});
  }
  const selects = scope.locator("select:visible:not([disabled])");
  for (let i = 0; i < Math.min(await selects.count(), 8); i++) {
    const s = selects.nth(i);
    const opts = await s
      .locator("option")
      .evaluateAll((os) => os.map((o) => ({ v: o.value, d: o.disabled })));
    const pick =
      opts.filter((o) => o.v && !o.d)[1] ?? opts.filter((o) => o.v && !o.d)[0];
    if (pick) await s.selectOption(pick.v).catch(() => {});
  }
  const tas = scope.locator("textarea:visible:not([disabled])");
  for (let i = 0; i < Math.min(await tas.count(), 4); i++)
    await tas
      .nth(i)
      .fill("Catatan uji QA — pengisian data manual.")
      .catch(() => {});
}

async function exerciseTabs(page, route, vp) {
  const tabs = page
    .locator(
      "main [role=tab], main .wm-seg button, main .segmented__item, main [role=tablist] button",
    )
    .filter({ visible: true });
  const n = Math.min(await tabs.count(), 10);
  const seen = new Set();
  for (let i = 0; i < n; i++) {
    const t = tabs.nth(i);
    const txt = ((await t.textContent().catch(() => "")) || "").trim();
    if (!txt || seen.has(txt)) continue;
    seen.add(txt);
    await budget(page, 8);
    await t.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(700);
    await shot(page, route, vp, `tab ${txt}`);
  }
}

async function exerciseSelects(page, route, vp) {
  const selects = page.locator("main select").filter({ visible: true });
  const n = Math.min(await selects.count(), 2);
  for (let i = 0; i < n; i++) {
    const s = selects.nth(i);
    if (
      await s
        .evaluate((el) => !!el.closest("[role=dialog], form"))
        .catch(() => true)
    )
      continue;
    const opts = await s
      .locator("option")
      .evaluateAll((os) =>
        os.map((o) => ({ v: o.value, t: o.textContent.trim(), d: o.disabled })),
      );
    const live = opts.filter((o) => o.v && !o.d).slice(0, 14);
    if (live.length < 2) continue;
    for (const o of live) {
      await budget(page, 10);
      await s.selectOption(o.v).catch(() => {});
      await page.waitForTimeout(800);
      await shot(page, route, vp, `select ${o.t}`);
    }
  }
}

async function exerciseOpeners(page, route, vp, startUrl) {
  const sel =
    route === "beranda"
      ? "main button, main [role=button], main a[aria-haspopup], header button, .wm-dock button, .wm-dock [role=button], .wm-dock a"
      : "main button, main [role=button], main a[aria-haspopup]";
  const openers = page.locator(sel).filter({ visible: true });
  const n = Math.min(await openers.count(), 30);
  const seen = new Set();
  let navs = 0;
  for (let i = 0; i < n; i++) {
    const b = openers.nth(i);
    const label = (
      (await b.getAttribute("aria-label", { timeout: 2000 }).catch(() => "")) ||
      (await b.textContent({ timeout: 2000 }).catch(() => "")) ||
      ""
    )
      .trim()
      .replace(/\s+/g, " ");
    if (!label || label.length > 60 || seen.has(label) || SKIP_TEXT.test(label))
      continue;
    if (
      await b
        .evaluate(
          (el) =>
            !!el.closest(
              "[role=tab], [role=tablist], .wm-seg, .segmented, table, [role=dialog]",
            ),
        )
        .catch(() => true)
    )
      continue;
    seen.add(label);
    const before = page.url();
    await page
      .evaluate(() =>
        document.querySelectorAll("[data-sonner-toast]").forEach((x) => {
          x.style.display = "none";
        }),
      )
      .catch(() => {});
    await budget(page, 8);
    if (
      navs >= 3 &&
      (await b
        .evaluate((el) => el.tagName === "A" || !!el.closest("li, tr, article"))
        .catch(() => false))
    )
      continue;
    await b.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
    await b.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(600);
    const popup = page.locator(POPUP).filter({ visible: true }).last();
    if (await popup.count()) {
      const kind = await popup
        .evaluate(
          (el) =>
            el.getAttribute("role") || el.className.toString().slice(0, 20),
        )
        .catch(() => "popup");
      await shot(page, route, vp, `${label} ${kind} open`);
      const hasForm = await popup
        .locator("input:visible, select:visible, textarea:visible")
        .count();
      if (hasForm) {
        const submit = popup
          .locator(
            'button[type=submit], button:has-text("Simpan"), button:has-text("Tambah"), button:has-text("Catat"), button:has-text("Kirim"), button:has-text("Bayar"), button:has-text("Buat")',
          )
          .last();
        if (await submit.isVisible().catch(() => false)) {
          await submit.click({ timeout: 3000 }).catch(() => {});
          await page.waitForTimeout(500);
          if (await popup.isVisible().catch(() => false))
            await shot(page, route, vp, `${label} validation`);
        }
        if (await popup.isVisible().catch(() => false)) {
          await fillForm(popup);
          await shot(page, route, vp, `${label} filled`);
          if (
            SUBMIT &&
            vp.name === "desktop" &&
            (await submit.isVisible().catch(() => false))
          ) {
            await submit.click({ timeout: 3000 }).catch(() => {});
            await page.waitForTimeout(1200);
            await shot(page, route, vp, `${label} submitted`, {
              toast: await page
                .locator("[data-sonner-toast], [role=status]")
                .allTextContents()
                .catch(() => []),
            });
          }
        }
      }
      await closePopups(page);
    } else if (page.url() !== before) {
      await page.waitForTimeout(800);
      navs++;
      await shot(page, route, vp, `nav ${label}`, { navigatedTo: page.url() });
      await page
        .goto(startUrl, { waitUntil: "domcontentloaded" })
        .catch(() => {});
      await page.waitForTimeout(900);
    } else {
      // state toggle (expand, filter, etc.) — capture only if something changed
      await shot(page, route, vp, `click ${label}`);
    }
    await closePopups(page);
  }
}

async function run() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const ctx0 = await browser.newContext({ viewport: VIEWPORTS[0] });
  const p0 = await ctx0.newPage();
  for (let attempt = 1; attempt <= 3; attempt++) {
    await p0.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await p0.fill('input[type="email"]', "demo@wealthme.id");
    await p0.fill('input[type="password"]', "demo1234");
    await p0.click('button[type="submit"]');
    const ok = await p0
      .waitForURL(/\/(beranda|ringkasan|dana|akun)/, {
        timeout: 45000,
        waitUntil: "commit",
      })
      .then(() => true)
      .catch(() => false);
    if (ok) break;
    if (attempt === 3) throw new Error("login failed after 3 attempts");
    await p0.waitForTimeout(3000 * attempt);
  }
  const state = await ctx0.storageState();
  await ctx0.close();

  const routes = ONLY.length ? ONLY : ROUTES;
  for (const vp of VIEWPORTS.filter((v) => !VP_ONLY || v.name === VP_ONLY)) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      storageState: state,
      isMobile: vp.name !== "desktop",
      hasTouch: vp.name !== "desktop",
      deviceScaleFactor: 1,
      reducedMotion: "reduce",
    });
    for (const route of routes)
      for (let attempt = 1; attempt <= 3; attempt++) {
        const page = await ctx.newPage();
        const errors = [];
        let got429 = false;
        page.on("console", (m) => {
          if (m.type() === "error") errors.push(m.text().slice(0, 160));
        });
        page.on("pageerror", (e) =>
          errors.push("pageerror: " + String(e).slice(0, 160)),
        );
        page.on("response", (r) => {
          if (r.status() === 429) got429 = true;
        });
        trackApi(page);
        const url = `${BASE}/${route}`;
        const watchdog = new Promise((_, rej) =>
          setTimeout(
            () => rej(new Error("route watchdog 8min")),
            8 * 60 * 1000,
          ),
        );
        try {
          await Promise.race([
            watchdog,
            (async () => {
              await budget(page, 25);
              await page.goto(url, {
                waitUntil: "domcontentloaded",
                timeout: 45000,
              });
              await page.waitForTimeout(1800);
              await dismissWalkthrough(page);
              await shot(page, route, vp, "page");
              await scrolledShots(page, route, vp);
              await exerciseTabs(page, route, vp);
              await exerciseSelects(page, route, vp);
              await exerciseOpeners(page, route, vp, url);
            })(),
          ]);
        } catch (e) {
          manifest.push({
            route,
            viewport: vp.name,
            label: "ERROR",
            error: String(e).slice(0, 200),
          });
        }
        await page.close();
        if (got429 && attempt < 3) {
          // Rate-limited by the API (100 req/min): the shots would show empty
          // states that are not real. Drop them, cool down, redo the route.
          for (let i = manifest.length - 1; i >= 0; i--)
            if (manifest[i].route === route && manifest[i].viewport === vp.name)
              manifest.splice(i, 1);
          fs.rmSync(path.join(OUT, route, vp.name), {
            recursive: true,
            force: true,
          });
          console.log(
            `${vp.name} ${route}: 429, cooling down (attempt ${attempt})`,
          );
          await new Promise((r) => setTimeout(r, 70000));
          continue;
        }
        if (errors.length)
          manifest.push({
            route,
            viewport: vp.name,
            label: "console",
            errors: [...new Set(errors)].slice(0, 10),
          });
        fs.writeFileSync(
          path.join(OUT, `manifest-${VP_ONLY ?? "all"}.json`),
          JSON.stringify(manifest, null, 1),
        );
        console.log(
          `${vp.name} ${route}: ${manifest.filter((m) => m.route === route && m.viewport === vp.name).length} shots`,
        );
        break;
      }
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(
    path.join(OUT, `manifest-${VP_ONLY ?? "all"}.json`),
    JSON.stringify(manifest, null, 1),
  );
}
run().catch((e) => {
  console.error(e);
  process.exit(1);
});
