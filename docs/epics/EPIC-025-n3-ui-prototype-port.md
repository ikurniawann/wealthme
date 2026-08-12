# EPIC-025: N3 — Port the Approved Prototype into apps/web

status: on-progress
environment: dev
phase: 5
priority: P1
area: Frontend

## Goal

EPIC-024 Task N shipped a 35-page static-HTML prototype (`docs/prototype/`),
owner-approved 2026-08-11, describing the app's target visual/UX state. N1/N2
are done; N3 — actually porting the prototype into the live Next.js app — was
deliberately deferred as its own wave because it touches a protected
foundation file (`components/charts/*`, swapping to ApexCharts per EPIC-024
Design Decision #18) and spans ~26 app routes + 6 public/auth routes.

This epic is that port. Two independent workstreams:

1. **Chart-library foundation change** — ApexCharts added alongside the
   existing chart components (zero-risk merge), then swapped into its exactly
   two consumers (`beranda`, `laporan`) once proven on a page that has none
   today (`ringkasan`).
2. **Page-by-page visual port** — every route restructured to match the
   prototype's bento-grid layout and shadcn component classes, translated to
   Tailwind + `@/components/wm` (the prototype's CSS is a reference, never
   copied into `globals.css`).

Groups A–M of EPIC-024 already landed the _functional_ work the prototype
depicts (istri co-master, `/persetujuan`, liabilitas actions, investasi
lot/lembar+deposito+live prices, aset privacy toggle, lampiran uploads,
laporan COA matrix, master data CRUD, split-bill public access). **N3 is a
presentation wave — it ports layout/styling/charts, it does not re-scope
functional work Groups A–M already did.** The one hard rule across every task
group: **zero functional regression**. Every interactive affordance a page
has today must still work after its port — verified against the same
existing tests, unmodified, plus an explicit feature checklist in each PR.

## Ground Truth (read before starting any group)

- **Chart blast radius is tiny.** `@/components/charts/*` exports exactly
  `BarChart`, `Donut`+`DonutLegend`, `Sparkline` — consumed by exactly two
  pages: `apps/web/src/app/(app)/beranda/page.tsx` and
  `apps/web/src/app/(app)/laporan/page.tsx`, plus one type-only import
  (`DonutSegment`) in the **protected** `apps/web/src/lib/laporan-utils.ts`.
  Preserve that type's shape — do not let a chart swap become a `lib/*`
  foundation change.
- **ApexCharts is not installed.** Adding `apexcharts` + `react-apexcharts`
  is a new runtime dependency (~130–150 KB gzipped) — must be
  `next/dynamic(..., { ssr: false })`, verified with `next build`'s route-size
  table before/after.
- **Colors already match; structure does not.** Every prototype color token
  exists in `apps/web/src/app/globals.css` already. The prototype's
  _structural_ classes (`bento-hero`, `bento-stat`, `snapshot-row`,
  `list-row`, `segmented`, `page-card`, `chart-error`) exist only in
  `docs/prototype/assets/app.css` and must be translated to Tailwind +
  `@/components/wm`, never copied wholesale into `globals.css` (that would
  silently turn a page PR into an all-26-routes foundation change).
- **Chart scope is bigger than it looks.** The prototype renders 32 chart
  mounts across 12 pages; the real app renders ~7 today. Charts whose data a
  page already fetches fold into that page's wave; charts needing a new
  aggregate endpoint are cut and listed (see Group N3-J).
- **The EPIC-024-N-backend-gap-report.md is stale for functional findings.**
  It predates Groups A–M. Every "MISSING"/"PARTIAL" in that report needs
  re-verification against current source before being re-scoped — most are
  now closed. See Group N3-J for the specific items that are still genuinely
  open and need an explicit decision (cut, fold in, or spin off).

## Tasks

One task group = one branch = one PR to `development`. Execution order is in
`## Execution Order` below. `### N3-J` (the cut-list decisions) should land
first, as docs only, so no later page PR has to relitigate them mid-review.

- [x] ### N3-J — Cut-list decisions + follow-up task list (docs only) ✅
  - [x] **J1** — Record these as explicitly cut from N3 (prototype-invented or
        needs new backend, no task covers them): `iam.html` (custom
        roles/permissions/audit log — needs ≥3 new Prisma models, its own epic),
        `akses-saya.html` (per-role sidebar — `nav.ts`'s `ownerOnly` flag from
        A5 is a single-flag gate, not this page's per-role menu model),
        `join-token.html`'s tombstone copy (the real `/join/[token]` accept flow
        still works — do not replace it, that breaks pending invites), 2FA
        toggle on `akun.html`, "Unduh CSV" on persetujuan riwayat, `panduan`'s
        support-ticket dialog, `asuransi`'s invented premium-history chart,
        `akun`'s "Kekayaan Keluarga"/"Rekening Terhubung" family-card tiles,
        register page's consent checkbox (nothing records it), login page's PIN
        attempt-counter + "Perangkat dikenali" badge (need backend), login's
        inert "Ingat saya" checkbox (remove — same defect class as the D1 gembok
        fix).
  - [x] **J2** — Record these as follow-up tasks for a LATER epic (real gaps,
        backend work, out of N3's presentation scope): member edit/delete UI in
        `akun.html` (API already exists — `PATCH`/`DELETE
/family-groups/:fg/members/:id` — highest value-per-effort item found,
        just needs UI), head-resets-a-member's-password (promised in prototype
        copy, zero backend — a dependant who forgets a temp password is
        permanently locked out, flag to owner), session/device revocation on
        password reset (security-relevant, promised in copy, not implemented —
        do not port the reassuring copy until built), shared
        `extractApiErrorMessage` utility (duplicated in 15+ files,
        `apps/web/src/lib/*` is protected so this needs its own reviewed
        foundation PR), role-aware nav (beyond the single `ownerOnly` flag),
        `AllowanceRequest.rejectionReason` column (DTO already accepts `reason?`,
        no column to store it, no UI collects it — decide before N3-C ships
        persetujuan's reject dialog: cut the field or build the column).
  - [x] **J3** — Itemize, page by page, every prototype chart mount that has no
        real-app equivalent today (`ringkasan` 4, `investasi` 3, `laporan` 11 vs
        3 today, `dana`/`aset`/`asuransi`/`kalkulator`/`anggaran`/`rekening`/
        `warisan`/`liabilitas` 1–2 each) — decide per chart: fold into that
        page's wave (data already fetched) or cut and list (needs a new
        aggregate endpoint).

    **Decision table** (FOLD = page's wave builds it from data already
    fetched; CUT = needs a new aggregate endpoint, out of N3 scope, listed
    for a later epic):

    | Page         | Chart                                                    | Decision                                                      | Why                                                              |
    | ------------ | -------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------- |
    | `ringkasan`  | Net-worth trend (area)                                   | FOLD (N3-C2)                                                  | derivable from existing snapshot list                            |
    | `ringkasan`  | Income/expense bars                                      | FOLD (N3-C2)                                                  | same transaction list `beranda` already sums                     |
    | `ringkasan`  | Asset-allocation donut                                   | FOLD (N3-C2)                                                  | same aset list `beranda`'s donut already sums                    |
    | `ringkasan`  | Liability breakdown (hbar)                               | FOLD (N3-C2)                                                  | same liabilitas list already fetched                             |
    | `investasi`  | Portfolio value trend                                    | CUT                                                           | needs historical price snapshots, no time-series endpoint exists |
    | `investasi`  | Allocation-by-instrument donut                           | FOLD (N3-F2)                                                  | derivable from current holdings list                             |
    | `investasi`  | Lot performance sparkline                                | CUT                                                           | needs per-lot historical price series                            |
    | `laporan`    | 8 additional COA sub-category bars beyond the existing 3 | FOLD (N3-G2)                                                  | same COA matrix query M2 already returns, sliced differently     |
    | `dana`       | Category trend line                                      | FOLD (N3-B3)                                                  | derivable from existing dana entries                             |
    | `aset`       | Value-over-time sparkline                                | CUT                                                           | needs asset valuation history, not stored                        |
    | `asuransi`   | Premium-history chart                                    | CUT (also J1 — prototype-invented, no backend concept at all) |                                                                  |
    | `kalkulator` | Projection chart                                         | FOLD (N3-E2)                                                  | pure client-side computation, no fetch needed                    |
    | `anggaran`   | Budget-vs-actual bars                                    | FOLD (N3-E1)                                                  | derivable from existing budget + transaction data                |
    | `rekening`   | Balance trend sparkline                                  | CUT                                                           | needs balance history, not stored (only current balance)         |
    | `warisan`    | Beneficiary allocation donut                             | FOLD (N3-E3)                                                  | derivable from existing beneficiary list                         |
    | `liabilitas` | Payoff projection                                        | FOLD (N3-F4)                                                  | pure client-side amortization computation                        |

    CUT items (portfolio/lot value history, asset valuation history, account
    balance history) share one root cause: **no historical/time-series data
    is persisted anywhere in the schema for these entities.** They are one
    follow-up epic ("historical snapshots"), not five separate gaps —
    recorded under J2.

  - [x] **J4** — Fix EPIC-024's own Agent Routing table: `ui-ux-pro-max` skill
        referenced for Group N does not exist on this machine — use
        `frontend-design` + `dataviz` instead.

- [ ] ### N3-A — ApexCharts foundation (added alongside, zero page changes)
  - **A1** — Add `apexcharts` + `react-apexcharts` to `apps/web/package.json`;
    record measured gzipped bundle delta in the PR body.
  - **A2** — `apps/web/src/components/charts/apex-base.tsx`: `"use client"`,
    `next/dynamic(..., { ssr: false })`, a `cssVar()` token reader, shared
    base grid/tooltip/legend/font options, and a theme-change re-render
    registry (port `docs/prototype/assets/charts.js:60-123`'s
    `registry.push({chart, build})` pattern — `next-themes` needs this wired
    explicitly, it is not automatic).
  - **A3** — `apps/web/src/components/charts/apex-presets.tsx`: one exported
    component per prototype preset —`CashflowChart` (grouped bar),
    `TrendChart` (gradient area), `DonutChart`, `SparklineChart` (area,
    `sparkline.enabled`), `HBarChart`, `RadialChart` (port
    `docs/prototype/assets/charts.js:127-260`). `DonutChart` accepts the
    **existing** `DonutSegment[]` type — never redefine that shape.
  - **A4** — `apps/web/src/components/charts/chart-error.tsx` + wire the
    failed-`render()` fallback so a broken chart degrades to a labeled error
    card, not silent whitespace or an uncaught throw.
  - **A5** — Unit tests for the preset option-builders as pure functions
    (extract option-building logic so it's testable without mounting Apex in
    jsdom — Apex measures SVG geometry jsdom does not implement).
  - **A6** — Confirm `jest.setup.ts`'s existing `ResizeObserver`/`matchMedia`
    polyfills (there because of `sparkline.tsx`) still cover what Apex needs;
    do not remove them in N3-I without checking.
  - **Exit**: `scripts/test.sh` green; `next build` route-size table for
    `/beranda` and `/laporan` **unchanged** (nothing imports the new module
    yet).

- [ ] ### N3-B — Wave 1: small pages, establish translation conventions
  - **B0** — Write the prototype-class → Tailwind/`@/components/wm`
    translation table into this epic's Automation Log (or a linked doc):
    `bento-*`, `stat`, `snapshot-row`, `list-row`, `segmented`, `notice`,
    `card__header/__title/__action`, `page-card`. Every later wave cites it
    instead of re-deriving it.
  - **B1** — Port `notifikasi`.
  - **B2** — Port `panduan` (cut the support-ticket dialog per J1).
  - **B3** — Port `dana`.
  - **B4** — Port `quickinput`.
  - **B5** — Port `ai`.

- [ ] ### N3-C — Wave 2: mid pages + ApexCharts proving ground
  - **C1** — Port `persetujuan`: add client-computed stat tiles (Menunggu /
    Disetujui bulan ini / Ditolak bulan ini) from the already-fetched list;
    decide the reject-reason field per J2 (cut, or build the column first);
    cut "Unduh CSV" per J1.
  - **C2** — Port `ringkasan` **and** add its 4 ApexCharts mounts — this is
    the **go/no-go gate for the whole ApexCharts swap**: a page with no
    existing chart to regress, first real SSR/hydration/theme-toggle proof
    on a live DEV deploy. Do not start N3-G until this is verified working.
  - **C3** — Port `masterdata`.
  - **C4** — Port `tujuan`.

- [ ] ### N3-D — Wave 3: forms/tables, no chart dependency
  - **D1** — Port `tax`.
  - **D2** — Port `mastercoa`.
  - **D3** — Port `rekening`.
  - **D4** — Port `donation`.

- [ ] ### N3-E — Wave 4: large, dialog-heavy, verify recent merges
  - **E1** — Port `anggaran`.
  - **E2** — Port `kalkulator`.
  - **E3** — Port `warisan`.
  - **E4** — Port `transaksi` — verify Group L's attachment UI (upload,
    view, delete) survives the port unchanged.
  - **E5** — Port `splitbill` — verify Group F's ≤375px responsive dialogs;
    `apps/web/tests/e2e/.../epic-023-i2-splitbill-390.spec.ts` (or current
    equivalent) must stay green.

