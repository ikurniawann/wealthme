# Aset module audit (read-only, 2026-10-19)

Paths relative to repo root. W = apps/web/src/app/(app)/aset/page.tsx, D = apps/web/src/app/(app)/aset/[id]/page.tsx, AS = apps/api/src/assets/assets.service.ts, IS = apps/api/src/investments/investments.service.ts, P = apps/api/prisma/schema.prisma.
Investment-side facts (avg cost, txs, units, no accountId) are in `2026-10-19-investasi-audit.md`; not repeated. "UNCERTAIN" = inferred, not run.

## 1. Web page structure (W, 1354 lines; D, 569 lines)

- Client page, 5 parallel useQuery calls (W:895-970): `GET /family-groups/:fg/assets`, `/accounts`, `/investments`, `/dashboard/net-worth/history?range=6m`, `/categories`. No Aset-specific aggregate endpoint: ALL merging/valuation is done in the browser.
- Layout: hero (total + 6m trend + 3 KPIs: accounts / investments / fisik, W:1170-1200), side card "investments" (first 5 only, W:1204-1236), accounts card (first 5, W:1240-1275), physical-asset tiles (`AssetTile`, W:650-760), tips card. No search, filters, sorting, pagination, sold/archived status, "gross vs net" label, or valuation-date control exist today (spec section 3 is all new).
- Merge rules (W:985-1017):
  - `accountsTotalBig` = sum of EVERY account balance (no `includeInNetWorth`, no privacy/owner filter, includes `type` investment/property accounts, ignores `Account.currency`).
  - `investmentsTotal` = float sum of `inv.currentValue ?? costBasisPerUnit*quantity` (W:997-1004).
  - `assetsTotalBig` = sum of recorded `currentValue` (W:1011).
  - `grandTotal = Number(accounts+assets) + investments` (W:1015) -> Number() on BigInt sums can lose precision above 2^53 (UNCERTAIN in practice; theoretical).
  - Cash/bank sub-totals use `danaAccounts` (cash+ewallet) / `rekeningAccounts` (bank). Accounts typed `investment`/`property` are in `accountsTotalBig` but in NEITHER sub-bucket, and are not in the composition donut (compItems W:1082-1105) -> hero KPI "accounts" and donut do not reconcile.
