# Task: Fix invisible "Gelombang" (waves) card pattern

Source: user-flagged live, 2026-10-05, screenshot of "Ubah tampilan kartu" (card
customization panel). "Gelombang" (waves) and "Polos" (plain) swatches/previews render
identically.

Root cause (confirmed in code): `apps/web/src/app/bento.css` —
`.wm-plate[data-pattern="waves"]::before` positions two radial-gradients at
`110% 120%` and `110% 150%` with a `60%`-tall ellipse (vertical radius 30% of box
height). Center y (120%/150%) minus the vertical radius (30%) is still 90%/120% —
entirely below the card's bottom edge (`.wm-plate` has `overflow: hidden`), so neither
gradient ever paints inside the visible box. `plain` has no `::before` rule at all by
design (DESIGN.md intent: a blank texture) — the bug is that `waves` unintentionally
renders the same blank result.

Scope: `apps/web/src/app/bento.css` only, the `data-pattern="waves"` rule. `bento.css`
is a foundation path (`WM_CONVENTIONS.md`) — this task explicitly authorizes touching
only this one rule to fix a confirmed, screenshotted visual bug; no other foundation
file. No API changes.

## Acceptance checks

### Check 1 — waves pattern produces a visibly different element than plain

- **Setup:** `playwright-cli` session, authenticated, open the card customization panel
  (Rekening → an account → "Ubah tampilan kartu").
- **Action:** for the "Gelombang" and "Polos" swatch previews, read the computed
  `background-image` of their `::before` pseudo-element, and take a cropped screenshot
  of each swatch.
- **Expected:** the two swatches are visually distinguishable (the waves preview shows a
  visible curved texture; the plain preview is flat).
- **Command:**
  ```
  playwright-cli -s=audit eval "() => [...document.querySelectorAll('.wm-skin-dot')].map(el => ({ pattern: el.dataset.pattern, bg: getComputedStyle(el, '::before').backgroundImage }))"
  ```
  Expected result: the `waves` entry's `::before` background-image resolves to a
  non-empty gradient whose visible portion actually falls within the 0–100% box (not a
  gradient whose center + radius both fall outside the box).

### Check 2 — other patterns (hatch, dots, plain) unchanged

- **Command:** `grep -n "wm-plate\[data-pattern" apps/web/src/app/bento.css`
- **Expected:** only the `waves` rule's gradient values changed; `hatch`/`dots` rules and
  the absence of a `plain` rule are untouched.

### Check 3 — no new design-token-drift findings

- **Command:**
  `.agents/skills/impeccable/scripts/impeccable detect --json --target apps/web/src/app/bento.css`
- **Expected:** no new findings at the edited lines.

## Out of scope

- Any other `.wm-plate` rule or other card skins/patterns.
- Other backlog tasks — tracked in `docs/agentic/checkpoints/ui-restyle-backlog.md`.