- [ ] ### N3-F — Wave 5: largest pages, verify Group C/D/G merges
  - **F1** — Port `aset` — verify Group D1's eye/privacy toggle and D2's
    fixed-Rp depreciation mode.
  - **F2** — Port `investasi` — verify Group C2/C3's lot/lembar toggle,
    deposito, purchasedAt date picker, and live-price refresh.
  - **F3** — Port `asuransi` (cut the invented premium-history chart per
    J1).
  - **F4** — Port `liabilitas` — verify Group G1's Detail/Edit/Hapus/Bayar
    actions.
  - **F5** — Port `rekonsiliasi`.

- [ ] ### N3-G — Wave 6: the chart swap (the two real consumers)
  - **G1** — Port `beranda` to the bento-hero layout **and** replace
    `Sparkline`/`Donut`/`BarChart` with the Apex presets from N3-A.
    `beranda.test.tsx` must pass unmodified.
  - **G2** — Port `laporan` (large file — consider splitting into a
    chart-swap-only PR and a layout-port PR) **and** replace
    `BarChart`/`Donut`/`DonutLegend`. `laporan-balance.test.tsx`,
    `laporan-utils.test.ts`, `laporan-period.test.ts` must pass unmodified.
    Group M2's `rcoa` COA-matrix tab behavior must be unchanged.

