# EPIC-001: Halaman Anggaran (Budget Page Port)

status: on-progress
environment: dev
retries: 0

## Goal

Port the Anggaran (Budget) page from the WealthMe HTML demo (`id="page-budget"`)
into a production-grade Next.js 16 App Router page.

The page must match the demo's layout, Indonesian copy, and interactions — using
React state, the project's shared primitives (`@/components/wm`, `@/lib/format`),
and Tailwind v4 token-based styling.

## Tasks

- [ ] Create `src/app/(app)/budget/page.tsx` with `"use client"` and inner content only
- [ ] Port budget summary cards (total budget, spent, remaining) using `SummaryCard`
- [ ] Port budget category list with `ProgressBar` per category
- [ ] Port "Tambah Anggaran" modal using `Dialog` from `@/components/ui/dialog`
- [ ] Wire Indonesian copy, `formatRupiah` formatting, and toast notifications
- [ ] Add responsive grid (`grid-cols-1 md:grid-cols-2`) for summary cards
- [ ] Verify no foundation files modified (`globals.css`, `lib/*`, `components/ui/*`, etc.)
- [ ] Add TypeScript props interfaces for all local components

## Acceptance Criteria

- Page renders at `/budget` without errors
- All text is Indonesian (no translation artifacts)
- `formatRupiah` used for all currency values — no hardcoded `Rp` strings
- `SummaryCard`, `ProgressBar`, and `StatusBadge` from `@/components/wm` used
- "Tambah Anggaran" modal opens and closes correctly
- `toast.success()` fires on successful budget save
- No `console.log` in production code
- No hardcoded hex colors — CSS variable tokens only
- Foundation files not modified
- `npm run build` passes with zero TypeScript errors
- No hardcoded secrets or credentials

## Automation Log

<!-- Automation appends results here after each run -->
