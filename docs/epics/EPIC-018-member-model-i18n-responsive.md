# EPIC-018: Per-Member Finances, i18n Coverage & Responsive UI

status: on-progress
environment: dev
retries: 0
phase: 4
priority: P2
area: Full-stack
source: `/nerve` QA audit 2026-07-19 (3-agent code audit, follow-up to EPIC-016/017)

## Goal

Close the three biggest gaps between what WealthMe _appears_ to promise and
what it actually does, surfaced by a full-app QA audit:

1. **Per-member finances.** A family member intuitively expects "my money" to
   be distinct from "the family's money," but today the roles
   `owner | member | admin_staff` differ **only** in CASL permissions with
   **zero data separation** — every member sees the same accounts, categories,
   and transactions, and a member's new transaction lands in a shared family
   account. This is the user's #1 confusion. Either build real per-member
   ownership ("pockets") or make the already-possible separate-family-group
   answer explicit (see Open Design Decisions).
2. **i18n coverage.** The language mechanism works and the `/akun` picker is
   real (per EPIC-016 B1), but the dictionary covers only ~52 keys across 3
   sections and only 2 of 25 app pages consume it. Switching to English
   visibly changes almost nothing, so the user perceives "the language
   doesn't change." Extend real bilingual coverage to the whole app.
3. **Responsive / empty space.** On tall desktop viewports, sparse pages
   (`beranda`, `ringkasan`) leave a large empty area below the content because
   the layout is a top-aligned vertical stack that never fills the viewport.
   Cosmetic, but it reads as "unfinished." Make sparse dashboards denser/more
   adaptive or consciously accept the whitespace.

This epic preserves every existing feature shape and stays backward-compatible;
each task group is independently shippable and independently gated.

## Evidence

From a 3-agent read-only code audit, 2026-07-19 (line refs verified against the
current tree):

- **Roles differ only by permissions, not data.**
  `apps/api/src/auth/casl-ability.factory.ts:38-97` defines all three roles
  (`owner | member | admin_staff`) as CASL ability sets over the _same_
  family-scoped data. There is **no** `createdByUserId` / `ownerUserId` on the
  financial models: `apps/api/prisma/schema.prisma` — `Account` (`:301-321`),
  `Category` (`:323-341`), `Transaction` (`:343-361`) are scoped **only** by
  `familyGroupId`. Confirmed: no per-member owner column exists. The
  `isPrivate` flag added in EPIC-016 B4 (`schema.prisma:312, 332`) is a
  per-item **HIDE** toggle, not per-member ownership — a private account is
  still a _family_ account, just hidden from `member` viewers.
- **Separate finances already achievable with no code:** one `FamilyGroup` per
  person (separate logins) fully isolates data today — this is a product
  decision, not a missing feature.
- **i18n is shallow.** Store + hook work (`apps/web/src/hooks/use-locale.ts:40-57`);
  the `/akun` picker is real (`apps/web/src/app/(app)/akun/page.tsx:918`, per
  EPIC-016 B1). But the dictionaries (`apps/web/src/i18n/id.ts`,
  `apps/web/src/i18n/en.ts`) hold only ~52 keys / 3 sections
  (`greeting` + `common` + `beranda`), and only **2 of 25** app pages
  (`beranda`, `akun`) call `useLocale`. The shell is hardcoded Indonesian:
  sidebar/nav (`apps/web/src/lib/nav` → `apps/web/src/components/shell/sidebar.tsx:105,158`),
  topbar, mobile nav, and `apps/web/src/components/shell/app-shell.tsx:29`
  ("Memuat WealthMe…"). ~1551 quoted multi-word literals across ~17k LOC in
  the remaining 23 pages. Net effect: EN mode changes almost nothing on screen.
- **`/panduan` is real content, hardcoded ID.**
  `apps/web/src/app/(app)/panduan/page.tsx` `JOURNEYS` (`:47-268`) is a genuine
  9-journey catalog with 1-2 sentence explanations (not just links) — decent
  content, but 100% hardcoded Indonesian and "Buka →" (`:306`) is a plain
  `router.push`. Not a defect; its strings fold into the i18n task.
