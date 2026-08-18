# EPIC-028: PDF export on pdfcn + frontend structure refactor

status: backlog
environment: dev
retries: 0

> Runs **after** EPIC-027 merges. `akun/page.tsx` and
> `components/shell/transaction-dialog.tsx` are edited by both epics; starting
> a refactor wave on either before EPIC-027 lands guarantees conflicts.

## Goal

1. Replace the hand-drawn `pdf-lib` report writer with **pdfcn on Takumi**,
   rendered from a Next.js route handler, and give the six reports a real
   branded layout.
2. Make `apps/web` maintainable by a future AI session: no file over 500
   lines, a documented page-folder layout, and a lint rule that keeps it that
   way.

`theme-factory` was evaluated and **dropped**: it is a curated font/colour
preset picker for presentation artifacts, not a refactoring tool, and
contributes nothing to either goal.

## Evidence

| Claim                                                                                                                                                                              | Where                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| PDF generation is server-side, `pdf-lib`, hand-drawn A4 tables                                                                                                                     | `apps/api/src/exports/pdf-report-writer.util.ts` (157 lines), `apps/api/package.json:48`                                     |
| Delivery is a base64 data URI through a BullMQ job + polling                                                                                                                       | `exports.service.ts:433-476`, `exports.processor.ts`, `apps/web/src/app/(app)/laporan/_components/export-section.tsx:66-153` |
| Six report types                                                                                                                                                                   | `exports.service.ts` — `summary`, `bank`, `detail`, `pnl`, `balance-sheet`, `cashflow`                                       |
| PDF export exists on `/laporan` only; other PDF mentions are attachments and rekonsiliasi import rejection                                                                         | `transaksi/page.tsx:688`, `rekonsiliasi/page.tsx:1033`                                                                       |
| `takumi-pdf`: WASM, Node/Bun/Workers/Next.js entry point, JSX + Tailwind, CSS page-breaks, repeating headers with page counters, tagged PDF/A, explicit font registration required | https://takumi.kane.tw/docs/pdf                                                                                              |
| Forme is 3 packages + CLI, license unstated, Enterprise-gated features                                                                                                             | https://docs.formepdf.com                                                                                                    |
| pdfcn: MIT, 721 stars, **69 commits**; docs state neither runtime nor peer deps                                                                                                    | https://github.com/shadcn-labs/pdfcn                                                                                         |
| `apps/web/src` is 63,127 LOC; eleven page files exceed the project's own 500-line rule                                                                                             | measured 2026-08-18                                                                                                          |
| `apps/web/CONTEXT.md` already exists and is agent-loaded                                                                                                                           | `apps/web/CONTEXT.md` (7 KB)                                                                                                 |
| The test gate runs Jest + build only — Playwright specs never execute                                                                                                              | `scripts/test.sh:19-25`                                                                                                      |

Oversized page files (lines):

| File                    | Lines |
| ----------------------- | ----- |
| `akun/page.tsx`         | 3703  |
| `rekonsiliasi/page.tsx` | 2338  |
| `investasi/page.tsx`    | 1909  |
| `liabilitas/page.tsx`   | 1805  |
| `asuransi/page.tsx`     | 1784  |
| `transaksi/page.tsx`    | 1676  |
| `aset/page.tsx`         | 1575  |
| `anggaran/page.tsx`     | 1357  |
| `kalkulator/page.tsx`   | 1300  |
| `warisan/page.tsx`      | 1298  |
| `splitbill/page.tsx`    | 1154  |

## Decisions

