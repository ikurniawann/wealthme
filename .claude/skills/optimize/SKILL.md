---
name: optimize
description: Measure and fix frontend performance without flattening the design. Use whenever a website or web app is slow, laggy or janky, in any stack (Next.js, Vite, React, plain HTML), and load it before digging into the code. Typical asks are a slow first load or a poor Lighthouse, PageSpeed or Core Web Vitals score (LCP, INP, CLS); buttons, dropdowns, filters or inputs that take a beat to respond when clicked; a page that jumps around or pops content in while it loads; scroll animations, scroll sequences, video or WebGL heroes that stutter, drop frames, heat the phone or crash mobile Safari; a JavaScript bundle that's too big; or a pre-launch performance pass. It measures first with a bundled script, finds the real bottleneck, applies the smallest fix that keeps signature motion intact, and proves the result with before/after numbers and captures. Not for building new animation (marketing-ui, gsap), new screens (functional-ui), or backend, API and database performance.
---

# Optimize

Make it faster without making it plainer. The goal is the experience, not the score.

## The motion rule

Never remove, disable, flatten, or globally shorten animation because it exists. In this pack motion is usually the point: marketing-ui's signature moment, scroll choreography, a hero sequence. GSAP, Lenis, Three.js, video, blur and canvas sequences are innocent until a trace says otherwise.

When a trace proves motion is the bottleneck, climb this ladder and stop at the first rung that clears it:

1. **Cheaper delivery** (same pixels, less work): transform instead of layout properties, right-sized frames, lighter encodes.
2. **Scoping** (same effect, smaller area or fewer redraws): bound the blur, redraw only when the frame changes, `will-change` only during the motion.
3. **Pausing** (stop it when nobody sees it): IntersectionObserver on loops, video and WebGL.
4. **Isolation** (off the main thread): no layout reads in scroll callbacks, async decode, compositor-driven scroll timelines.
5. **Fidelity reduction** (hard to see, measurable): DPR cap, fewer frames on phones, smaller blur radius.
6. **Equivalent replacement** (same look, cheaper mechanism): sticky instead of pin, crossfaded pre-blurred layers, scrubbed video instead of a frame sequence.
7. **Removal:** one effect, on the device class that fails, and only after asking the user.

Rungs 5–7 change what people see. Show the user before/after captures and let them decide. Techniques, evidence and worked examples for every rung are in [references/motion.md](references/motion.md).

Don't:

- Ship `* { animation: none !important }` or any other global kill.
- Use `prefers-reduced-motion` as a performance switch. It's an accessibility setting; its version is designed on purpose, not a side effect of this work.
- Sprinkle `will-change`, `memo`, lazy loading or code splitting everywhere.
- Follow advice to delete animation first, or to lazy-load scroll-sequence frames as "below the fold".

## Workflow

Copy this checklist and tick it off as you go:

- [ ] 1. Context: claude.md, design.md, signature motion, git state
- [ ] 2. Symptom: route, interaction, viewport, device, network
- [ ] 3. Baseline: measured and captured
- [ ] 4. Cause: traced, not guessed
- [ ] 5. Fix: one change, the smallest that works
- [ ] 6. Verify: numbers, experience, engineering, ledger
- [ ] 7. Report

### 1. Context

Read the project's `claude.md` (what the product is, who it's for) and `design/design.md` if it exists. Name the signature motion, the moments that must survive: usually marketing-ui's one signature moment plus any scroll choreography. Record the commit and any uncommitted changes, and never overwrite work that isn't yours.

### 2. Name the symptom

Turn "slow" into a route, an interaction, a viewport, a device class and a network. Then look where the symptom points:

| Symptom                       | Inspect first                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------------ |
| Slow first view (LCP)         | the LCP element and its four subparts; fix the biggest subpart, not the image by reflex          |
| Laggy click or input (INP)    | the interaction's input delay, processing and presentation; the longest script                   |
| Janky scroll or animation     | dropped frames, long animation frames, forced layout in callbacks, paint area, image decode      |
| Content jumps (CLS)           | the shifting element: unsized media, font swap, injected content, layout-driving animation, pins |
| Heavy bundle                  | route chunks, client boundaries, duplicate or unused dependencies                                |
| Hot phone, battery drain      | offscreen loops, uncapped DPR, video decode, timers                                              |
| Memory, tab reloads on iPhone | decoded image sequences, textures, undisposed GPU and animation contexts, listeners              |

