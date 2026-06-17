# EPIC-010: Frontend Theming (Swappable shadcn Color Presets) + Demo Visual Alignment

status: on-progress
environment: dev
retries: 0
phase: 4
priority: P1
area: Frontend
source: UI/UX audit 2026-06-17 (`apps/web/tests/e2e/audit/ui-audit.spec.ts` → `docs/ui-audit/GAP-ANALYSIS.md`)

## Goal

Two related outcomes:

1. **Swappable color themes** — add a shadcn-style runtime color-preset picker
   (à la the shadcn theme generator / tweakcn) so users can switch the brand
   palette at runtime, in addition to the existing light/dark toggle. Ship 6
   presets: **Indigo (default), Emerald, Rose, Amber, Violet, Slate**.
2. **Demo visual alignment** — close the concrete per-page divergences found in
   `docs/ui-audit/GAP-ANALYSIS.md` so the live app matches the mockup
   `docs/WealthMe_Demo(1).html`.

The live app is already a mature shadcn/Tailwind v4 build that matches the demo's
palette/fonts and has a working light/dark toggle (`next-themes`). This epic adds
the **preset axis** on top of that, and tightens fidelity.

## Evidence

- Theme tokens: `apps/web/src/app/globals.css` — hex CSS vars in `:root` / `.dark`,
  mapped to Tailwind v4 via `@theme inline`; `@custom-variant dark (&:is(.dark *))`.
  Default `--primary: #4f46e5`.
- Theme infra: `components/providers/theme-provider.tsx` (wraps `next-themes`),
  `components/shell/theme-toggle.tsx`, configured in `app/layout.tsx`
  (`attribute="class"`, `storageKey="wealthme-theme"`, `enableSystem={false}`).
- Picker mount points: `ThemeToggle` is rendered at
  `components/shell/topbar.tsx:63` and `components/shell/mobile-bars.tsx:63`.
- Reusable picker primitive: `components/ui/dropdown-menu.tsx`.
- Per-page gaps + priority: `docs/ui-audit/GAP-ANALYSIS.md` (screenshots under
  `docs/ui-audit/live` and `docs/ui-audit/demo`).

## Architecture (theming)

Two orthogonal axes so they compose:

- **Mode** (light/dark) — unchanged: `next-themes` toggles `.dark` on `<html>`.
- **Color preset** — a new `data-theme` attribute on `<html>` (e.g.
  `data-theme="emerald"`). Default preset writes **no** attribute, so today's
  indigo `:root` / `.dark` values remain the fallback and are byte-identical.