- **Empty vertical space is a layout choice, not a bug.**
  `apps/web/src/components/shell/app-shell.tsx:55` — `<main>` is
  `flex-1 px-3.5 pb-20 pt-3.5 md:px-6 md:py-6`, full-width, no `max-width`,
  nothing stretches to viewport height. `apps/web/src/app/(app)/beranda/page.tsx:284`
  is a top-aligned `space-y` stack. On tall desktops, content height < viewport
  → empty area below. Data-heavy pages fill fine; only sparse pages
  (`beranda`, `ringkasan`) show the gap. LOW / cosmetic.

## Tasks

Phased per a 2026-07-25 codebase inventory: **2,204 hardcoded literals
confirmed across 25 pages** (higher than the original ~1500 estimate — see
Automation Log). Task B is dropped (superseded by EPIC-019). Task C runs last,
after A6, so it lands on top of an already-translated `ringkasan`.

- [x] ### A1 — i18n foundation + shell/nav (protected path, authorized) ✅
  - Extend `apps/web/src/i18n/types.ts` with a scalable per-page-section shape
    (keep `greeting`/`common`/`beranda`; add a `shell` section for shell-owned
    copy, mirroring the `beranda` section pattern).
  - Wire `useLocale` into `components/shell/app-shell.tsx` (line 29 loading
    text), `sidebar.tsx` (line 70 tooltip), `mobile-bars.tsx` (5 aria-labels:
    "Buka menu", "Menu Navigasi", "Cari", "Notifikasi", "Tambah transaksi"),
    `topbar.tsx` (search placeholder + "Keluar" aria-label),
    `transaction-dialog.tsx` (64 literals — the global add-transaction modal
    rendered on every page via `AppShell`), `theme-toggle.tsx`,
    `theme-picker.tsx`, `search-dialog.tsx`.
  - Centralize `lib/nav.ts` labels (`REPORT_TABS` 16, `NAV_SECTIONS` 24 + 2
    section headers, `PAGE_TITLES` 24, `MOBILE_NAV` 4) into the `shell`
    dictionary section, keyed by the existing route `id`s; `lib/nav.ts` keeps
    only structural data (id/href/icon), labels resolve from `t.shell.*` at
    render time. Preserve today's exact ID copy per surface, including the
    existing `aset` (sidebar) vs `"Aset Saya"` (page title) distinction — two
    different surfaces, don't unify them.
  - This is the protected-foundation-path phase — explicitly authorized by the
    user for this epic run (2026-07-25, AskUserQuestion).

- [x] ### A2 — i18n: akun + panduan ✅
  - `akun/page.tsx` (400 literals, 2186 lines) — full content translation; it
    already calls `useLocale` for the language picker, extend to `t.akun.*`
    for its own copy.
  - `panduan/page.tsx` (41 literals) — fold the `JOURNEYS` catalog (lines
    47-268: 9 journeys × title/subtitle + 24 nested features × title/desc = 66
    string fields) into `t.panduan.*`, including "Buka →".

- [ ] ### A3 — i18n: laporan
  - `laporan/page.tsx` (352 literals, 2916 lines — largest file in the app) —
    16 report-tab sub-views (tab labels come from A1's `shell` section; this
    phase covers per-tab body content/headers/table copy).

- [x] ### A4 — i18n: asuransi, kalkulator, quickinput, ai
  - `asuransi/page.tsx` (123), `kalkulator/page.tsx` (112, multiple calculator
    sub-tools), `quickinput/page.tsx` (104, high literal-density form
    labels/options), `ai/page.tsx` (25).

- [x] ### A5 — i18n: wealth & asset pages
  - `investasi/page.tsx` (88), `masterdata/page.tsx` (87), `aset/page.tsx`
    (86), `liabilitas/page.tsx` (84), `mastercoa/page.tsx` (77).

