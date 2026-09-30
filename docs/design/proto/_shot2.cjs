// usage: node _shot2.cjs page.html [page2.html ...]  -> screenshots at 1280x800 and 1024x768 in /tmp/claude-1000/wm-shots2
const {
  chromium,
} = require("/home/wit/WORK/vibes/wealthme-web-revisi-g/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright");
const path = require("path"),
  fs = require("fs");
const out = "/tmp/claude-1000/wm-shots2";
fs.mkdirSync(out, { recursive: true });
(async () => {
  const b = await chromium.launch({
    executablePath: "/opt/google/chrome/chrome",
  });
  for (const f of process.argv.slice(2)) {
    for (const [w, h] of [
      [1280, 800],
      [1024, 768],
    ]) {
      const p = await b.newPage({
        viewport: { width: w, height: h },
        reducedMotion: "reduce",
      });
      const errs = [];
      p.on("pageerror", (e) => errs.push(e.message));
      p.on("console", (m) => {
        if (m.type() === "error" && !/fonts\.g/.test(m.text()))
          errs.push(m.text());
      });
      await p.goto("file://" + path.resolve(__dirname, f));
      await p.waitForTimeout(500);
      const name = `${out}/${f.replace(/\W/g, "_")}-${w}.png`;
      await p.screenshot({ path: name, fullPage: true });
      const over = await p.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      );
      console.log(
        f,
        w,
        "overflow:",
        over,
        "errors:",
        errs.join(" | ") || "none",
        "->",
        name,
      );
      await p.close();
    }
  }
  await b.close();
})();
