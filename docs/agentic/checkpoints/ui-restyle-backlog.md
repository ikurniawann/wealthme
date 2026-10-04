# UI/UX restyle backlog — task-loop breakdown

**Goal:** Work through `docs/audits/ui-ux-audit.md` findings via bounded
`/task-loop` runs (per `program.md`), frontend-only (`apps/web`), no API
changes. Skills in use: `impeccable` (craft floor + critique framework) and
`ui-ux-pro-max` (priority-ranked UX rule database) — both already installed
locally under `.agents/skills/`, no install step needed.

**Why broken into multiple task-loops instead of one big change:**
`/task-loop` is explicitly bounded to one feature/defect with check-first
acceptance criteria and at most two repair rounds (`.claude/commands/task-loop.md`,
`program.md`). The audit covers 10 dimensions across ~9 pages — too large for
one bounded run, and `components/ui/*`, `wm/*`, `shell/*` are protected
foundation paths that need an explicit, narrow justification per touch
(`WM_CONVENTIONS.md`), not a blanket rewrite.

## Ordered backlog (one task-loop each)

| #   | Task                                                                                                             | Severity                            | Foundation paths touched                                        | Status                                 |
| --- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------- | -------------------------------------- |
| 1   | Mobile dock stays reachable while scrolled                                                                       | P0                                  | `bento.css` only                                                | **done** — see `results.md` 2026-10-05 |
| 2   | Fix `Sfmono-Regular` token violation                                                                             | P1                                  | `masterdata.css` (page-local, not foundation)                   | **done** — see `results.md` 2026-10-05 |
| 3   | Fix `transition: width` layout-thrash                                                                            | P1                                  | `beranda.css` (page-local)                                      | **done** — see `results.md` 2026-10-05 |
| 4   | Trace/fix missing TanStack Query `queryFn`                                                                       | P1                                  | `hooks/use-my-access.ts`                                        | **done** — see `results.md` 2026-10-05 |
| 5   | Consistent money formatting (DM Mono/tabular) on Dana                                                            | P1                                  | page-local (`dana/`)                                            | **done** — see `results.md` 2026-10-05 |
| 6   | Resolve contradictory goal status on Tujuan                                                                      | P1                                  | page-local (`tujuan/`)                                          | **done** — see `results.md` 2026-10-05 |
| 7   | Account card color differentiation defaults                                                                      | P2                                  | `wm/` (AccountCard) — foundation, needs narrow justification    | **done** — see `results.md` 2026-10-05 |
| 8   | IAM access matrix a11y labeling                                                                                  | P2                                  | page-local (`iam/_components/page-access-matrix.tsx`)           | **done** — see `results.md` 2026-10-05 |
| 9   | Required-field indicators + inline validation on Tambah Transaksi                                                | P2                                  | shared modal — check if foundation or page-local before scoping | **done** — see `results.md` 2026-10-05 |
| 10  | "Penghasilan Bulanan" field in profile modal has no thousand-separator live formatting                           | P1 (user-flagged, same theme as #5) | `akun/page.tsx` (page-local)                                    | **done** — see `results.md` 2026-10-05 |
| 11  | Card pattern swatches "Gelombang" and "Polos" render identically (no visual difference) in "Ubah tampilan kartu" | P1 (user-flagged)                   | `bento.css` (`.wm-plate[data-pattern="waves"]`)                 | **done** — see `results.md` 2026-10-05 |

Each row becomes its own `checks/drafts/<task>.md` → review → `checks/approved/`
→ implementation → `results.md` entry, in order. P0 first (highest impact,
narrowest blast radius, already root-caused).

## uiarc.dev decision — flagged, not resolved

User wants "component terbaik" from `uiarc.dev` (a shadcn-compatible
component/block registry) swapped in for weak UI. Confirmed conflict:
Arc's flagship blocks lean on **donut charts** and **primary data tables**,
both explicitly banned in `apps/web/DESIGN.md` ("Don't use... donut charts,
or a data table as the primary page surface"). Recommendation standing from
the earlier investigate turn: adopt Arc **selectively**, only for primitives
genuinely missing from `components/ui`/`wm` (e.g. command palette, date
range picker), restyled to WealthMe tokens — never its chart/table blocks
wholesale. This needs an explicit per-component decision, not a blanket
"replace ugly UI with Arc." Not blocking the P0 fix; will surface again if a
later backlog task needs a net-new component Arc could supply.

## Next command on resume

Resume with task #1: get the user's approval on
`checks/drafts/p0-mobile-dock-reachability.md`, then copy to
`checks/approved/` and run the implementation round per `.claude/commands/task-loop.md`
step 4–6. Do not reload the full conversation — this file plus `MEMORY.md`
plus the draft checks file are sufficient context.
