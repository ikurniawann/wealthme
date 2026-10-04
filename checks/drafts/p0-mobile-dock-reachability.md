# Task: Mobile bottom dock must stay reachable while scrolled

Source: `docs/audits/ui-ux-audit.md` finding P0-1.
Root cause (confirmed in code): `apps/web/src/app/bento.css:469-473` —
`.wm-dock[data-hidden]` sets `opacity: 0`, `pointer-events: none`, and
`transform: translateX(-50%) translateY(calc(100% + 24px))`, driven by
`useDockHidden()` in `apps/web/src/components/shell/mobile-bars.tsx`. This is
a deliberate hide-on-scroll-down pattern, but it fully removes the dock
(zero opacity + no pointer events) rather than leaving it reachable —
violating `persistent-nav` in `ui-ux-pro-max` ("core navigation must remain
reachable from deep pages; don't hide it entirely in sub-flows") and Nielsen
#7/#6.

Scope: `apps/web/src/app/bento.css` and/or
`apps/web/src/components/shell/mobile-bars.tsx` only (both are foundation
paths listed in `WM_CONVENTIONS.md`; this task explicitly authorizes
touching them for this narrow fix — no other foundation file). No API
changes.

## Acceptance checks

### Check 1 — dock never fully exits the viewport while hidden

- **Setup:** `playwright-cli` session at 390×844 viewport, authenticated
  (demo account), on `/laporan` (a long scrollable page).
- **Action:** scroll the inner `.wm-main` container down past 150px.
- **Expected:** `document.querySelector('.wm-dock').getBoundingClientRect()`
  reports `top < window.innerHeight` (the dock's box still intersects the
  viewport) — it may be visually de-emphasized/compact, but not translated
  fully off-screen.
- **Command:**
  ```
  playwright-cli -s=audit resize 390 844
  playwright-cli -s=audit goto http://localhost:3000/laporan
  playwright-cli -s=audit mousemove 200 400
  playwright-cli -s=audit mousewheel 0 500
  playwright-cli -s=audit eval "() => { const r = document.querySelector('.wm-dock').getBoundingClientRect(); return { top: r.top, bottom: r.bottom, innerHeight: window.innerHeight }; }"
  ```
  Expected result: `top < innerHeight`.

### Check 2 — dock stays operable while de-emphasized

- **Setup:** same scrolled state as Check 1.
- **Action:** inspect the dock's `pointer-events` computed style and at
  least one dock item's accessible name.
- **Expected:** `pointer-events` is not `none` while the dock intersects the
  viewport — a user who taps where the dock now sits must be able to
  activate a nav item, not hit a dead zone.
- **Command:**
  ```
  playwright-cli -s=audit eval "() => getComputedStyle(document.querySelector('.wm-dock')).pointerEvents"
  ```
  Expected result: not `"none"`.

### Check 3 — existing hide/show behavior is not removed (regression guard)

- **Setup:** same page, fresh load (scrollTop = 0).
- **Action:** confirm dock is fully visible at rest, scroll down past 150px
  (de-emphasized per Check 1/2), then scroll back up.
- **Expected:** dock returns to its original fully-visible resting state
  (`data-hidden` attribute absent or equivalent visible state) after
  scrolling up — the hide-on-scroll-down / show-on-scroll-up interaction
  pattern itself is preserved, only the "fully gone" failure mode is fixed.
- **Command:**
  ```
  playwright-cli -s=audit mousewheel 0 -500
  playwright-cli -s=audit eval "() => document.querySelector('.wm-dock').hasAttribute('data-hidden')"
  ```
  Expected result: `false` at rest.

### Check 4 — reduced motion respected (ui-ux-pro-max `reduced-motion`)

- **Setup:** emulate `prefers-reduced-motion: reduce`.
- **Action:** repeat the scroll from Check 1.
- **Expected:** the dock's state-change is instant or near-instant (no
  spring/duration animation) — consistent with the existing `useReducedMotion`
  usage already in `mobile-bars.tsx` (`reduce ? { duration: 0 } : ...`); the
  fix must not regress this.
- **Command:** manual code review of the diff — confirm the existing
  `reduce` branch still governs any new transition the fix introduces.

## Out of scope for this task

- Desktop/tablet nav (icon rail) — unaffected, not touched.
- The other P0/P1 audit findings (typography token, `transition: width`,
  TanStack Query console error, Dana money formatting, Tujuan status
  contradiction) — tracked as separate follow-up task-loop runs, see
  `docs/agentic/checkpoints/ui-restyle-backlog.md`.
- Any `uiarc.dev` component adoption — not needed for this fix.