Optimize the route that has the symptom, not the whole repository, and fix the complaint the user named. Other problems you find along the way (say, CLS while you're fixing jank) go in the report as recommendations, not into the same change.

### 3. Baseline: measure before editing

Use a production build served over http, never the dev server and never `file://`. Then:

```bash
node <skill-dir>/scripts/measure.mjs http://localhost:3000/ --label before --do scroll:4000 --do click:#menu --shots 0,1600,3200
```

`<skill-dir>` is this skill's directory. Each `--do` is a real input, run in order; leave `--do` out to watch an idle page.

- **Runs:** one warm-up and five cold runs on Lighthouse's mobile profile (4x CPU, Slow 4G).
- **Output:** `perf/before/summary.json`, with LCP and its subparts, CLS and the shifting element, INP and the slow handler, long animation frames and the scripts behind them, dropped frames, main-thread time, bytes by type, and an animation inventory.
- **`--shots`:** adds an unmeasured capture pass (video, an intro filmstrip and stills).
- **Keep results out of what ships.** In an app with a build step, `perf/` at the repo root is fine once it's in `.gitignore`. For a static site deployed straight from its folder, point `--out` outside that folder, or delete `perf/` (and any backup copies of originals) before you finish.

Use Chrome DevTools MCP traces to find out _why_; compare the script's numbers. Tools, options, traps, and the fallback when nothing can run are in [references/measurement.md](references/measurement.md).

"Good" Core Web Vitals at the 75th percentile: LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1. FID is retired. A Lighthouse score is not proof.

### 4. Find the cause

Trace before theorizing:

- **Don't confuse correlation with cause.** A large dependency isn't automatically why a click is slow, and the animation on screen during jank isn't automatically the jank.
- **Attribution names the entry point.** Long-animation-frame attribution names whatever started the work (`ScrollTrigger.min.js` `onwheel`), not the code that's slow (your `onUpdate`).
- **Know what headless can't see.** Desktop headless can't reproduce GPU, decoder or memory limits. Say so instead of guessing. For memory, `scripts/webkit-memory.mjs` gives a WebKit-at-iPhone-size proxy on a Mac.

If two rounds of tracing don't find the cause, stop and report what you know.

### 5. Fix: the smallest change, one at a time

Structural wins first:

- Remove request waterfalls.
- Give the LCP resource the right size and priority.
- Cut client JS and third parties.
- Stop work nobody can see.
- Break up long tasks.
- Remove forced layout.

For motion, climb the ladder. Don't switch frameworks, animation libraries, rendering modes or asset pipelines unless measurements demand it. GSAP specifics are in `gsap/references/gsap-performance.md`.

### 6. Verify

Re-measure with the identical command and `--label after-1`, then compare:

```bash
node <skill-dir>/scripts/compare.mjs perf/before perf/after-1
```

While you're trying ideas, `--runs 3` and no `--shots` keep each loop to a couple of minutes. Use the default five runs, with captures, for the baseline and for the version you intend to keep, since those are the numbers you report.

| Result                                         | Do                                                                                                                                                                                  |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Better beyond noise, tests pass, design intact | keep                                                                                                                                                                                |
| Within noise                                   | revert: neutral is a revert                                                                                                                                                         |
| Worse                                          | revert                                                                                                                                                                              |
| Better, but another metric got worse           | find out why: a real regression → revert; a side effect of the page now rendering more frames (CLS from a layout animation that was already there) → keep, and report it separately |
| Better, but a test broke                       | revert, fix, re-measure                                                                                                                                                             |
| Better, but the design got worse               | revert, or ask the user                                                                                                                                                             |

**Experience check.** Give a fresh subagent (Claude Code's default task agent) both `capture/` folders and ask three questions:

- Is every signature animation still there, with the same timing, order and intent?
- Is there any new flash, jump, pop-in, blank frame or missing state?
- Does it still look like the same site?

Treat any difference it reports as a finding. Screenshots can't show flicker; the video can. The filmstrip and stills usually suffice; if you pull frames from the video, a few per second is plenty, not every frame.

**Engineering check.**

- Lint, typecheck, tests and a production build pass.
- Timers, observers, listeners, GSAP contexts, media and GPU resources are cleaned up.
- Desktop and mobile widths, keyboard use, and `--reduced-motion` still work.

Log every attempt, kept or reverted, in `perf/LEDGER.md`: the change, the metric before → after, the verdict, and why. It goes into the report, so nothing is lost when `perf/` is cleaned up.

### 7. Report

1. Symptom and baseline: route, profile, runs, commit.
2. The verified cause, with its evidence.
3. What changed, and why it was the safest high-impact fix.
4. The `compare.mjs` table and the ledger of attempts.
5. Motion and visuals deliberately preserved, and what the experience check found.
6. What's not verified and why (real-device behavior, field data), with the command or steps to verify it.

Never claim a speedup from reading code.