- Icons / actions:
  - Maps: `ASSET_TYPE_ICON` (W:~88), `ACCOUNT_TYPE_ICON`, `INV_TYPE_ICON` (W:~108). All lucide names resolve in installed lucide-react 1.17.0 (`BarChart2` and `Home` are aliases of `ChartNoAxesColumn` / `House`; deprecated but exported). No missing import found.
  - `INV_TYPE_ICON` has NO `deposito` key (enum has it, P:145-155) -> falls back to generic `Package` icon silently (W:1215). Label is fine (id.ts:2378). Only real icon gap found.
  - Tile tools (`.as-tools` detail link + `RowActions` edit/delete) are absolutely positioned top-right of `.as-tilewrap` (aset.css:63-69); on <=720px they become a static row under the tile (aset.css:116-124). `RowActions` renders only when `canManage` (W:~740). `.as-priv .wm-money {filter: blur}` hides amounts only. I found NO CSS that hides icons/buttons. Most likely causes of "icon/button not rendering" (UNCERTAIN, needs browser): (a) `canManage` false for the viewing role (read-only roles see no edit/delete); (b) detail link icon is 14px with `color: inherit` and no background/border -> near-invisible on the tile; (c) `BentoTile icon` is the only icon slot (bento.tsx:~554) and the investment/account rows use `MiniRow` with chip classes defined in the maps (`chip` strings `bg-blue-100 text-blue-600` are DEFINED but NEVER USED - the maps' `chip` field is dead, so icons render with no tinted chip). Verify visually with Playwright.
  - Investments with no row-level actions at all in `/aset` (read-only list, link "see all" -> /investasi).

## 2. "Summary has value but NVDA = Rp0" - root cause (HIGH confidence)

Two code paths disagree on null:

1. `IS.findAll` sets `currentValue = null` when a non-deposito, non-emas holding has no stored price and no simulated flag (IS:~196-219; only `isSimulatedPrice` falls back to `costBasis*qty`).
2. Why NVDA has no price: type `saham` is routed to Yahoo (routed-market-data.adapter.ts:35) and `toIdxTicker` blindly appends `.JK` (yahoo-finance-market-data.adapter.ts:36-40) -> `NVDA.JK` does not exist -> throws -> caught as `priceRefreshFailed` (IS:~138-165) -> price stays null. There is NO market/exchange/currency field on Investment to route US tickers (confirmed in investasi audit).
3. The Aset summary (W:997-1004) and `IS.getSummary` (IS:~311-317) fall back to cost basis when `currentValue` is null, so the HEADER has a number. The per-row renderer prints `parseFloat(inv.currentValue ?? "0")` (W:1229) -> Rp0. Fix is a single shared per-holding value, not a display tweak.
4. USD holdings: money is stored IDR; `Investment.currency` is a display tag only (IS:250). `investmentPositionValue` and `findAll` multiply raw `price*quantity` with no FX. A Yahoo/CoinGecko price in USD (if a US/crypto ticker did resolve) would be stored in `InvestmentPrice.price` and multiplied as if IDR (UNCERTAIN whether CoinGecko adapter requests IDR; not read). FX is applied only at input time (apps/api/src/fx/fx-input.\*, `fxInputs` DTO) - so a USD cost basis is converted to IDR on entry, but market prices are not.
5. Quantity units: saham = lembar, emas = gram, deposito qty=1; `lot` is a web-only toggle. Aset page prints no quantity, so no unit bug here, but the future quantity filter must be per-unit (spec 3).

## 3. "Increase shown as decrease" - causes (two independent, HIGH confidence)

A. History row ordering/delta (AS):

- `create()` writes the opening `AssetHistory` row with default `recordedAt = now()` (AS:214), a full timestamp.
- `recordValue()` takes `recordedAt` from the dialog's date-only string: D:414 `localIsoDate()` then D:430 `new Date(recordedAt).toISOString()` -> UTC midnight of that date (for a WIB user, 07:00 WIB = earlier than the real creation time same day).
- `findHistory()` sorts `recordedAt asc` with NO tie-break (AS:383) and computes `changePercent` against the previous array element (AS:398-400). So a user who creates an asset at 100 and the same day records 120 gets rows [120 @00:00Z, 100 @14:00Z]: the 100 row displays "-16.67%" (an increase shown as a decrease), and the 120 row has no previous.
- Same cause also corrupts `currentValue`: `recordValue` sets `isNewest = latest.recordedAt <= recordedAt` (AS:451-453); the same-day entry at 00:00Z is OLDER than the creation row at now() -> `isNewest=false` -> history row inserted but `Asset.currentValue` NOT updated. Totals and the "recorded value" disagree with the latest history row the user just typed. (Percent-mode entries compute from `asset.currentValue`, AS:~440, not from the as-of-date predecessor.)
- `update()` inserts a history row only when `currentValue` changes (AS:283), with `recordedAt=now()`, no user id, no note, no source - mixed with backdated rows, ordering is by instant only.
- Display: D:153 `[...rows].reverse()` (relies on API asc order); D:355-370 colours `pct >= 0 ? ad-up : ad-down` (sign logic itself is correct; the bad input is the pairing).
  B. Projection tinted as fact (W:650-740): headline tile value is `estimatedValue` (compute-on-read, AS:70-93) whenever it differs from recorded; class `is-up/is-down` colours it. A kendaraan default rate of -12%/yr (contracts DEFAULT_ASSET_VALUE_CHANGE_RATE_PCT) makes a car's headline value red/"down" purely from elapsed time, while the group total and net worth use the recorded value. The projection only lags `max(0, now - since)`; with `acquisitionDate` null it anchors on `createdAt`.
- Hero delta (W:1138-1160): `investasiDeltaPct` compares two monthly `NetWorthSnapshot.totalInvestments` buckets from `/dashboard/net-worth/history`. Order depends on `bucketPointsByMonth` (not inspected in detail; UNCERTAIN) - check it sorts by `capturedAt` not insertion/`createdAt`.

## 4. Same-day ordering - timestamps available

- `AssetHistory`: `recordedAt DateTime @default(now())` (P:1290-1303), index `(assetId, recordedAt)`. No `createdAt`, no sequence, no `effectiveAt` vs `recordedAt` split. `value BigInt`, `recordedByUserId`, `note`. No type (valuation/buy/sell/adjustment), no quantity, no source.
- User-entered valuations are date-only (UTC midnight); system rows are instants. No tie-breaker anywhere (AS:383, 449, 455).
- `Asset.acquisitionDate @db.Date` is date-only; `createdAt/updatedAt` instants. `recordedAt` future check allows +60s (AS:429).
- Compare: dashboard transactions already use `orderBy [occurredAt desc, createdAt desc]` with a comment about date-only ties (dashboard.service.ts:~190) - precedent for the fix.

## 5. Buy / sell / value history for physical assets

- There is NO buy/sell/transaction model for Asset. Only: `currentValue` (single mutable BigInt), `AssetHistory` valuations, `acquisitionDate`. No purchase price/cost basis, no quantity/unit, no disposal date/price, no sold/archived flag (hard `delete` only, AS:~362, cascades history). So "pembelian/penjualan" cannot be computed consistently - nothing stores them.
- Projection fields: `valueChangeRatePct Decimal(5,2)`, `valueChangeMode percent|fixed`, `valueChangeAmount BigInt` (P:1238-1251). `currentEstimatedValue` is computed on every read with float math (AS:70-93, `Number(currentValue)*multiplier`), linear not compound, from `acquisitionDate ?? createdAt`. It is presented as the tile headline and "adoptable" (PATCH `currentValue = currentEstimatedValue`, W:683-695) which writes a projection into history as if it were a recorded valuation (no `source`/note, `recordedByUserId` null). Contracts doc says "THIS IS A PROJECTION, NOT NET WORTH" (assets/index.ts) yet the tile is coloured as fact.
- `emas` is a valid `AssetType` (P:129-136) with default rate 0; no gram/quantity; no link to the Investment `emas` (family gold price `FamilyGroup.goldPricePerGram` applies to Investment only, investment-value.util.ts:5-10).
- No AssetHistory fx handling on update path; `recordValue` accepts `fxInputs` DTO (FX at entry only).

## 6. Valuation formulas by surface

| Surface                                                                      | Accounts                                                                      | Investments                                                                                                                 | Physical assets                                                                             |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| /aset page (W:985-1017)                                                      | ALL accounts, any type, no includeInNetWorth/privacy filter, currency ignored | `IS.findAll` `currentValue` (live price refresh), null -> cost\*qty in total, null -> 0 in rows                             | recorded `currentValue` in total; tile headline = projection                                |
| /investasi + `IS.getSummary`                                                 | n/a                                                                           | same findAll basis, summary null -> cost fallback                                                                           | n/a                                                                                         |
| Dashboard `computeNetWorthBreakdown` (dashboard.service.ts:335-405)          | `includeInNetWorth`, privacy + row-scope filtered                             | `investmentPositionValue` (stored price, skip `mock`, family gold price, deposito interest, fallback cost); NO live refresh | recorded `currentValue`; restricted roles -> []                                             |
| Dashboard summary (dashboard.service.ts:80-100)                              | same filters                                                                  | via breakdown                                                                                                               | recorded; allocation merges account-type "investment"/"property" with Investment/Asset rows |
| Reports balance sheet `computeLiveBalanceSheet` (reports.service.ts:855-960) | `includeInNetWorth` + privacy; NO row-scope filter                            | `investmentPositionValue`                                                                                                   | recorded `currentValue`; NO row-scope filter (UNCERTAIN: controller may gate)               |
| `NetWorthSnapshot` (P:1305)                                                  | stored `totalCash/Investments/Assets` per day                                 |                                                                                                                             | historical, written by a job (writer not traced)                                            |
| ai-advisor.service.ts:277,312                                                |                                                                               |                                                                                                                             | `asset.aggregate` / findMany of `currentValue` (not read in detail)                         |

Differences to resolve: (1) account inclusion (`includeInNetWorth`, privacy, row-scope, investment/property account types) - /aset sums all; (2) investment null handling - findAll null vs util fallback; findAll does a live provider call and persists a price (side effect on GET) while util reads stored; (3) mock-price handling identical in both but findAll sets `automatedPriceSimulated`; (4) projection vs recorded for assets; (5) float (`parseFloat`, `.toNumber()`) vs BigInt/Decimal sums. The util (`investmentPositionValue`) is the closest to a single source; `IS.findAll` re-implements the branching (IS:~175-225), so there are already two formulas inside the API plus the web re-derivation.

## 7. Duplication risks

- Gold: `Asset.type=emas` and `Investment.type=emas` are independent rows, no shared id/FK; user can record the same bar twice and both sum into totals (dashboard adds both). Names are the only link today.
- Platform/RDN cash: `Account.type=investment` exists (P:42) and is summed by /aset, dashboard, reports as cash, while Investment buys can optionally debit an `accountId` (IS:~812-842; optional, no FK on Investment). A broker balance can be counted as an account and as holdings if the user records cash-in as a balance and buys without selecting an account. No Account<->Investment link, no platform entity.
- `Account.type=property` also exists alongside `Asset.type=properti`: same asset can be recorded in both (summed twice).
- No Investment<->Asset id link anywhere (grep of schema: Asset has familyGroupId, categoryId only).
- Asset has no custodian/storage/source-module fields (spec 2 wants classification separated from location/source).

## 8. Permissions (AS / controller)

- Controller `apps/api/src/assets/assets.controller.ts`: `@PageAccess("assets")`, GET `can("read","Asset")`, POST/PATCH/DELETE/history/attachments `can("manage","Asset")`. CASL (casl-ability.factory.ts): owner, spouse, one more adult role (line ~169) manage; admin_staff read-only (~225); dependant/operational have no Asset ability in the sections I read (UNCERTAIN for Master-defined custom roles - EPIC-030 `rowScoped` is only consulted via `isRowScoped` in dashboard/accounts/transactions).
- `findAll(familyGroupId)` (AS:171) filters ONLY by `familyGroupId`. `Asset` has NO owner/created-by column, no shares table, no privacy flag -> all-or-nothing per family; a custom role with `read Asset` but `rowScoped` sees everything while dashboard hides assets for row-scoped roles (dashboard.service.ts:~93,350). Mismatch to settle.
- Tenant scoping of writes is good (`where {id, familyGroupId}`; category tenant check AS:~330).
- `/aset` page also pulls accounts (row-scoped by API) and investments (no row scoping; no owner field) - merged view can show different completeness per role. Investments have no per-user owner either (investasi audit).
- `recordValue` actingUserId comes from `tenantContext.userId` (controller:139-151).

## 9. Existing tests

- apps/api/src/assets/assets.service.spec.ts (882 lines): computeEstimatedValue math, create/update validation (rate bounds, categoryId tenant scope, acquisitionDate incl. WIB boundary, fixed mode). NO tests for `findHistory`, `recordValue` (ordering, isNewest, percent mode), or `remove`.
- apps/api/src/assets/asset-type-contract-drift.spec.ts; dto/create-asset.dto.spec.ts; dto/asset-type-emas.dto.spec.ts.
- apps/web/src/app/(app)/aset/aset.test.tsx (~620 lines): totals from recorded value, projection + adopt, AddAssetModal (rate prefill, fixed mode, FX, emas), edit/delete, privacy eye. NOTHING for investments list rows, accounts merge, or the detail page `[id]` (no test file).
- Related: apps/api/src/fx/fx-wiring-holdings.spec.ts, dashboard.service.spec.ts, reports.service.spec.ts, reports-dashboard-networth-parity.spec.ts, common/utils/investment-value.util.spec.ts (parity of dashboard vs reports; /aset page excluded from parity).
- No Playwright/e2e specs referencing aset found under apps/web/e2e (dir absent / no hits).

## 10. Migration-safety notes for the planned additions

Latest migration: 20261019100000_account_cash_wallet. Follow repo rules (never hand-apply DDL; additive, nullable/defaulted columns; `migrate resolve --applied` is only recovery; timestamps unique across parallel worktrees).

1. Valuation history with effective timestamp: add to `asset_history` `effectiveAt timestamptz NULL` (backfill `= recordedAt` in the migration, then read as `COALESCE(effectiveAt, recordedAt)`), keep `recordedAt` as insert time, add `createdAt`/monotonic `seq` (or order by `(effectiveAt, recordedAt, id)`). Do NOT rewrite or coarsen legacy date-only rows (user: keep old data, no unit changes without evidence). Add index `(assetId, effectiveAt)`. Backfill old rows with `kind='valuation'`, `source='legacy'`. Unique/idempotency key optional.
2. Asset transactions (buy/sell/adjust): new `asset_transactions` table (assetId, type, quantity Decimal(18,8)?, unit, amount BigInt, occurredAt timestamptz, createdAt, optional accountId, note, idempotencyKey). Existing assets have no cost data: leave `purchasePrice` NULL and surface "belum lengkap" (spec filter "status kelengkapan valuasi"); do not invent opening buys from currentValue. Wrap writes in the same Serializable-retry pattern as `runSerializableWithRetry` (IS:702) and store signed deltas not recomputed state.
3. Links to investments: add `Asset.investmentId String? @unique` (or a `linkedInvestmentId` on one side only) with `onDelete: SetNull`; for emas/RDN add `custodianAccountId` (FK Account) and `sourceModule`. Make a linked Asset a VIEW row: exclude it from `assetsTotal` in dashboard.service.ts:350, reports.service.ts:871 and W:1011 (single query `WHERE investmentId IS NULL`) to avoid double count. Existing emas rows: needs a user-confirmed merge flow (name matching is explicitly disallowed by spec 2); never auto-link.
4. Archive/sold: add `status enum(active|sold|archived) default active`, `soldAt`, `soldValue`; default keeps every existing row active (no backfill). Replace hard delete with archive for rows having history; every aggregate query (dashboard, reports, ai-advisor, snapshot writer, W) must add `status='active'` - grep list in section 6 plus `NetWorthSnapshot` writer and inheritance.service.ts:117 (links to Asset by id; UNCERTAIN what it does).
5. Keep BigInt Rupiah for currentValue; add Decimal for quantity; no float sums in new shared service. Prisma enum additions in Postgres need their own migration step (cannot be used in same transaction as ALTER TYPE ADD VALUE) - split migration.
6. Deploy hazards from memory: contracts/dist is committed (rebuild after editing packages/contracts src or web build SIGTRAPs); `eslint --fix` type-import rewrite breaks Nest DI; spec tests using `new Service()` will not catch DI breaks; throttle 100 req/min per IP affects crawl-style audits.
7. Recommended seams: one `AssetsOverviewService` in apps/api returning merged rows (account/cash/investment/physical) using `investmentPositionValue` (extended to return `{value, basis: 'price'|'cost'|'none'}`) + `Account` filters from dashboard (`includeInNetWorth`, privacy, row-scope); drop client-side summing in W:985-1017; make `IS.findAll` GET side-effect-free or share the same valuation core.
