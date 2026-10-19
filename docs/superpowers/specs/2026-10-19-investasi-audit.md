# Investment module audit (read-only). Paths relative to repo root.

API = apps/api/src/investments/investments.service.ts (S), schema = apps/api/prisma/schema.prisma (P)

## 1. Data model

- Investment (P:1325): quantity Decimal(18,8) (P:1330s), costBasisPerUnit Decimal(18,2) = weighted AVG cost, currency String default "IDR" (display tag only; all money stored IDR), purchasedAt/maturityDate nullable, createdAt, familyGroupId (NO per-user owner field). ticker String (required column; internal code derived for non-automated types).
- InvestmentTransaction (P:1367): type buy|sell, quantity Decimal(18,8), pricePerUnit Decimal(18,2), occurredAt (effective date), realizedPnl nullable, createdAt. Index (investmentId, occurredAt). NO accountId, NO idempotency key, NO unique constraint, NO link to Transaction row.
- InvestmentPrice (P:1389): price, source, asOf, delayed, recordedAt.
- InvestmentType enum (P:145): saham, reksa_dana, obligasi, emas, kripto, lainnya, deposito. NO market/exchange field (IDX vs NASDAQ), NO lot-size field.
- AccountType enum (P:42): bank, ewallet, cash, investment, property. Account.balance BigInt, currency default IDR. No RDN/platform concept, no Investment<->Account FK.
- Units: saham quantity stored in LEMBAR (shares), gold in GRAMS, deposito quantity=1 and costBasisPerUnit=nominal. "lot" is a web-only display toggle (1 lot=100 lembar).

## 2. API

- create (S:338): no tx row, no account debit, no accountId in CreateInvestmentDto. Initial quantity/cost written straight to Investment; no InvestmentTransaction "opening buy" => history empty, realized P&L base undefined.
- update (S:398): quantity/cost only editable for deposito (else 400).
- recordTransaction (S:702) -> runRecordTransaction (S:751) inside runSerializableWithRetry (Serializable, retried).
  Cost basis = WEIGHTED AVERAGE, not FIFO (S:787): `newAvgCost = oldQty.times(oldAvgCost).plus(qty.times(price)).dividedBy(newQty)`; sell keeps avg (S:797-801); `realizedPnl = price.minus(oldAvgCost).times(qty)` (S:802). Decimal.js throughout (no float) in write path; floats only in returnPct display (S:225-228) and dashboard sum `.toNumber()` (dashboard.service.ts:~380).
  Running state is in Investment.quantity/costBasis (mutable); transactions are NOT replayed.
- Sell guard: `qty > oldQty` -> 400 (S:790). Compares against CURRENT quantity, ignoring occurredAt.
- occurredAt: `dto.occurredAt ? new Date(..) : new Date()` (S:716). No validation vs future, vs purchasedAt, vs earlier txs. Txs applied in ARRIVAL order, never sorted by occurredAt: a backdated buy is folded into the average as if latest; a backdated sell is validated against today's qty, so valid-by-date sells can pass/fail wrongly, and a sell dated before the first buy is accepted. findTransactions orders by occurredAt desc (S:~972) so display order != application order. realizedPnl is frozen at insertion; never recomputed.
- Cash leg (S:~812-905): ONLY if dto.accountId given (optional, DTO create-investment-transaction.dto.ts). Buy: `account.balance decrement gross`, Transaction type "transfer" accountId=settleAccount (S:~826-842). NO balance sufficiency check => account balance can go negative silently (no error). No currency check (Account.currency vs IDR gross). gross=BigInt(qty\*price .toFixed(0)). Sell: credits gross; gain->"Hasil Investasi" income tx; loss->"Rugi Investasi" expense tx. Transaction rows use occurredAt but account.balance is a live mutable counter (no ledger replay).
- Idempotency: none (no key, no dedupe). Double submit = double buy + double debit. Only Serializable retry protects concurrency.
- Zero price allowed on tx (price>=0, S:713); manual price must be >0 (S:584).
- Market price: findAll (S:81) refreshes saham/kripto once/day via MarketDataPort (S:136). Price missing => currentPrice null (S:~190) -> currentValue null in list, BUT investmentPositionValue (apps/api/src/common/utils/investment-value.util.ts) falls back to costBasisPerUnit\*quantity for net worth/reports ("missing price valued at cost", not 0). Mock-source price ignored. emas without price => cost basis (S:~190).
- Yahoo adapter (yahoo-finance-market-data.adapter.ts:~28,45): ALWAYS appends ".JK" (toIdxTicker) for saham. So US tickers (AAPL) resolve to AAPL.JK -> not found/wrong; and any USD quote would be stored as IDR anyway (no price currency). No exchange/market input anywhere.
- FX: fx-field-specs.ts: investmentTrade.pricePerUnit / investment.costBasisPerUnit are converted to IDR at entry (decimal2 sen). So everything stored in IDR; currency column informational.

## 3. Web (apps/web/src/app/(app)/investasi/page.tsx 2688 lines)

