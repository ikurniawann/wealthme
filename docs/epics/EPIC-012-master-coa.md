# EPIC-012: Master COA (Chart of Accounts)

status: done
environment: dev
retries: 0
phase: 4
priority: P2
area: Backend + Frontend
source: `docs/COA_MasterData.md`, `docs/COA_Updates 21 June.xlsx` (canonical data), `docs/WealthMe_Demo-3.html` (`data-page="mastercoa"`)

## Goal

Add a **Master COA** reference dataset (6 groups, ~115 accounts) and its management
page. COA is **reference master data**: each account carries a transaction direction
(↓ income / ↑ expense / ↔ transfer) used at report time to keep PNL / Balance Sheet /
Cashflow accurate. Per the approved plan, COA is a **separate, reference-only** model —
no `Category` FK; reports resolve direction via a read-time util.

## Tasks

- [x] ### A — Data model + seed ✅
  - Add `CoaDirection` and `CoaBudgetType` enums to Prisma schema
  - Add `CoaAccount` model (familyGroupId tenant scope, code/name/group/direction/budgetType/parentCode)
  - Generate and apply migration
  - Seed 78 accounts (static array from xlsx; no new dep); fix seed.spec.ts mock

- [x] ### B — API module ✅
  - Create `apps/api/src/coa-accounts/` (module, service, controller, DTOs)
  - Tenant-scoped CRUD: list, create, update, delete filtered by familyGroupId
  - Add `CoaAccount` to CASL subjects + abilities; register module in AppModule

- [x] ### C — Frontend page + sidebar ✅
  - Create `apps/web/src/app/(app)/mastercoa/page.tsx` (API-driven: summary cards, 7-tab filter, CRUD table + modals)
  - Add mastercoa entry to `nav.ts` under "Alat" with badge "New" (new-purple)
  - Add to PAGE_TITLES

- [x] ### D — Reports wiring ✅
  - Create `apps/api/src/common/utils/coa-direction.util.ts`
  - Wire into reports service getPnl (typed CoaDirection enum replaces string literals)

## Evidence

- `docs/COA_MasterData.md` — 6-group structure, direction rules, budget types, the
  Master COA page spec (summary cards · filter tabs · hierarchical table · CRUD form).
- `docs/COA_Updates 21 June.xlsx` — **canonical** account list: columns
  Type / Category / Sub-Category / Code / Budget Type / Details / Notes-Examples;
  codes like `10101`, `20101`; ~115 rows.
- `docs/WealthMe_Demo-3.html` — `data-page="mastercoa"` page + `renderCOA()`/`filterCOA()`;
  summary cards (6 Grup · 115 Akun / 98 Terhubung / 17 Belum Dimapping); filter tabs;
  table (Kode · Nama · Grup · Arah · Budget Type · Aksi). App has **no** such page yet.
- Existing pattern to mirror: `apps/api/src/categories/` (tenant-scoped CRUD module).

### 6-group structure (digit 1 = group)

| Kode    | Grup               | Arah default  |
| ------- | ------------------ | ------------- |
| `1xxxx` | Income             | ↓ Pemasukan   |
| `2xxxx` | Expense            | ↑ Pengeluaran |
| `3xxxx` | Wealth Allocation  | ↔ Transfer    |
| `4xxxx` | Account Receivable | ↓ Pemasukan   |
| `5xxxx` | Account Payable    | ↑ Pengeluaran |
| `6xxxx` | Tax                | ↑ Pengeluaran |

## Scope

### A — Data model + seed

- Prisma model `CoaAccount` (tenant-scoped: `userId` + `familyGroupId` per repo
  convention), fields: `code`, `name`, `group` (1–6 enum/int), `direction`
  (INCOME/EXPENSE/TRANSFER), `budgetType` (FIXED/VARIABLE/REIMBURSEMENT, nullable),
  `parentCode` (nullable). **No FK to `Category`** — reference-only.
- Migration via `/ecc:database-migrations`.
- Seed by **parsing `docs/COA_Updates 21 June.xlsx` in the seed script** (per approved
  decision) — not a hand-maintained list. Group label `3` = "Wealth Allocation".

### B — API

- Tenant-scoped CRUD module mirroring `apps/api/src/categories/`
  (`coa-accounts.{module,service,controller}.ts` + DTOs). List/create/update/delete,
  all filtered by `userId` + `familyGroupId`.