- [ ] ### N3-H — Wave 7: public/auth surfaces
  - **H1** — Port `login`: build the PIN keypad (3×4 grid + dots) as pure
    UI; remove the inert "Ingat saya" checkbox per J1; cut the attempt
    counter and "Perangkat dikenali" badge per J1 (need backend).
  - **H2** — Port `register`: keep the password-strength meter (pure UI);
    cut the consent checkbox per J1.
  - **H3** — Port `lupa-password` + `ubah-password-wajib`: **delete** the
    head-resets-a-member's-password promise from the copy unless J2's
    follow-up task builds it first.
  - **H4** — Port `reset-password`: **delete** the session/device
    revocation promise from the copy unless J2's follow-up task builds it
    first.
  - **H5** — Port `/split/[shareToken]`.
  - **H6** — Do **not** port `join-token.html`'s tombstone content — the
    real accept flow (`apps/web/src/app/join/[token]/page.tsx`) still works
    and must not be replaced.

- [ ] ### N3-I — Wave 8: cleanup
  - **I1** — Delete `bar-chart.tsx`, `sparkline.tsx`, the old `Donut` render
    path. Relocate/keep the `DonutSegment` type so
    `apps/web/src/lib/laporan-utils.ts` stays untouched. Gate: `grep -rn
"components/charts" apps/web/src` returns only the new Apex module.
  - **I2** — Update `apps/web/WM_CONVENTIONS.md` §Charts,
    `apps/web/AGENTS.md`, root `CLAUDE.md`, and any architecture/design-system
    docs referencing the old chart components.
  - **I3** — Append the N3 outcome and every N3-J decision to this epic's
    Automation Log.

