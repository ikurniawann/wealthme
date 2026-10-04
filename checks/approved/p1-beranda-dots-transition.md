# Task: Fix `transition: width` layout-thrash in beranda carousel dots

Source: `docs/audits/ui-ux-audit.md` finding P1-2.
Root cause (confirmed in code): `apps/web/src/app/(app)/beranda/_components/beranda.css:413`
— `.beranda-mh-dots i` animates `width` (6px → 16px on `[data-on]`), which is a layout
property: the browser must recompute layout on every frame of the transition instead of
compositing on the GPU. Violates `ui-ux-pro-max`'s `transform-performance` rule ("use
transform/opacity only; avoid animating width/height/top/left").

Scope: `apps/web/src/app/(app)/beranda/_components/beranda.css` only (page-local). No API
changes, no JS changes (the `data-on` attribute toggle logic is untouched).

## Acceptance checks

### Check 1 — no layout property is transitioned

- **Command:** `grep -n "transition" apps/web/src/app/\(app\)/beranda/_components/beranda.css | grep -i dots`
- **Expected:** the dots' `transition` declaration references `transform` (or `opacity`),
  not `width`/`height`/`top`/`left`.

### Check 2 — visual equivalence preserved (inactive dot vs. active dot)

- **Setup:** `playwright-cli` session, authenticated, on `/beranda` (hero carousel with dots).
- **Action:** read the dots' computed `width`/`transform` for an inactive dot and the
  `[data-on]` dot.
- **Expected:** the inactive dot renders visually smaller/rounder and the active dot
  visually wider/pill-shaped — same visual outcome as before, now driven by `transform`
  instead of `width`.
- **Command:**
  ```
  playwright-cli -s=audit goto http://localhost:3000/beranda
  playwright-cli -s=audit eval "() => { const dots = [...document.querySelectorAll('.beranda-mh-dots i')]; return dots.map(d => ({ on: d.hasAttribute('data-on'), rect: d.getBoundingClientRect().width, transform: getComputedStyle(d).transform })); }"
  ```

### Check 3 — no new design-token-drift findings

- **Command:**
  `.agents/skills/impeccable/scripts/impeccable detect --json --target "apps/web/src/app/(app)/beranda/_components/beranda.css"`
- **Expected:** no new findings introduced at the edited lines.

## Out of scope

- Any other beranda.css rules or the carousel's JS/data-on toggle logic.
- Other backlog tasks — tracked separately in `docs/agentic/checkpoints/ui-restyle-backlog.md`.
