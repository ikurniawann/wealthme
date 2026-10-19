# Codex continuation — 2026-10-19

## Goal and scope

Continue the 26-task plan sequentially on development, explicit-path commits,
no push, no tests until Task 26. User supplied the investment/aset reference
images again; aset images are byte-identical to tracked refs. Extra top-up /
purchase reference saved at docs/design/refs/2026-10-19/invest-topup-purchase.png
(currently untracked; commit with Task 10).

## Proven state

- Task 8 reviewed against 717e6693..b3b5ff87, spec, R8/R10, report.
  Fix commit 7cb2f865: select latest price by effective observation date,
  avoid older automatic quotes overwriting newer manual observations,
  reject invalid quotes, validate calendar dates, stop bond accrual at maturity.
  API/web tsc and eslint pass, post-commit health 200. Ledger says complete.
- Task 9 commit c0da0deb: modular investment overview, summary, filters,
  responsive portfolio table/cards, exact decimal sort, search, 20/page,
  URL tabs, real recent ledger activity. All TSX components <400 lines.
  New portfolio-history.service.ts replays active transactions at actual
  stored quote dates (last 365 dates); no fabricated chart or historical FX.
  Incomplete historical points are omitted. Display amounts converted in API
  and optional valuation.display fields added to contracts (tsup rebuilt).
  API/web tsc + changed files eslint pass; health 200, value-history 401
  unauthenticated. Ledger says complete. Browser/Jest deferred to Task 26.
- Header form buttons and row action items explicitly disabled with title
  until Tasks 10–13 connect them; detail route follows Task 14. Task 10 must
  replace funds/history preview tabs with full implementation. No final UI
  completion claim has been made.
- No migrations created in Codex continuation yet.

## Environment and failures resolved

Dev env remains in original handoff's /tmp/.../scratchpad/devrun. Never print.
Contracts tsup briefly deletes d.ts; Nest watch can cache TS7016. Restarted API
once; ESLint moved DI annotation on new PortfolioHistoryService import, which
was fixed to value import with annotation. API then recovered (health 200).
Current live API logs are again original devrun/api.log (a host supervisor
appears to have replaced the process); /tmp/wealthme-codex-api.log is the stale
failed startup log. Inspect live PID/fd before restarting again.
Next's .next/dev/types/validator.ts was malformed (stray duplicate tail);
`rtk proxy npx next typegen` in apps/web regenerated .next/types/validator.ts;
removed only malformed generated dev validator, then web tsc passed. No
source/config workaround. Root npx eslint has no config; use package cwd.
Contracts package has no eslint config (lint script says no lint yet).

## Sources already loaded

Root AGENTS/CLAUDE/conventions/workflow, web AGENTS + full conventions,
orchestrate, executing-plans, code-review-and-quality, design-orchestrator,
functional-ui, shadcn skills. User's sequential/no-Jest policy overrides
skill TDD/subagents/approval suggestions. Reference layout is already approved.
Shell app-shell.tsx, SidebarNav/sidebar-brand.tsx (real logo wealthme-mark.png),
wm tokens in globals/bento; page-local CSS only. No protected foundation edits.

## Next action: Task 10

Read Task 10 brief again. Relevant inspected APIs:

- platform-accounts controller: GET list, POST create (catalog/custom, owner,
  optional initial pockets); POST :id/pockets; POST :id/pockets/:pocketId/top-up
  and /withdraw (PocketTransferDto; R7 idempotent).
- PocketTransferDto: counterAccountId, sourceAmount total leaving source,
  sourceCurrency, destAmount net received (required cross currency),
  destCurrency, fxRate actual IDR per foreign unit (cross only), fee,
  feeCurrency, occurredAt ISO, description?, idempotencyKey uuid.
- Same foreign currency uses FX snapshot; cross supports exactly one IDR
  side. Fee is an expense on destination. sourceAmount includes fee.
  See pocket-transfer-amounts.ts for exact rounding.
- CreatePlatformAccountDto: platformKey, customName, ownerUserId?, label?,
  accountRef?, pockets?. Non-master pinned by backend.
- CreatePocketDto: pocketKind, currency, name?, balance? (default0), isPrivate.
- PortfolioActivityList currently only five rows; full history needs separate
  component, investment ledger PATCH/void plus pocket transaction history.