## Acceptance Criteria

Every page PR (Waves N3-B through N3-H) must satisfy all of:

1. **Structure matches the prototype** — section order, card grouping,
   header/action placement, and the bento-grid breakpoints (12-col desktop →
   2-col tablet → stacked mobile, no horizontal scroll) match
   `docs/prototype/pages/<page>.html`. Verified at 390 / 768 / 1440px.
2. **No new CSS in `globals.css`** — prototype classes translated to
   Tailwind + `@/components/wm`, never copied wholesale. A genuinely
   reusable primitive is added to the page file first; promotion to
   `components/wm/*` is a separate, explicitly-reviewed foundation PR.
3. **Zero functional regression** — every interactive affordance the
   _current_ page has still works: every dialog opens and submits, every
   filter filters, every mutation hits the same endpoint with the same
   payload, every error path surfaces the same message. The PR description
   enumerates the page's features and ticks each one off.
4. **Existing tests pass unmodified** — the page's colocated test suite
   passes without editing assertions. A test needing rewriting signals the
   port changed behavior, not just presentation — call it out explicitly and
   re-justify it in the PR body if truly unavoidable (e.g. a heading moved
   into a card header).
5. **A11y not regressed** — `aria-labelledby` on sections, `aria-selected`
   on segmented controls, `aria-hidden` on decorative icons carried over
   from the prototype. Existing a11y/modal-geometry E2E specs stay green.
   Dialog widths keep the `max-w-[min(Npx,calc(100%-2rem))]` guard.