Rules to encode (so it can't be subtly broken):

- Each non-default preset needs **both** a light block `[data-theme="x"] { … }`
  **and** a dark block `[data-theme="x"].dark { … }`, placed **after** `:root`
  and `.dark` in `globals.css`. `.dark` (one class) and `[data-theme="x"]` (one
  attribute) have equal specificity, so the `.dark`-qualified block must exist to
  win in dark mode.
- **Only brand/accent/chart vars swap**: `--primary*`, `--accent*`, `--ring`,
  `--chart-*`. Semantic `--success*`, `--warning*`, `--destructive*`,
  `--background/foreground/card/border` stay constant (they carry meaning).
- **No-flash**: an inline `<script>` in `layout.tsx` `<head>` reads
  `localStorage["wealthme-theme-preset"]` and sets
  `document.documentElement.dataset.theme` before paint (mirrors next-themes'
  anti-FOUC pattern and the mount-guard in `theme-toggle.tsx`).

> Protected-path note (per `WM_CONVENTIONS.md` / `CLAUDE.md`): this epic is
> explicitly permitted to edit `globals.css`, `app/layout.tsx`, and
> `components/shell/*` because theming is intrinsic to them. Keep edits scoped to
> theming + the listed alignment fixes; no unrelated refactors.

## Tasks

### Group A — Theme-preset infrastructure ✅

- [x] **T-1001** Add `apps/web/src/lib/themes.ts` — preset registry
      `{ id, label, swatch }[]` for indigo (default) + emerald, rose, amber, violet,
      slate; export the localStorage key constant `wealthme-theme-preset`.
- [x] **T-1002** Extend `apps/web/src/app/globals.css` — for each non-default
      preset add `[data-theme="x"] { --primary*/--accent*/--ring/--chart-* }` and
      `[data-theme="x"].dark { … }`, placed after `:root`/`.dark`. Leave default
      (no `data-theme`) untouched.
- [x] **T-1003** Wire `data-theme` + no-flash inline script in
      `apps/web/src/app/layout.tsx` `<head>`; reads `wealthme-theme-preset` and sets
      `document.documentElement.dataset.theme` pre-paint.

### Group B — Theme picker UI ✅

- [x] **T-1004** Add `apps/web/src/components/shell/theme-picker.tsx` — swatch
      dropdown built on `components/ui/dropdown-menu.tsx`; persists to
      `wealthme-theme-preset`; sets `document.documentElement.dataset.theme`; mount
      guard for SSR like `theme-toggle.tsx`.
- [x] **T-1005** Mount the picker beside `ThemeToggle` in `topbar.tsx` and
      `mobile-bars.tsx`; a11y: keyboard nav, `aria-label`, sufficient swatch contrast.

### Group C — Per-page demo alignment (from GAP-ANALYSIS.md)

- [ ] **T-1006** **Aset (P1)** — aggregate existing Rekening + Investasi data into
      the consolidated net-worth view; remove "Data akan tersedia…" placeholders;
      fix total label/calc. Fixes Laporan → Wealth Allocation too.
- [ ] **T-1007** **Transaksi (P2)** — add "Kartu Kredit" filter + sort dropdown;
      align row affordance/density + circular icons; drop redundant add button.
- [ ] **T-1008** **Rekening (P2)** — bank-branded icon badges; status badge
      (Utama/Aktif); demo-style action buttons; masked account number.
- [ ] **T-1009** **Ringkasan (P2)** — Komposisi Aset bar-list viz; reconcile KPI
      card #3; Top-Pengeluaran %-badge; Health Score label.
- [ ] **T-1010** **Laporan (P2)** — scrollable/grouped tab bar (fix 17-tab
      overflow) + de-dupe sidebar submenu; line-chart for Performa Investasi.
- [ ] **T-1011** **Beranda (P2)** — restore 5-up summary-card row; rename
      "Komposisi"→"Alokasi Kekayaan" and "Transaksi"→"Aktivitas Terbaru".
- [ ] **T-1012** **AI / Anggaran / Liabilitas / Notifikasi (P2)** — AI chat
      container height; Anggaran row spacing; Liabilitas DTA-ratio KPI; verify
      Notifikasi header pill + badges (re-capture clean).
- [ ] **T-1013** **Cross-cutting copy/color sweep (P3)** — G4 (header casing),
      G5 (headline color), circular list-row icons (G3), and remaining P3 copy items.

### Group D — Verification

- [ ] **T-1014** Re-run `apps/web/tests/e2e/audit/ui-audit.spec.ts` across all 6
      presets × light/dark; visual sign-off live ≈ demo; refresh `docs/ui-audit/`.
- [ ] **T-1015** `bash scripts/test.sh` (lint + tsc + build) green; a11y check on
      the picker.

## Acceptance Criteria

- Preset picker swaps ≥5 color palettes at runtime with **no reload** and **no FOUC**.
- Every preset works in both light and dark.
- Choice persists across reloads (`wealthme-theme-preset`).
- Default (no `data-theme`) is **byte-identical** to today's look.
- Each audited page matches the demo within agreed tolerance; all **P1** items
  and the listed **P2** items resolved (P3 sweep best-effort).
- `scripts/test.sh` green; protected-path edits limited to `globals.css`,
  `app/layout.tsx`, `components/shell/*` (+ page files for Group C).

## Test Plan

- Unit/light: preset registry shape; picker persists + sets `data-theme`.
- E2E: `ui-audit` spec re-run per preset; assert `--primary` computed value
  changes with `data-theme` and that default is unchanged.
- Manual: toggle each preset in light + dark; reload to confirm persistence + no
  flash; keyboard-only operation of the picker.

## Agent Routing

- `code-agent` + `shadcn` skill (picker), `frontend-design` skill (alignment).
- Gates: `ecc:react-reviewer`, `ecc:typescript-reviewer`, `a11y-architect`,
  `ecc:security-reviewer`, `test-agent` (`scripts/test.sh`).

## Done Signal

All tasks checked; `scripts/test.sh` green; `docs/ui-audit/` refreshed showing
live ≈ demo across presets; PR merged to `development`.

## Automation Log

<!-- Epic loop appends here -->

- 2026-06-17 /epic-loop EPIC-010 #2 "Group B — Theme picker UI" → PASS (attempts: 2), PR: #152. Review: react/ts/a11y/qa — attempt 1 FAIL (react-reviewer CRITICAL: `DropdownMenuLabel` outside a group → Base UI `MenuGroupContext` throw); fixed by wrapping in `DropdownMenuGroup`; attempt 2 all ✓. Test: attempt 1 FAIL on a real ESLint error (misplaced `eslint-disable-next-line` after line shifts — directive landed on the `useEffect(` line, not the `setMounted(true)` line); fixed; attempt 2 frontend lint/tsc/web-build ✓. Security: code-level ✓. Pre-existing `apps/api` ws advisory + Prisma seed test remained red per standing policy.
- 2026-06-17 /epic-loop EPIC-010 #1 "Group A — Theme-preset infrastructure" → PASS (attempts: 1), PR: #151. Review ✓ (react/ts/qa, 0 CRIT/HIGH). Security: code-level ✓; `scripts/security-check.sh` red ONLY on pre-existing `ws` DoS advisory (GHSA-96hv-2xvq-fx4p) in `apps/api` NestJS deps — unrelated to this frontend change; user approved proceeding + tracking separately. Test: frontend lint/web-build/tsc ✓; `scripts/test.sh` red ONLY on pre-existing backend Prisma `baSession` seed test in `apps/api` — unrelated; tracked separately. Standing policy set for this epic: proceed when failures are pre-existing/unrelated `apps/api` baseline issues and all frontend checks pass.

### 2026-06-17 — Epic created from UI/UX audit

- Audit spec `apps/web/tests/e2e/audit/ui-audit.spec.ts` captured 14 pages ×
  desktop+mobile for live + demo (`docs/ui-audit/{live,demo}`).
- Findings + priority recorded in `docs/ui-audit/GAP-ANALYSIS.md`. Top items:
  Aset consolidated net-worth (P1), Transaksi filters/affordance (P2), Rekening
  card styling (P2), Ringkasan Komposisi viz (P2), Laporan tab overflow (P2).
- No application code changed in this run (audit + epic authoring only).
