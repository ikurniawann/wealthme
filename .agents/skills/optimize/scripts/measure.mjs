#!/usr/bin/env node
// Repeatable performance measurement for the optimize skill.
// Runs cold-cache passes of one URL + flow on a throttled profile and writes
// <out>/<label>/summary.json (median, min, max per metric) and runs.json (raw).
// Dependencies (playwright, web-vitals) install once into ~/.cache/optimize-skill,
// never into the project. Nothing is sent anywhere except requests to <url>.

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const HELP = `Usage: node measure.mjs <url> [options]

  --label <name>       results folder name, e.g. before, after-1        (default: run)
  --out <dir>          parent folder for results                         (default: perf)
  --profile <p>        mobile | desktop                                  (default: mobile)
  --cpu <n>            CPU slowdown factor               (default: 4 mobile, 1 desktop)
  --network <n>        slow4g | desktop | none   (default: slow4g mobile, desktop desktop)
  --runs <n>           measured runs; medians are reported               (default: 5)
  --warmup <n>         discarded runs first                              (default: 1)
  --settle <ms>        wait after load before the flow, so the intro plays (default: 3000)
  --do <step>          flow step, repeatable, runs in order:
                         click:<selector>   hover:<selector>   key:<Key>
                         type:<selector>=<text>   scroll:<px>   wait:<ms>
                       With no --do, the flow is a 3 s idle window (catches loops that never stop).
  --capture            extra unmeasured pass: video, intro filmstrip, and --shots stills
  --shots <y,y,...>    stills at these scroll offsets (implies --capture)
  --reduced-motion     emulate prefers-reduced-motion: reduce
  --headed             visible browser: real GPU path for blur/WebGL-heavy pages
  --keep-trace         save a full DevTools trace of the flow (slower; open it in the Performance panel)
  --load-timeout <ms>  stop waiting for the load event after this long     (default: 60000)
`;

const DEPS =
  process.env.OPTIMIZE_DEPS || join(homedir(), ".cache", "optimize-skill");
const VALUE_FLAGS = [
  "label",
  "out",
  "profile",
  "cpu",
  "network",
  "runs",
  "warmup",
  "settle",
  "do",
  "shots",
  "load-timeout",
];
const BOOL_FLAGS = ["capture", "reduced-motion", "headed", "keep-trace"];
const STEP_KINDS = ["click", "hover", "key", "type", "scroll", "wait"];

const PROFILES = {
  mobile: {
    viewport: { width: 412, height: 823 },
    deviceScaleFactor: 1.75,
    isMobile: true,
    hasTouch: true,
    cpu: 4,
    network: "slow4g",
  },
  desktop: {
    viewport: { width: 1350, height: 940 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
    cpu: 1,
    network: "desktop",
  },
};
// Request-level throttling, same as DevTools' presets (Lighthouse's RTT x3.75, throughput x0.9).
const NETWORKS = {
  slow4g: {
    latency: 562.5,
    downloadThroughput: 180_000,
    uploadThroughput: 84_375,
  },
  desktop: {
    latency: 150,
    downloadThroughput: 1_125_000,
    uploadThroughput: 1_125_000,
  },
  none: null,
};

const die = (msg) => {
  console.error(`measure: ${msg}\n\n${HELP}`);
  process.exit(1);
};

// ---------- arguments ----------
const args = { do: [] };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "-h" || a === "--help") {
    console.log(HELP);
    process.exit(0);
  }
  if (!a.startsWith("--")) {
    if (args.url) die(`unexpected argument "${a}"`);
    args.url = a;
    continue;
  }
  const key = a.slice(2);
  if (BOOL_FLAGS.includes(key)) {
    args[key] = true;
    continue;
  }
  if (!VALUE_FLAGS.includes(key)) die(`unknown option ${a}`);
  const val = argv[++i];
  if (val === undefined) die(`${a} needs a value`);
  if (key === "do") args.do.push(val);
  else args[key] = val;
}
if (!args.url) die("missing <url>");

const profileName = args.profile || "mobile";
const profile =
  PROFILES[profileName] || die(`unknown profile "${profileName}"`);