- Lot logic is applied to type === "saham" ONLY, regardless of market: formatQuantityCell page.tsx:~335-350 shows `divideBy100(h.quantity)` lot + lembar; unit spec UNIT_BY_TYPE instrument-units.ts: saham {shares, maxDecimals 0}; lot toggle in add form (page.tsx:~967-990, default "lot" at ~616) and Beli/Jual dialog (~1275, ~1393 factor 100); canonicalizeSahamQuantity (quantity-conversion.ts end) multiplies by 100 at submit (page.tsx:~721, ~1338). No exchange awareness => US stock "1 share" typed in lot mode becomes 100 shares; display shows 0.01 lot.
- Ticker: required in UI only for AUTOMATED types (saham,kripto) (page.tsx:~629 requiresTicker); API also enforces (S:resolveTickerForCreate ~ line 505-526: "Ticker wajib diisi untuk saham dan kripto"). Other types get derived internal code.
- Time: Beli/Jual date is DateField (page.tsx:~1604), default localIsoDate(); sent as `new Date(occurredAt).toISOString()` (page.tsx:1358) => date only, midnight (local->UTC parse of "YYYY-MM-DD" is UTC midnight). No time-of-day field. purchasedAt on create similar.
- Settlement account select optional ("none" option, page.tsx:~1589); options filtered to bank/cash/ewallet (page.tsx:~1296) so "investment"-type account cannot be chosen. Creating a holding (add form) has NO account field at all => "purchases don't take money" for add-holding path; only Beli dialog + explicit account debits.
- No-price display: holding-price.ts hasMarketPrice() => false when currentPrice null/mock/emas-no-source; UI shows "—" (page.tsx:~2236, 2456). Honest here.

## 4. Root causes

(a) US stocks lot-converted: no market/exchange field; UI keys lot conversion on type==="saham" (see above); Yahoo adapter hardcodes .JK. Fix = add market (IDX|US|...) + per-market lot size, default 1 for non-IDX.
(b) Purchases don't debit platform: accountId optional on tx (defaults none; UI default "none"), absent entirely on create; no platform/RDN entity; investment-type Account excluded from selector. When provided, debit works (test investments.service.spec.ts:1306).
(c) Backdated: no ordering; sells checked vs current qty; avg-cost running state mutated in arrival order; no replay; no date validation (future/before purchasedAt); occurredAt is date-only. Result: wrong avg cost/realized P&L, not necessarily errors. Failures likely "Cannot sell X — only Y held" (S:790) when user enters sell before the buy that funds it chronologically (buy entered later).
(d) Negative: holdings can't go negative (guard S:790), but the error message is raw English/unit-agnostic (lembar vs lot confusion: user enters lots, server compares lembar). ACCOUNT balance CAN go negative silently (no check at debit). Net worth mixing => negative cash.
(e) Empty ticker: API 400 for saham/kripto with Indonesian message; UI marks required. Missing time: date-only. Missing market price: list currentValue null / "—", but net worth/reports use cost basis (investment-value.util.ts) -- not 0, intentional; sell/buy price allowed 0 (S:713) which would book 0-priced trade & huge P&L.

## 5. Net worth

- dashboard.service.ts computeNetWorthBreakdown (~330-405): netWorth = totalCash + totalInvestments + totalAssets - totalLiabilities. totalCash = SUM(Account.balance WHERE includeInNetWorth) over ALL account types (incl. type "investment"); totalInvestments = SUM investmentPositionValue over Investment rows. Reports balance sheet (reports.service.ts:~861-930) same basis.
- Double count risk: a buy debits cash account (transfer out) AND adds Investment value => correct, no double. But if a platform/RDN cash Account of type "investment" holds the cash AND positions are valued separately it is fine only while cash stays cash; if platform account balance is later also raised by position value (or an Account of type investment mirrors holdings), it double counts. Allocation chart (dashboard.service.ts:~135-142) merges Account type "investment" slice with totalInvestments by key "investment" (already merging, labelled same). Keep platform cash as Account (includeInNetWorth) and never add holdings value to it.
- Reports have "30002"-style wealth-vehicle transfers (reports.service.ts:65-70) — transfers to investment are not expenses; verify new cash legs follow same.

## 6. Tests / price sources

API specs: investments.service.spec.ts (1769 lines; buy/sell/account settle at 1306,1354), coingecko-market-data.adapter.spec.ts, yahoo-finance-market-data.adapter.spec.ts, routed-market-data.adapter.spec.ts, internal-code.util.spec.ts, dto/set-manual-price.dto.spec.ts, common/utils/investment-value.util.spec.ts. No backdating/ordering tests, no idempotency tests, no negative-account-balance test.
Web: investasi.test.tsx (1247), currency-conversion.test.tsx, history-filter.test.ts, holding-price.test.ts, instrument-units.test.ts, quantity-conversion.test.ts, components/tax/investment-tax-card.test.tsx.
Price sources: Yahoo (.JK only) saham; CoinGecko kripto (coingecko-market-data.adapter.ts); gold: apps/api/src/gold-price/antam-gold-price.\* -> FamilyGroup.goldPricePerGram (emas); mock adapter (dev); manual (POST :id/price). Scheduler: price-refresh.scheduler.ts/processor.ts. No US stock feed (would need Yahoo without suffix + USD handling).

## 7. Migration safety

- Existing saham quantity = lembar (page canonicalizes lot\*100 at submit). Reinterpreting units is unsafe for rows where user typed 1 US share in lot mode (stored 100) — cannot distinguish IDX vs US from data; ticker heuristic only. Needs a migration with explicit review/default market=IDX, and a manual "convert" tool for US rows.
- Existing holdings created via add form have no InvestmentTransaction; opening balance lives only in Investment.quantity/costBasis => replay-based costing needs synthetic opening tx (occurredAt = purchasedAt ?? createdAt).
- Past buys with accountId have Transaction rows with description "Beli {qty} {ticker} @ {price}" but no FK to InvestmentTransaction (cannot join reliably).
- Purely additive columns (market, lotSize, accountId on InvestmentTransaction, idempotencyKey unique) are safe; never hand-apply DDL (project memory) — use prisma migration. contracts/dist is committed: rebuild after src edits.
- costBasisPerUnit scale is 2 dp: avg cost rounding on repeated buys loses precision (small).
  Uncertain: exact line numbers marked "~"; settle-leg line range approximated from reading.