- Existing apiFetch throws status/message/code only; apiErrorMessage is shared.
- Important: do not use Number for financial arithmetic; display formatting
  currently uses Intl Number conversion, exact sort uses scaled BigInt.
- i18n v3 module apps/web/src/i18n/investasi-v3.ts already wired to id/en/types.

## Risks and pending verification

All Task 26 regression cases still pending (including Task 8 fixes). UI refs
need desktop1440/tablet820/phone390 light/dark browser pass at Task26.
History API currently loads full matching price/transaction history; grouping
avoids scanning all holdings inside each inner loop, but long histories may
need future optimization. Historical FX intentionally absent/empty chart.
User WIP remains untouched (see initial git status); never add -A or commit -a.
Task reports + ledger under .superpowers are ignored and on disk; preserve them.

## Updated after Task 10

Task 10 committed b6b022fe. New platform-funds/platform-form/pocket-transfer,
investment-history, ledger-correction, investment-fields, decimal,
investment-api and investment-conflict components wired to page. Header and
preview top-up enabled, full funds/history tabs replaced previews. Exact
BigInt source/fee FX estimates round IDR half-up like API. Correction/void
ledger events preserve 409 body via page-local investmentWrite (shared
api-client strips it and is protected). Cash rows deep-link to existing
/transaksi?tx=…&accountId=… editing flow; see ledger ruling and Task26 risk.
API backdate fix: pocket-transfer-timeline.ts validates both cash legs and
held funds inside existing Serializable transaction callback; combines
parent+fee for validation to avoid arbitrary same-createdAt UUID order.
No migration. API/web tsc and changed files eslint PASS, health200 after
commit; ledger Task10 complete. Added Suspense around useSearchParams.

Next is Task11. Investigation found old POST investments CreateInvestmentDto
and service still do NOT accept market/platform/details/owner, despite schema
fields from Task5. Need atomic create-position endpoint (metadata + buy/opening
ledger): cannot POST legacy create then POST ledger (partial-save/double debit
risk). InvestmentLedgerService.create currently owns runSerializableWithRetry;
extract a public createWithinTransaction helper so new holding + initial
ledger run in one Serializable transaction. Existing create uses helper too.
Unknown opening cost is not represented yet: costBasisPerUnit DB non-null.
Need explicit unknown marker (e.g. details.costBasisKnown=false) and nullable
valuation cost/P&L DTO, not silently treat unknown as zero. Decide + ledger
ruling before changing. No Task11 files changed yet.

Other findings for integration/security: ledger.lockInvestment currently only
checks family; no owner/row-scope check at all. New position creation must
validate owner/platform/pocket family + row permissions; Task15 must close
legacy read/update/ledger scope gaps. Platform owner helpers are exported by
accounts/accounts.service.ts: resolveOwnerForActor(AccountActor,owner),
isMasterLike; only owner/spouse can choose other/family owner, others pinned.
Reference images currently tracked and latest supplied match existing.

## Task 11 implementation (latest)

Task11 implementation now exists (supersedes earlier "no files changed").
New API files: dto/create-position.dto.ts, investment-positions.service.ts,
position-details.ts. New POST investments/positions. Ledger create extracted
to createWithinTransaction, reused for atomically creating metadata+entry.
New client position-{form,state,account-fields,execution-fields,type-fields,
preview}; header add button enabled. All TSX <400 lines. Proof uploads to
linked purchase cash transaction; opening has no upload control. Local
investmentWrite now generic and returns response data; upload helper added.
Unknown-cost JSON marker + nullable v3 cost/P&L, ledger result cost, and legacy
summary costIncomplete (known cost aggregate stays string for protected lib
compatibility). Laporan report-cover and inv-section hide unknown cost/P&L.
New bond quantityIsPrincipal flag: remaining nominal used in valuation; old
bonds not reinterpreted. Manual instruments skipped by price refresh.
Zero-rate deposits valid. Contracts declarations rebuilt; runtime JS unchanged.

API/web tsc + changed files eslint PASS, health200, POST positions401 without
auth. No tests written/run. No migration. Need post-commit health and ledger
Task11 complete after commit. Next Task12 then13–26. Unknown opening cost
completion in Task14 must mark costBasisKnown=true explicitly. Old investment
paths still lack owner row scoping: close in Task15. Task10 cash edit uses
canonical transaction detail; final Task26 must review soft-void semantics gap.
User reset only their 5-hour usage limit; no git/server reset requested.