const cpu = Number(args.cpu ?? profile.cpu);
const networkName = args.network || profile.network;
if (!(networkName in NETWORKS)) die(`unknown network "${networkName}"`);
const runs = Number(args.runs ?? 5);
const warmup = Number(args.warmup ?? 1);
const settle = Number(args.settle ?? 3000);
const loadTimeout = Number(args["load-timeout"] ?? 60000);
const shots = args.shots ? args.shots.split(",").map(Number) : [];
const capture = args.capture || shots.length > 0;
const steps = (args.do.length ? args.do : ["wait:3000"]).map((s) => {
  const i = s.indexOf(":");
  const kind = s.slice(0, i),
    arg = s.slice(i + 1);
  if (i < 0 || !STEP_KINDS.includes(kind)) die(`bad --do step "${s}"`);
  return { kind, arg };
});
const interactive = steps.some((s) =>
  ["click", "hover", "key", "type"].includes(s.kind),
);
const outDir = join(args.out || "perf", args.label || "run");

// ---------- dependencies ----------
const req = createRequire(join(DEPS, "package.json"));
const WV_PATH = join(
  DEPS,
  "node_modules/web-vitals/dist/web-vitals.attribution.iife.js",
);
function haveDeps() {
  try {
    req.resolve("playwright");
    return existsSync(WV_PATH);
  } catch {
    return false;
  }
}
if (!haveDeps()) {
  console.error(
    `measure: installing playwright + web-vitals into ${DEPS} (one time)…`,
  );
  mkdirSync(DEPS, { recursive: true });
  if (!existsSync(join(DEPS, "package.json")))
    writeFileSync(join(DEPS, "package.json"), '{ "private": true }\n');
  const r = spawnSync(
    "npm",
    [
      "install",
      "--no-audit",
      "--no-fund",
      "--loglevel=error",
      "playwright@1",
      "web-vitals@6",
    ],
    { cwd: DEPS, stdio: "inherit" },
  );
  if (r.status !== 0 || !haveDeps()) die(`npm install failed in ${DEPS}`);
}
const { chromium } = req("playwright");

// Injected before any page script: web-vitals (attribution build) + LoAF, frame and animation collectors.
const INIT =
  readFileSync(WV_PATH, "utf8") +
  `
;(() => {
  const o = window.__opt = { wv: {}, loaf: [], animNames: new Set(), frames: null };
  const R = { reportAllChanges: true };
  webVitals.onLCP((m) => { const a = m.attribution; o.wv.LCP = { value: m.value, target: a.target, url: a.url,
    ttfb: a.timeToFirstByte, loadDelay: a.resourceLoadDelay, loadDuration: a.resourceLoadDuration, renderDelay: a.elementRenderDelay }; }, R);
  webVitals.onCLS((m) => { o.wv.CLS = { value: m.value, target: m.attribution.largestShiftTarget }; }, R);
  webVitals.onINP((m) => { const a = m.attribution, ls = a.longestScript;
    o.wv.INP = { value: m.value, target: a.interactionTarget, type: a.interactionType, inputDelay: a.inputDelay,
      processing: a.processingDuration, presentation: a.presentationDelay,
      longestScript: ls ? { subpart: ls.subpart, ms: Math.round(ls.intersectingDuration), src: ls.entry && ls.entry.sourceURL,
        invoker: ls.entry && ls.entry.invoker, fn: ls.entry && ls.entry.sourceFunctionName } : null }; },
    { reportAllChanges: true, durationThreshold: 16 });
  try {
    new PerformanceObserver((list) => { for (const e of list.getEntries()) o.loaf.push({ start: e.startTime, duration: e.duration,
      blocking: e.blockingDuration, scripts: e.scripts.map((s) => ({ src: s.sourceURL, invoker: s.invoker, fn: s.sourceFunctionName,
        ms: s.duration, forcedLayoutMs: s.forcedStyleAndLayoutDuration })) }); })
      .observe({ type: 'long-animation-frame', buffered: true });
  } catch {}
  const onAnim = (e) => o.animNames.add(e.animationName || 'transition:' + e.propertyName);
  addEventListener('animationstart', onAnim, true);
  addEventListener('transitionstart', onAnim, true);
  o.startFrames = () => { o.frames = []; let last = performance.now();
    const tick = (t) => { o.frames.push(t - last); last = t; o.raf = requestAnimationFrame(tick); };
    o.raf = requestAnimationFrame(tick); };
  o.stopFrames = () => { cancelAnimationFrame(o.raf); const f = (o.frames || []).slice(1); o.frames = null; return f; };
  o.inventory = () => ({
    scrollTriggers: window.ScrollTrigger ? ScrollTrigger.getAll().length : null,
    gsapActive: window.gsap ? gsap.globalTimeline.getChildren(true, true, true).length : null,
    runningAnimations: document.getAnimations().length,
    cssAnimationNames: [...o.animNames].sort(),
  });
})();`;

