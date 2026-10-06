# Measurement

How to get numbers you can trust, and the traps that make them lie. Read the section for the tool you're using.

Contents: Ground rules · measure.mjs · Chrome DevTools MCP · Lighthouse · Bundles · Field data · Reading the numbers · Real devices · When nothing can run

## Ground rules

- **Production build over http.** `next build && next start`, `vite build && vite preview`, or the static output behind `npx serve`. Dev servers ship unminified code, HMR clients and dev-only checks. `file://` breaks script attribution.
- **One variable at a time.** Same URL, flow, profile and machine for before and after. Close heavy apps; never run two measurements at once.
- **Five runs, compare medians.** One run is a guess. `measure.mjs` does one warm-up plus five cold runs by default.
- **Measure, then capture.** Recording video costs CPU, so captures happen in a separate, unmeasured pass.
- **Keep private sites private.** Nothing here needs to upload anything. Start Chrome DevTools MCP with `--no-performance-crux` for unreleased or client sites (by default it sends traced URLs to Google's CrUX API), and don't use screenshot tools that post to public hosts.

## scripts/measure.mjs (default)

```bash
node <skill-dir>/scripts/measure.mjs <url> --label before [--do <step> ...] [options]
node <skill-dir>/scripts/compare.mjs perf/before perf/after
```

First run installs Playwright and web-vitals into `~/.cache/optimize-skill` (never the project) and uses the installed Chrome if there is one. `--help` lists every option.

| Option                                                           | Use                                                                                                                                                                                       |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--do click:<sel>` `hover:<sel>` `key:<Key>` `type:<sel>=<text>` | Real input, in order. Needed for INP.                                                                                                                                                     |
| `--do scroll:<px>`                                               | Steady wheel scroll (~1500 px/s). Drives ScrollTrigger, Lenis and scrubbed sequences as a person would.                                                                                   |
| `--do wait:<ms>`                                                 | Pause. With no `--do` at all, the flow is a 3 s idle window, which exposes loops that never stop.                                                                                         |
| `--profile desktop`                                              | 1350×940, no CPU slowdown, fast network. Default `mobile`: 412×823 @1.75x, 4x CPU, Slow 4G (Lighthouse's mobile profile).                                                                 |
| `--cpu 6`                                                        | Stress pass. 4x on Apple Silicon is gentler than a mid-tier phone; use 6x when a result is borderline.                                                                                    |
| `--network none`                                                 | For local asset-heavy pages where Slow 4G would take minutes (say so in the report).                                                                                                      |
| `--settle <ms>`                                                  | Wait after load before the flow (default 3000). Raise it for long intros.                                                                                                                 |
| `--capture` / `--shots 0,1600,3200`                              | Unmeasured pass: `video.webm`, an intro filmstrip (`intro-*.png`) and stills at scroll offsets, reached by wheel so scrubbed and smooth-scrolled effects follow the same path every time. |
| `--reduced-motion`                                               | Emulates `prefers-reduced-motion: reduce`. Use it to check the reduced version, not to speed anything up.                                                                                 |
| `--headed`                                                       | Visible browser. The GPU path for blur-, canvas- and WebGL-heavy pages is closer to reality.                                                                                              |
| `--keep-trace`                                                   | Saves the flow's full DevTools trace to open in the Performance panel. Slower; don't compare its numbers with untraced runs.                                                              |

Output: `perf/<label>/summary.json` (median, min, max per metric), `runs.json`, and `capture/`. The console prints the table, the LCP element, the CLS and INP targets, the scripts behind long animation frames, and the animation inventory (ScrollTrigger count and CSS animation names, which `compare.mjs` checks so a fix can't silently drop an effect).

Traps, all seen in practice:

- **TTFB reads ~0 and LCP leaves out the document's own download.** Emulated throttling delays the HTML before the page's clock starts. Subresources are throttled normally. Fine for before/after; use Lighthouse for absolute LCP.
- **Desktop headless can't reproduce GPU, decoder or memory limits.** CPU throttling slows the main thread only. A 40 MB, 150-frame 1080p sequence scrolled with 0% dropped frames here while it would crash an iPhone. Blur, WebGL, big canvases and video decode need `--headed` and a real device; for image-sequence memory use `webkit-memory.mjs` (Real devices, below).
- **Long-animation-frame attribution names the entry point, not the culprit.** `ScrollTrigger.min.js` with `DOMWindow.onwheel` or `#document.onscroll` and a large `forced layout` means _your_ `onUpdate` or callback reads layout after writing it. `FrameRequestCallback` means your rAF loop. GSAP isn't the cost.
- **Scroll flows report CLS from ScrollTrigger pins.** Target: the pinned element or `.pin-spacer`. Real Chrome users report it too. See the pin entry in `motion.md`.
- **A smoother layout animation can raise CLS.** If a scroll effect animates `width`, `top` or `left`, more rendered frames means more counted shifts. The fix is a different mechanism, which can change the look; see `motion.md`.
- **Check the LCP element is the one you expect.** An element faded in from opacity 0 by a CSS animation may count only when the animation ends, or not at all, so LCP reports late or silently falls to another element. A fade driven by JS (GSAP, an inline script) counts when the element starts to show.
- **Transfer sizes are whatever your local server sends.** Self-hosting a CDN file can look 13% heavier only because the local server gzips while the CDN uses brotli, or doesn't compress at all. Serve with production's compression, or compare brotli sizes directly, before calling a byte change real.
- **INP needs real input.** `--do click:` dispatches real events. A scripted `el.click()` produces no INP entry. Lab INP covers only the interactions you scripted, so report "INP for <interaction>", never "the page's INP".

`compare.mjs` calls a metric changed only when the after-median falls outside the before min–max, moves at least 10% (CLS 0.02, bytes 1%), and clears a small absolute floor (10 ms, 2 frames, 2 points, 1 MB). It also warns when the profile, flow or URL differ, and when ScrollTrigger counts or CSS animation names change.

## Chrome DevTools MCP (diagnosis)

Best for _why_: named insights and full traces. Use `measure.mjs` for the numbers you compare.

```bash
claude mcp add chrome-devtools --scope user -- npx -y chrome-devtools-mcp@latest --headless --isolated --no-performance-crux
```

Add `--experimentalScreencast` for `screencast_start`/`screencast_stop` (needs ffmpeg), `--memoryDebugging` for heap snapshots.

- **Load:** `emulate {cpuThrottlingRate: 4, networkConditions: "Slow 4G", viewport: "412x823x1.75,mobile,touch"}` → `performance_start_trace {reload: true, autoStop: true}` → `performance_analyze_insight {insightSetId: "NAVIGATION_0", insightName: "LCPBreakdown"}`. Other insights: `LCPDiscovery`, `RenderBlocking`, `DocumentLatency`, `CLSCulprits`, `ImageDelivery`, `FontDisplay`, `ThirdParties`, `NetworkDependencyTree`, `DOMSize`, `ForcedReflow`, `DuplicatedJavaScript`.
- **Interaction:** `take_snapshot` (for uids) → `performance_start_trace {reload: false, autoStop: false}` → `click {uid}` / `press_key` / `fill` → `performance_stop_trace` → `performance_analyze_insight {insightSetId: "NO_NAVIGATION", insightName: "INPBreakdown"}`.
- **Scroll or animation:** start a trace with `reload: false, autoStop: false` → `evaluate_script` that scrolls (there is no scroll tool) → stop → `ForcedReflow`.
- **Memory:** `take_heapsnapshot` at baseline, after ten open/close cycles of the feature, and compare. Detached DOM nodes and growing listeners are leaks.

Traps: `autoStop` ends the trace 5 s after load, which cuts off long intros (use `autoStop: false` plus `performance_stop_trace`). `lighthouse_audit` skips performance entirely. `emulate` can't set reduced motion. File-writing tools may be limited to the OS temp directory, so pass `$TMPDIR` paths.

## Lighthouse (absolute load numbers)

```bash
npx lighthouse@13 <url> --only-categories=performance --output=json --output-path=perf/lh-before-1.json --chrome-flags="--headless=new" --quiet
```

Add `--preset=desktop` for desktop. Run it five times and take medians; Lighthouse CI still bundles Lighthouse 12. Read `audits['largest-contentful-paint'|'cumulative-layout-shift'|'total-blocking-time'].numericValue` and the `*-insight` audits (`lcp-breakdown-insight`, `render-blocking-insight`, `cls-culprits-insight`). It measures page load only (no INP), its default throttling is simulated, and a score is never proof on its own.

## Bundles

- **Next.js 16:** `next experimental-analyze --output` (16.1+; newer canaries call it `next analyze`) writes to `.next/diagnostics/analyze`; copy it aside before rebuilding. `next build` no longer prints First Load JS sizes. Webpack builds: `ANALYZE=true next build --webpack` with `@next/bundle-analyzer`.
- **Vite:** `vite build` prints gzip size per chunk; `rollup-plugin-visualizer` with `template: 'markdown'` gives a readable breakdown.
- **Anything with source maps:** `npx source-map-explorer 'dist/**/*.js' --json --gzip`.
- **What a route actually downloads:** `scriptKB` in `measure.mjs`, or `list_network_requests {resourceTypes: ["Script"]}` in DevTools MCP.

## Field data

Field data (real users, 75th percentile, 28-day window) says whether a problem is real. Lab data diagnoses it and proves a fix. A fix can't appear in field data until it ships and about 28 days pass.

- **Public sites with enough Chrome traffic:** the CrUX API (needs a Google API key):
  ```bash
  curl -s "https://chromeuxreport.googleapis.com/v1/records:queryRecord?key=$CRUX_KEY" \
    -d '{"origin":"https://example.com","formFactor":"PHONE","metrics":["largest_contentful_paint","interaction_to_next_paint","cumulative_layout_shift"]}'
  ```
  Read `record.metrics.*.percentiles.p75`. DevTools MCP traces of public URLs also show CrUX p75 unless started with `--no-performance-crux`.
- The PageSpeed Insights API often returns 429 without a key.
- Unreleased or low-traffic sites have no field data. Say so; don't substitute lab numbers.

## Reading the numbers

**LCP subparts.** Fix the biggest one, not the image by reflex.

| Subpart       | Healthy share of LCP | Usually means                                                                                       |
| ------------- | -------------------- | --------------------------------------------------------------------------------------------------- |
| TTFB          | ~40%                 | server, redirects, no CDN                                                                           |
| Load delay    | <10%                 | LCP image discovered late (CSS background, JS-inserted, lazy-loaded, no preload or `fetchpriority`) |
| Load duration | ~40%                 | oversized or wrongly encoded image, video poster, font                                              |
| Render delay  | <10%                 | render-blocking CSS/JS, font swap, or the element hidden until a reveal runs                        |

Text LCP has no load delay or duration; everything after TTFB is render delay.

**INP phases.** Input delay: the main thread was busy (long tasks, hydration, third parties). Processing: your handlers. Presentation: rendering the result (big DOM updates, layout).

**Smoothness.** Long animation frames are over 50 ms, a visible hitch. `forced layout` on a script means layout reads after writes. Dropped frames % is Chrome's count of frames that wanted an update and missed. A frame p95 above ~25 ms at 60 Hz reads as stutter. Main thread above ~100 ms/s in an idle window with nothing moving on screen is a loop that never stops.

## Real devices

Use them for anything GPU-, decoder- or memory-bound, and always for image sequences.

- **Android:** USB debugging, then `chrome://inspect` on the desktop; record in the Performance panel.
- **iPhone:** Settings → Safari → Advanced → Web Inspector, then Safari's Develop menu on the Mac; the Timelines tab shows memory, frames and layout.
- **No iPhone to hand:** on a Mac, `node <skill-dir>/scripts/webkit-memory.mjs <url> --label before` loads the page in WebKit at iPhone size, scrolls it, and records peak `footprint` for every WebKit process it started, the GPU process included. GPU memory is noisy, so compare medians of three or more runs, and run nothing else in WebKit meanwhile. `footprint` reports phys_footprint, the number iOS uses to kill tabs. `ps` RSS misses GPU and IOSurface memory, where decoded bitmaps live, and can show two very different loaders as equal. It's a proxy that shows whether a change raises or lowers memory, not iOS's actual limit; say so in the report.

## When nothing can run

1. Say so. Label the finding "Not verified (code inspection only)", with the expected effect and why.
2. Measure what you can without a browser: the production build passes; bytes before/after (`gzip -c file | wc -c`); image dimensions and weights; bundle analyzer output.
3. Hand the user the exact `measure.mjs` command, or manual steps: DevTools Performance panel → CPU: the calibrated "mid-tier mobile" preset (Chrome 134+) or 4x → Network: Slow 4G → record the interaction → read LCP, INP, CLS and the insights.
