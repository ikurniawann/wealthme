# EPIC-017: Master COA Integration — Real Chart-of-Accounts Backbone

status: on-progress
environment: dev
retries: 0
phase: 4
priority: P2
area: Backend + Frontend
source: team-lead directive 2026-07-19 (supersedes EPIC-012's reference-only scope); grounded in a read pass over schema.prisma, reports.service.ts, coa-accounts/_, budgets/_, and the mastercoa/masterdata pages.

## Goal

Make **Master COA** actually work. Today the Chart of Accounts is a
**write-only registry**: users can seed, list, and CRUD ~78 `CoaAccount`
rows, but nothing downstream ever reads them. `Category` has no COA link,
reports classify off raw `category.name` + transaction `type`, budgets ignore
`budgetType` entirely, and the /mastercoa "connected / unmapped" counts and
"used in reports" claim are cosmetic. This epic wires COA into the real
feature relations — categories, transactions, reports, budgets, dashboard — so
COA becomes the accounting backbone it was designed to be, while preserving
every existing report/UX shape and staying backward-compatible for un-mapped
data. EPIC-012 deliberately shipped COA as reference-only; EPIC-017 supersedes
that limitation.

## Evidence

Grounded in a direct read pass (2026-07-19). Key findings:

- **`CoaAccount` is reference-only.** `apps/api/prisma/schema.prisma:253-269`:
  fields `familyGroupId`, `code`, `name`, `groupNum Int`, `direction`
  (`CoaDirection` enum, schema `:132-136`), `budgetType`
  (`CoaBudgetType?` enum, schema `:138-142`), `parentCode String?` (a plain
  string, **not** a self-FK), no balance/amount. Unique `(familyGroupId, code)`.
  `coa-accounts.service.ts` is plain tenant-scoped CRUD; **nothing reads
  `CoaAccount` anywhere downstream** (verified: no other service imports it).
- **`Category` has no COA link.** `schema.prisma:323-341`: `Category` carries
  `name`, `kind` (`CategoryKind` income/expense, `:26-29`), `color`, `icon`,
  `isPrivate` — **no `coaAccountId`/`coaAccountCode`**. `Transaction`
  (`:343-361`) references `Account` + optional `Category`; its COA is
  undefined.
- **Reports do not use COA.** `apps/api/src/reports/reports.service.ts` has 7
  methods; only `getPnl` (`:291-391`) even names a COA type, and only via
  `transactionTypeToCoaDirection(tx.type)` — a hardcoded
  `TransactionType → CoaDirection` map in
  `apps/api/src/common/utils/coa-direction.util.ts` that **never queries COA**
  and still groups by `tx.category?.name`. `getSummary` (`:64`),
  `getBankReport` (`:179`), `getDetailReport` (`:235`), `getBalanceSheet`
  (`:393` — built from `Account`/`Asset`/`Liability` balances, not
  transactions), `getCashflowStatement` (`:480`), and `getSankey` (`:535`)
  classify straight off `tx.type === "income"/"expense"` and group by
  `category.name`. No COA join exists in any of them.
- **Budgets ignore `budgetType`.** `apps/api/src/budgets/budgets.service.ts`:
  `Budget` (`schema.prisma:363-377`) ties to `Category` by `categoryId` +
  `period` + `limitAmount` only. `budgetType` (FIXED/VARIABLE/REIMBURSEMENT)
  is stored on `CoaAccount` but **never read** by any budget or report logic.
- **The /mastercoa "connected" UI is cosmetic.**
  `apps/web/src/app/(app)/mastercoa/page.tsx:139-143` computes
  `linkedCategories`/`unmappedCount` by **browser-side lowercased name-string
  matching** between COA names and category names — not a real mapping. The
  "Dipakai di Laporan → PNL · Neraca · Arus Kas" card (`:341-360`) is static
  aspirational copy; nothing in reports consumes COA.
- **Category CRUD lives in** `apps/web/src/app/(app)/masterdata/page.tsx` (the
  only master-data entity with a real API; reference lists are local-only). A
  COA-mapping picker would extend this page's `CrudModal`
  (`@/components/crud`, not a protected foundation path).
- **groupNum semantics are real but undocumented in the schema.** Verified from
  `apps/api/prisma/seed.ts:1968-2500+` (78 accounts) — see Open Design
  Decisions #3 for the confirmed 1-6 mapping.

## Tasks

- [x] ### A — Schema link: `Category` → `CoaAccount` relation (foundation) ✅
  - Add a real, tenant-scoped FK `Category.coaAccountId` → `CoaAccount`,
    **NOT NULL** (Open Design Decision #2 = MANDATORY). Every category must map
    to a COA account in the same family group, and the user must pick a COA when
    creating or editing a category.
  - Add the inverse relation on `CoaAccount` (`categories Category[]`).
  - **Additive** Prisma migration with a **mandatory backfill**: add the column
    - index and assign a `CoaAccount` to **every** existing category via the seed
      default-map (Task G) in the same migration, so the NOT NULL constraint holds
      and no existing row is orphaned; no drops.
  - Decide `parentCode` → real self-relation FK now vs. later (Open Design
    Decision #6) — only needed if COA-tree rollups (Task E) require it.
  - Blocks B, C, D, E. Ship the backfill/default-map in Task G (or co-deliver a
    minimal default here) so no category is left unmapped.

- [x] ### B — Mapping UX: assign each Category to a COA account ✅
  - Let the owner map a `Category` to a `CoaAccount` from `/masterdata` (extend
    the category `CrudModal`) and/or `/mastercoa`.
  - Add the API surface: category create/update accepts the COA link;
    tenant-scoped validation that the COA account belongs to the same family
    group.
  - Replace the cosmetic browser name-match count with a **server-backed**
    "truly unmapped categories" query (categories with a null COA link).
  - Depends on A.

- [x] ### C — Reports driven by COA (PNL / Neraca / Arus Kas) ✅
  - Classify and group transactions **purely** by their category's COA
    `direction` + `groupNum`, resolved transitively via `Transaction → Category
→ CoaAccount`. This **REPLACES** (Open Design Decision #1 = REPLACE, total)
    the raw `tx.type` + `category.name` + hardcoded-util classification — no
    augment/fallback path.
  - Apply to `getPnl` and `getCashflowStatement` (and consider
    `getSummary`/`getSankey`), **preserving the existing DTO shape and UX**.
    `getBalanceSheet` (Neraca) is handled per the **Neraca (Balance Sheet) note**
    in Open Design Decisions: it stays balance-based (computed from
    `Account`/`Asset`/`Liability` balances) unless the Task C sub-decision moves
    it to COA classification.
  - No fallback for un-mapped categories: Decision #2 (MANDATORY) guarantees
    every category is mapped, so classification comes solely from COA. Because
    the source of truth changes, **existing report numbers may shift** where a
    category's COA bucket differs from its old name/type bucket — verify in QA.
  - **Retire** `coa-direction.util.ts` once the real COA lookup lands. Depends on
    A and on B's mappings; with MANDATORY mapping there is no fallback, so B's
    mappings must be populated before COA classification is correct.

- [x] ### D — Budgets by COA + real `budgetType` ✅
  - Make budgets tie to COA (directly, or transitively via the category's COA
    link) so `budgetType` (FIXED / VARIABLE / REIMBURSEMENT) is actually used
    — e.g. in budget grouping, variance logic, or a report breakdown (Open
    Design Decision #4 sets the exact scope).
  - Preserve the existing `/anggaran` budget UX; `budgetType` becomes real
    signal rather than dead metadata.
  - Depends on A.

- [x] ### E — Transaction/COA rollups + dashboard alignment ✅ (dashboard alignment done; per-group COA rollups deferred — depend on the deferred `parentCode` self-relation tree, Decision #6)
  - Expose a transaction's resolved COA (via its category) where reporting
    needs it; compute COA-level rollups/balances (per group/account) for the
    reports and dashboard.
  - Align the dashboard's income/expense/allocation figures with the COA-driven
    classification from Task C so the numbers agree across screens.
  - Depends on A, C.

- [x] ### F — Make the /mastercoa UI honest and real ✅
  - Replace the browser name-match "Kategori Terhubung / Belum Dimapping" cards
    (`mastercoa/page.tsx:139-143`, `:300-340`) with the server-truth counts from
    Task B.
  - Make the "Dipakai di Laporan → PNL · Neraca · Arus Kas" card (`:341-360`)
    accurate once Task C lands — or relabel/remove it until it does (honest-UI
    mandate, ties to EPIC-016).
  - Depends on B (counts) and C (report claim). Touches page files only — no
    protected foundation web file.

- [x] ### G — Data safety & seed ✅ (co-delivered with A)
  - Extend `seed.ts` with a default `Category → CoaAccount` mapping (map the
    demo categories to sensible seeded COA accounts) alongside the existing 78
    COA rows.
  - Migration safety for **existing family groups**: the additive column
    defaults to null; provide a backfill/default-map step (idempotent) so live
    data is not orphaned, and guarantee backward compatibility — un-mapped
    categories/transactions still classify via the Task C fallback.
  - Owns the end-to-end back-compat guarantee and the seed default mapping;
    co-delivered with A's migration.

## Open Design Decisions

The implementer must resolve these with the user before/within the relevant
task — they are genuine forks, not defaults:

1. **Replace vs. augment classification in reports.** _RESOLVED — decided by the
   user on 2026-07-19: **REPLACE (total).**_ Reports (P&L, Arus Kas, and the
   classification layer) classify **purely** via `Transaction → Category →
CoaAccount` (`direction` + `groupNum`), **replacing** the current
   `category.name` + hardcoded `coa-direction.util.ts` (`tx.type`) approach — no
   augment/fallback path. **Consequence:** this requires **every** `Category` to
   be mapped to a COA account (ties directly to Decision #2 being MANDATORY), and
   because classification now comes from COA rather than transaction type +
   category name, **existing report numbers may shift** where a category's COA
   `direction`/`groupNum` differs from its old name/type-based bucket — expect and
   verify this during QA.

2. **Mandatory vs. optional mapping.** _RESOLVED — decided by the user on
   2026-07-19: **MANDATORY.**_ `Category.coaAccountId` is **NOT NULL**: every
   category must map to a COA account. The additive migration must assign a
   `CoaAccount` to **every** existing category (backfill via the seed
   default-map — see Task G), and the UI must **require** a COA when creating or
   editing a category (Task B blocks category create/update without one). There
   is **no** nullable column and **no** default-fallback "unmapped/other" path.

**Neraca (Balance Sheet) note (consequence of REPLACE).** REPLACE moves P&L and
Arus Kas to pure COA classification, but the **Balance Sheet stays
balance-based**: `getBalanceSheet` is computed from `Account` / `Asset` /
`Liability` **balances**, not transactions, so COA groups — especially the
non-transactional ones (e.g. groups 4/5 Receivable/Payable) — have **no
transaction-level source** to classify from. Task C must therefore treat Neraca
separately: keep the balance sheet balance-based while P&L / Arus Kas move to COA
classification. If a COA-driven Neraca is wanted instead, that is an open
**sub-decision for Task C** to resolve with the user before implementing it.

3. **Confirm `groupNum` 1-6 semantics.** **Verified from `seed.ts:1968-2500+`**
   — the taxonomy is a personal-finance chart, **NOT** the classic
   Asset/Liability/Equity/Income/Expense set:

   | groupNum | Grup               | seeded `direction` | seeded count |
   | -------- | ------------------ | ------------------ | ------------ |
   | 1        | Income             | INCOME             | 6            |
   | 2        | Expense            | EXPENSE            | 44           |
   | 3        | Wealth Allocation  | TRANSFER           | 10           |
   | 4        | Account Receivable | INCOME             | 4            |
   | 5        | Account Payable    | EXPENSE            | 8            |
   | 6        | Tax                | EXPENSE            | 6            |

   This matches the UI `GROUP_LABELS` (`mastercoa/page.tsx:43-50`) and the
   EPIC-012 table. **It is documented in seed comments + UI + EPIC-012, but NOT
   annotated on `schema.prisma`'s bare `groupNum Int`.** Decision: this task
   should add a schema comment and treat this table as canonical. Note the
   tension for **Neraca (Balance Sheet)**: it is built from
   `Account`/`Asset`/`Liability` balances, not transactions — groups 4/5
   (Receivable/Payable) have no transaction-level data source today, so how (or
   whether) COA groups feed the balance sheet is an open question for Task C/E.

4. **Scope of `budgetType` usage.** How far does FIXED/VARIABLE/REIMBURSEMENT
   go — a display/grouping dimension on budgets, real variance/rollover logic,
   a reimbursement-tracking flow, or just a report breakdown? Smaller scope is
   safer; confirm the intended behavior before Task D.

5. **`parentCode` → real hierarchy.** Keep `parentCode` as a plain string, or
   promote it to a self-relation FK to enable COA-tree rollups (subtotals by
   parent account) in Task E? Only worth doing if rollups need the tree.

## Acceptance Criteria

- `Category` has a real, tenant-scoped FK to `CoaAccount` that is **NOT NULL**
  (mandatory — Decision #2): every category has a COA, backfilled by the additive
  migration, which leaves existing rows valid.
- The owner can map a category to a COA account from the UI; unmapped-category
  counts on /mastercoa are **server-truth**, not browser name-matching.
- PNL / Neraca / Arus Kas classify **purely** via the transaction's COA
  (transitively through its category) — no category-name/`type` fallback, since
  every category is mapped (mandatory — Decision #2); existing report DTO shapes
  and UX are unchanged.
- `budgetType` is actually consumed by budget and/or report logic (no longer
  dead metadata).
- The /mastercoa "connected/unmapped" cards and the "Dipakai di Laporan" claim
  reflect reality (or are honestly relabeled until their task lands).
- Seed provides a default category→COA mapping; un-mapped live data still
  reports sanely (backward compatible).
- Tenant scoping preserved everywhere (`familyGroupId`); no cross-tenant COA or
  mapping read/write.
- Gates green: `scripts/qa.sh`, `scripts/test.sh`, `scripts/security-check.sh`.

## Test Plan

- **Unit:** COA-resolution helper maps a transaction → COA
  direction/groupNum via its category (mapped → COA value; unmapped → fallback).
  `budgetType` grouping/variance logic. Server-side unmapped-category count.
- **Integration:** category create/update accepts + validates the COA link
  (tenant-scoped, rejects cross-tenant COA ids); reports endpoints return the
  same DTO shape with COA-driven numbers; migration applies additively on a DB
  with existing categories.
- **E2E (Playwright):** map a category to a COA account in /masterdata (or
  /mastercoa); /mastercoa unmapped count updates from server truth; a report
  reflects the mapped classification; reload persists.
- **Smoke:** /mastercoa, /masterdata, /laporan, /anggaran load after DEV deploy;
  reports render for a family group with a mix of mapped and unmapped
  categories.

## Agent Routing

`database-reviewer` + `/ecc:prisma-patterns` / `/ecc:database-migrations`
(Task A schema + migration + seed safety); `nestjs-best-practices` +
`ecc:typescript-reviewer` + `security-agent` (Tasks B–E API, tenant scope);
`code-agent` + `shadcn` (Tasks B, F UI) with `ecc:react-reviewer` post-edit;
`review-qa-agent` for WealthMe-specific acceptance-criteria + honest-UI checks
(Task F, ties to EPIC-016); gates via `test-agent` / `security-agent`;
`deploy-agent` (DEV only). Per task: `/task-work EPIC-017 <n>`. Each of the
Open Design Decisions above should be confirmed with the user (AskUserQuestion)
before the dependent task starts, matching EPIC-016's build-vs-relabel sign-off
pattern.

## Done Signal

Each task group closes independently via `/task-work EPIC-017 <n>`. The epic
closes when all tasks are checked, the acceptance criteria hold across a fresh
QA pass of /mastercoa, /masterdata, /laporan, and /anggaran, and COA is
demonstrably read by at least reports + budgets (no longer a write-only
registry).

## Automation Log

- 2026-07-19 — Epic created (docs-only) from the team-lead directive to make
  Master COA function as a real accounting backbone, superseding EPIC-012's
  reference-only scope. Grounded in a read pass over `schema.prisma`,
  `reports.service.ts`, `coa-accounts/*`, `budgets/*`, `coa-direction.util.ts`,
  and the mastercoa/masterdata pages (findings in Evidence). Task groups A–G
  shaped around the schema-link → mapping → reports → budgets → rollups →
  honest-UI → seed/safety build order. Status left at `backlog` (not
  `on-progress`): five Open Design Decisions (replace-vs-augment, mapping
  optionality, groupNum semantics confirmed, budgetType scope, parentCode
  hierarchy) need human sign-off before an automated loop picks this up. No
  code changed.
- 2026-07-19 /epic-loop EPIC-017 #1 "A — Schema link: Category → CoaAccount
  relation (foundation)" + #7 "G — Data safety & seed" (co-delivered) → PASS
  (attempts: 1). Added NOT-NULL `Category.coaAccountId` FK, self-healing additive
  migration (provisions a generic ~24-account COA chart for any family group
  lacking one, backfills every category, then enforces NOT NULL + FK), COA-linked
  registration (`auth.service`) + seed, and tenant-scoped resolve/validate on
  category create/update. **Decision resolved with user (2026-07-19):** registered
  family groups had categories but zero COA (epic's "seed default-map" assumed a
  chart that only existed for the demo) — chose a **generic ~24-account starter
  chart** provisioned per group. Gates: security-review PASS; ts-review found 1
  HIGH (expense→TRANSFER mis-link in `defaultCoaCodeForCategory`) → fixed +
  regression test added; jest 142/142, eslint clean, security-check PASS.
  parentCode kept a plain string (deferred, Decision #6). Branch
  `feat/epic-017-category-coa-link`.
- 2026-07-19 /epic-loop EPIC-017 #2 "B — Mapping UX: assign each Category to a
  COA account" → PASS (attempts: 1). COA picker in /masterdata category modal
  (CrudModal `dynamicOptions`; "Otomatis" = server default; mapped COA code
  shown per chip); /mastercoa counts now use the real `coaAccountId ↔ account`
  join, not browser name-matching (retitled the always-zero "unmapped" card to
  "Akun COA Kosong" = COA accounts with no category). Extracted the generic COA
  chart to `@wealthme/contracts` (API re-exports; net deletion). **Also fixes a
  build break Task A left on `development`:** `apps/web/src/lib/auth.ts`
  (Better-Auth registration hook — a 2nd registration path) created categories
  without the now-mandatory `coaAccountId`; it now provisions the chart + links
  them (reviewed foundation change, forced by A's schema). Gates: full
  `scripts/test.sh` PASS (monorepo build + web 38/38 + api), security-check
  PASS, ecc security/react/typescript reviewers all PASS. Branch
  `feat/epic-017-task-2-category-coa-mapping-ux`.
- 2026-07-19 /epic-loop EPIC-017 #3 "C — Reports driven by COA" → PASS
  (attempts: 1). `getSummary`, `getPnl` (current + previous period),
  `getCashflowStatement`, `getSankey` now classify via `Transaction → Category →
CoaAccount` direction (new `txCoaDirection` helper); category-less tx fall back
  to `tx.type` (only signal). TRANSFER (wealth allocation) now excluded from P&L
  - operating cashflow — **report numbers shift** where a category's COA
    direction differs from its tx.type (expected, per Decision #1; verify in QA).
    Retired `coa-direction.util.ts`. Neraca (`getBalanceSheet`) left balance-based
    (default). `getBankReport`/`getDetailReport` keep tx.type (out of scope).
    DTO shapes unchanged. Gates: api jest 143/143 (+ new REPLACE regression test),
    security-check PASS, ecc typescript/security + review-qa all PASS. Branch
    `feat/epic-017-task-3-reports-by-coa`.
- 2026-07-19 /epic-loop EPIC-017 #4 "D — Budgets by COA + real budgetType" →
  PASS (attempts: 1). **Decision #4 resolved with user: "Report breakdown"
  scope** (display/grouping + budget-vs-actual by budgetType; read-only, no
  rollover logic). `BudgetDto` gains `budgetType` (FIXED/VARIABLE/REIMBURSEMENT |
  null), resolved via the category's COA account (`budgets.service` includes
  `category.coaAccount.budgetType`). `/anggaran` shows a budgetType badge per
  budget + a "Rincian per Tipe Anggaran" budget-vs-actual breakdown grouped by
  type (client-side aggregate). Gates: full `scripts/test.sh` PASS (web 38/38 +
  api build), security-check PASS, ecc react/typescript reviewers PASS. Branch
  `feat/epic-017-task-4-budgets-by-budgettype`.
- 2026-07-19 /epic-loop EPIC-017 #5 "E — Transaction/COA rollups + dashboard
  alignment" → PASS (attempts: 1). **Dashboard alignment done; per-group COA
  rollups DEFERRED** (they depend on the deferred `parentCode` self-relation
  tree, Decision #6 — recommend a follow-up E2 if wanted). Extracted
  `txCoaDirection` to a shared `common/utils/coa-classify.util.ts`; both
  `reports.service` and `dashboard.service` now use it. `dashboard.getSummary`
  (/beranda) classifies income/expense by COA direction — the 6-month cashflow
  chart, 30-day sparkline, and current-month headline + savings rate — so
  /beranda and /laporan agree; TRANSFER excluded from income/expense. DTO
  unchanged (no frontend change). Gates: api jest 143/143 (+ dashboard COA-vs-
  tx.type regression test), typecheck + eslint clean, security-check PASS, ecc
  typescript + review-qa PASS. Branch
  `feat/epic-017-task-5-coa-rollups-dashboard`.
- 2026-07-19 /epic-loop EPIC-017 #6 "F — Make the /mastercoa UI honest and real"
  → PASS (attempts: 1). The "Kategori Terhubung / Belum Dimapping" counts were
  already made server-truth in Task B (retitled "Akun COA Kosong"). F fixes the
  "Dipakai di Laporan" card: now that C+E ship, it honestly lists the COA-driven
  reports (**PNL · Arus Kas · Ringkasan**) with an "Aktif" badge, and notes
  **Neraca stays balance-based** (was mislabeled as COA-driven). Trivial cosmetic
  card change (one page file); typecheck + eslint + security-check PASS.
  Branch `feat/epic-017-task-6-mastercoa-honest-ui`. **All six task groups (A–G)
  complete.** After F merges, development has the full A→F stack; run DEV deploy
  - flip status to `ready-for-qa` for human QA (verify report numbers shifted
    sanely, esp. PNL/Arus Kas/Ringkasan where categories map to TRANSFER COA).
- 2026-08-03 /nerve "do everything" attempt — **deploy blocked, not run.**
  `scripts/deploy-dev.sh` requires a running Docker daemon on the shared dev
  host; this session's sandbox has no `dockerd` (`docker info` fails: no
  `/var/run/docker.sock`). Status left at `on-progress` — do NOT flip to
  `ready-for-qa` without an actual deploy + smoke check. Action needed: run
  `bash scripts/deploy-dev.sh` from a session with Docker access (the real dev
  host), verify `/health` + report numbers, then flip status.
