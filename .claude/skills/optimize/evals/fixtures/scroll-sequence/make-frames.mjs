#!/usr/bin/env node
// Generates the 150 JPEG frames (1920x1080, ~40 MB total) this fixture scrolls through,
// standing in for a Higgsfield clip sliced into frames. Run once before the eval:
//   node evals/fixtures/scroll-sequence/make-frames.mjs
// Uses the Playwright that scripts/measure.mjs installs into ~/.cache/optimize-skill.

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DEPS =
  process.env.OPTIMIZE_DEPS || join(homedir(), ".cache", "optimize-skill");
const req = createRequire(join(DEPS, "package.json"));
try {
  req.resolve("playwright");
} catch {
  mkdirSync(DEPS, { recursive: true });
  if (!existsSync(join(DEPS, "package.json")))
    writeFileSync(join(DEPS, "package.json"), '{ "private": true }\n');
  spawnSync(
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
}
const { chromium } = req("playwright");

const out = join(dirname(fileURLToPath(import.meta.url)), "frames");
mkdirSync(out, { recursive: true });
const browser = await chromium
  .launch()
  .catch(() => chromium.launch({ channel: "chrome" }));
const page = await browser.newPage();
const FRAMES = 150;
for (let i = 0; i < FRAMES; i++) {
  const dataUrl = await page.evaluate(
    ({ i, n }) => {
      const c = document.createElement("canvas");
      c.width = 1920;
      c.height = 1080;
      const g = c.getContext("2d");
      const t = i / (n - 1);
      const bg = g.createRadialGradient(960, 540, 50, 960, 540, 1100);
      bg.addColorStop(0, `hsl(${220 + t * 60} 40% 18%)`);
      bg.addColorStop(1, "#000");
      g.fillStyle = bg;
      g.fillRect(0, 0, 1920, 1080);
      for (let k = 0; k < 40; k++) {
        // the "drivers" opening out around the ring
        const a = (k / 40) * Math.PI * 2 + t * Math.PI;
        const r = 220 + t * 260;
        g.fillStyle = `hsl(${(k * 9 + t * 120) % 360} 70% ${45 + 15 * Math.sin(a)}%)`;
        g.beginPath();
        g.arc(
          960 + Math.cos(a) * r,
          540 + Math.sin(a) * r * 0.55,
          34 - t * 10,
          0,
          Math.PI * 2,
        );
        g.fill();
      }
      const img = g.getImageData(0, 0, 1920, 1080),
        d = img.data; // film grain, so frames weigh what real footage weighs
      for (let p = 0; p < d.length; p += 4) {
        const n2 = (Math.random() - 0.5) * 22;
        d[p] += n2;
        d[p + 1] += n2;
        d[p + 2] += n2;
      }
      g.putImageData(img, 0, 0);
      return c.toDataURL("image/jpeg", 0.8);
    },
    { i, n: FRAMES },
  );
  writeFileSync(
    join(out, `${String(i + 1).padStart(4, "0")}.jpg`),
    Buffer.from(dataUrl.split(",")[1], "base64"),
  );
  if ((i + 1) % 25 === 0) console.log(`frames: ${i + 1}/${FRAMES}`);
}
await browser.close();
console.log(`wrote ${FRAMES} frames to ${out}`);