- [x] ### A6 — i18n: remaining pages
  - `transaksi/page.tsx` (71), `rekonsiliasi/page.tsx` (79),
    `splitbill/page.tsx` (61), `anggaran/page.tsx` (60), `rekening/page.tsx`
    (59), `donation/page.tsx` (54), `warisan/page.tsx` (48), `tujuan/page.tsx`
    (42), `tax/page.tsx` (30), `dana/page.tsx` (29), `ringkasan/page.tsx`
    (23), `notifikasi/page.tsx` (16).
  - Run before Task C so `ringkasan` is already i18n-wired when its layout is
    redesigned.

- [x] ### B — Per-member finances ("pockets") — SUPERSEDED, not built here
  - **Resolved 2026-07-25 (AskUserQuestion):** dropped from this epic.
    EPIC-019 (family sub-accounts & allowances, created 2026-07-24) builds the
    same `ownerUserId`-on-`Account` foundation at a larger scope (transfer
    ledger, request/approve flow, per-member allowances). Building it here too
    risks duplicate/conflicting schema work. EPIC-019 is now the canonical
    home for per-member finances — its own Open Design Decision #4 ("confirm
    it supersedes EPIC-018 Task B") should be resolved there. No schema
    change made in this epic.

- [x] ### C — Responsive layout redesign for sparse pages
  - **Resolved 2026-07-25 (AskUserQuestion):** redesign chosen over
    accept-whitespace.
  - `beranda/page.tsx` and `ringkasan/page.tsx` both already use internal
    multi-breakpoint grids (beranda: 7 card blocks / 3 grid rows; ringkasan: 9
    card blocks / 3 grid rows) — the gap is the page-level wrapper
    (`<div className="space-y-3.5">`) never filling viewport height on tall
    desktops, not a naive single-column stack. Re-flow the existing grid rows
    into a wide-viewport main+aside 2-column layout (primary cards/charts in a
    wider main column, secondary lists/goals in a narrower aside) so content
    fills available height/width at `lg`/`xl` breakpoints instead of leaving a
    dead zone below a top-aligned stack.
  - Solve this inside `beranda/page.tsx` / `ringkasan/page.tsx`. Do **not**
    touch `components/shell/app-shell.tsx`'s `<main>` wrapper — that remains a
    separate, not-yet-authorized foundation change; if it turns out to be
    genuinely required, stop and flag it instead of editing it
    opportunistically.
  - Runs after A6 so `ringkasan` is already using `t.*` before its JSX gets
    restructured.

## Open Design Decisions

All three resolved 2026-07-25 via AskUserQuestion before any implementation
started, per the sign-off pattern below.