6. **Honest UI** — any control the prototype draws with no backend does not
   ship as a live-looking control; per J1/J2, either cut it or ship visibly
   disabled/labeled.

Wave N3-G pages additionally require:

7. **Chart parity** — same series/categories/totals as before the swap,
   verified against a hand-computed value, not the implementation's own
   output. Colors resolve from CSS custom properties and re-render correctly
   on theme toggle without a page reload.

## Definition of Done

See [`../DEFINITION-OF-DONE.md`](../DEFINITION-OF-DONE.md). Additionally:

- N3-A ships and soaks with **zero page changes** before any page group
  starts — `next build`'s route-size table for `/beranda`/`/laporan` proves
  nothing references the new chart module yet.
- N3-C2 (`ringkasan`, the first real ApexCharts page) is verified working on
  a live DEV deploy — SSR, hydration, and theme toggle — before N3-G (the
  actual `beranda`/`laporan` chart swap) starts. This is a hard go/no-go
  gate, not a suggestion.
- N3-G's two PRs each pass their existing colocated test suites (
  `beranda.test.tsx`; `laporan-balance.test.tsx`, `laporan-utils.test.ts`,
  `laporan-period.test.ts`) **unmodified**.
- N3-I1's cleanup only runs after every N3-G PR has merged and soaked —
  deleting the old chart components while a page group still imports them
  breaks the build.
- Every N3-J decision (cut, fold-in, or follow-up-task) is recorded in this
  epic's Automation Log before the wave that would otherwise re-litigate it
  starts.

## Test Plan

- **Unit** — Apex preset option-builders as pure functions (N3-A5); existing
  page test suites re-run unmodified per page (acceptance criterion #4).
- **Integration** — none expected; N3 is presentation-only, no API changes.
- **E2E (Playwright)** — existing a11y/modal-geometry/responsive specs must
  stay green per page; `ringkasan` (N3-C2) gets an explicit chart-render
  smoke check before N3-G starts.
- **Manual/DEV** — theme toggle (light/dark) on both N3-G pages after the
  swap; visual side-by-side against the prototype at 390/768/1440px for a
  sample of pages per wave (not exhaustively every page).

## Agent Routing

Reuses the protocol EPIC-024 proved out. `code-agent` implements each page
group; `ecc:react-reviewer` + `ecc:typescript-reviewer` + `review-qa-agent`
(WM conventions, protected-path creep check, acceptance-criteria checklist)
gate every PR. `ecc:security-reviewer` additionally on N3-H (auth surfaces).
`database-reviewer` not needed — no schema changes in this epic by design.

### Execution order — waves

**J → A → (B, C, D, E, F in dependency-aware parallel; C2 gates G) → G → H
(parallel with B–F, no shared conventions) → I**

- **N3-J** first, docs-only — records every cut/fold-in/follow-up decision
  so no later PR re-litigates them mid-review.
- **N3-A** next, alone — the chart foundation, zero page changes, must merge
  and soak before any page imports it.
- **N3-B through N3-F** are **fully parallelizable across worktrees** — they
  touch disjoint page files. The only realistic conflict surface is the i18n
  dictionaries (`i18n/id.ts`/`en.ts` — structures must stay identical) and
  `package.json` (N3-A only).
- **N3-C2 is a hard gate** for N3-G — do not start the `beranda`/`laporan`
  chart swap until `ringkasan`'s Apex charts are proven on a live DEV
  deploy.
- **N3-H** (public/auth) shares no conventions with the `(app)`-shell waves
  and can run in parallel with any of B–F.
- **N3-I** (cleanup) only after every N3-G PR has merged and soaked.

### Mandatory before touching shared code

`graphify-out/graph.json` exists — query blast radius before editing
anything shared: `components/charts/*` (protected, N3-A/N3-G), `lib/env.ts`-
adjacent files are NOT in scope here but any accidental touch to
`apps/web/src/lib/*` (e.g. `laporan-utils.ts` for `DonutSegment`) is an
explicit reviewed foundation change, not a page-PR side effect.
`apps/web/src/app/globals.css` must show **zero diff** across this entire
epic — that is the single clearest signal a page PR overstepped scope.

## Risk Notes

- **SSR/hydration** — ApexCharts needs `window` at module scope in some
  builds; must be `next/dynamic(..., { ssr: false })` **inside**
  `apex-base.tsx`, not at each page call site (client components still
  pre-render on the server in Next 16's RSC model — `"use client"` alone is
  not sufficient).
- **jsdom** — Apex measures SVG geometry jsdom doesn't implement; keep
  option-building in pure functions and test those, not full Apex mounts.
- **Bundle size** — the single biggest dependency this app would take on;
  must land in a page chunk via dynamic import, not the shared bundle, or
  every route (including `/login`) pays for it.
- **Theme re-render** — needs explicit wiring (the registry pattern in
  N3-A2); without it, dark-mode charts keep light-mode colors until reload.
- **Animation flakiness in E2E** — disable Apex animations deterministically
  for visual checks, not `waitForTimeout` (the prototype's own `?static=1`
  escape hatch exists for exactly this reason).
- **Silent functional regression is the dominant risk, not visual
  mismatch** — Waves E/F/G rewrite the presentation of pages whose behavior
  was merged days ago (EPIC-024 Groups C/D/G/L/M). A reviewer comparing
  against the prototype screenshot will not notice a dropped `onClick`.
  Acceptance criterion #3 (explicit feature enumeration) and #4 (no
  editing existing test assertions) are the actual guardrails here.
