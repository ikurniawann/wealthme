# Motion

Making motion cheaper without making it plainer. Climb the ladder in order and stop at the first rung that clears the trace. Each technique names the evidence that calls for it.

Contents: Budgets · 1 Cheaper delivery · 2 Scoping · 3 Pausing · 4 Isolation · 5 Fidelity reduction · 6 Equivalent replacement · 7 Removal · Playbooks (scroll-frame sequence, hero reveal vs LCP, GSAP callbacks and pins, WebGL) · Product UI · Reduced motion · False culprits · Advice to ignore here

## Budgets

- A 60 Hz frame is 16.7 ms, and about 10 ms of it is yours. At 120 Hz it's 8.3 ms. A long animation frame (over 50 ms) is a visible hitch.
- A decoded image costs width × height × 4 bytes, whatever its file size. 150 frames at 1920×1080 = 1.24 GB. At 1280×720 = 553 MB. 75 frames at 720×405 = 87 MB. iOS Safari reloads tabs well below 1 GB; plan for a few hundred MB in total.
- A 2048² RGBA texture takes 16 MB of GPU memory unless it's KTX2-compressed.

## 1. Cheaper delivery: same pixels, less to fetch or compute

- **Move with transform and opacity, not `top`, `left`, `width`, `height`,** when the look is identical (it is for most movement). Evidence: forced layout in the flow, CLS during scroll.
- **Right-size media.** Never ship frames or images larger than they're drawn. For sequences, prefer WebP or JPEG over AVIF: AVIF decodes slower, and sequences decode during scroll.
- **Serve phones their own sequence** via `gsap.matchMedia()`, which also tears down and rebuilds on breakpoint change. Crop it to what a portrait screen actually shows (a cover-fit canvas shows only the middle third of a 16:9 frame) and size it to the drawn width. Fewer frames is a fidelity reduction (rung 5), not delivery.
- **Video:** muted, no audio track (`-an`), efficient codecs first (AV1/HEVC sources, then H.264), and a lighter file for phones with `<source media>`. The poster (or first frame) is the LCP candidate: give it `fetchpriority="high"`.
- **Display fonts:** one face, WOFF2, subset, preloaded. Pair it with a metric-matched fallback (`size-adjust`, `ascent-override`; `next/font`, Fontaine or Capsize generate them) so the swap doesn't shift.
- **Bundles:** Motion's `LazyMotion` + `m` instead of `motion` (about 34 KB up front down to about 5 KB, with features loaded separately). Import only the GSAP plugins you use. Dynamically import below-fold 3D.
- **3D assets:** `npx @gltf-transform/cli optimize in.glb out.glb --texture-compress ktx2 --compress meshopt` (KTX2 needs KTX-Software installed; `webp` works without it but doesn't save GPU memory).
- **GSAP basics** (`quickTo`, stagger instead of many tweens, read/write batching): `gsap/references/gsap-performance.md`. Two corrections to it: toggle `will-change` around the motion instead of leaving it on, and numeric `scrub` smooths motion; it doesn't reduce work.

## 2. Scoping: same effect, smaller area or fewer redraws

- **Redraw only when something changed.** For canvas sequences: `if (index === last) return;`. GSAP's `imageSequenceScrub` helper redraws on every update unless you add this guard.
- **Bound blur, `backdrop-filter` and large shadows** to the smallest element that gives the look. Cost scales with area × radius, so avoid full-viewport wrappers and sticky headers blurring moving content.
- **`will-change` only around the motion:** set it on start, remove it on complete. Leaving it on many elements costs memory.
- **`content-visibility: auto; contain-intrinsic-size: auto 800px`** on heavy below-fold sections. Not above the fold, and not in or before pinned ScrollTrigger sections: it changes heights ScrollTrigger measured. Refresh after layout settles.
- **ScrollTrigger:** `ScrollTrigger.config({ ignoreMobileResize: true })`, `fastScrollEnd: true` and `limitCallbacks: true` where they fit. Debounce `ScrollTrigger.refresh()` and call it only when layout changed.
- **Motion:** `layout` only on elements that actually move; `LayoutGroup` instead of tree-wide layout animation.

## 3. Pausing: keep it, stop it when nobody sees it

Browsers pause rAF in hidden tabs, but loops keep running when scrolled offscreen. Evidence: main thread above ~100 ms/s in an idle window with nothing moving.

```js
new IntersectionObserver(([e]) =>
  renderer.setAnimationLoop(e.isIntersecting ? tick : null),
).observe(canvas);
```

- **R3F:** `setFrameloop(visible ? 'always' : 'never')`; scenes that change only on interaction use `frameloop="demand"` + `invalidate()`.
- **Video:** play and pause with an IntersectionObserver yourself; don't rely on the browser.
- **Ambient GSAP timelines:** `toggleActions: 'play pause resume pause'`.
- **Sections with `content-visibility: auto`:** stop canvas loops on `contentvisibilityautostatechange` when `event.skipped` is true.
- **Teardown:** revert `gsap.context()`/`useGSAP`; dispose geometries, materials and textures (watch `renderer.info.memory`); `close()` ImageBitmaps.

## 4. Isolation: off the main thread, out of the paint path

- **No layout reads inside scroll callbacks.** Read once (on load and resize), compute from progress, write transforms. If you must read, read everything first, then write.
- **Decode ahead off the main thread, within a byte budget.** `createImageBitmap(blob)` decodes off the main thread, but a bitmap stays decoded until you `close()` it; WebKit keeps them in its GPU process. Size the window in bytes, not frames: about 32–64 MB, which is 4–8 frames at 1920×1080 or 27–55 at 720×405. Close everything outside it. A window sized in frames barely helps. Measured in WebKit at iPhone size (phys_footprint, 150 frames at 1080p), the original loader peaked at 0.8–1.3 GB, a ±12-frame window at 0.7–1.0 GB with most of it in the GPU process, and a 32 MB budget at 0.46–0.69 GB, lowest in every run. Check peak memory in WebKit before and after (`measurement.md`, Real devices).
- **CSS scroll-driven animations** (`animation-timeline: view()` / `scroll()`) run on the compositor in Chrome and Safari 26 when they animate transform or opacity. Firefox still has them behind a flag, so wrap them in `@supports (animation-timeline: view())` and make the fallback the finished state, never hidden content.
- **Motion:** pass `scrollYProgress` straight to `opacity`, `transform` or `clipPath` (hardware-accelerated), and animate a `transform` string rather than `x`/`scale` shorthands, which run on the main thread.
- **Lenis + GSAP on one clock**, not a separate rAF loop as well:
  ```js
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  ```
  Leave `syncTouch` off so phones keep native touch scrolling. `ScrollTrigger.normalizeScroll()` moves scrolling onto the JS thread too; use it only to fix address-bar jumps.
- **OffscreenCanvas in a worker** for heavy canvas or Three rendering. **One WebGL context** (drei `<View>`) instead of several canvases.

## 5. Fidelity reduction: hard to see, easy to measure (show the user captures)

- **Clamp DPR:** `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))` (R3F's default is already `[1, 2]`). For canvas sequences, set the backing store to the smaller of CSS size × min(DPR, 2) and the source frame size.
- **Adaptive quality:** drei `PerformanceMonitor`, with `onDecline` to lower DPR and `onFallback` to swap in a cheaper path.
- **Sequences:** fewer frames on phones, plus a numeric `scrub` (e.g. `0.4`) to smooth the steps.
- A smaller blur radius; post-processing at half resolution.

## 6. Equivalent replacement: same look, cheaper mechanism (show the user)

- **ScrollTrigger `pin` → CSS `position: sticky` + scrub.** Measured on the scroll-sequence fixture: CLS 0.70 → 0. `pinType: 'transform'` also gets 0 but can jitter.
- **Animated blur → crossfade** between a sharp and a pre-blurred layer, so only opacity animates.
- **Animated `box-shadow` →** the opacity of a pseudo-element shadow. **Animated `border-radius` →** `clip-path: inset(0 round X)`.
- **Width or height animation → FLIP** (GSAP `Flip`, Motion `layout`), `clip-path` or `scale`. Text then scales instead of reflowing, which is visible, so ask.
- **Canvas sequence ↔ scrubbed video.** Video is far lighter on memory and download, but seek smoothness depends on the device's decoder. Encode it for seeking:
  ```bash
  ffmpeg -i in.mov -vf scale=1280:-2 -an -c:v libx264 -crf 23 -g 8 -keyint_min 8 -sc_threshold 0 -pix_fmt yuv420p -movflags +faststart scrub.mp4
  ```
  For phones, use 720p with `-g 4`. Drop to `-g 1` if seeks still stutter; the file grows several times. Fetch it as a blob (iOS ignores `preload`) and wait for `seeked` before setting the next `currentTime`.
- **Live WebGL hero on weak devices →** a pre-rendered loop of the same scene.

## 7. Removal: last resort

Remove only one effect, only on the device class that fails, and only after rungs 1–6 were measured and fell short. Ask first and bring three things: the trace evidence, what each rung achieved, and what the visitor loses. Reduced motion is not this rung.

## Playbook: scroll-frame sequence (canvas)

Symptoms: the tab reloads on iPhone ("A problem repeatedly occurred"), a long first load, mid-scroll stutter. Desktop headless won't reproduce memory or decode limits, so compute and test on a device (see `measurement.md`, Real devices).

1. **Compute decoded memory:** frames × w × h × 4. The fixture is 150 × 1920×1080 = 1.24 GB, plus 40 MB to download.
2. **Delivery:** frames no larger than drawn; a portrait phone set cropped to the visible area, which changes nothing anyone can see; WebP at about q75 if the grain survives it (check the captures). Make frame 0 a real `<img>` or poster: a `<canvas>` never counts for LCP. Halving the frame count is rung 5, so ask.
3. **Loading:** start when the section nears the viewport (IntersectionObserver with a wide `rootMargin`). Load coarse-to-fine (every 8th frame, then every 4th, then every 2nd, then the rest) and draw the nearest loaded frame. Don't put `loading="lazy"` on frames: the sequence needs them before the user arrives.
4. Draw only on frame change, into a DPR-capped backing store.
5. **Decode budget:** keep at most about 32–64 MB of decoded frames (`createImageBitmap`, `close()` outside the budget), and confirm with `scripts/webkit-memory.mjs` before and after that peak memory went down. A window sized in frames barely helps.
6. Still failing on a device? Swap to the scrubbed video (rung 6).
7. If CLS points at the pinned section, use `sticky` instead of `pin`.
8. **Reduced motion:** crossfade 4–6 key stills instead of scrubbing.

## Playbook: hero reveal vs LCP

Measured on `evals/fixtures/hero-reveal` (mobile, 4x CPU, Slow 4G, median of 3):

| Reveal                                                   | LCP        | LCP element               |
| -------------------------------------------------------- | ---------- | ------------------------- |
| CSS `opacity: 0`, GSAP fades it in after `load` + 0.6 s  | 2616 ms    | h1                        |
| Same fade, started at `DOMContentLoaded`, no delay       | 1988 ms    | h1                        |
| Headline painted at first paint, rises by transform only | **620 ms** | h1                        |
| CSS keyframe fade from `opacity: 0` at first paint       | 2624 ms    | p (the h1 wasn't counted) |

- LCP waits until the LCP element paints visibly. If the hero stays hidden until JS loads and a delay passes, LCP is the reveal's start time, and render delay dominates the subparts.
- **Keep the motion, start it sooner:** no `load` wait, no pre-delay on the LCP element, and don't make the first frame wait on a CDN library. A tiny inline script that runs the same reveal from first paint keeps the motion identical; in an eval run it took LCP from about 2.6 s to 1.25 s with zero pixel difference in the reveal.
- **Bigger win:** paint the LCP element from the first frame and carry its motion on transform (rise, scale), keeping fades on the secondary elements. The headline losing its fade is visible, so show the user.
- Moving a fade into CSS keyframes can backfire: Chrome may count the element only when the animation ends, or not at all, so LCP reports late or quietly measures something else (the nav, a paragraph). A JS-driven fade counts when the element starts to show. Always check which element LCP reports.
- Don't start at `opacity: 0.01` to trick the metric. That games the number, not the experience.

## Playbook: GSAP scroll callbacks and pins

Measured on `evals/fixtures/gsap-scroll`. Reading `offsetHeight` and writing `top` for 200 particles inside `onUpdate` gave 33% dropped frames, p95 33 ms and about 700 ms/s of main thread. Reading once and writing `transform` gave 0%, 16.7 ms and about 95 ms/s, with pixel-identical stills.

- Long-animation-frame attribution blames `ScrollTrigger.min.js` (`DOMWindow.onwheel`, `#document.onscroll`) because ScrollTrigger called your callback. A large `forced layout` there means your callback reads layout.
- Animating `width`, `height`, `top` or `left` during scroll shows up as CLS, and making it smoother raises CLS (more frames, more shifts). The cure is a different mechanism (transform, clip-path, FLIP), which may change the look, so ask.
- Pins can register CLS (0.70 on the scroll-sequence fixture). `sticky` or `pinType: 'transform'` takes it to 0.

## Playbook: WebGL / Three.js

GPU cost doesn't show under CPU throttling, so gather evidence with `--headed` and on a real device. In order: clamp DPR, pause offscreen, demand frameloop for static scenes, `PerformanceMonitor`, KTX2 + meshopt assets, dispose on unmount, lazy-load below-fold scenes, one context.

## Product UI (Motion, functional-ui)

- INP problems in product UI are usually handlers and re-renders, not animation. Trace the interaction before touching motion.
- Keep per-frame values in motion values or refs, not React state that re-renders a tree.
- Animate a `transform` string for WAAPI acceleration; `LazyMotion` + `m` for bundle size.

## Reduced motion, designed

`prefers-reduced-motion` is an accessibility preference, not a performance switch. Design its version: swap large movement, zoom, parallax and spin for crossfades or opacity changes; keep meaning and affordances; give autoplay a pause control or a still. In GSAP use `gsap.matchMedia()` with `(prefers-reduced-motion: reduce)`. In Motion, `<MotionConfig reducedMotion="user">` drops transforms and keeps opacity. For a scroll sequence, crossfade key stills. Check it with `measure.mjs --reduced-motion --capture`.

## False culprits

- **"GSAP, Lenis or Three is slow."** It's usually layout reads in callbacks, uncapped DPR, a full-viewport blur, or an unbounded image cache.
- **"It's fine on throttled desktop."** The GPU, decoder and memory aren't throttled.
- **Blaming the video file for LCP.** The poster is the candidate; fix the poster.
- **A `visibilitychange` handler to pause rAF.** Hidden tabs already pause it; the gap is offscreen work.
- **Adding `dpr={[1, 2]}` to R3F.** It's already the default.
- **Lighthouse "Avoid non-composited animations".** It's a hint, not proof of jank.

## Advice to ignore here

Other skills and articles say these things. Here they're wrong or too broad:

- "Delete the animation" as the first remedy, or "used 100+ times a day → no animation". These are product-UI heuristics, not rules for marketing motion.
- A global reduced-motion kill (`* { animation-duration: .01ms !important }`).
- "60 fps is non-negotiable: simplify or remove it."
- Lazy-loading scroll-sequence frames, or switching scrub video to `preload="metadata"`, as a generic media fix.
- Permanent `will-change` on every animated element; "numeric scrub reduces work".
- Debounced scroll handlers for scroll-linked motion. They stutter by design.