| #   | Decision                                                                       | Rejected alternative                                                                        |
| --- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| D1  | pdfcn on **Takumi** (`takumi-pdf`)                                             | Forme (3 packages, CLI, unclear license, Enterprise tier)                                   |
| D2  | Render in a **Next.js route handler in `apps/web`**                            | Running React SSR inside the NestJS worker; browser-side rendering                          |
| D3  | PDF becomes a **synchronous streamed download**; BullMQ keeps serving CSV only | Enqueuing PDF too (worker would have to HTTP-call the web app)                              |
| D4  | Branded, table-based layout for all six reports                                | Straight port (no user-visible gain); charts (needs a vector rendering path per chart type) |
| D5  | Refactor proves the pattern on two files, then rolls out in waves, one PR each | All 11 files in one sweep; refactor-only-when-touched                                       |
| D6  | **Characterization tests written first** on each target                        | Relying on TypeScript + manual QA                                                           |
| D7  | Convention documented in `apps/web/CONTEXT.md`                                 | Per-folder CONTEXT.md files (27 more files to rot); generated codemaps                      |
| D8  | ESLint `max-lines` **error at 500** with a shrinking allowlist                 | Warn-only; docs-only                                                                        |
| D9  | `theme-factory` dropped entirely                                               | Using it for a visual pass                                                                  |

## Tasks

### Group C — PDF export on pdfcn

- [ ] C1 — Install pdfcn + `takumi-pdf` in `apps/web`; shared font registration module (Latin subset)
- [ ] C2 — Next.js route handler: fetch report data from the Nest API with the caller's token forwarded, render, stream the PDF
- [ ] C3 — Shared branded document shell — header/logo, family name + period, "page x of y" footer, zebra rows, right-aligned Rupiah — reusing Tailwind tokens
- [ ] C4 — Port all six report types onto the shell
- [ ] C5 — `/laporan` export switches PDF to a direct download; job polling remains for CSV only
- [ ] C6 — Delete `pdf-report-writer.util.ts`, `buildPdf`/`buildPdfContent`, and the `pdf-lib` dependency

### Group D — Frontend structure refactor

- [ ] D1 — Characterization tests for `akun/page.tsx`
- [ ] D2 — Refactor `akun` → `page.tsx` + `_components/*` + `_hooks/*`, every file under 500 lines, tests unchanged and green
- [ ] D3 — Characterization tests for `rekonsiliasi/page.tsx` (one test file exists today)
- [ ] D4 — Refactor `rekonsiliasi` to the same layout
- [ ] D5 — Write the convention into `apps/web/CONTEXT.md` (folder layout, 500-line rule, shared primitives, protected files)
- [ ] D6 — ESLint `max-lines` error at 500 + allowlist of the nine remaining files
- [ ] D7…D15 — One wave per remaining oversized file, allowlist shrinking each time

## Acceptance Criteria

- All six reports download as PDFs rendered by pdfcn/Takumi, with the branded shell and correct pagination.
- `pdf-lib` no longer appears in `apps/api/package.json`.
- The PDF route never returns data the API would not have returned to that user (`canSeePrivate` stays server-authoritative).
- Refactored pages behave identically: characterization tests pass unmodified.
- No file in `apps/web/src` exceeds 500 lines except those on the allowlist, and CI fails on a new violation.

## Test Plan

- Unit: document shell rendering per report type, font registration, page-break behaviour on a long `detail` report.
- Characterization: per refactor target, written before the move.
- Manual: download each of the six reports and compare against the current output.
- Gates: `scripts/qa.sh`, `scripts/test.sh`, `scripts/security-check.sh`.

## Agent Routing

`ecc:react-reviewer` · `ecc:typescript-reviewer` · `ecc:security-reviewer` (C2 token forwarding) · `ecc:code-simplifier` (Group D) · `ecc:pr-test-analyzer` (D1/D3) · `test-agent`.

## Risks

- pdfcn is 69 commits old with thin docs. If its component layer disappoints, fall back to using `takumi-pdf` directly — same output, no registry dependency.
- C2 routes report data through the web tier; the handler must forward the user's token and widen nothing.
- Group D waves must not touch `akun/page.tsx` until EPIC-027 Group A5 has merged.

## Done Signal

Groups C and D wave 1 merged to `development` with gates green; remaining D waves tracked as separate task groups in this file.

## Automation Log

- 2026-08-18 — Epic created from a `/grilling` session. `theme-factory` was
  investigated and rejected as unfit for the stated purpose (it themes
  presentation artifacts, it does not refactor code); the maintainability goal
  was re-scoped onto file structure, characterization tests and lint
  enforcement instead.
