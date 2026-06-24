# EPIC-013: Design-System Enhancement Layer

status: on-progress
environment: dev
retries: 0
phase: 4
priority: P1
area: Frontend
source: `docs/WealthMe Design System/design_handoff_enhancements/` (handoff 2026-06)

## Goal

Apply the **enhancement layer** from the WealthMe design-system handoff on top of the
already-correct token foundation. The handoff README confirms the token layer is
identical 1:1 to `apps/web/src/app/globals.css` (shipped by EPIC-010) — **tokens are
NOT reinstalled**. This epic adds 6 approved UX enhancements:

1. Count-up on big numbers (net worth, totals)
2. Hover-lift on KPI / asset / liability / goal cards
3. Lucide tinted icon-chips replacing emoji category glyphs
4. Stagger entrance (fade-up) on page mount
5. Progress fill-on-mount (bars fill from 0)
6. Thin status strip atop goal cards (replacing full colored borders)

All motion respects `prefers-reduced-motion`.

## Evidence

- Handoff: `docs/WealthMe Design System/design_handoff_enhancements/` — `README.md`
  (mapping table + emoji→Lucide map), `globals-additions.css`, `wm-motion.tsx.txt`,
  `wm-icon-chip.tsx.txt`, before/after example. Code is written in repo idiom
  (Tailwind v4 + `cn()` + lucide-react), drop-in.
- Foundation verified present: `formatRupiah`/`formatRupiahCompact` (`lib/format.ts`),
  `cn` (`lib/utils.ts`), `ProgressBar`/`SummaryCard` (`components/wm/index.tsx`),
  `lucide-react` (`apps/web/package.json`), Tailwind v4 (`@theme inline`,
  `@custom-variant` in globals.css → `@utility` supported).
- `ui_kits/wealthme-app/*` + `WealthMe App.html` are design **references** (prototypes),
  not production code to copy raw.

## Tasks

- [x] **A — Foundation primitives** (protected-path exception, plan-approved)
  - [x] Append `globals-additions.css` to `apps/web/src/app/globals.css`
        (`@keyframes wm-rise/wm-pop`, `@utility animate-rise/animate-pop`,
        reduced-motion guard). Additive only, zero token changes.
  - [x] New `apps/web/src/components/wm/motion.tsx` (`useCountUp`, `CountUpRupiah`,
        `AnimatedProgress`, `Rise`).
  - [x] New `apps/web/src/components/wm/icon-chip.tsx` (`IconChip`).
  - [x] Re-export both from `components/wm/index.tsx`.
- [x] **B — Beranda** `app/(app)/beranda/page.tsx` (hero net worth count-up,
      SummaryCard hover-lift + IconChip, `<Rise>` stagger, goal `AnimatedProgress`)
- [x] **C — Investasi** `app/(app)/investasi/page.tsx` (total count-up, TrendingUp chip,
      hover-lift; row stagger via `animate-rise` on `<tr>` — `<Rise>` div invalid in `<tbody>`)
- [x] **D — Aset** `app/(app)/aset/page.tsx` (total count-up, per-type IconChips, hover-lift, Rise)
- [x] **E — Tujuan** `app/(app)/tujuan/page.tsx` (border-2 → overflow-hidden + 3px status strip,
      AnimatedProgress, GraduationCap chip for edu goals, Rise + hover-lift)
- [x] **F — Liabilitas** `app/(app)/liabilitas/page.tsx` (total count-up, CreditCard/Landmark
      chips, AnimatedProgress, Rise)
- [x] **G — Anggaran** `app/(app)/anggaran/page.tsx` (AnimatedProgress budget bars, total
      count-up, Rise + hover-lift)
- [x] **H — Transaksi** `app/(app)/transaksi/page.tsx` (round directional IconChips, `<Rise>` per day)
- [ ] **I — Gates + DEV deploy**

### Emoji → Lucide map (from handoff)

| Kategori                 | Lucide           | Chip class                      |
| ------------------------ | ---------------- | ------------------------------- |
| Bank / rekening          | `Landmark`       | `bg-blue-100 text-blue-600`     |
| E-wallet / kas           | `Wallet`         | `bg-green-100 text-green-600`   |
| Investasi                | `TrendingUp`     | `bg-violet-100 text-violet-600` |
| Properti                 | `Home`           | `bg-yellow-100 text-yellow-600` |
| Liabilitas / pengeluaran | `CreditCard`     | `bg-red-100 text-red-600`       |
| Pemasukan                | `ArrowDownLeft`  | `bg-green-100 text-green-600`   |
| Transfer                 | `ArrowLeftRight` | `bg-violet-100 text-violet-600` |
| Goal pendidikan          | `GraduationCap`  | `bg-blue-100 text-blue-600`     |

## Acceptance Criteria

- Big numbers count up on mount; cards lift on hover; emoji glyphs replaced by tinted
  Lucide chips; cards stagger-in; progress bars fill from 0; goal cards use a top strip.
- `prefers-reduced-motion: reduce` disables all animation (count-up jumps to final).
- No token/color/font/radius change vs current `globals.css` (diff = keyframes+utils only).
- All Indonesian copy/numbers preserved (faithful port, per `apps/web/WM_CONVENTIONS.md`).

## Test Plan

- Unit: `useCountUp` ends at target; reduced-motion returns target immediately;
  `AnimatedProgress` settles at `value`.
- E2E (Playwright, `apps/web/tests/`): `/beranda` renders final net-worth text,
  IconChips present (no emoji), no console errors; one spec per enhanced page.
- Manual/MCP: screenshot `/beranda` before/after; toggle reduced-motion → animations off.
- Smoke: each touched page loads after DEV deploy.

## Agent Routing

`code-agent` + `shadcn`/`frontend-design`; `ecc:react-reviewer` (mandatory post-edit) +
`review-qa-agent`; `ecc:typescript-reviewer`; gates `test-agent`/`security-agent`;
`deploy-agent` (DEV only). Per page: `/task-work EPIC-013 <n>`.

## Automation Log

- 2026-06-24 — Epic created via `/nerve`. Finding: design-system tokens already shipped
  (EPIC-010); only the enhancement layer is new. **Group A done in main session**
  (foundation primitives: globals keyframes + `wm/motion.tsx` + `wm/icon-chip.tsx` +
  re-export). Group A touches protected `globals.css`/`components/wm/*` — approved
  exception (handoff-authorized, additive, zero token change). Per-page Groups B–H
  pending; recommend `/compact` before continuing (context was ~97%).
- 2026-06-24 — **Group B (Beranda) done in main session** as the reference port
  (commit on `development`). Typecheck clean.
- 2026-06-25 — **Groups C–H done** via 6 parallel `code-agent`s (one page each), using the
  committed Beranda diff as the template; main session reviewed scope + ran central
  `tsc --noEmit` (clean after one fix: re-added `Rise` import to investasi, which the agent
  dropped while keeping `<Rise>` usages). Dynamic user-set emoji (goal icons, budget-category
  icons) intentionally preserved — only fixed category glyphs were swapped to Lucide chips.
  All 6 page files only; no protected/foundation file touched. Group I (gates + DEV deploy)
  in progress.