1. **Member model — PIVOTAL. RESOLVED: neither (b) nor (c) — deferred to
   EPIC-019.** EPIC-019 (family sub-accounts & allowances) was created
   2026-07-24, after this epic, and independently builds the same
   `ownerUserId`-on-`Account` foundation Task B(b) would have added, at a
   larger scope (transfer ledger, request/approve flow, per-member
   allowances). Rather than re-litigate (b) vs (c) here and risk building
   `ownerUserId` twice, Task B is dropped from EPIC-018 entirely; the member
   model question now lives in EPIC-019's own Open Design Decisions
   (including its #4: "confirm it supersedes EPIC-018 Task B").
2. **i18n scope. RESOLVED: all 25 pages now**, phased into 6 reviewable
   clusters (A1-A6, see Tasks) rather than one mega-PR, per the original
   phasing instruction.
3. **Responsiveness. RESOLVED: redesign** — a wide-viewport main+aside grid
   for `beranda`/`ringkasan`, not accept-whitespace.

## Acceptance Criteria

- **i18n:** switching language in `/akun` visibly changes the sidebar, topbar,
  mobile nav, and every covered page; Indonesian copy remains byte-faithful to
  today's; no visible raw dictionary keys; all 25 pages + shell covered
  (Decision #2).
- **Member model:** N/A in this epic — Task B dropped, superseded by EPIC-019
  (Decision #1). No schema change made here.
- **Responsive:** `beranda`/`ringkasan` fill the viewport with an adaptive
  main+aside grid at wide breakpoints (Decision #3).
- All static gates green: `scripts/qa.sh`, `scripts/test.sh`,
  `scripts/security-check.sh`. Any protected `components/shell/*` / `lib/nav`
  change carries explicit reviewed authorization.

## Test Plan

- **Unit/component:** dictionary lookups fall back safely (missing key never
  renders a raw key); `useLocale`-wired components re-render on locale change;
  (Task B) owner-scoping helper returns "mine" vs "family" sets correctly for
  each role; the "mine vs family" filter toggles the query.
- **Integration:** (Task B) account/transaction create accepts + validates
  `ownerUserId` within the family group (rejects cross-member/cross-tenant ids);
  reports/dashboard/budgets honor the owner lens; additive migration applies on
  a DB with existing null-owner rows.
- **E2E (Playwright):** switch language in `/akun` → sidebar + a sample page
  render in English, reload persists; (Task B) create a member-owned account,
  confirm it shows under "Milik saya" and is excluded from another member's
  "mine" view; (Task C) sparse page fills the viewport at a wide breakpoint (or
  the accepted-whitespace decision is recorded, no test needed).
- **Smoke:** `beranda`, `ringkasan`, `panduan`, `akun` load after DEV deploy in
  both locales.

## Agent Routing

`code-agent` + `shadcn` for the page/i18n wiring, `ecc:react-reviewer` +
`ecc:typescript-reviewer` post-edit on every diff; `review-qa-agent` for
WealthMe-specific acceptance-criteria + honest-UI + foundation-path checks
(Tasks A shell change, C). For Task B: `database-reviewer` +
`/ecc:prisma-patterns` / `/ecc:database-migrations` (schema + additive
migration), `nestjs-best-practices` + `ecc:security-reviewer` + `security-agent`
(owner scoping, tenant + cross-member isolation, CASL). Gates via `test-agent` /
`security-agent`; `deploy-agent` (DEV only). Per task: `/task-work EPIC-018 <n>`.
Each Open Design Decision above must be confirmed with the user
(AskUserQuestion) before the dependent task starts — Decision #1 gates Task B
entirely.

## Done Signal

Each task group closes independently via `/task-work EPIC-018 <n>` (Task A in
phased sub-passes). The epic closes when: the agreed i18n scope renders in both
locales across the covered pages + shell; the member-model decision is
implemented (per-member pockets shipped and gated, **or** the separate-family-
group answer documented); the responsiveness decision is implemented or recorded
as accepted; and the acceptance criteria hold across a fresh QA pass of
`/akun`, `/beranda`, `/ringkasan`, and `/panduan`.

## Automation Log

- 2026-07-25 /epic-loop — activated (`backlog` → `on-progress`). Resolved all
  3 Open Design Decisions + shell/nav protected-path authorization via
  AskUserQuestion: Task B dropped (superseded by EPIC-019), i18n = all 25
  pages phased into A1-A6, responsive = redesign. Explore-agent codebase
  inventory found 2,204 hardcoded literals across 25 pages (vs. the epic's
  original ~1500 estimate) and only `beranda` actually rendering translated
  content today (`akun`'s `useLocale` call drives its picker only, not its own
  copy). Restructured Task A into 6 phased task groups (A1 foundation+shell/nav,
  A2 akun+panduan, A3 laporan, A4 asuransi/kalkulator/quickinput/ai, A5
  wealth/asset pages, A6 remaining pages); reordered Task C to run after A6.
  No code changes yet — this entry covers planning only.
- 2026-07-25 /epic-loop EPIC-018 #1 "A1 — i18n foundation + shell/nav" → PASS
  (attempts: 2). Added `shell` i18n dictionary section with literal-union-typed
  keys (derived from new `as const` id arrays in `lib/nav.ts`) so a missing
  translation stays a compile error, not a runtime fallback; wired `useLocale`
  into all 8 `components/shell/*` files; `lib/nav.ts` now holds only
  structural nav data. Attempt 1 review found 1 HIGH (locale-reactive `key`
  prop on transaction-dialog tab buttons causing remount-on-toggle) — fixed in
  attempt 2 along with 2 MEDIUM cleanups (stale comment, de-duplicated
  `useLocale()` call). All gates PASS except `security-agent`, which FAILed on
  baseline `pnpm audit` findings (postcss + a better-auth account-takeover
  CVE, GHSA-qq9h-g4jm-xgf3) confirmed pre-existing — `package.json`/
  `pnpm-lock.yaml` are byte-identical to this branch's merge-base. Not bundled
  into this PR (out of scope, mirrors the standalone `fix/postcss-security-
advisory` PR #186 pattern); flagged to the user as a separate, urgent
  follow-up. PR: https://github.com/andrsrjld/wealthme-web/pull/196
- 2026-07-27 /nerve EPIC-018 #2 "A2 — i18n: akun + panduan" → IMPLEMENTATION
  PASS (attempts: 1; local branch, not pushed). Added typed `akun` and `panduan`
  dictionary sections in both locales; `/akun` now resolves its hero, menus,
  every sub-page sheet, settings/options, toasts, family roles, session/sync
  statuses, and add-admin copy from `t.akun.*`; persisted gender values remain
  backward-compatible while visible labels translate. `/panduan` keeps only
  structural journey/feature metadata in the page and resolves all 9 journey +
  24 feature text entries (including "Buka →") from `t.panduan.*`. Indonesian
  source copy parity and residual-literal scans PASS. Added dictionary parity/
  coverage guards plus an EN gender-label regression test. Gates: `scripts/qa.sh`
  PASS; `scripts/test.sh` PASS (API 144/144, web 46/46, monorepo build green).
  `scripts/security-check.sh` source/secret scan found no code issue but remains
  FAIL on the pre-existing dependency baseline (21 total: 10 high, 10 moderate,
  1 low; this task does not modify package manifests or the lockfile). DEV
  deploy/E2E and remote PR intentionally not run without explicit approval.
- 2026-08-03 /nerve "do everything" — A2 review pass (ecc:react-reviewer,
  ecc:typescript-reviewer, review-qa-agent, parallel). TypeScript + React
  reviews PASS; review-qa-agent FAILed one HIGH: a new `roleLabel()` helper in
  `FamilyBody` (`akun/page.tsx`) translated the `FamilyMember.role` **data**
  enum (`owner`/`member`/`admin_staff`) into new display text (e.g. "Admin" →
  "Admin / Staf"), which is a genuine content change, not a literal
  extraction — violates the epic's "byte-faithful ID copy" acceptance
  criterion and was inconsistent with an untouched raw-role badge at
  `page.tsx:2057`. **Fixed**: reverted all 4 render sites to the original raw
  `m.role`/`group.myRole` output (byte-identical to pre-A2), removed the now-
  dead `akun.family.roleLabels` dictionary entries from `types.ts`/`en.ts`/
  `id.ts` and its assertion in `dictionary.test.ts`. Re-ran `tsc --noEmit`,
  `eslint`, and the 3 affected jest suites (25/25) — all green. Translating
  role labels remains a legitimate future idea but needs its own explicitly-
  scoped task (would also need to fix the `page.tsx:2057` inconsistency), not
  bundled into "faithful i18n port."

- **2026-08-04 — /nerve wave: A4, A5, A6, C shipped; A3 in flight.** A4 (PR #206:
  asuransi/kalkulator/quickinput/ai), A5 (#209: investasi/masterdata/aset/
  liabilitas/mastercoa), A6 (#213: the remaining 12 pages) completed the phased
  i18n rollout — with A1/A2 already merged, **24 of 25 app pages plus the shell
  render in both locales**; only `/laporan` (A3) remains and is in progress.
  Each cluster followed the same rules: typed per-page dictionary sections,
  byte-faithful Indonesian, persisted enum values untouched (only display labels
  translate), prefix/suffix splitting for mixed label+value rows, locale-aware
  date formatting, and dictionary parity guards in `dictionary.test.ts`.
  Documented value-locked residuals: `crud-config.ts`-owned modal copy, bank and
  institution names, sample participant names, currency symbols. Task C (#215)
  chose the recorded redesign over accept-whitespace: `/beranda` and `/ringkasan`
  re-flow their existing card blocks into a main+aside grid at `lg`+ via
  `lg:contents` on the existing row wrappers, so **mobile markup is byte-identical**
  and no protected shell file was touched. Gates green throughout (web 13 suites /
  122 tests at A6+C; api unaffected).
