# Task: Fix inconsistent money formatting on Dana account rows

Source: `docs/audits/ui-ux-audit.md` finding P1-4 / AC-4.
Root cause (confirmed in code): `apps/web/src/app/(app)/dana/page.tsx:289` renders each
account row's balance with `className="dn-row-amt num"` — `num` is a dead class name (not
defined anywhere in `dana.css`, `bento.css`, or `globals.css`), so the figure falls back to
default body typography. Every other page that shows money (Beranda `wm-num` at
`bento-sections.tsx:734`/`825`, `mobile-home.tsx:136`/`168`/`273`; Laporan
`laporan-inner.tsx:747`; Transaksi `page.tsx:575`/`860`/`1214`/`1842`) applies the shared
`wm-num` class, which sets `font-variant-numeric: tabular-nums` (`bento.css:17`) — the
DM-Mono-adjacent tabular-Sora-numeral treatment `DESIGN.md` specifies for money
("Money uses tabular Sora numerals; mono is reserved for codes and IDs"). Dana's hero
figure and KPIs (`BentoHero`/`HeroKpi`, `components/wm/bento.tsx`) already get tabular
numerals built into `.wm-big`/`.wm-kpi-v` — only this page-local row amount was missing
the shared class.

Scope: `apps/web/src/app/(app)/dana/page.tsx` only (page-local; one className swap).
No API changes, no changes to `components/wm/*` (the shared hero/KPI components already
apply tabular numerals correctly).

## Acceptance checks

### Check 1 — row amount uses the shared tabular-numeral class

- **Command:** `grep -n "dn-row-amt" apps/web/src/app/\(app\)/dana/page.tsx`
- **Expected:** class list includes `wm-num`, not the dead `num` class.

### Check 2 — live computed style matches other pages

- **Setup:** `playwright-cli` session, authenticated, on `/dana` (at least one account
  row rendered).
- **Action:** read `getComputedStyle(...).fontVariantNumeric` for a Dana row amount and
  compare to the same property on a known `wm-num` element elsewhere (e.g. a Beranda hero
  figure).
- **Expected:** both report `"tabular-nums"`.
- **Command:**
  ```
  playwright-cli -s=audit eval "() => getComputedStyle(document.querySelector('.dn-row-amt')).fontVariantNumeric"
  ```
  Expected result: `"tabular-nums"`.

### Check 3 — no new design-token-drift findings

- **Command:**
  `.agents/skills/impeccable/scripts/impeccable detect --json --target "apps/web/src/app/(app)/dana/page.tsx"`
- **Expected:** no new findings at the edited line.

## Out of scope

- `BentoHero`/`HeroKpi` (`components/wm/bento.tsx`) — already correct, not touched.
- Other backlog tasks — tracked in `docs/agentic/checkpoints/ui-restyle-backlog.md`.