- **`akun/page.tsx` (3370 lines) is deliberately not in any wave** — it
  exceeds the 800-line file guidance by 4× and was excluded from this epic's
  scope pending a decision on whether to port it wholesale or split it into
  sub-component files first (the `akun/` directory's existing extracted
  bodies — `profil-body`, `keamanan-body`, `pengaturan-body` — suggest the
  pattern). Decide before scheduling it; not currently blocking any other
  wave.
- **Protected-path creep via `app.css`** — the single most tempting mistake
  in this epic; `review-qa-agent` must check every PR's diff for any new
  rule in `globals.css`.
- **Prototype depicts target state, not current state** (its own README
  says so) — when a page PR discovers a "missing" feature, check Groups A–M
  first; the default answer is "already built, port it," not "build it."

## Relationship to Other Epics

- **EPIC-024** (`ready-for-qa`) — N1/N2 (the prototype itself) are done and
  owner-approved there; this epic is N3, deliberately split out per that
  epic's own Group N section ("Implementation to follow as its own planned
  wave after N2 ... will need its own migration plan"). EPIC-024's Groups
  A–M supply the functional behavior this epic ports the presentation for —
  do not re-implement anything from those groups here.
- **EPIC-024-N-backend-gap-report.md** — the source audit this epic's plan
  is built from; treat its findings as requiring re-verification against
  current source (see Ground Truth above and Group N3-J), not as a fresh
  task list.

## Done Signal

Each group closes independently through `/task-work`. The epic closes when
all waves N3-A through N3-I have merged, `apps/web/src/app/globals.css` shows
zero diff across the entire epic, `grep -rn "components/charts"
apps/web/src` returns only the new Apex module, and the owner has walked a
side-by-side comparison of a representative page from each wave against its
prototype counterpart.

## Automation Log

- 2026-08-12 — Epic created from a `planner` agent run scoping EPIC-024 Task
  N3. Read `docs/prototype/README.md`, representative prototype pages,
  `docs/epics/EPIC-024-N-backend-gap-report.md` (flagged as stale for
  functional findings — Groups A–M merged since), the parent epic's Group N
  section, current `components/charts/*`, and current page structure to
  ground the plan in actual source, not assumptions. No code changed.
- 2026-08-12 /epic-loop EPIC-025 #1 "N3-J — Cut-list decisions + follow-up
  task list (docs only)" → PASS (attempts: 1). Fixed EPIC-024's Agent
  Routing table (`ui-ux-pro-max` skill doesn't exist on this machine —
  corrected to `frontend-design`+`dataviz`). Expanded J3 into a full
  per-page chart fold-in/cut decision table (11 charts: 7 FOLD into their
  page's wave, 4 CUT — all 4 share one root cause, no historical/
  time-series data persisted for portfolio value, lot prices, asset
  valuation, or account balance; recorded as one follow-up "historical
  snapshots" epic under J2, not five separate gaps). PR: https://github.com/andrsrjld/wealthme-web/pull/269
