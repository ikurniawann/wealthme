#!/usr/bin/env node
// Peak memory of a page in WebKit (Safari's engine) at iPhone size: a proxy for the
// "A problem repeatedly occurred" tab reloads that desktop Chrome can't reproduce.
// Samples phys_footprint (what iOS uses to kill tabs) of every WebKit process the run
// starts, GPU process included; ps/RSS misses the GPU-side memory where bitmaps live.
// macOS only (uses /usr/bin/footprint). Shares the Playwright install with measure.mjs.
//
// Usage: node webkit-memory.mjs <url> [--scroll <px>] [--runs <n> (default 3)] [--settle <ms>] [--label <name>] [--out <dir>]
//   Scrolls down <px>, back up, and down again (default 6000), sampling every 300 ms.
//   GPU memory is noisy: compare medians, and don't run other WebKit instances at the same time
//   (any WebKit process started during a run is counted).

import { execSync, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";

const argv = process.argv.slice(2);
const opt = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 ? argv[i + 1] : d;
};
const url = argv.find(
  (a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"),
);
if (!url || argv.includes("--help")) {
  console.log(
    "usage: node webkit-memory.mjs <url> [--scroll 6000] [--runs 3] [--settle 6000] [--label run] [--out perf]",
  );
  process.exit(url ? 0 : 1);
}
if (platform() !== "darwin" || !existsSync("/usr/bin/footprint")) {
  console.error(
    "webkit-memory: needs macOS (/usr/bin/footprint). Use Safari Web Inspector on a device instead.",
  );
  process.exit(1);
}
const scroll = Number(opt("scroll", 6000)),
  runs = Number(opt("runs", 3)),
  settle = Number(opt("settle", 6000));
const outDir = join(opt("out", "perf"), opt("label", "run"));

const DEPS =
  process.env.OPTIMIZE_DEPS || join(homedir(), ".cache", "optimize-skill");
const req = createRequire(join(DEPS, "package.json"));
try {
  req.resolve("playwright");
} catch {
  console.error(
    `webkit-memory: run measure.mjs once first (it installs Playwright into ${DEPS})`,
  );
  process.exit(1);
}
const { webkit } = req("playwright");

const webkitPids = () =>
  new Set(
    execSync(
      "ps -ax -o pid=,command= | grep -i 'ms-playwright/webkit' | grep -v grep || true",
    )
      .toString()
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((l) => +l.trim().split(/\s+/)[0]),
  );
function footprint(pids) {
  const r = { total: 0, webContent: 0, gpu: 0 };
  if (!pids.size) return r;
  let out = "";
  try {
    out = execSync(
      `footprint ${[...pids].map((p) => `-p ${p}`).join(" ")} 2>/dev/null`,
      { timeout: 5000 },
    ).toString();
  } catch (e) {
    out = e.stdout?.toString() || "";
  }
  for (const m of out.matchAll(
    /^(.*?) \[(\d+)\].*?Footprint: ([\d.]+) (KB|MB|GB)/gm,
  )) {
    const mb = +m[3] * (m[4] === "GB" ? 1024 : m[4] === "KB" ? 1 / 1024 : 1);
    r.total += mb;
    if (/WebContent|WebProcess/i.test(m[1])) r.webContent += mb;
    else if (/GPU/i.test(m[1])) r.gpu += mb;
  }
  return r;
}

const peaks = [];
for (let i = 0; i < runs; i++) {
  process.stderr.write(`webkit-memory: run ${i + 1}/${runs}…\n`);
  const before = webkitPids();
  let browser;
  try {
    browser = await webkit.launch();
  } catch {
    spawnSync(
      process.execPath,
      [join(DEPS, "node_modules/playwright/cli.js"), "install", "webkit"],
      { stdio: "inherit" },
    );
    browser = await webkit.launch();
  }
  const page = await (
    await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    })
  ).newPage();
  await page.goto(url, { waitUntil: "load", timeout: 180000 }).catch(() => {});
  await page.waitForTimeout(settle);
  const mine = new Set([...webkitPids()].filter((p) => !before.has(p)));
  const peak = { total: 0, webContent: 0, gpu: 0 };
  let busy = false;
  const timer = setInterval(() => {
    if (busy) return;
    busy = true;
    const s = footprint(mine);
    busy = false;
    for (const k in peak) peak[k] = Math.max(peak[k], s[k]);
  }, 300);
  await page.evaluate(async (px) => {
    const go = (to) =>
      new Promise((res) => {
        const step = () => {
          const d = to - scrollY;
          if (Math.abs(d) < 40) {
            scrollTo(0, to);
            return res();
          }
          scrollBy(0, Math.sign(d) * 40);
          requestAnimationFrame(step);
        };
        step();
      });
    const pause = (ms) => new Promise((r) => setTimeout(r, ms));
    await go(px);
    await pause(800);
    await go(0);
    await pause(800);
    await go(px);
    await pause(1500);
  }, scroll);
  clearInterval(timer);
  await browser.close();
  peaks.push(
    Object.fromEntries(
      Object.entries(peak).map(([k, v]) => [k, Math.round(v)]),
    ),
  );
}

const med = (k) => {
  const v = peaks.map((p) => p[k]).sort((a, b) => a - b);
  return v[Math.floor(v.length / 2)];
};
const summary = {
  url,
  engine: "webkit",
  viewport: "390x844@3x",
  scroll,
  runs,
  metric: "phys_footprint MB (peak per run)",
  peaks,
  median: {
    total: med("total"),
    webContent: med("webContent"),
    gpu: med("gpu"),
  },
  note: "Mac WebKit proxy for iOS memory pressure; compare before/after, never quote as the iPhone limit.",
};
mkdirSync(outDir, { recursive: true });
writeFileSync(
  join(outDir, "webkit-memory.json"),
  JSON.stringify(summary, null, 2),
);
console.log(
  `peak footprint (MB) per run: ${peaks.map((p) => `${p.total} [WebContent ${p.webContent}, GPU ${p.gpu}]`).join("  |  ")}`,
);
console.log(
  `median total ${summary.median.total} MB → saved ${join(outDir, "webkit-memory.json")}`,
);