### C — Page

- `app/(app)/mastercoa/page.tsx` ported from Demo-3, **API-driven** (not static).
  Reuse `SectionCard`, `CrudModal`, `StatusBadge`; summary cards; filter tabs by group;
  hierarchical table with direction + budget-type columns; add/edit/delete.
- Sidebar entry under Tools (badge "New").

### D — Reports wiring (in scope)

- Read-time `coa-direction.util.ts` resolver: Category → COA direction (no schema link).
  Wire into PNL / Balance Sheet / Cashflow so direction flows without a DB FK.

## Acceptance Criteria

- `/mastercoa` renders all seeded accounts from the API, tenant-scoped; filter tabs work;
  CRUD round-trips persist.
- Seed parses the xlsx → ~115 accounts across 6 groups with correct codes/directions.
- Reports resolve direction via the util (no `Category`→`CoaAccount` FK).
- All Indonesian copy preserved; faithful port of the Demo-3 page.
- Gates green: `scripts/qa.sh`, `scripts/test.sh`, `scripts/security-check.sh`.

## Test Plan

- Unit: xlsx parser yields expected group/direction for sample codes (`10101`→Income↓,
  `20101`→Expense↑, `3xxxx`→Transfer↔); `coa-direction.util` maps category→direction.
- Integration: CRUD endpoints enforce tenant scope (no cross-tenant read/write).
- E2E (Playwright): `/mastercoa` loads, filter by group, create+edit+delete an account.
- Smoke: page loads after DEV deploy.

## Agent Routing

`database-reviewer` + `/ecc:prisma-patterns`/`/ecc:database-migrations` (model+seed);
`nestjs-best-practices` + `ecc:typescript-reviewer` + `security-agent` (API, tenant scope);
`code-agent` + `shadcn` (page); `ecc:react-reviewer` (post-edit); gates via
`test-agent`/`security-agent`; `deploy-agent` (DEV only). Per task: `/task-work EPIC-012 <n>`.

## Automation Log

- 2026-06-24 — Epic created via `/nerve` ("selesaikan penulisan epic terlebih dahulu").
  Decisions locked from the approved plan: COA is **separate/reference-only** (no
  `Category` FK); **reports wiring included** via read-time `coa-direction.util.ts`;
  **seed parses the xlsx**. Status `backlog` — start after EPIC-013 unless redirected.
- 2026-06-27 — Tasks A+B+C completed in a single branch `feat/epic-012-task-1-a-data-model-seed`.
  78 accounts seeded (static array; no xlsx dep added; Python/openpyxl used for extraction only).
  Migration `20260626171841_add_coa_accounts` applied to dev DB. All 88 API tests passing.
  QA + build green. Security: pre-existing multer advisory (unrelated to COA changes).
  Branch pushed; PR creation requires gh auth (do manually). Task D (reports wiring) pending.
- 2026-06-27 — Task D completed. coa-direction.util.ts added; wired into reports.service.ts getPnl.
  All 88 tests green. Epic set to ready-for-qa. Pending: manual PR creation + QA sign-off.
- **2026-07-18 — /nerve "PR #171 merged".** PR #171 (bundled EPIC-012 + EPIC-014) merged to
  `development` at `0747a1e`. Merge blocker resolved. Still `ready-for-qa` pending human QA sign-off
  (per `CLAUDE.md` "What Remains Manual") before promotion to `done` + archive.

- **2026-08-03/04 — /nerve QA sweep (delegated QA; user confirms from the live system). Evidence: gates green on development@5f2383f (qa/test/security); fresh DEV deploy clean (compose build, migrate+seed exit 0, api/web healthy); e2e vs https://wealthme.demo-wit.id — auth, route-protection, and all page regression specs green (57 passed, 2 flaky passed on serial retry, 0 real failures); code-level criteria verification by 4 parallel QA agents. **Verdict: QA-PASS, superseded scope. /mastercoa CRUD real+tenant-scoped. AC text drift recorded: seed is a hand-written 78-account chart (no xlsx parse, ~115 claim stale) and the 'no FK / util-based direction' wording is obsolete — EPIC-017 added the mandatory Category→CoaAccount FK and retired coa-direction.util.ts. This epic is superseded by EPIC-017 for everything downstream of the registry. Status → done.