// ---------- helpers ----------
const sh = (cmd, a) => {
  const r = spawnSync(cmd, a, { encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : null;
};
const round = (v, d = 0) =>
  typeof v === "number" && Number.isFinite(v) ? Number(v.toFixed(d)) : null;
const pct = (sorted, q) =>
  sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];

function stats(values) {
  const v = values
    .filter((x) => typeof x === "number" && Number.isFinite(x))
    .sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = v.length / 2;
  return {
    median: v.length % 2 ? v[Math.floor(mid)] : (v[mid - 1] + v[mid]) / 2,
    min: v[0],
    max: v.at(-1),
    n: v.length,
  };
}
function mode(values) {
  const c = new Map();
  for (const v of values) if (v != null) c.set(v, (c.get(v) || 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

// Share of frames that wanted an update but were dropped or partially presented
// (Chrome's own smoothness accounting; forked and no-update frames excluded).
function droppedFramePct(tracePath) {
  const j = JSON.parse(readFileSync(tracePath, "utf8"));
  let frames = 0,
    bad = 0;
  for (const e of j.traceEvents ?? j) {
    if (e.name !== "PipelineReporter" || e.ph !== "b") continue;
    const r = e.args?.frame_reporter ?? e.args?.chrome_frame_reporter;
    if (
      !r ||
      r.frame_type === "FORKED" ||
      r.state === "STATE_NO_UPDATE_DESIRED"
    )
      continue;
    frames++;
    if (
      r.affects_smoothness &&
      (r.state === "STATE_DROPPED" || r.state === "STATE_PRESENTED_PARTIAL")
    )
      bad++;
  }
  return frames ? (100 * bad) / frames : null;
}

async function runStep(page, { kind, arg }) {
  switch (kind) {
    // Real input events. page.evaluate(() => el.click()) produces no INP entry.
    case "click":
      await page.click(arg);
      return page.waitForTimeout(300);
    case "hover":
      await page.hover(arg);
      return page.waitForTimeout(300);
    case "key":
      await page.keyboard.press(arg);
      return page.waitForTimeout(300);
    case "type": {
      const [sel, ...t] = arg.split("=");
      await page.locator(sel).pressSequentially(t.join("="), { delay: 60 });
      return page.waitForTimeout(300);
    }
    case "wait":
      return page.waitForTimeout(Number(arg));
    case "scroll": {
      // steady wheel input in small ticks (~1500 px/s), so scroll-linked effects update every frame
      const total = Number(arg),
        dir = Math.sign(total) || 1;
      for (let done = 0; done < Math.abs(total); done += 25) {
        await page.mouse.wheel(0, 25 * dir);
        await page.waitForTimeout(16);
      }
      return page.waitForTimeout(500);
    }
  }
}

const contextOptions = () => ({
  viewport: profile.viewport,
  deviceScaleFactor: profile.deviceScaleFactor,
  isMobile: profile.isMobile,
  hasTouch: profile.hasTouch,
  reducedMotion: args["reduced-motion"] ? "reduce" : "no-preference",
});

async function launch() {
  const opts = {
    headless: !args.headed,
    args: [
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
      "--disable-backgrounding-occluded-windows",
    ],
  };
  try {
    return await chromium.launch({ ...opts, channel: "chrome" });
  } catch {}
  try {
    return await chromium.launch(opts);
  } catch {}
  console.error("measure: installing Playwright Chromium (one time)…");
  spawnSync(
    process.execPath,
    [join(DEPS, "node_modules/playwright/cli.js"), "install", "chromium"],
    { stdio: "inherit" },
  );
  return chromium.launch(opts);
}

// ---------- one measured run ----------
async function measureRun(browser, idx, warnings) {
  const context = await browser.newContext(contextOptions()); // fresh context = cold cache
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable");
  await cdp.send("Network.enable");
  if (cpu > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
  if (NETWORKS[networkName])
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      ...NETWORKS[networkName],
    });
  const types = new Map(),
    bytes = {};
  cdp.on("Network.responseReceived", (e) => types.set(e.requestId, e.type));
  cdp.on("Network.loadingFinished", (e) => {
    const t = types.get(e.requestId) || "Other";
    bytes[t] = (bytes[t] || 0) + e.encodedDataLength;
  });
  await page.addInitScript({ content: INIT });

  await page.goto(args.url, {
    waitUntil: "domcontentloaded",
    timeout: loadTimeout,
  });
  try {
    await page.waitForLoadState("load", { timeout: loadTimeout });
  } catch {
    warnings.add(
      `load event did not fire within ${loadTimeout} ms; measured anyway`,
    );
  }
  await page.waitForTimeout(settle);

  if (idx === 0) {
    const dev = await page.evaluate(
      () =>
        !!document.querySelector(
          'script[src*="@vite/client"], nextjs-portal',
        ) || !!window.__NEXT_HMR_CB,
    );
    if (dev)
      warnings.add(
        "page looks like a dev server: measure a production build (next build && next start, vite build && vite preview)",
      );
  }
  const inventory = await page.evaluate(() => window.__opt.inventory());

  // ---- flow phase: frames, trace, main-thread deltas ----
  const metric = (m, n) => m.metrics.find((x) => x.name === n)?.value ?? 0;
  const tracePath = join(
    outDir,
    args["keep-trace"] ? `trace-run${idx}.json` : ".frames-trace.json",
  );
  const categories = args["keep-trace"]
    ? undefined
    : ["-*", "disabled-by-default-devtools.timeline.frame"];
  await browser.startTracing(page, { path: tracePath, categories });
  const flowStart = await page.evaluate(() => {
    window.__opt.startFrames();
    return performance.now();
  });
  const m0 = await cdp.send("Performance.getMetrics");
  const t0 = Date.now();
  for (const step of steps) await runStep(page, step);
  const flowSec = (Date.now() - t0) / 1000;
  const m1 = await cdp.send("Performance.getMetrics");
  const frames = await page.evaluate(() => window.__opt.stopFrames());
  await browser.stopTracing();
  const dropped = droppedFramePct(tracePath);
  if (!args["keep-trace"]) rmSync(tracePath, { force: true });

  const { wv, loaf } = await page.evaluate(() => ({
    wv: window.__opt.wv,
    loaf: window.__opt.loaf,
  }));
  await context.close();

  const loadLoaf = loaf.filter((e) => e.start < flowStart),
    flowLoaf = loaf.filter((e) => e.start >= flowStart);
  const sorted = [...frames].sort((a, b) => a - b);
  const kb = (t) => round((bytes[t] || 0) / 1024, 1);
  return {
    metrics: {
      lcpMs: round(wv.LCP?.value),
      lcpTtfbMs: round(wv.LCP?.ttfb),
      lcpLoadDelayMs: round(wv.LCP?.loadDelay),
      lcpLoadDurationMs: round(wv.LCP?.loadDuration),
      lcpRenderDelayMs: round(wv.LCP?.renderDelay),
      cls: round(wv.CLS?.value ?? 0, 4),
      inpMs: interactive ? round(wv.INP?.value) : null,
      inpInputDelayMs: round(wv.INP?.inputDelay),
      inpProcessingMs: round(wv.INP?.processing),
      inpPresentationMs: round(wv.INP?.presentation),
      loadBlockingMs: round(loadLoaf.reduce((s, e) => s + e.blocking, 0)),
      flowLongFrames: flowLoaf.length,
      flowBlockingMs: round(flowLoaf.reduce((s, e) => s + e.blocking, 0)),
      flowForcedLayoutMs: round(
        flowLoaf
          .flatMap((e) => e.scripts)
          .reduce((s, x) => s + (x.forcedLayoutMs || 0), 0),
      ),
      flowDroppedFramePct: round(dropped, 1),
      flowFrameP95Ms: round(sorted.length ? pct(sorted, 0.95) : null, 1),
      flowMainThreadMsPerSec: round(
        ((metric(m1, "TaskDuration") - metric(m0, "TaskDuration")) * 1000) /
          flowSec,
      ),
      flowLayouts: metric(m1, "LayoutCount") - metric(m0, "LayoutCount"),
      flowStyleRecalcs:
        metric(m1, "RecalcStyleCount") - metric(m0, "RecalcStyleCount"),
      transferKB: round(
        Object.values(bytes).reduce((s, b) => s + b, 0) / 1024,
        1,
      ),
      scriptKB: kb("Script"),
      imageKB: kb("Image"),
      mediaKB: kb("Media"),
      fontKB: kb("Font"),
      cssKB: kb("Stylesheet"),
      jsHeapMB: round(metric(m1, "JSHeapUsedSize") / 1048576, 1),
    },
    attribution: {
      lcpElement: wv.LCP?.target ?? null,
      lcpUrl: wv.LCP?.url ?? null,
      clsTarget: wv.CLS?.target ?? null,
      inpTarget: wv.INP?.target ?? null,
      inpLongestScript: wv.INP?.longestScript ?? null,
    },
    loafScripts: loaf.flatMap((e) =>
      e.scripts.map((s) => ({
        ...s,
        phase: e.start < flowStart ? "load" : "flow",
      })),
    ),
    inventory,
  };
}

// ---------- capture pass (not measured) ----------
async function capturePass(browser) {
  const dir = join(outDir, "capture");
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const context = await browser.newContext({
    ...contextOptions(),
    recordVideo: { dir, size: profile.viewport },
  });
  const page = await context.newPage();
  const t0 = Date.now();
  await page.goto(args.url, { waitUntil: "commit", timeout: loadTimeout });
  // Filmstrip of the intro, where the signature moment usually is. Timing is approximate.
  for (let t = 0; t < settle; t = Date.now() - t0) {
    await page.screenshot({
      path: join(dir, `intro-${String(t).padStart(5, "0")}ms.png`),
    });
    await page.waitForTimeout(200);
  }
  for (const step of steps) await runStep(page, step);
  if (shots.length) {
    // reach each offset by wheel from the top, not scrollTo: scrubbed and Lenis-driven effects need the path
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.waitForTimeout(1200);
    for (const y of [...shots].sort((a, b) => a - b)) {
      const dist = y - (await page.evaluate(() => Math.round(scrollY)));
      if (dist) await runStep(page, { kind: "scroll", arg: String(dist) });
      await page.waitForTimeout(1200); // let scrubbed timelines catch up
      await page.screenshot({ path: join(dir, `scroll-${y}.png`) });
    }
  }
  const video = page.video();
  await context.close();
  await video.saveAs(join(dir, "video.webm"));
  await video.delete();
  return dir;
}

// ---------- main ----------
mkdirSync(outDir, { recursive: true });
const warnings = new Set();
if (args.url.startsWith("file:"))
  warnings.add(
    "file:// URL: script attribution is empty and loading is unrealistic; serve over http (npx serve, python3 -m http.server)",
  );

const browser = await launch();
const chrome = browser.version();
const raw = [];
for (let i = 0; i < warmup + runs; i++) {
  const label =
    i < warmup ? `warm-up ${i + 1}/${warmup}` : `run ${i - warmup + 1}/${runs}`;
  process.stderr.write(`measure: ${label}…\n`);
  const r = await measureRun(browser, i, warnings);
  if (i >= warmup) raw.push(r);
}
const captureDir = capture ? await capturePass(browser) : null;
await browser.close();

const metrics = {};
for (const k of Object.keys(raw[0].metrics))
  metrics[k] = stats(raw.map((r) => r.metrics[k]));

const attribution = {};
for (const k of Object.keys(raw[0].attribution)) {
  const vals = raw.map((r) => r.attribution[k]);
  attribution[k] =
    typeof vals.find((v) => v != null) === "object"
      ? (vals.find((v) => v != null) ?? null)
      : mode(vals);
}

// Long-animation-frame script time averaged per run, worst first: where the main thread goes.
const agg = new Map();
for (const s of raw.flatMap((r) => r.loafScripts)) {
  const key = `${s.phase}|${s.invoker}|${s.src}|${s.fn}`;
  const a = agg.get(key) || {
    phase: s.phase,
    invoker: s.invoker,
    src: s.src,
    fn: s.fn || null,
    ms: 0,
    forcedLayoutMs: 0,
  };
  a.ms += s.ms / runs;
  a.forcedLayoutMs += (s.forcedLayoutMs || 0) / runs;
  agg.set(key, a);
}
const topScripts = [...agg.values()]
  .sort((a, b) => b.ms - a.ms)
  .slice(0, 8)
  .map((a) => ({
    ...a,
    ms: round(a.ms),
    forcedLayoutMs: round(a.forcedLayoutMs),
  }));

if (interactive && !metrics.inpMs)
  warnings.add(
    "flow has interactions but no INP was recorded: check the selectors hit real, visible elements",
  );
if (!metrics.lcpMs)
  warnings.add(
    "no LCP recorded: the largest element may be hidden (opacity 0, fully clipped) or a <canvas>, which never counts",
  );
if (
  raw[0].inventory.scrollTriggers === null &&
  raw[0].inventory.gsapActive === null
)
  warnings.add(
    "gsap is not on window (bundled), so GSAP inventory is unavailable: compare the capture stills and video instead",
  );

const commit = sh("git", ["rev-parse", "--short", "HEAD"]);
const dirty = sh("git", ["status", "--porcelain"]);
const summary = {
  label: args.label || "run",
  url: args.url,
  date: new Date().toISOString(),
  chrome,
  commit: commit ? commit + (dirty ? " (uncommitted changes)" : "") : null,
  profile: profileName,
  cpu,
  network: networkName,
  reducedMotion: !!args["reduced-motion"],
  headed: !!args.headed,
  runs,
  flow: steps.map((s) => `${s.kind}:${s.arg}`),
  note: "Lab numbers from this machine. Compare before/after measured the same way; never quote them as field data.",
  warnings: [...warnings],
  metrics,
  attribution,
  topScripts,
  inventory: raw[0].inventory,
  capture: captureDir,
};
writeFileSync(join(outDir, "summary.json"), JSON.stringify(summary, null, 2));
writeFileSync(join(outDir, "runs.json"), JSON.stringify(raw, null, 2));

// ---------- console summary ----------
const fmt = (s) =>
  s ? `${s.median}`.padStart(9) + `   ${s.min}–${s.max}` : "        –";
const ROWS = [
  ["lcpMs", "LCP ms"],
  ["lcpTtfbMs", "  TTFB"],
  ["lcpLoadDelayMs", "  load delay"],
  ["lcpLoadDurationMs", "  load duration"],
  ["lcpRenderDelayMs", "  render delay"],
  ["cls", "CLS"],
  ["inpMs", "INP ms"],
  ["inpInputDelayMs", "  input delay"],
  ["inpProcessingMs", "  processing"],
  ["inpPresentationMs", "  presentation"],
  ["loadBlockingMs", "load blocking ms"],
  ["flowLongFrames", "flow long frames"],
  ["flowBlockingMs", "flow blocking ms"],
  ["flowForcedLayoutMs", "flow forced layout ms"],
  ["flowDroppedFramePct", "flow dropped frames %"],
  ["flowFrameP95Ms", "flow frame p95 ms"],
  ["flowMainThreadMsPerSec", "flow main thread ms/s"],
  ["flowLayouts", "flow layouts"],
  ["flowStyleRecalcs", "flow style recalcs"],
  ["transferKB", "transfer KB"],
  ["scriptKB", "  script KB"],
  ["imageKB", "  image KB"],
  ["mediaKB", "  media KB"],
  ["fontKB", "  font KB"],
  ["jsHeapMB", "JS heap MB"],
];
console.log(
  `\n${summary.label}  ${args.url}\n${profileName}, cpu ${cpu}x, network ${networkName}, ${runs} runs, Chrome ${chrome}, commit ${summary.commit ?? "n/a"}`,
);
console.log(
  `flow: ${summary.flow.join("  ")}\n\n${"metric".padEnd(24)}${"median".padStart(9)}   min–max`,
);
for (const [k, name] of ROWS)
  if (metrics[k]) console.log(name.padEnd(24) + fmt(metrics[k]));
const a = attribution;
console.log(
  `\nLCP element: ${a.lcpElement ?? "–"}${a.lcpUrl ? ` (${a.lcpUrl})` : ""}\nCLS largest shift: ${a.clsTarget ?? "–"}\nINP target: ${a.inpTarget ?? "–"}`,
);
if (topScripts.length) {
  console.log("\nlong-animation-frame script time (ms per run, worst first):");
  for (const s of topScripts)
    console.log(
      `  ${String(s.ms).padStart(6)}  [${s.phase}] ${s.invoker ?? ""} ${s.fn ? `${s.fn}() ` : ""}${s.src ?? ""}${s.forcedLayoutMs ? `  forced layout ${s.forcedLayoutMs}` : ""}`,
    );
}
const inv = summary.inventory;
console.log(
  `\nanimation inventory: scrollTriggers ${inv.scrollTriggers ?? "n/a"}, gsap active ${inv.gsapActive ?? "n/a"}, running ${inv.runningAnimations}, css [${inv.cssAnimationNames.join(", ")}]`,
);
for (const w of warnings) console.log(`warning: ${w}`);
console.log(
  `\nsaved ${join(outDir, "summary.json")}${captureDir ? `\ncaptures in ${captureDir}` : ""}`,
);
