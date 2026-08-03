# EPIC-020: Transaction Detail, Report Period Filters & PDF Export Fix

status: backlog
environment: dev
retries: 0
phase: 4
priority: P1
area: Full-stack
source: User request 2026-07-24 (items #1 transaksi detail, #3 report date filters, #4 PDF export broken)

## Goal

Three independent, mostly-mechanical fixes to the two "read your money" surfaces
(`/transaksi` and `/laporan`) that currently mislead the user:

1. **Transaction rows are dead.** A user expects to tap a transaction and see
   its full detail; today rows only expose edit/delete and there is no detail
   view at all.
2. **Report period filters are missing.** Only the daily report has a real date
   picker; every other report section shows a fixed or hard-coded-`now` window
   the user cannot change. The user wants a year/month/date filter across **all**
   report sections.
3. **PDF export is broken.** "Export PDF" never produces a PDF — the backend
   returns plaintext with a `text/plain` data URI, so the download is a mislabeled
   text stub, not a report.

Each is its own `/task-work` group; none depends on the others.

## Evidence

Verified against the current tree, 2026-07-24:

- **#1 — rows are not clickable.** `apps/web/src/app/(app)/transaksi/page.tsx`
  `TxRow` (`:103-157`) renders a plain `<div>` with only a `RowActions`
  (edit/delete) control; there is no row `onClick` and no detail dialog. The
  only modal is `EditTransactionDialog` (`:159-272`). `TransactionDto` already
  carries the fields a detail view needs (id, type, amount, description,
  categoryName, accountName, occurredAt, createdAt) — used at `:112-119`.
- **#3 — filters exist on one section only.** `apps/web/src/app/(app)/laporan/page.tsx`
  is a single page with a `TABS` array of ~11 sections
  (Ringkasan, Harian, Bulanan, Tahunan, Group Family, Bank, Detail, Aliran Dana,
  PNL, Balance Sheet, Cashflow — section headers at `:194,444,554,637,719,840,924,1001,1118,1250,1384`).
  Only **Harian** has a real date input (`value={date}`, `:485`, added by commit
  `04a13a3`). Bulanan/Tahunan derive from a fixed `summary.points` window
  (`:563,646`); Aliran Dana / PNL / Balance Sheet / Cashflow hard-code the
  current month via `now` (`:1055-1057,1158`). No shared year/month/date filter.
- **#4 — "PDF" is a plaintext stub.** `apps/api/src/exports/exports.service.ts`
  `buildPdf` (`:360-532`) builds a plaintext report and returns
  `` `data:text/plain;base64,${b64}` `` (`:529-531`) — it never generates a PDF
  binary. The frontend `handleDownload`
  (`apps/web/src/app/(app)/laporan/page.tsx:2192-2213`) maps
  `data:application/pdf → .pdf` but the URL is `data:text/plain`, so it even
  names the file `.txt`. Excel/CSV go through the same job pipeline
  (`exports.service.ts:356-357`) and are unaffected.

## Tasks

- [ ] ### A — Clickable transaction rows → detail view
  - Make each `TxRow` open a **read-only transaction detail** (dialog or drawer)
    showing all `TransactionDto` fields: type, amount, category, account,
    date/time, description, created-at. Keep the existing edit/delete actions
    reachable from the detail view (or leave `RowActions` in place alongside).
  - Reuse `@/components/wm` + `@/components/ui/dialog` per WM conventions; do not
    rebuild a modal primitive. Keep the row keyboard-accessible (button/role).
  - Preserve current filter/sort/day-grouping behavior unchanged.

- [ ] ### B — Consistent year/month/date filter across all report sections
  - Add a shared period selector (year + month + optional day/range) that drives
    **every** report section, not just Harian. Sections that currently ignore
    user input (`now`-hard-coded and fixed-window ones) must re-query for the
    selected period.
  - Wire the selected period through to the report API calls each section makes
    (the reports service already accepts `startDate`/`endDate`/`months`
    parameters — see `exports.service.ts:360-527` call sites into
    `reportsService.*`), so the filter is honored server-side, not just visually.
  - One filter pattern, reused across sections — do not hand-roll a different
    picker per tab. Match the existing Harian date-input styling.

- [ ] ### C — Real PDF export
  - Replace the plaintext stub in `buildPdf` (`exports.service.ts:360-532`) with
    **actual PDF generation** (a server-side PDF library, e.g. `pdfkit` /
    `pdf-lib` — final choice belongs to `/plan`), returning a
    `data:application/pdf;base64,…` URL (or a real file the existing job/download
    pipeline serves).
  - The rendered PDF must contain the same report content the text stub produced
    for each `ExportReportType` (summary, bank, detail, pnl, balance-sheet,
    cashflow), formatted as a readable document.
  - Frontend `handleDownload` already recognizes `data:application/pdf` → `.pdf`
    (`laporan/page.tsx:2199-2209`); once the MIME is correct the file downloads
    as a real `.pdf`. Excel/CSV paths must remain working.

## Acceptance Criteria

- **#1:** clicking/tapping any transaction row opens a detail view with all of
  its fields; edit and delete remain reachable; list filter/sort/grouping is
  unchanged; the row is keyboard-operable.
- **#3:** changing the year/month/date filter re-queries and updates **every**
  report section (not only Harian) with server-honored date bounds; one shared
  filter component is used across sections.
- **#4:** "Export PDF" downloads a genuine `.pdf` (correct `application/pdf`
  MIME) containing the selected report's data; Excel/CSV exports still work; the
  export job never returns `status: failed` for a valid request.
- All static gates green: `scripts/qa.sh`, `scripts/test.sh`,
  `scripts/security-check.sh`.

## Test Plan

- **Unit/component:** (A) detail view renders each `TransactionDto` field and
  handles null description/category; (B) the period filter maps a
  year/month/day selection to correct `startDate`/`endDate` bounds; (C)
  `buildPdf` returns a `data:application/pdf` URL whose decoded bytes start with
  the `%PDF-` header for every `ExportReportType`.
- **Integration:** (B) each report endpoint returns data scoped to the selected
  period; (C) the export job for `format: "pdf"` reaches `status: done` with a
  `application/pdf` downloadUrl and does not fail.
- **E2E (Playwright):** open `/transaksi`, click a row, assert the detail view
  shows the expected amount/category/date; on `/laporan`, change the period
  filter and assert a non-Harian section's numbers change; click "Export PDF",
  assert the download is a `.pdf` and (if feasible) that its bytes begin `%PDF-`.
- **Smoke:** `/transaksi` and `/laporan` load after DEV deploy; a PDF export
  round-trips end to end.

## Agent Routing

`code-agent` + `shadcn` for the transaction detail view (Task A) and the shared
report filter (Task B); `ecc:react-reviewer` + `ecc:typescript-reviewer`
post-edit. Task C is backend: `nestjs-best-practices` + `ecc:docs-lookup`
(Context7 for the chosen PDF library API) + `ecc:typescript-reviewer`;
`ecc:build-error-resolver` if the new dependency breaks the build. `review-qa-agent`
for acceptance-criteria + honest-UI (no mislabeled downloads). Gates via
`test-agent` / `security-agent`; `deploy-agent` (DEV only). Per task:
`/task-work EPIC-020 <n>`.

## Done Signal

Each task group closes independently via `/task-work EPIC-020 <n>`. The epic
closes when: transaction rows open a real detail view; the report period filter
drives every section server-side; "Export PDF" downloads a genuine PDF; and the
acceptance criteria hold across a fresh QA pass of `/transaksi` and `/laporan`.

## Automation Log

<!-- Append automation results here. -->
