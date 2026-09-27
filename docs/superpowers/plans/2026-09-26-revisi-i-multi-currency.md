# Revisi I — Multi-Currency Money Input (live FX, convert to IDR, audit trail) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every persisted money input lets the user pick a currency (IDR, USD, SGD, EUR, JPY, AUD, CNY). The server converts the amount to IDR with a live, cached ECB rate and stores the IDR value exactly as it does today. The original amount, currency, rate, rate date and source go into an append-only audit table.

**Architecture:** The API gains three pieces:

- A pure BigInt money module in `@wealthme/contracts` (`packages/contracts/src/fx/money.ts`) for minor units, round-half-up and conversion. It is shared with the web preview, so both sides round identically.
- A live `FxPort` adapter, `FrankfurterFxService`. It reads through an in-process memo, then the new Postgres `fx_rates` table, then the Frankfurter/ECB feed. If the provider is down it falls back to the last stored rate, and then to the existing indicative table.
- `FxInputService`. Controllers pass it the new optional `fxInputs` array. The service converts each entry server-side, overwrites the matching IDR field on the DTO, calls the unchanged service method, and writes one `fx_conversions` row per converted field.

The ledger, balances, reports and every existing service method stay IDR-only and untouched. On the web, a new non-protected `MoneyInput` component in `apps/web/src/components/money/` pairs the amount field with a currency select. It shows an informational IDR preview (plus the user's display currency) and a rate label. Each money input in scope is swapped for it, and the page adds `fxInputs` to its request only when a foreign currency was chosen. IDR submissions are byte-identical to today.

**Tech Stack:**

- API: NestJS 11, Prisma 6 (PostgreSQL), class-validator, zod (env), Jest.
- Web: Next.js 16 App Router, React 19, TanStack Query, Jest + Testing Library.
- Shared: `@wealthme/contracts` (tsup; `dist/` is committed). pnpm 9.

> The brief said NestJS 10 / Prisma 5. `apps/api/package.json` actually pins `@nestjs/*` ^11 and `@prisma/client` 6.19.3. Nothing below depends on the difference.

**Spec:** `docs/superpowers/plans/2026-09-25-revisi-besar-catalog.md`, **new item 18** (added by this plan, not edited into the catalog): "Input uang dimanapun harus bisa pilih currency-nya apa, lalu nanti di-convert ke default currency dari settings." Sub-plan **I**. Screenshots cited by the client: investasi "Record Investment" (purchase price per unit), master data "Tambah Rekening Bank" and "Tambah Kas Tunai" (Saldo Saat Ini).

## Global Constraints

- Work in the worktree `/home/wit/WORK/vibes/wealthme-web-revisi-g` on a new branch `feat/revisi-i-multi-currency`, cut from `development` once sub-plan G (`feat/revisi-g-liabilitas-bunga`) has merged. Task 9 edits `liabilitas/page.tsx`, which G rewrites. Never touch `/home/wit/WORK/vibes/wealthme-web`.
- Never edit protected files: `apps/web/src/app/globals.css`, `apps/web/src/app/design-system.css`, `apps/web/src/lib/*`, `apps/web/src/components/ui/*`, `apps/web/src/components/wm/*`, `apps/web/src/components/charts/*`, `apps/web/src/components/shell/*`, `apps/web/src/app/layout.tsx`, `packages/config/*`.
  - **Granted exception:** `apps/web/src/components/shell/transaction-dialog.tsx` may be edited minimally, only to swap its main amount input for `MoneyInput` and to add `fxInputs` to the two request bodies (Task 8b).
- The new shared web code lives in `apps/web/src/components/money/`. The id-ID typing/parsing helpers and the preview wrapper live there, never in `lib/format.ts`. The conversion math itself is imported from `@wealthme/contracts`, the same function the server uses.
- Every new user-visible string goes into **all three** of `apps/web/src/i18n/types.ts`, `apps/web/src/i18n/id.ts` and `apps/web/src/i18n/en.ts` (dictionaries use `satisfies I18nDictionary`). Templates use `{placeholder}` plus `.replace(...)`, like the existing `quantityWholeNumberErrorTemplate`.
- Controller DTO classes consumed by `@Body()`/`@Query()` are value imports preceded by `// eslint-disable-next-line @typescript-eslint/consistent-type-imports`. Services injected through a controller constructor (e.g. `FxInputService`) keep the same convention, because Nest reads their runtime type.
- **Never run `eslint --fix` on API files.** Husky lint-staged runs `eslint --fix` on commit, and it can rewrite `import { X }` into `import type { X }`, which breaks Nest DI and DTO validation at boot while unit specs stay green. After every API commit, run `git show --stat HEAD` and `git diff HEAD~1 -- '*.controller.ts' '*.module.ts' | grep "import type"`. If a DI or DTO import became type-only, restore it and amend.
- Tenant scoping: every changed endpoint keeps its existing `familyGroupId` route param, its `@CheckAbility(...)` and its service-level `where: { familyGroupId }`. The only new table with tenant data (`fx_conversions`) always carries `familyGroupId` taken from the route param, never from the body. No new family-scoped route is added. `GET /fx/rates` stays `@Public()` and gains only additive response fields.
- Money is BigInt on the API and digit strings or numbers over the wire, exactly as today. FX math is fixed-point BigInt: rates are stored at scale 6, and results round half away from zero (round-half-up on magnitude) to the target column's scale. No floats for stored values. The web preview reuses the same algorithm but is informational only; the server value wins.
- Migrations are additive only, with timestamps after `20260925210000`. This plan uses `20260926090000_revisi_i_fx_rates_and_conversions`. After a schema change, run `pnpm exec prisma generate` from `apps/api`. After a contracts change, run `pnpm --filter @wealthme/contracts build` and commit `packages/contracts/dist/` too. The web build dies with a SIGTRAP on a stale dist.
- Run tests locally only as the focused jest commands each task names. No `next build`, no full `turbo` runs.
- Lint every file you touch: `pnpm exec eslint <files>` from the owning app dir must exit 0 (no `--fix` on API files).
- Commit messages follow Conventional Commits and end with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Code comments: none unless the WHY is non-obvious; one line max.
- The husky post-commit hook prints "post-commit script failed (code 1)" (graphify). The commit still lands. Never use `--no-verify`.

## Key Decisions (binding decisions from the user, plus the judgment calls this plan makes)

0. **Interpretation (one line, user-confirmed):** "di-convert ke default currency dari settings" means the amount is **stored as IDR (family base, with an audit trail of the original) and displayed in each user's display currency**. The user explicitly chose IDR storage + audit trail over storing in each user's display currency. `MoneyInput` says so in its helper text (`t.money.storedAsIdr`).
1. **Storage (binding).**
   - Every stored money column keeps holding IDR, so ledger, balance, report, budget and net-worth math is unchanged.
   - Each foreign-currency input also writes one append-only `fx_conversions` row: `familyGroupId, entity, entityId, field, originalAmount, originalCurrency, idrAmount, idrPerUnit, rateDate, rateSource, rateStale, createdByUserId, createdAt`.
   - Display keeps following `User.currency` through the existing `formatRupiah(value, target)` / `useCurrencyPreference`.
2. **Existing per-row `currency` columns** exist on Account, Asset, Investment, Liability, Insurance, SplitBill, InheritanceAsset, Donation and BankSyncEntry.
   - Verified: no code reads them for math. Services write `dto.currency ?? "IDR"` and echo it; the web never sends them.
   - They keep that meaning and are **not** set to the input currency, because the amount beside them is IDR and writing "USD" there would mislabel it.
   - The audit table is the only home of the original currency.
3. **FX source (binding): Frankfurter (ECB reference rates), no API key.**
   - Endpoint: `GET https://api.frankfurter.dev/v1/latest?base=EUR&symbols=IDR,USD,SGD,JPY,AUD,CNY`. Verified live on 2026-09-26: `{"amount":1.0,"base":"EUR","date":"2026-09-25","rates":{"AUD":1.622,"CNY":7.6551,"IDR":20427.22,"JPY":179.7,"SGD":1.4563,"USD":1.1403}}`.
   - EUR is used as the base because `base=IDR` is rounded to 2 significant digits (`"USD":5.6e-05`), which would lose about 1 % of precision.
   - IDR-per-unit is derived as `EUR→IDR ÷ EUR→X` in BigInt at scale 6, e.g. USD = `17913.899851`.
   - The old `api.frankfurter.app` host now answers with a 301.
4. **Cache: Postgres `fx_rates` table plus an in-process memo. No Redis.**
   - The table holds one row per `(source, currency, rateDate)`. Being durable is what makes "fall back to the last good rate" survive restarts, deploys and Redis flushes; today Redis only holds refresh tokens.
   - The memo holds one snapshot per API process with a 60 min TTL, so a request never needs a DB read.
   - A snapshot counts as fresh while `fetchedAt` is < 12 h old. ECB publishes once per working day around 16:00 CET.
   - Refresh is lazy on read, with single-flight (one in-flight fetch shared by concurrent callers) and a 5 s timeout through `fetchWithTimeout`. No new cron.
   - Fallback chain, in order:
     1. Live fetch.
     2. The latest `fx_rates` row per currency, returned with `stale: true` and its real `rateDate`.
     3. The indicative table (`source: "indicative"`, `stale: true`).
   - The UI labels each case.
   - Env `FX_PROVIDER` is `"frankfurter" | "mock"` and defaults to `"frankfurter"`. Unit specs build services directly and never touch the network.
5. **Minor units.** `IDR 0, JPY 0, USD 2, SGD 2, EUR 2, AUD 2, CNY 2` decimals.
   - An input with more decimals than its currency allows is rejected with 400, not rounded.
   - The wire format is a canonical decimal string with `.` as separator and an optional leading `-`, e.g. `"1250.50"`. The web input uses the app's id-ID convention (`.` for thousands, `,` for decimals) and canonicalises before sending.
6. **Rounding.** `idr = round_half_away_from_zero(amountMinor × idrPerUnit₆ / 10^(decimals+6−targetScale))`.
   - `targetScale` is 0 for every BigInt rupiah column. It is 2 for the three investment `Decimal(18,2)` price fields (`costBasisPerUnit`, `pricePerUnit`, manual `price`). Rounding a unit price to whole rupiah would multiply the error by the quantity.
   - Negative inputs round symmetrically: `convert(-x) = -convert(x)`.
7. **Wire protocol.**
   - Every in-scope request DTO gains an optional `fxInputs?: { field, currency, amount }[]`. `field` names the DTO property it replaces, e.g. `"balance"` or `"participants.0.amountOwed"`.
   - The client still sends the legacy IDR field, filled with its preview, so every existing validator keeps running unchanged.
   - When `fxInputs` is present, the server **overwrites** that field with its own conversion, re-checks sign and bounds per a field spec, and ignores the client number.
   - An IDR submission sends no `fxInputs` key at all.
8. **Audit write timing.**
   - `FxInputService.run()` records the audit rows **after** the service method returns, outside its `$transaction`.
   - Threading audit rows into the ~20 existing service transactions would touch every money service. Failing the request after the money has committed would invite a client retry that double-posts.
   - An audit insert failure is therefore logged with `Logger.error` and full context (familyGroupId, entity, entityId, payload), and the response still returns. This is a deliberate trade-off and Review Focus item 7.
9. **Edit opens in IDR and never re-converts (user decision).**
   - Edit forms prefill the **stored IDR value** with the currency select on **IDR**, whatever the user's display currency is. The original currency is not restored: the audit row holds it, but the stored IDR is the truth, and restoring "USD 100" would re-convert it at today's rate on save.
   - Saving without touching the amount sends no `fxInputs`, so no conversion happens with today's rate.
   - Picking a foreign currency on edit means typing a new foreign amount, which converts at today's rate. That is correct because the user entered a new value.
   - The same IDR opening applies to every prefill that comes from stored IDR data: the receipt-scan amount, the zakat/tithe → donation prefill, the warisan "pick an asset" value, and the liabilitas pay presets.
10. **Split bills.** One currency per bill.
    - The client sends `fxInputs` for `totalAmount` and every `participants.N.amountOwed`, all in the same currency.
    - After converting, the server makes `totalAmount` authoritative and adds the rounding residue (at most ±n/2 rupiah for n participants) to participant 0, so the existing `sum === total` check still holds.
11. **Transaction dialog admin fee stays IDR-only.**
    - The exception granted covers only the amount input.
    - An e-wallet top-up fee is charged in rupiah by the Indonesian provider.
    - Out of scope, listed below.
12. **Default currency = the user's display currency (user decision).**
    - An empty **create** form opens its currency select on `User.currency`, read through the existing `useCurrencyPreference()`. Only a code in the 7-currency list counts; anything else falls back to IDR.
    - For an IDR-display user nothing changes: the form opens on IDR and saves exactly as today, with no `fxInputs`.
    - For a USD-display user, create forms open on USD and convert on save.
    - The default is **latched** the first time the user types or picks a currency. A profile that loads after the user has started typing never flips the currency under them.
    - Edit mode and IDR prefills always open on IDR (Decision 9).
13. **Backdated entries use the latest rate, labelled (user decision).**
    - A transaction dated in the past still converts at the latest ECB rate available at save time.
    - `MoneyInput` shows the rate date ("1 USD = Rp 17.913,90 · ECB 25 Sep 2026"), and `fx_conversions.rateDate` records it, so the gap is visible and auditable.
    - Historical-rate conversion is an explicit out-of-scope follow-up.

## Review Focus

1. **Provider down → fallback + label:**
   - The live fetch throws or times out, the DB has a snapshot from 2026-09-24 → returns `stale: true, rateDate: "2026-09-24", source: "frankfurter"`, and the UI label says "Kurs terakhir tersedia (24 Sep 2026)".
   - The DB is empty too → `source: "indicative"`.
   - Tests: Task 3, "falls back to the latest stored rows when the provider fails" and "falls back to the indicative table when provider and DB are both empty"; Task 7, "labels a stale rate" and "labels an indicative rate".
2. **IDR path unchanged (and the default for IDR-display users):** an IDR submission sends **no** `fxInputs` key, and the legacy field keeps its exact current value and type (number vs digit string). `FxInputService.run()` with no `fxInputs` calls `persist` with the DTO minus `fxInputs` and writes nothing.
   - Tests: Task 4, "passes the DTO through untouched when fxInputs is absent"; Task 8b, "IDR submit sends the same body as before (no fxInputs)"; Task 9, "an IDR liability save sends no fxInputs"; Task 7, "defaults to IDR for an IDR-display user".
3. **Rounding:** half away from zero at the target scale. JPY and IDR have no decimals, and extra decimals return 400.
   - Tests: Task 1, "rounds .5 away from zero, both signs", "JPY and IDR have no minor unit: decimals are rejected, not rounded" and "decimal2 target keeps sen: USD 12.34 → Rp 221.057,52"; Task 4, "JPY rejects decimals with 400, not a silent round".
4. **Server is authoritative:** a tampered client preview (`balance: 1`) with `fxInputs: [{ field: "balance", currency: "USD", amount: "100.00" }]` stores `1791390`.
   - Test: Task 4, "overwrites the client preview with the server conversion".
5. **Editing never re-converts, even for a USD-display user:** edit forms open on IDR with the stored value (Decision 9). A PATCH without `fxInputs` writes no `fx_conversions` row and never calls `getSnapshot()`.
   - Tests: Task 4, "passes the DTO through untouched…" (asserts `getSnapshot` not called); Task 7, "edit prefill opens on IDR even for a USD-display user"; Task 8a, "editing a saved account without touching the amount sends no fxInputs" and "a USD-display user's edit form opens on IDR and sends no fxInputs".
6. **Balance and ledger totals unaffected; negative cash still allowed:**
   - A foreign cash balance of `USD -20.00` stores `-358278`.
   - A foreign negative on a non-cash account is rejected with 400 before the service runs. On PATCH the cash/non-cash decision uses the **stored** account type, never the client-sent `type`.
   - Tests: Task 4, "negative allowed only when the spec allows it"; Task 5, "cash account accepts a negative foreign balance", "bank account rejects a negative foreign balance", "cash edit without `type` still accepts USD -20" and "`type: \"cash\"` sent for a stored bank account does NOT allow a negative foreign balance".
7. **Audit write failure after commit** is logged, not swallowed silently, and does not fail the response (Decision 8).
   - Test: Task 4, "logs and still returns when the audit insert fails".
8. **Split bill rounding residue** keeps `sum(participants) === totalAmount`.
   - Test: Task 6, "split bill: residue goes to participant 0".
9. **Unknown or duplicate `field`, or a field that is not in the route's spec** (e.g. `fxInputs` naming `familyGroupId`) → 400. Only money fields can be overwritten.
   - Test: Task 4, "rejects a field outside the spec".
10. **Display-currency default (Decision 12):**
    - A USD-display user's create form opens on USD and sends `fxInputs`.
    - The default latches on first input: a profile arriving late never switches a field the user has already typed in.
    - An unsupported profile currency falls back to IDR.
    - Tests: Task 7, "defaults a create form to the display currency (USD)", "a late-loading profile does not flip a field the user already typed in" and "an unsupported profile currency falls back to IDR"; Task 8a, "a USD-display user's new account opens on USD".
11. **Backdated entry uses the latest rate, labelled with its date (Decision 13).**
    - Tests: Task 7, "USD: shows the IDR preview, the ECB rate line and the server note" (the date is in the label); Task 4, "converts an int field and records the audit payload" (`rateDate` is stored).
12. **`/akun` settings:**
    - The gold price keeps its owner-only rule, now also enforced by a `@CheckAbility` decorator: before this, the route was undecorated, so `AbilitiesGuard` let it through (fail-open).
    - The threshold keeps accepting `null` to clear it. A foreign threshold must be positive.
    - Tests: Task 5, "gold price: owner converts USD per gram; admin_staff is refused" and "member threshold converts, and null still clears".

## Module coverage (verified by reading the code)

| Surface (web file)                                                                                                                                                                         | Money input(s) → API field                                                                                                                                                                                                                                                                                                         | In scope?                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `components/shell/transaction-dialog.tsx:885`                                                                                                                                              | amount → `POST …/transactions` `amount` (INT) and card tab `POST …/liabilities/:id/purchase` `amount` (digit string)                                                                                                                                                                                                               | **Yes** (Task 8b). Admin fee `:986` stays IDR (Decision 11).                                                                                                                                           |
| `components/crud/crud-modal.tsx:244` (all `type:"amount"` fields) via `akun/page.tsx:3096`, `dana/page.tsx:412`, `rekening/page.tsx:577`, `quickinput/page.tsx:201`, `tujuan/page.tsx:457` | rekening/ewallet/cash `saldo` → accounts `balance`; aset `nilai` → `currentValue`; liabilitas `total`/`cicilan` → `totalDebt`,`remainingBalance`/`minimumPayment`; asuransi `premi`/`pertanggungan` → `premiumAmount`/`coverageAmount`; tujuan `target`/`terkumpul`/`autodebit` → `targetAmount`/`currentAmount`/`autoDebitAmount` | **Yes** (Task 8a). `investasi.modal`/`nilai` are declared but never rendered by any caller, so there is nothing to wire.                                                                               |
| `investasi/page.tsx:960` cost basis, `:1111` manual price, `:1382` buy/sell price                                                                                                          | `costBasisPerUnit`, `price`, `pricePerUnit` (decimal2)                                                                                                                                                                                                                                                                             | **Yes** (Task 9). This is the client's "Record Investment" screenshot.                                                                                                                                 |
| `laporan/_components/investment-dialogs.tsx:142` → `laporan-inner.tsx:301`                                                                                                                 | `costBasisPerUnit`                                                                                                                                                                                                                                                                                                                 | **Yes** (Task 9)                                                                                                                                                                                       |
| `aset/page.tsx:410`, `:491`; `aset/[id]/page.tsx:454`                                                                                                                                      | `currentValue`, `valueChangeAmount` (signed), history `value`                                                                                                                                                                                                                                                                      | **Yes** (Task 9)                                                                                                                                                                                       |
| `asuransi/page.tsx:806`, `:844`                                                                                                                                                            | `premiumAmount`, `coverageAmount`                                                                                                                                                                                                                                                                                                  | **Yes** (Task 9)                                                                                                                                                                                       |
| `liabilitas/page.tsx` modal (`#liability-total-debt`, `#liability-remaining`, `#liability-min-payment`, `#liability-installment`) + `#pay-liability-amount`                                | `totalDebt`, `remainingBalance`, `minimumPayment`, `installmentAmount`, pay `amount`                                                                                                                                                                                                                                               | **Yes** (Task 9). Re-grep the ids; sub-plan G moves these lines.                                                                                                                                       |
| `anggaran/page.tsx:1529`, `:1607`                                                                                                                                                          | budgets `limitAmount`                                                                                                                                                                                                                                                                                                              | **Yes** (Task 10a)                                                                                                                                                                                     |
| `tujuan/_components/contribute-dialog.tsx:113`                                                                                                                                             | contribution `amount`                                                                                                                                                                                                                                                                                                              | **Yes** (Task 10a)                                                                                                                                                                                     |
| `components/allowance/minta-dana-dialog.tsx:153`                                                                                                                                           | allowance `amount`                                                                                                                                                                                                                                                                                                                 | **Yes** (Task 10a)                                                                                                                                                                                     |
| `warisan/page.tsx:1133`                                                                                                                                                                    | `estimatedValue`                                                                                                                                                                                                                                                                                                                   | **Yes** (Task 10b)                                                                                                                                                                                     |
| `donation/page.tsx:907` `#dn-jumlah`                                                                                                                                                       | donations `amount`                                                                                                                                                                                                                                                                                                                 | **Yes** (Task 10b)                                                                                                                                                                                     |
| `splitbill/page.tsx:684` total, `:782` custom shares                                                                                                                                       | `totalAmount`, `participants[].amountOwed`                                                                                                                                                                                                                                                                                         | **Yes** (Task 10b, Decision 10)                                                                                                                                                                        |
| `transaksi/page.tsx:1047` edit dialog                                                                                                                                                      | transactions PATCH `amount`                                                                                                                                                                                                                                                                                                        | **Yes** (Task 10a)                                                                                                                                                                                     |
| `components/onboarding/guided-setup.tsx:632`, `:731`, `:822`                                                                                                                               | account `balance`, budget `limitAmount`, transaction `amount`                                                                                                                                                                                                                                                                      | **Yes** (Task 10b)                                                                                                                                                                                     |
| `tax/page.tsx:554`, `:609`                                                                                                                                                                 | `grossIncome` / calculator `zakatPaid`                                                                                                                                                                                                                                                                                             | **No.** PPh 21 / SPT is filed in rupiah, `ptkp` and the brackets are statutory rupiah amounts, and `netTax` is computed server-side from them. A foreign-currency gross income is not a tax-law input. |
| `rekonsiliasi/page.tsx:705`, `:720` split dialog                                                                                                                                           | `principalAmount` + `adminFee`                                                                                                                                                                                                                                                                                                     | **No.** The API requires them to sum exactly to the IDR bank-statement entry being split, so a converted amount would almost never match. Imports carry amounts from IDR statements.                   |
| `donation/page.tsx` zakat/tithe calculators, `kalkulator/page.tsx` (all), `tax` calculator preview                                                                                         | —                                                                                                                                                                                                                                                                                                                                  | **No.** Stateless calculators; nothing is persisted.                                                                                                                                                   |
| `akun/page.tsx` gold price per gram (`saveGoldPrice`, input bound to `goldPriceInput`, ~:1291/:1388) via `hooks/use-gold-price.ts` `updateGoldPrice`                                       | `PATCH /family-groups/:fg/gold-price` `pricePerGram` (INT, `@Min(1)`)                                                                                                                                                                                                                                                              | **Yes** (API Task 5, web Task 8b). This is the one place the user may think in a foreign price, e.g. a USD spot price per gram. It is stored as IDR per gram and still values gold holdings in IDR.    |
| `akun/page.tsx` `ThresholdForm` `#threshold-amount` (~:2685-2731)                                                                                                                          | `PATCH /family-groups/:fg/members/:memberId` `largeTxnThreshold` (INT positive, or `null` to clear)                                                                                                                                                                                                                                | **Yes** (API Task 5, web Task 8b). It is stored as IDR and compared against IDR transaction amounts, as today.                                                                                         |

## Out of scope (deliberately untouched)

- **Showing the original input after save.** Lists and detail dialogs do not display "input as USD 1,250.50 @ 17.913,90". The data sits in `fx_conversions`, but no read endpoint or UI exists yet. That is a follow-up (a read-only `GET …/fx-conversions?entity=&entityId=` with `@CheckAbility` read).
- **GDPR export** of `fx_conversions` (`gdpr.service.ts`). Follow-up.
- **Repeated conversions append, never supersede.** Each PATCH with `fxInputs` appends a new `fx_conversions` row for the same `(entity, entityId, field)`, with no supersede marker. That is correct for an append-only audit trail, but a future read endpoint must take the **latest row per `(entity, entityId, field)`** (ordered by `createdAt`) as "the current original input". A later IDR edit leaves the last foreign row in place, so the reader must also compare that row's `idrAmount` with the entity's current stored value before showing it as the origin.
- **Stale "indicative" copy in protected files (follow-up, not a defect).** `useCurrencyPreference().isIndicative` / `hooks/use-currency-preference.ts` comments and the `lib/format.ts` header comments still describe the FX source as a mock, "kurs indikatif, bukan kurs pasar real-time". The same wording appears in display copy such as `beranda/_components/hero-card.tsx`. With `FX_PROVIDER=frankfurter` the rates are now live ECB reference rates. The wording stays accurate in spirit, since ECB reference rates are daily and not a tradable market quote. Updating it touches protected `lib/*` and is left to a reviewed foundation follow-up.
- **Changing the meaning of the existing per-row `currency` columns** (Decision 2). Also untouched: the reconciliation `/upload` path, which stores a row's free `currency` string but posts it as rupiah on import (`reconciliation.service.ts:487` / `createTransactionFromEntry`). That is a pre-existing bug, noted here and not fixed.
- Admin fee on transfers (Decision 11), and the tax, rekonsiliasi and calculator inputs (see the coverage table).
- Currencies beyond the 7 in `apps/web/src/hooks/currencies.ts`. Gold ("GOLD") is a display unit, not an input currency.
- **Historical-rate conversion (explicit follow-up, user decision):** a backdated entry converts at the latest ECB rate at save time, labelled with that rate's date (Decision 13). A follow-up can use Frankfurter's `/v1/{date}` to convert on `occurredAt`, which would need `fx_rates` rows per historical date.
- Pre-existing bugs found while inventorying and **not** fixed here, except where marked:
  - Crypto `pricePerUnit` on buy/sell and the laporan cost basis drop decimals (partly fixed as a side effect, because the IDR MoneyInput for those three price fields accepts `,xx`).
  - `quickinput` double-encodes the goal body (`JSON.stringify` of a string, `quickinput/page.tsx:338`). **Fixed in Task 8a**, because that code path is rewritten there anyway.
  - The audit interceptor labels every family-scoped write as entity `"Family-group"`.

## File Map

| File                                                                                                                                                                                                                             | Responsibility                                                      | Tasks |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ----- |
| `packages/contracts/src/fx/{currencies,money,index}.ts` (+ `dist/`), tested by `apps/api/src/fx/money-units.spec.ts`                                                                                                             | Codes, minor units, schemas; pure BigInt parse/round/convert/format | 1     |
| `apps/api/prisma/schema.prisma` + `migrations/20260926090000_revisi_i_fx_rates_and_conversions/migration.sql`                                                                                                                    | `FxRate`, `FxConversion` models                                     | 2     |
| `apps/api/src/fx/frankfurter.client.ts` + `.spec.ts`                                                                                                                                                                             | HTTP fetch + zod parse + EUR-cross derivation                       | 2     |
| `apps/api/src/config/env.ts`, `.env.example`                                                                                                                                                                                     | `FX_PROVIDER`                                                       | 2     |
| `apps/api/src/fx/fx.port.ts`, `fx-mock.service.ts` (+spec)                                                                                                                                                                       | Port gains `getSnapshot()`                                          | 3     |
| `apps/api/src/fx/frankfurter-fx.service.ts` + `.spec.ts`                                                                                                                                                                         | Memo → DB → provider, fallback chain                                | 3     |
| `apps/api/src/fx/fx.module.ts`, `fx.controller.ts` (+ new `fx.controller.spec.ts`)                                                                                                                                               | Provider selection; additive `/fx/rates` fields                     | 3     |
| `apps/api/src/fx/fx-input.dto.ts`, `fx-input.resolve.ts` (+spec), `fx-input.service.ts` (+spec), `fx-field-specs.ts`                                                                                                             | Wire DTO, pure resolver, run/record, per-route field specs          | 4     |
| `apps/api/src/{accounts,transactions,budgets,goals,allowance-requests}/…controller.ts` + DTOs + controller specs; `apps/api/src/family-groups/family-groups.controller.ts` + `dto/{update-gold-price,update-member-role}.dto.ts` | Ledger wiring + `/akun` settings (gold price, threshold)            | 5     |
| `apps/api/src/{assets,investments,liabilities,insurances,inheritance,donations,split-bills}/…controller.ts` + DTOs + specs; `split-bills/split-fx.util.ts`                                                                       | Holdings/obligations wiring                                         | 6     |
| `apps/web/src/components/money/{money-math.ts,use-fx-snapshot.ts,use-money-field.ts,money-input.tsx,fx-inputs.ts,index.ts}` + tests                                                                                              | Shared web money input                                              | 7     |
| `apps/web/src/i18n/{types,id,en}.ts`                                                                                                                                                                                             | `money` section                                                     | 7     |
| `apps/web/src/components/shell/transaction-dialog.tsx` (exception), `components/crud/{crud-modal.tsx,crud-config.ts}`, `app/(app)/{akun,dana,rekening,quickinput,tujuan}/page.tsx`, `hooks/use-gold-price.ts` + tests            | Dialog + CRUD engine + `/akun` gold price & threshold               | 8     |
| `app/(app)/{investasi,aset,aset/[id],asuransi,liabilitas}/page.tsx`, `laporan/_components/{investment-dialogs,laporan-inner}.tsx` + tests                                                                                        | Holdings pages                                                      | 9     |
| `app/(app)/{anggaran,warisan,donation,splitbill,transaksi}/page.tsx`, `tujuan/_components/contribute-dialog.tsx`, `components/allowance/minta-dana-dialog.tsx`, `components/onboarding/guided-setup.tsx` + tests                 | Remaining surfaces                                                  | 10    |

---

### Task 1: Contracts `fx` module — currencies, schemas and the pure BigInt money math

**Files:**

- Create: `packages/contracts/src/fx/currencies.ts` (codes, minor units, rate scale)
- Create: `packages/contracts/src/fx/money.ts` (pure BigInt math shared by API and web, so both round identically)
- Create: `packages/contracts/src/fx/index.ts` (re-exports + zod schemas)
- Modify: `packages/contracts/src/index.ts` (append one export line), then rebuild and commit `packages/contracts/dist/`
- Test: `apps/api/src/fx/money-units.spec.ts`. The contracts package has no test runner (`"test": "echo …"`), so the math is exercised from the API's jest against the built `dist/`.

**Interfaces:**

- Consumes: nothing.
- Produces:
  - Contracts (`@wealthme/contracts`):
    - `FX_CURRENCY_CODES` (readonly tuple `["IDR","USD","SGD","EUR","JPY","AUD","CNY"]`)
    - `type FxCurrencyCode`, `type ForeignFxCurrencyCode`
    - `FOREIGN_FX_CURRENCY_CODES`
    - `FX_CURRENCY_DECIMALS: Record<FxCurrencyCode, number>`
    - `FX_RATE_SCALE = 6`
    - `FxInputSchema` / `type FxInput = { field: string; currency: ForeignFxCurrencyCode; amount: string }`
    - `FxRatesResponseSchema` / `type FxRatesResponse = { base; rates: Record<string, number>; rateDate: string; source: "frankfurter" | "indicative"; stale: boolean; idrPerUnit: Record<string, string> }`
  - Also from `@wealthme/contracts` (`fx/money.ts`):
    - `parseScaled(value: string, scale: number): bigint`, which throws `RangeError`
    - `parseMinor(amount: string, currency: FxCurrencyCode): bigint`
    - `divRoundHalfUp(n: bigint, d: bigint): bigint`, which rounds half away from zero
    - `convertToIdr(input: { amount: string; currency: FxCurrencyCode; idrPerUnit: string; targetScale: 0 | 2 }): bigint`
    - `formatScaled(value: bigint, scale: number): string`
    - `deriveIdrPerUnit(eurToIdr: string, eurToX: string): string` (scale-6 decimal string)
    - `isFxCurrency(value: string): value is FxCurrencyCode`

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/fx/money-units.spec.ts`:

```ts
import {
  convertToIdr,
  deriveIdrPerUnit,
  divRoundHalfUp,
  formatScaled,
  isFxCurrency,
  parseMinor,
  parseScaled,
} from "@wealthme/contracts";

// Rates below are real ECB (Frankfurter) values for 2026-09-25, base EUR:
// IDR 20427.22, USD 1.1403, JPY 179.7 → USD = 17913.899851, JPY = 113.674012 IDR/unit.
const USD = "17913.899851";
const JPY = "113.674012";

describe("parseScaled / parseMinor — revisi I", () => {
  it("parses canonical decimals at the requested scale", () => {
    expect(parseScaled("1250.50", 2)).toBe(125050n);
    expect(parseScaled("1250.5", 2)).toBe(125050n);
    expect(parseScaled("-20", 2)).toBe(-2000n);
    expect(parseScaled("20427.22", 6)).toBe(20427220000n);
  });

  it.each(["1.234", "abc", "1e5", "", "1,5", "--1", "."])(
    "rejects %p at scale 2",
    (bad) => {
      expect(() => parseScaled(bad, 2)).toThrow(RangeError);
    },
  );

  it("JPY and IDR have no minor unit: decimals are rejected, not rounded", () => {
    expect(parseMinor("1500", "JPY")).toBe(1500n);
    expect(() => parseMinor("1500.5", "JPY")).toThrow(RangeError);
    expect(() => parseMinor("250000.01", "IDR")).toThrow(RangeError);
    expect(parseMinor("0.01", "USD")).toBe(1n);
  });

  it("isFxCurrency accepts exactly the 7 supported codes", () => {
    expect(
      ["IDR", "USD", "SGD", "EUR", "JPY", "AUD", "CNY"].every(isFxCurrency),
    ).toBe(true);
    expect(isFxCurrency("GBP")).toBe(false);
    expect(isFxCurrency("usd")).toBe(false);
  });
});

describe("divRoundHalfUp — revisi I", () => {
  it("rounds .5 away from zero, both signs", () => {
    expect(divRoundHalfUp(5n, 2n)).toBe(3n);
    expect(divRoundHalfUp(-5n, 2n)).toBe(-3n);
    expect(divRoundHalfUp(4n, 2n)).toBe(2n);
    expect(divRoundHalfUp(1n, 4n)).toBe(0n);
    expect(divRoundHalfUp(3n, 4n)).toBe(1n);
    expect(divRoundHalfUp(-3n, 4n)).toBe(-1n);
  });

  it("rejects a non-positive divisor", () => {
    expect(() => divRoundHalfUp(1n, 0n)).toThrow(RangeError);
    expect(() => divRoundHalfUp(1n, -2n)).toThrow(RangeError);
  });
});

describe("convertToIdr — revisi I", () => {
  it("USD 1,250.50 → Rp 22.401.332 (1250.50 × 17913.899851 = 22401331.7637)", () => {
    expect(
      convertToIdr({
        amount: "1250.50",
        currency: "USD",
        idrPerUnit: USD,
        targetScale: 0,
      }),
    ).toBe(22_401_332n);
  });

  it("USD 0.01 → Rp 179 (179.139)", () => {
    expect(
      convertToIdr({
        amount: "0.01",
        currency: "USD",
        idrPerUnit: USD,
        targetScale: 0,
      }),
    ).toBe(179n);
  });

  it("negative cash: USD -20.00 → -Rp 358.278 (symmetric with +20.00)", () => {
    expect(
      convertToIdr({
        amount: "-20.00",
        currency: "USD",
        idrPerUnit: USD,
        targetScale: 0,
      }),
    ).toBe(-358_278n);
    expect(
      convertToIdr({
        amount: "20.00",
        currency: "USD",
        idrPerUnit: USD,
        targetScale: 0,
      }),
    ).toBe(358_278n);
  });

  it("decimal2 target keeps sen: USD 12.34 → Rp 221.057,52", () => {
    expect(
      convertToIdr({
        amount: "12.34",
        currency: "USD",
        idrPerUnit: USD,
        targetScale: 2,
      }),
    ).toBe(22_105_752n);
  });

  it("JPY 1,500 → Rp 170.511", () => {
    expect(
      convertToIdr({
        amount: "1500",
        currency: "JPY",
        idrPerUnit: JPY,
        targetScale: 0,
      }),
    ).toBe(170_511n);
  });

  it("an exact half rounds away from zero", () => {
    expect(
      convertToIdr({
        amount: "1",
        currency: "JPY",
        idrPerUnit: "2.500000",
        targetScale: 0,
      }),
    ).toBe(3n);
    expect(
      convertToIdr({
        amount: "-1",
        currency: "JPY",
        idrPerUnit: "2.500000",
        targetScale: 0,
      }),
    ).toBe(-3n);
  });

  it("IDR passes through without a rate (scale 0 and 2)", () => {
    expect(
      convertToIdr({
        amount: "250000",
        currency: "IDR",
        idrPerUnit: "1.000000",
        targetScale: 0,
      }),
    ).toBe(250_000n);
    expect(
      convertToIdr({
        amount: "250000",
        currency: "IDR",
        idrPerUnit: "1.000000",
        targetScale: 2,
      }),
    ).toBe(25_000_000n);
  });

  it("rejects a zero or negative rate", () => {
    expect(() =>
      convertToIdr({
        amount: "1",
        currency: "USD",
        idrPerUnit: "0",
        targetScale: 0,
      }),
    ).toThrow(RangeError);
    expect(() =>
      convertToIdr({
        amount: "1",
        currency: "USD",
        idrPerUnit: "-1",
        targetScale: 0,
      }),
    ).toThrow(RangeError);
  });
});

describe("formatScaled / deriveIdrPerUnit — revisi I", () => {
  it("formats scaled integers as canonical decimals", () => {
    expect(formatScaled(22_105_752n, 2)).toBe("221057.52");
    expect(formatScaled(-358_278n, 0)).toBe("-358278");
    expect(formatScaled(-5n, 2)).toBe("-0.05");
    expect(formatScaled(0n, 2)).toBe("0.00");
    expect(formatScaled(17_913_899_851n, 6)).toBe("17913.899851");
  });

  it("derives IDR per unit from EUR crosses at scale 6", () => {
    expect(deriveIdrPerUnit("20427.22", "1.1403")).toBe(USD);
    expect(deriveIdrPerUnit("20427.22", "179.7")).toBe(JPY);
    expect(deriveIdrPerUnit("20427.22", "1")).toBe("20427.220000");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `apps/api`): `pnpm exec jest src/fx/money-units.spec.ts`
Expected: FAIL with TS2305 `Module '"@wealthme/contracts"' has no exported member 'convertToIdr'` (and the other six names).

- [ ] **Step 3a: Contracts — currencies + schemas**

Create `packages/contracts/src/fx/currencies.ts`:

```ts
/** Revisi I — the input/display currency universe (matches apps/web/src/hooks/currencies.ts). */
export const FX_CURRENCY_CODES = [
  "IDR",
  "USD",
  "SGD",
  "EUR",
  "JPY",
  "AUD",
  "CNY",
] as const;
export type FxCurrencyCode = (typeof FX_CURRENCY_CODES)[number];
export type ForeignFxCurrencyCode = Exclude<FxCurrencyCode, "IDR">;
export const FOREIGN_FX_CURRENCY_CODES = FX_CURRENCY_CODES.filter(
  (c): c is ForeignFxCurrencyCode => c !== "IDR",
);

/** ISO 4217 minor-unit digits. IDR and JPY have none. */
export const FX_CURRENCY_DECIMALS: Record<FxCurrencyCode, number> = {
  IDR: 0,
  USD: 2,
  SGD: 2,
  EUR: 2,
  JPY: 0,
  AUD: 2,
  CNY: 2,
};

/** Rates travel as IDR-per-1-unit decimal strings with this many decimals. */
export const FX_RATE_SCALE = 6;
```

Create `packages/contracts/src/fx/index.ts`:

```ts
import { z } from "zod";

import { FX_CURRENCY_CODES } from "./currencies.js";

export * from "./currencies.js";
export * from "./money.js";

export const FxCurrencyCodeSchema = z.enum(FX_CURRENCY_CODES);

/** One money field typed in a foreign currency; the server converts it and overwrites `field`. */
export const FxInputSchema = z.object({
  field: z.string().min(1).max(96),
  currency: FxCurrencyCodeSchema.exclude(["IDR"]),
  amount: z.string().regex(/^-?\d{1,13}(\.\d{1,2})?$/),
});
export type FxInput = z.infer<typeof FxInputSchema>;

export const FxRatesResponseSchema = z.object({
  base: z.string(),
  rates: z.record(z.number()),
  rateDate: z.string(),
  source: z.enum(["frankfurter", "indicative"]),
  stale: z.boolean(),
  idrPerUnit: z.record(z.string()),
});
export type FxRatesResponse = z.infer<typeof FxRatesResponseSchema>;
```

Append to `packages/contracts/src/index.ts`:

```ts
export * from "./fx/index.js";
```

- [ ] **Step 3b: Contracts — money math**

Create `packages/contracts/src/fx/money.ts`:

```ts
import {
  FX_CURRENCY_CODES,
  FX_CURRENCY_DECIMALS,
  FX_RATE_SCALE,
  type FxCurrencyCode,
} from "./currencies.js";

const DECIMAL_RE = /^(-?)(\d+)(?:\.(\d+))?$/;

export function isFxCurrency(value: string): value is FxCurrencyCode {
  return (FX_CURRENCY_CODES as readonly string[]).includes(value);
}

export function parseScaled(value: string, scale: number): bigint {
  const match = DECIMAL_RE.exec(value);
  if (!match) throw new RangeError(`"${value}" is not a decimal number`);
  const [, sign, intPart, frac = ""] = match;
  if (frac.length > scale) {
    throw new RangeError(`"${value}" has more than ${scale} decimal places`);
  }
  const magnitude = BigInt(`${intPart}${frac.padEnd(scale, "0")}`);
  return sign === "-" ? -magnitude : magnitude;
}

export function parseMinor(amount: string, currency: FxCurrencyCode): bigint {
  return parseScaled(amount, FX_CURRENCY_DECIMALS[currency]);
}

/** Integer division rounding half away from zero (round-half-up on magnitude). */
export function divRoundHalfUp(n: bigint, d: bigint): bigint {
  if (d <= 0n) throw new RangeError("divisor must be positive");
  const negative = n < 0n;
  const magnitude = negative ? -n : n;
  const quotient = (magnitude * 2n + d) / (2n * d);
  return negative ? -quotient : quotient;
}

export function formatScaled(value: bigint, scale: number): string {
  const negative = value < 0n;
  const digits = (negative ? -value : value)
    .toString()
    .padStart(scale + 1, "0");
  const body =
    scale === 0 ? digits : `${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
  return negative ? `-${body}` : body;
}

/** `amount` (canonical decimal in `currency`) → IDR at `targetScale` (0 = whole rupiah, 2 = sen). */
export function convertToIdr(input: {
  amount: string;
  currency: FxCurrencyCode;
  idrPerUnit: string;
  targetScale: 0 | 2;
}): bigint {
  const decimals = FX_CURRENCY_DECIMALS[input.currency];
  const minor = parseScaled(input.amount, decimals);
  if (input.currency === "IDR") return minor * 10n ** BigInt(input.targetScale);
  const rate = parseScaled(input.idrPerUnit, FX_RATE_SCALE);
  if (rate <= 0n)
    throw new RangeError(`rate for ${input.currency} must be positive`);
  const shift = decimals + FX_RATE_SCALE - input.targetScale;
  return divRoundHalfUp(minor * rate, 10n ** BigInt(shift));
}

/** IDR per 1 unit of X from two EUR-based ECB quotes, at FX_RATE_SCALE. */
export function deriveIdrPerUnit(eurToIdr: string, eurToX: string): string {
  const idr = parseScaled(eurToIdr, FX_RATE_SCALE);
  const x = parseScaled(eurToX, FX_RATE_SCALE);
  return formatScaled(
    divRoundHalfUp(idr * 10n ** BigInt(FX_RATE_SCALE), x),
    FX_RATE_SCALE,
  );
}
```

Run: `pnpm --filter @wealthme/contracts build`
Expected: tsup prints `Build success`, and `packages/contracts/dist/index.d.ts` contains `convertToIdr` and `FX_CURRENCY_DECIMALS`.

- [ ] **Step 4: Run tests to verify they pass**

Run (from `apps/api`): `pnpm exec jest src/fx/money-units.spec.ts`
Expected: PASS, every test in the file (22).

- [ ] **Step 5: Lint**

Run (from `apps/api`): `pnpm exec eslint src/fx/money-units.spec.ts`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add packages/contracts/src/fx packages/contracts/src/index.ts packages/contracts/dist apps/api/src/fx/money-units.spec.ts
git commit -m "$(cat <<'EOF'
feat(fx): shared currency contracts and BigInt money-unit math

Minor units per ISO 4217 (IDR/JPY 0, others 2), rates as scale-6 IDR per
unit, round half away from zero, EUR-cross derivation for ECB rates.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Schema (`fx_rates`, `fx_conversions`) + Frankfurter client + `FX_PROVIDER` env

**Files:**

- Modify: `apps/api/prisma/schema.prisma` (append two models; add back-relations on `User` and `FamilyGroup`)
- Create: `apps/api/prisma/migrations/20260926090000_revisi_i_fx_rates_and_conversions/migration.sql`
- Create: `apps/api/src/fx/frankfurter.client.ts`
- Test: `apps/api/src/fx/frankfurter.client.spec.ts`
- Modify: `apps/api/src/config/env.ts` (next to `USE_REAL_MARKET_DATA`, ~line 76), `.env.example` (next to `USE_REAL_MARKET_DATA=true`, ~line 171)

**Interfaces:**

- Consumes: Task 1 `deriveIdrPerUnit`, `formatScaled`, `parseScaled` (all from `@wealthme/contracts`); `fetchWithTimeout` from `apps/api/src/common/utils/external-fetch.util.ts`.
- Produces:
  - Prisma models `FxRate` and `FxConversion`, with client accessors `prisma.fxRate` and `prisma.fxConversion` and unique input `source_currency_rateDate`.
  - `FRANKFURTER_SOURCE = "frankfurter"`.
  - `interface ProviderRates { rateDate: string; idrPerUnit: Record<FxCurrencyCode, string> }`.
  - `class FrankfurterClient { constructor(fetchImpl?: FetchWithTimeout, timeoutMs?: number); fetchLatest(): Promise<ProviderRates> }`.
  - `Env.FX_PROVIDER: "frankfurter" | "mock"` (default `"frankfurter"`).

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/fx/frankfurter.client.spec.ts`:

```ts
import { FrankfurterClient } from "./frankfurter.client";

const LIVE_BODY = {
  amount: 1.0,
  base: "EUR",
  date: "2026-09-25",
  rates: {
    AUD: 1.622,
    CNY: 7.6551,
    IDR: 20427.22,
    JPY: 179.7,
    SGD: 1.4563,
    USD: 1.1403,
  },
};

function fakeFetch(status: number, body: unknown) {
  return jest.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
}

describe("FrankfurterClient — revisi I", () => {
  it("requests EUR-based rates once and derives IDR per unit for every code", async () => {
    const fetchImpl = fakeFetch(200, LIVE_BODY);
    const result = await new FrankfurterClient(fetchImpl, 5_000).fetchLatest();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe(
      "https://api.frankfurter.dev/v1/latest?base=EUR&symbols=IDR,USD,SGD,JPY,AUD,CNY",
    );
    expect(fetchImpl.mock.calls[0][2]).toBe(5_000);
    expect(result).toEqual({
      rateDate: "2026-09-25",
      idrPerUnit: {
        IDR: "1.000000",
        EUR: "20427.220000",
        USD: "17913.899851",
        SGD: "14026.793930",
        JPY: "113.674012",
        AUD: "12593.847102",
        CNY: "2668.445873",
      },
    });
  });

  it("throws on a non-2xx response", async () => {
    await expect(
      new FrankfurterClient(fakeFetch(503, {}), 5_000).fetchLatest(),
    ).rejects.toThrow("Frankfurter FX responded 503");
  });

  it("throws when a currency is missing from the payload", async () => {
    const { USD: _drop, ...rates } = LIVE_BODY.rates;
    await expect(
      new FrankfurterClient(
        fakeFetch(200, { ...LIVE_BODY, rates }),
        5_000,
      ).fetchLatest(),
    ).rejects.toThrow();
  });

  it("throws when the base is not EUR (payload shape changed)", async () => {
    await expect(
      new FrankfurterClient(
        fakeFetch(200, { ...LIVE_BODY, base: "USD" }),
        5_000,
      ).fetchLatest(),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `apps/api`): `pnpm exec jest src/fx/frankfurter.client.spec.ts`
Expected: FAIL with `Cannot find module './frankfurter.client'`.

- [ ] **Step 3a: Schema + migration**

Append to `apps/api/prisma/schema.prisma`:

```prisma
// Revisi I — cached ECB reference rates (IDR per 1 unit); durable last-known-good for FX fallback.
model FxRate {
  id         String   @id @default(uuid())
  source     String   @db.VarChar(32)
  currency   String   @db.VarChar(3)
  rateDate   DateTime @db.Date
  idrPerUnit Decimal  @db.Decimal(24, 6)
  fetchedAt  DateTime @default(now())

  @@unique([source, currency, rateDate])
  @@index([currency, rateDate])
  @@map("fx_rates")
}

// Revisi I — append-only audit of a money field typed in a foreign currency and stored as IDR.
model FxConversion {
  id               String      @id @default(uuid())
  familyGroupId    String
  entity           String      @db.VarChar(48)
  entityId         String
  field            String      @db.VarChar(96)
  originalAmount   Decimal     @db.Decimal(24, 2)
  originalCurrency String      @db.VarChar(3)
  idrAmount        Decimal     @db.Decimal(24, 2)
  idrPerUnit       Decimal     @db.Decimal(24, 6)
  rateDate         DateTime    @db.Date
  rateSource       String      @db.VarChar(32)
  rateStale        Boolean     @default(false)
  createdByUserId  String?
  createdAt        DateTime    @default(now())
  familyGroup      FamilyGroup @relation(fields: [familyGroupId], references: [id], onDelete: Cascade)
  createdBy        User?       @relation("FxConversionCreatedBy", fields: [createdByUserId], references: [id], onDelete: SetNull)

  @@index([familyGroupId, entity, entityId])
  @@map("fx_conversions")
}
```

In `model User`, directly before `  @@map("users")`, add:

```prisma
  fxConversionsCreated     FxConversion[]     @relation("FxConversionCreatedBy")
```

In `model FamilyGroup`, directly after `  goalContributions       GoalContribution[]`, add:

```prisma
  fxConversions           FxConversion[]
```

Create `apps/api/prisma/migrations/20260926090000_revisi_i_fx_rates_and_conversions/migration.sql`. If a sibling sub-plan has already committed a migration with this timestamp, bump it to the next free minute.

```sql
-- Revisi I (catalog item 18): cached ECB FX rates + audit of foreign-currency money inputs.
CREATE TABLE "fx_rates" (
    "id" TEXT NOT NULL,
    "source" VARCHAR(32) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "rateDate" DATE NOT NULL,
    "idrPerUnit" DECIMAL(24,6) NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fx_rates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "fx_rates_source_currency_rateDate_key" ON "fx_rates"("source", "currency", "rateDate");
CREATE INDEX "fx_rates_currency_rateDate_idx" ON "fx_rates"("currency", "rateDate");

CREATE TABLE "fx_conversions" (
    "id" TEXT NOT NULL,
    "familyGroupId" TEXT NOT NULL,
    "entity" VARCHAR(48) NOT NULL,
    "entityId" TEXT NOT NULL,
    "field" VARCHAR(96) NOT NULL,
    "originalAmount" DECIMAL(24,2) NOT NULL,
    "originalCurrency" VARCHAR(3) NOT NULL,
    "idrAmount" DECIMAL(24,2) NOT NULL,
    "idrPerUnit" DECIMAL(24,6) NOT NULL,
    "rateDate" DATE NOT NULL,
    "rateSource" VARCHAR(32) NOT NULL,
    "rateStale" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fx_conversions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "fx_conversions_familyGroupId_entity_entityId_idx" ON "fx_conversions"("familyGroupId", "entity", "entityId");
ALTER TABLE "fx_conversions" ADD CONSTRAINT "fx_conversions_familyGroupId_fkey"
  FOREIGN KEY ("familyGroupId") REFERENCES "family_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fx_conversions" ADD CONSTRAINT "fx_conversions_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

Run (from `apps/api`): `pnpm exec prisma validate && pnpm exec prisma generate`
Expected: `The schema at prisma/schema.prisma is valid` and `✔ Generated Prisma Client`.

Never apply this migration by hand with psql. It deploys through `prisma migrate deploy` in the DEV pipeline.

- [ ] **Step 3b: Client**

Create `apps/api/src/fx/frankfurter.client.ts`:

```ts
import {
  deriveIdrPerUnit,
  formatScaled,
  FX_RATE_SCALE,
  parseScaled,
  type FxCurrencyCode,
} from "@wealthme/contracts";
import { z } from "zod";

import { fetchWithTimeout } from "../common/utils/external-fetch.util";

export const FRANKFURTER_SOURCE = "frankfurter";
const FRANKFURTER_URL =
  "https://api.frankfurter.dev/v1/latest?base=EUR&symbols=IDR,USD,SGD,JPY,AUD,CNY";
const FX_TIMEOUT_MS = 5_000;

const positiveRate = z.number().positive().finite();
const ResponseSchema = z.object({
  base: z.literal("EUR"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rates: z.object({
    IDR: positiveRate,
    USD: positiveRate,
    SGD: positiveRate,
    JPY: positiveRate,
    AUD: positiveRate,
    CNY: positiveRate,
  }),
});

export interface ProviderRates {
  rateDate: string;
  idrPerUnit: Record<FxCurrencyCode, string>;
}

type FetchWithTimeout = typeof fetchWithTimeout;

function toDecimal(n: number): string {
  const s = n.toFixed(FX_RATE_SCALE);
  parseScaled(s, FX_RATE_SCALE);
  return s;
}

export class FrankfurterClient {
  constructor(
    private readonly fetchImpl: FetchWithTimeout = fetchWithTimeout,
    private readonly timeoutMs: number = FX_TIMEOUT_MS,
  ) {}

  async fetchLatest(): Promise<ProviderRates> {
    const res = await this.fetchImpl(
      FRANKFURTER_URL,
      { headers: { accept: "application/json" } },
      this.timeoutMs,
      "Frankfurter FX",
    );
    if (!res.ok) throw new Error(`Frankfurter FX responded ${res.status}`);
    const body = ResponseSchema.parse(await res.json());
    const eurIdr = toDecimal(body.rates.IDR);
    const cross = (x: number) => deriveIdrPerUnit(eurIdr, toDecimal(x));
    return {
      rateDate: body.date,
      idrPerUnit: {
        IDR: formatScaled(10n ** BigInt(FX_RATE_SCALE), FX_RATE_SCALE),
        EUR: formatScaled(parseScaled(eurIdr, FX_RATE_SCALE), FX_RATE_SCALE),
        USD: cross(body.rates.USD),
        SGD: cross(body.rates.SGD),
        JPY: cross(body.rates.JPY),
        AUD: cross(body.rates.AUD),
        CNY: cross(body.rates.CNY),
      },
    };
  }
}
```

- [ ] **Step 3c: Env**

In `apps/api/src/config/env.ts`, directly after the `USE_REAL_MARKET_DATA: …` line, add:

```ts
  // Revisi I — "mock" keeps the static indicative table (offline dev/tests); default is the live ECB feed.
  FX_PROVIDER: z.enum(["frankfurter", "mock"]).default("frankfurter"),
```

In `.env.example`, directly after `USE_REAL_MARKET_DATA=true`, add:

```bash
# Revisi I — FX for multi-currency money input: "frankfurter" (live ECB, no key) or "mock" (indicative table)
FX_PROVIDER=frankfurter
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from `apps/api`): `pnpm exec jest src/fx/frankfurter.client.spec.ts src/fx/money-units.spec.ts`
Expected: PASS (4 + 22 tests).

- [ ] **Step 5: Lint**

Run (from `apps/api`): `pnpm exec eslint src/fx/frankfurter.client.ts src/fx/frankfurter.client.spec.ts src/config/env.ts`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/20260926090000_revisi_i_fx_rates_and_conversions apps/api/src/fx/frankfurter.client.ts apps/api/src/fx/frankfurter.client.spec.ts apps/api/src/config/env.ts .env.example
git commit -m "$(cat <<'EOF'
feat(fx): fx_rates cache + fx_conversions audit tables, Frankfurter client

Additive migration. The client pulls ECB rates with base EUR (base IDR is
rounded to 2 significant digits) and derives IDR-per-unit in BigInt.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `FrankfurterFxService` (memo → DB → provider → fallback) + `/fx/rates` additive fields

**Files:**

- Create: `apps/api/src/fx/fx-snapshot.ts`
- Modify: `apps/api/src/fx/fx.port.ts`, `apps/api/src/fx/fx-mock.service.ts`, `apps/api/src/fx/fx-mock.service.spec.ts` (append), `apps/api/src/fx/fx.module.ts`, `apps/api/src/fx/fx.controller.ts`
- Create: `apps/api/src/fx/frankfurter-fx.service.ts`
- Test: `apps/api/src/fx/frankfurter-fx.service.spec.ts`, `apps/api/src/fx/fx.controller.spec.ts`

**Interfaces:**

- Consumes: Task 1 math and contracts; Task 2 `FrankfurterClient`, `FRANKFURTER_SOURCE`, `prisma.fxRate`, `Env.FX_PROVIDER`.
- Produces:
  - `interface FxSnapshot { source: "frankfurter" | "indicative"; rateDate: string; fetchedAt: string; stale: boolean; idrPerUnit: Record<FxCurrencyCode, string> }` and `ratesFromSnapshot(snapshot: FxSnapshot, base: string): Record<string, number>` (display-only floats), both in `fx-snapshot.ts`.
  - `FxPort` gains `abstract getSnapshot(): Promise<FxSnapshot>`.
  - `FrankfurterFxService extends FxPort`, with constructor `(prisma: PrismaService, client: FrankfurterClient, fallback: FxMockService, now?: () => number)`.
  - `FxModule` becomes `@Global()` and exports `FxPort` (and `FxInputService` from Task 4). It is global so the 12 feature modules in Tasks 5–6 need no `imports` change.
  - `GET /fx/rates?base=IDR` returns `{ base, rates, rateDate, source, stale, idrPerUnit }`. The last four fields are new and additive; `rates` is unchanged in shape.

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/fx/frankfurter-fx.service.spec.ts`:

```ts
import { Prisma } from "@prisma/client";

import { FrankfurterFxService } from "./frankfurter-fx.service";
import { FxMockService } from "./fx-mock.service";

import type { FrankfurterClient, ProviderRates } from "./frankfurter.client";
import type { PrismaService } from "../prisma/prisma.service";

const LIVE: ProviderRates = {
  rateDate: "2026-09-25",
  idrPerUnit: {
    IDR: "1.000000",
    EUR: "20427.220000",
    USD: "17913.899851",
    SGD: "14026.793930",
    JPY: "113.674012",
    AUD: "12593.847102",
    CNY: "2668.445873",
  },
};
const T0 = Date.parse("2026-09-26T03:00:00.000Z");
const HOUR = 60 * 60 * 1000;

function storedRows(rateDate: string, fetchedAt: number) {
  return (["USD", "SGD", "EUR", "JPY", "AUD", "CNY"] as const).map(
    (currency) => ({
      id: `r-${currency}`,
      source: "frankfurter",
      currency,
      rateDate: new Date(`${rateDate}T00:00:00.000Z`),
      idrPerUnit: new Prisma.Decimal(LIVE.idrPerUnit[currency]),
      fetchedAt: new Date(fetchedAt),
    }),
  );
}

function build(opts: {
  rows?: ReturnType<typeof storedRows>;
  fetch?: jest.Mock;
  now?: () => number;
}) {
  const prisma = {
    fxRate: {
      findMany: jest.fn().mockResolvedValue(opts.rows ?? []),
      upsert: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  const client = {
    fetchLatest: opts.fetch ?? jest.fn().mockResolvedValue(LIVE),
  };
  const service = new FrankfurterFxService(
    prisma as unknown as PrismaService,
    client as unknown as FrankfurterClient,
    new FxMockService(),
    opts.now ?? (() => T0),
  );
  return { service, prisma, client };
}

describe("FrankfurterFxService — revisi I", () => {
  it("serves the stored rows without calling the provider while they are < 12 h old", async () => {
    const { service, client } = build({
      rows: storedRows("2026-09-25", T0 - 2 * HOUR),
    });
    const snap = await service.getSnapshot();
    expect(client.fetchLatest).not.toHaveBeenCalled();
    expect(snap).toMatchObject({
      source: "frankfurter",
      rateDate: "2026-09-25",
      stale: false,
    });
    expect(snap.idrPerUnit.USD).toBe("17913.899851");
    expect(snap.idrPerUnit.IDR).toBe("1.000000");
  });

  it("fetches, persists and returns live rates when the store is empty", async () => {
    const { service, prisma, client } = build({});
    const snap = await service.getSnapshot();
    expect(client.fetchLatest).toHaveBeenCalledTimes(1);
    expect(prisma.fxRate.upsert).toHaveBeenCalledTimes(6);
    expect(prisma.fxRate.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          source_currency_rateDate: {
            source: "frankfurter",
            currency: "USD",
            rateDate: new Date("2026-09-25T00:00:00.000Z"),
          },
        },
      }),
    );
    expect(snap).toMatchObject({
      source: "frankfurter",
      stale: false,
      rateDate: "2026-09-25",
    });
  });

  it("fetches when the stored rows are older than 12 h", async () => {
    const { service, client } = build({
      rows: storedRows("2026-09-24", T0 - 13 * HOUR),
    });
    const snap = await service.getSnapshot();
    expect(client.fetchLatest).toHaveBeenCalledTimes(1);
    expect(snap.rateDate).toBe("2026-09-25");
  });

  it("falls back to the latest stored rows when the provider fails", async () => {
    const { service } = build({
      rows: storedRows("2026-09-24", T0 - 30 * HOUR),
      fetch: jest.fn().mockRejectedValue(new Error("Frankfurter FX timed out")),
    });
    const snap = await service.getSnapshot();
    expect(snap).toMatchObject({
      source: "frankfurter",
      rateDate: "2026-09-24",
      stale: true,
    });
  });

  it("falls back to the indicative table when provider and DB are both empty", async () => {
    const { service } = build({
      fetch: jest.fn().mockRejectedValue(new Error("down")),
    });
    const snap = await service.getSnapshot();
    expect(snap).toMatchObject({ source: "indicative", stale: true });
    expect(snap.idrPerUnit.USD).toBe("15873.015873");
  });

  it("serves live rates when the fx_rates read fails", async () => {
    const { service, prisma, client } = build({});
    prisma.fxRate.findMany.mockRejectedValueOnce(new Error("db down"));
    const snap = await service.getSnapshot();
    expect(client.fetchLatest).toHaveBeenCalledTimes(1);
    expect(snap).toMatchObject({
      source: "frankfurter",
      stale: false,
      rateDate: "2026-09-25",
    });
  });

  it("falls back to the indicative table when both the fx_rates read and the provider fail", async () => {
    const { service, prisma } = build({
      fetch: jest.fn().mockRejectedValue(new Error("down")),
    });
    prisma.fxRate.findMany.mockRejectedValueOnce(new Error("db down"));
    expect(await service.getSnapshot()).toMatchObject({
      source: "indicative",
      stale: true,
    });
  });

  it("still returns live rates when persisting them fails", async () => {
    const { service, prisma } = build({});
    prisma.$transaction.mockRejectedValueOnce(new Error("db down"));
    const snap = await service.getSnapshot();
    expect(snap).toMatchObject({ source: "frankfurter", stale: false });
  });

  it("memoises a fresh snapshot for 60 min: no second DB or provider call", async () => {
    let now = T0;
    const { service, prisma, client } = build({ now: () => now });
    await service.getSnapshot();
    now += 59 * 60 * 1000;
    await service.getSnapshot();
    expect(prisma.fxRate.findMany).toHaveBeenCalledTimes(1);
    expect(client.fetchLatest).toHaveBeenCalledTimes(1);
  });

  it("memoises a stale snapshot for only 5 min so recovery is quick", async () => {
    let now = T0;
    const fetch = jest
      .fn()
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValue(LIVE);
    const { service } = build({ fetch, now: () => now });
    expect((await service.getSnapshot()).stale).toBe(true);
    now += 6 * 60 * 1000;
    expect((await service.getSnapshot()).stale).toBe(false);
  });

  it("single-flight: concurrent callers share one provider call", async () => {
    const { service, client } = build({});
    await Promise.all([
      service.getSnapshot(),
      service.getSnapshot(),
      service.getSnapshot(),
    ]);
    expect(client.fetchLatest).toHaveBeenCalledTimes(1);
  });

  it("getRates('IDR') keeps the legacy numeric shape (1 IDR in X)", async () => {
    const { service } = build({ rows: storedRows("2026-09-25", T0 - HOUR) });
    const rates = await service.getRates("IDR");
    expect(rates.IDR).toBe(1);
    expect(rates.USD).toBeCloseTo(1 / 17913.899851, 12);
    expect(await service.getRate("USD", "IDR")).toBeCloseTo(17913.899851, 6);
  });
});
```

Append to `apps/api/src/fx/fx-mock.service.spec.ts`, inside the existing `describe` (before its closing `});`):

```ts
it("revisi I — getSnapshot exposes the table as indicative IDR-per-unit strings", async () => {
  const snap = await service.getSnapshot();
  expect(snap).toMatchObject({ source: "indicative", stale: true });
  expect(snap.idrPerUnit).toEqual({
    IDR: "1.000000",
    USD: "15873.015873",
    SGD: "11764.705882",
    EUR: "17241.379310",
    JPY: "105.263158",
    AUD: "10309.278351",
    CNY: "2232.142857",
  });
});
```

Create `apps/api/src/fx/fx.controller.spec.ts`:

```ts
import { FxController } from "./fx.controller";

import type { FxPort } from "./fx.port";

describe("FxController — revisi I", () => {
  it("GET /fx/rates adds rateDate, source, stale and idrPerUnit without changing rates", async () => {
    const port = {
      getRates: jest.fn().mockResolvedValue({ IDR: 1, USD: 0.0000558 }),
      getSnapshot: jest.fn().mockResolvedValue({
        source: "frankfurter",
        rateDate: "2026-09-25",
        fetchedAt: "2026-09-26T03:00:00.000Z",
        stale: false,
        idrPerUnit: { IDR: "1.000000", USD: "17913.899851" },
      }),
    };
    const res = await new FxController(port as unknown as FxPort).getRates(
      "IDR",
    );
    expect(res).toEqual({
      base: "IDR",
      rates: { IDR: 1, USD: 0.0000558 },
      rateDate: "2026-09-25",
      source: "frankfurter",
      stale: false,
      idrPerUnit: { IDR: "1.000000", USD: "17913.899851" },
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `apps/api`): `pnpm exec jest src/fx`
Expected: FAIL. `frankfurter-fx.service.spec.ts` cannot find the module, `fx-mock.service.spec.ts` reports `service.getSnapshot is not a function`, and the controller spec's `toEqual` lacks the new keys.

- [ ] **Step 3a: Snapshot type + port**

Create `apps/api/src/fx/fx-snapshot.ts`:

```ts
import type { FxCurrencyCode } from "@wealthme/contracts";

export interface FxSnapshot {
  source: "frankfurter" | "indicative";
  rateDate: string;
  fetchedAt: string;
  stale: boolean;
  idrPerUnit: Record<FxCurrencyCode, string>;
}

/** Display-only floats in the legacy `/fx/rates` shape: 1 `base` expressed in each currency. */
export function ratesFromSnapshot(
  snapshot: FxSnapshot,
  base: string,
): Record<string, number> {
  const idr = snapshot.idrPerUnit as Record<string, string>;
  const baseIdr = Number(idr[base] ?? "1");
  return Object.fromEntries(
    Object.entries(idr).map(([code, perUnit]) => [
      code,
      baseIdr / Number(perUnit),
    ]),
  );
}
```

Replace `apps/api/src/fx/fx.port.ts` with:

```ts
import type { FxSnapshot } from "./fx-snapshot";

export abstract class FxPort {
  abstract getRate(from: string, to: string): Promise<number>;
  abstract getRates(base: string): Promise<Record<string, number>>;
  abstract getSnapshot(): Promise<FxSnapshot>;
}
```

In `apps/api/src/fx/fx-mock.service.ts`, add these imports under the existing ones:

```ts
import {
  divRoundHalfUp,
  formatScaled,
  FX_RATE_SCALE,
  parseScaled,
  type FxCurrencyCode,
} from "@wealthme/contracts";

import type { FxSnapshot } from "./fx-snapshot";
```

Then add this method after `getRates`:

```ts
  async getSnapshot(): Promise<FxSnapshot> {
    const one = 10n ** BigInt(FX_RATE_SCALE);
    const idrPerUnit = Object.fromEntries(
      Object.entries(this.rates).map(([code, rate]) => [
        code,
        formatScaled(
          divRoundHalfUp(one * one, parseScaled(rate.toFixed(FX_RATE_SCALE), FX_RATE_SCALE)),
          FX_RATE_SCALE,
        ),
      ]),
    ) as Record<FxCurrencyCode, string>;
    const now = new Date();
    return {
      source: "indicative",
      rateDate: now.toISOString().slice(0, 10),
      fetchedAt: now.toISOString(),
      stale: true,
      idrPerUnit,
    };
  }
```

- [ ] **Step 3b: Live service**

Create `apps/api/src/fx/frankfurter-fx.service.ts`:

```ts
import { Injectable, Logger } from "@nestjs/common";
import {
  FOREIGN_FX_CURRENCY_CODES,
  formatScaled,
  FX_RATE_SCALE,
  type FxCurrencyCode,
} from "@wealthme/contracts";

import { FRANKFURTER_SOURCE } from "./frankfurter.client";
import { FxPort } from "./fx.port";
import { ratesFromSnapshot, type FxSnapshot } from "./fx-snapshot";

import type { FrankfurterClient } from "./frankfurter.client";
import type { FxMockService } from "./fx-mock.service";
import type { PrismaService } from "../prisma/prisma.service";

const MEMO_TTL_MS = 60 * 60 * 1000;
const STALE_MEMO_TTL_MS = 5 * 60 * 1000;
const FRESH_MS = 12 * 60 * 60 * 1000;
const IDR_ONE = formatScaled(10n ** BigInt(FX_RATE_SCALE), FX_RATE_SCALE);

@Injectable()
export class FrankfurterFxService extends FxPort {
  private readonly logger = new Logger(FrankfurterFxService.name);
  private memo: { snapshot: FxSnapshot; at: number } | null = null;
  private inflight: Promise<FxSnapshot> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: FrankfurterClient,
    private readonly fallback: FxMockService,
    private readonly now: () => number = Date.now,
  ) {
    super();
  }

  async getSnapshot(): Promise<FxSnapshot> {
    if (this.memo) {
      const ttl = this.memo.snapshot.stale ? STALE_MEMO_TTL_MS : MEMO_TTL_MS;
      if (this.now() - this.memo.at < ttl) return this.memo.snapshot;
    }
    this.inflight ??= this.load().finally(() => {
      this.inflight = null;
    });
    const snapshot = await this.inflight;
    this.memo = { snapshot, at: this.now() };
    return snapshot;
  }

  async getRates(base: string): Promise<Record<string, number>> {
    return ratesFromSnapshot(await this.getSnapshot(), base);
  }

  async getRate(from: string, to: string): Promise<number> {
    if (from === to) return 1;
    return (await this.getRates(from))[to] ?? 1;
  }

  private async load(): Promise<FxSnapshot> {
    let stored: FxSnapshot | null = null;
    try {
      stored = await this.latestStored();
    } catch (err) {
      // A failing fx_rates read must not block the live feed or the indicative fallback.
      this.logger.warn(
        `could not read cached FX rates: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    if (stored && this.now() - Date.parse(stored.fetchedAt) < FRESH_MS) {
      return stored;
    }
    try {
      const live = await this.client.fetchLatest();
      const fetchedAt = new Date(this.now());
      await this.persist(live.rateDate, live.idrPerUnit, fetchedAt);
      return {
        source: "frankfurter",
        rateDate: live.rateDate,
        fetchedAt: fetchedAt.toISOString(),
        stale: false,
        idrPerUnit: live.idrPerUnit,
      };
    } catch (err) {
      this.logger.warn(
        `live FX fetch failed, serving ${stored ? `stored ${stored.rateDate}` : "indicative"} rates: ${err instanceof Error ? err.message : String(err)}`,
      );
      if (stored) return { ...stored, stale: true };
      return this.fallback.getSnapshot();
    }
  }

  private async latestStored(): Promise<FxSnapshot | null> {
    const rows = await this.prisma.fxRate.findMany({
      where: { source: FRANKFURTER_SOURCE },
      orderBy: [{ rateDate: "desc" }, { fetchedAt: "desc" }],
      distinct: ["currency"],
    });
    const byCode = new Map(rows.map((r) => [r.currency, r]));
    if (!FOREIGN_FX_CURRENCY_CODES.every((c) => byCode.has(c))) return null;
    const idrPerUnit = { IDR: IDR_ONE } as Record<FxCurrencyCode, string>;
    for (const code of FOREIGN_FX_CURRENCY_CODES) {
      idrPerUnit[code] = byCode.get(code)!.idrPerUnit.toFixed(FX_RATE_SCALE);
    }
    const oldestFetch = Math.min(...rows.map((r) => r.fetchedAt.getTime()));
    return {
      source: "frankfurter",
      rateDate: byCode.get("USD")!.rateDate.toISOString().slice(0, 10),
      fetchedAt: new Date(oldestFetch).toISOString(),
      stale: false,
      idrPerUnit,
    };
  }

  private async persist(
    rateDate: string,
    idrPerUnit: Record<FxCurrencyCode, string>,
    fetchedAt: Date,
  ): Promise<void> {
    const day = new Date(`${rateDate}T00:00:00.000Z`);
    try {
      await this.prisma.$transaction(
        FOREIGN_FX_CURRENCY_CODES.map((currency) =>
          this.prisma.fxRate.upsert({
            where: {
              source_currency_rateDate: {
                source: FRANKFURTER_SOURCE,
                currency,
                rateDate: day,
              },
            },
            create: {
              source: FRANKFURTER_SOURCE,
              currency,
              rateDate: day,
              idrPerUnit: idrPerUnit[currency],
              fetchedAt,
            },
            update: { idrPerUnit: idrPerUnit[currency], fetchedAt },
          }),
        ),
      );
    } catch (err) {
      this.logger.error(
        `could not cache FX rates for ${rateDate}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
```

- [ ] **Step 3c: Module + controller**

Replace `apps/api/src/fx/fx.module.ts` with the code below. `FxInputService` is added to `providers`/`exports` in Task 4.

```ts
import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { PrismaService } from "../prisma/prisma.service";

import { FrankfurterClient } from "./frankfurter.client";
import { FrankfurterFxService } from "./frankfurter-fx.service";
import { FxMockService } from "./fx-mock.service";
import { FxController } from "./fx.controller";
import { FxPort } from "./fx.port";

import type { Env } from "../config/env";

@Global()
@Module({
  controllers: [FxController],
  providers: [
    {
      provide: FxPort,
      useFactory: (config: ConfigService<Env, true>, prisma: PrismaService) =>
        config.get("FX_PROVIDER", { infer: true }) === "mock"
          ? new FxMockService()
          : new FrankfurterFxService(
              prisma,
              new FrankfurterClient(),
              new FxMockService(),
            ),
      inject: [ConfigService, PrismaService],
    },
  ],
  exports: [FxPort],
})
export class FxModule {}
```

In `apps/api/src/fx/fx.controller.ts`, replace the `getRates` method with:

```ts
  async getRates(@Query("base") base = "IDR"): Promise<{
    base: string;
    rates: Record<string, number>;
    rateDate: string;
    source: "frankfurter" | "indicative";
    stale: boolean;
    idrPerUnit: Record<string, string>;
  }> {
    const [rates, snapshot] = await Promise.all([
      this.fxPort.getRates(base),
      this.fxPort.getSnapshot(),
    ]);
    return {
      base,
      rates,
      rateDate: snapshot.rateDate,
      source: snapshot.source,
      stale: snapshot.stale,
      idrPerUnit: snapshot.idrPerUnit,
    };
  }
```

Also update its `@ApiResponse` description to `"Base currency, legacy rates map, and the IDR-per-unit snapshot with rate date, source and staleness"`.

If `ConfigModule` is not global in `app.module.ts` (check `ConfigModule.forRoot({ isGlobal: true` there), add `imports: [ConfigModule]` to the `@Module` above.

- [ ] **Step 4: Run tests to verify they pass**

Run (from `apps/api`): `pnpm exec jest src/fx`
Expected: PASS, every suite in `src/fx` green (new service spec 12 tests, mock spec 5, controller spec 1, plus the Task 1–2 suites).

- [ ] **Step 5: Lint + DI import check**

Run (from `apps/api`): `pnpm exec eslint src/fx`
Expected: exit 0.

Run: `grep -n "import type" apps/api/src/fx/fx.module.ts apps/api/src/fx/fx.controller.ts`
Expected: only `import type { Env }`. `FxPort` in the controller stays a value import under its existing eslint-disable comment.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/fx
git commit -m "$(cat <<'EOF'
feat(fx): live ECB rates with DB cache and labelled fallback

FrankfurterFxService memoises for 60 min (5 min when stale), refreshes
from fx_rates when older than 12 h, and falls back to the last stored
rates, then the indicative table. /fx/rates gains rateDate, source,
stale and idrPerUnit; the legacy rates map is unchanged.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

After committing: `git show --stat HEAD` must list only `apps/api/src/fx/*`. Then `git diff HEAD~1 -- apps/api/src/fx/fx.module.ts apps/api/src/fx/fx.controller.ts | grep "^+import type"` must show only the `Env` line. If lint-staged rewrote a DI import, restore it and `git commit --amend --no-edit`.

---

### Task 4: `FxInputDto`, pure resolver, `FxInputService.run()`, field specs, test helper

**Files:**

- Create: `apps/api/src/fx/fx-input.dto.ts`
- Create: `apps/api/src/fx/fx-input.resolve.ts`
- Test: `apps/api/src/fx/fx-input.resolve.spec.ts`
- Create: `apps/api/src/fx/fx-input.service.ts`
- Test: `apps/api/src/fx/fx-input.service.spec.ts`
- Create: `apps/api/src/fx/fx-field-specs.ts`
- Create: `apps/api/test/fx-testing.ts` (spec helper; `test/` is excluded from the build and included in jest `roots`)
- Modify: `apps/api/src/fx/fx.module.ts`

**Interfaces:**

- Consumes: Task 1 `convertToIdr`, `parseMinor`, `formatScaled`; Task 3 `FxPort.getSnapshot`, `FxSnapshot`; `prisma.fxConversion`.
- Produces:
  - `class FxInputDto { field: string; currency: ForeignFxCurrencyCode; amount: string }` and the property decorator `FxInputsProperty()`. Every in-scope request DTO declares `@FxInputsProperty() fxInputs?: FxInputDto[];`.
  - `type FxFieldKind = "int" | "digits" | "decimal2"`.
  - `interface FxFieldRule { kind: FxFieldKind; allowNegative?: boolean; positive?: boolean; max?: bigint }`.
  - `type FxFieldSpec = Readonly<Record<string, FxFieldRule>>`. A key may use `*` for an array index, e.g. `"participants.*.amountOwed"`.
  - `resolveFxInputs(inputs, spec, snapshot): FxResolution` and `applyFxOverrides<T extends object>(dto: T, overrides): T`.
  - `type FxEntity`, the union listed in Step 3b.
  - `FxInputService.run<TDto extends { fxInputs?: FxInputDto[] }, TResult>(args: FxRunArgs<TDto, TResult>, persist: (dto: Omit<TDto, "fxInputs">) => Promise<TResult>): Promise<TResult>`.
  - `FX_FIELD_SPECS` (const object) and `accountBalanceSpec(type?: string): FxFieldSpec`.
  - Test helper `fxTesting(snapshot?)` → `{ fxPort, prisma, providers, service }` and `TEST_SNAPSHOT`.

- [ ] **Step 1: Write the failing tests**

Create `apps/api/test/fx-testing.ts`:

```ts
import { FxInputService } from "../src/fx/fx-input.service";
import { FxPort } from "../src/fx/fx.port";
import { PrismaService } from "../src/prisma/prisma.service";

import type { FxSnapshot } from "../src/fx/fx-snapshot";

export const TEST_SNAPSHOT: FxSnapshot = {
  source: "frankfurter",
  rateDate: "2026-09-25",
  fetchedAt: "2026-09-26T03:00:00.000Z",
  stale: false,
  idrPerUnit: {
    IDR: "1.000000",
    USD: "17913.899851",
    SGD: "14026.793930",
    EUR: "20427.220000",
    JPY: "113.674012",
    AUD: "12593.847102",
    CNY: "2668.445873",
  },
};

/** Real FxInputService over a fake FxPort + a fake prisma.fxConversion, for controller/service specs. */
export function fxTesting(snapshot: FxSnapshot = TEST_SNAPSHOT) {
  const fxPort = {
    getSnapshot: jest.fn().mockResolvedValue(snapshot),
    getRates: jest.fn(),
    getRate: jest.fn(),
  };
  const prisma = {
    fxConversion: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
  const service = new FxInputService(
    fxPort as unknown as FxPort,
    prisma as unknown as PrismaService,
  );
  return {
    fxPort,
    prisma,
    service,
    providers: [{ provide: FxInputService, useValue: service }],
  };
}
```

Create `apps/api/src/fx/fx-input.resolve.spec.ts`:

```ts
import { BadRequestException } from "@nestjs/common";

import { TEST_SNAPSHOT } from "../../test/fx-testing";

import { applyFxOverrides, resolveFxInputs } from "./fx-input.resolve";

import type { FxFieldSpec } from "./fx-input.resolve";

const SPEC: FxFieldSpec = {
  balance: { kind: "int", allowNegative: true },
  amount: { kind: "digits", positive: true, max: 999_999_999_999n },
  pricePerUnit: { kind: "decimal2", positive: true },
  "participants.*.amountOwed": { kind: "int" },
};

describe("resolveFxInputs — revisi I", () => {
  it("converts an int field and records the audit payload", () => {
    const r = resolveFxInputs(
      [{ field: "balance", currency: "USD", amount: "100.00" }],
      SPEC,
      TEST_SNAPSHOT,
    );
    expect(r.overrides).toEqual([{ path: "balance", value: 1_791_390 }]);
    expect(r.pending).toEqual([
      {
        field: "balance",
        originalAmount: "100.00",
        originalCurrency: "USD",
        idrAmount: "1791390",
        idrPerUnit: "17913.899851",
        rateDate: "2026-09-25",
        rateSource: "frankfurter",
        rateStale: false,
      },
    ]);
  });

  it("digits fields become digit strings, decimal2 fields keep sen", () => {
    const r = resolveFxInputs(
      [
        { field: "amount", currency: "JPY", amount: "1500" },
        { field: "pricePerUnit", currency: "USD", amount: "12.34" },
      ],
      SPEC,
      TEST_SNAPSHOT,
    );
    expect(r.overrides).toEqual([
      { path: "amount", value: "170511" },
      { path: "pricePerUnit", value: "221057.52" },
    ]);
  });

  it("negative allowed only when the spec allows it", () => {
    expect(
      resolveFxInputs(
        [{ field: "balance", currency: "USD", amount: "-20.00" }],
        SPEC,
        TEST_SNAPSHOT,
      ).overrides,
    ).toEqual([{ path: "balance", value: -358_278 }]);
    expect(() =>
      resolveFxInputs(
        [{ field: "amount", currency: "USD", amount: "-1.00" }],
        SPEC,
        TEST_SNAPSHOT,
      ),
    ).toThrow(BadRequestException);
  });

  it("positive fields reject zero", () => {
    expect(() =>
      resolveFxInputs(
        [{ field: "amount", currency: "USD", amount: "0.00" }],
        SPEC,
        TEST_SNAPSHOT,
      ),
    ).toThrow(BadRequestException);
  });

  it("enforces max after conversion", () => {
    expect(() =>
      resolveFxInputs(
        [{ field: "amount", currency: "EUR", amount: "99999999.00" }],
        SPEC,
        TEST_SNAPSHOT,
      ),
    ).toThrow(BadRequestException);
  });

  it("rejects a field outside the spec", () => {
    expect(() =>
      resolveFxInputs(
        [{ field: "familyGroupId", currency: "USD", amount: "1.00" }],
        SPEC,
        TEST_SNAPSHOT,
      ),
    ).toThrow(BadRequestException);
  });

  it("rejects a duplicate field", () => {
    expect(() =>
      resolveFxInputs(
        [
          { field: "balance", currency: "USD", amount: "1.00" },
          { field: "balance", currency: "SGD", amount: "1.00" },
        ],
        SPEC,
        TEST_SNAPSHOT,
      ),
    ).toThrow(BadRequestException);
  });

  it("JPY rejects decimals with 400, not a silent round", () => {
    expect(() =>
      resolveFxInputs(
        [{ field: "balance", currency: "JPY", amount: "10.50" }],
        SPEC,
        TEST_SNAPSHOT,
      ),
    ).toThrow(BadRequestException);
  });

  it("matches array paths through the * rule", () => {
    const r = resolveFxInputs(
      [
        {
          field: "participants.1.amountOwed",
          currency: "USD",
          amount: "10.00",
        },
      ],
      SPEC,
      TEST_SNAPSHOT,
    );
    expect(r.overrides).toEqual([
      { path: "participants.1.amountOwed", value: 179_139 },
    ]);
  });

  it("labels a stale snapshot on every pending row", () => {
    const r = resolveFxInputs(
      [{ field: "balance", currency: "USD", amount: "1.00" }],
      SPEC,
      { ...TEST_SNAPSHOT, stale: true, source: "indicative" },
    );
    expect(r.pending[0]).toMatchObject({
      rateStale: true,
      rateSource: "indicative",
    });
  });
});

describe("applyFxOverrides — revisi I", () => {
  it("returns a new object and never mutates the input", () => {
    const dto = {
      name: "Kas",
      balance: 1,
      participants: [{ amountOwed: 1 }, { amountOwed: 2 }],
    };
    const out = applyFxOverrides(dto, [
      { path: "balance", value: 99 },
      { path: "participants.1.amountOwed", value: 7 },
    ]);
    expect(out).toEqual({
      name: "Kas",
      balance: 99,
      participants: [{ amountOwed: 1 }, { amountOwed: 7 }],
    });
    expect(dto.balance).toBe(1);
    expect(dto.participants[1].amountOwed).toBe(2);
  });

  it("rejects an array index that does not exist", () => {
    expect(() =>
      applyFxOverrides({ participants: [{ amountOwed: 1 }] }, [
        { path: "participants.3.amountOwed", value: 1 },
      ]),
    ).toThrow(BadRequestException);
  });
});
```

Create `apps/api/src/fx/fx-input.service.spec.ts`:

```ts
import { Logger } from "@nestjs/common";

import { fxTesting } from "../../test/fx-testing";

const SPEC = { balance: { kind: "int" as const, allowNegative: true } };

describe("FxInputService.run — revisi I", () => {
  it("passes the DTO through untouched when fxInputs is absent (no snapshot, no audit)", async () => {
    const { service, fxPort, prisma } = fxTesting();
    const persist = jest.fn().mockResolvedValue({ id: "acc-1" });
    await service.run(
      {
        familyGroupId: "fg-1",
        userId: "u-1",
        entity: "Account",
        dto: { name: "BCA", balance: 5000 },
        spec: SPEC,
      },
      persist,
    );
    expect(persist).toHaveBeenCalledWith({ name: "BCA", balance: 5000 });
    expect(fxPort.getSnapshot).not.toHaveBeenCalled();
    expect(prisma.fxConversion.createMany).not.toHaveBeenCalled();
  });

  it("an empty fxInputs array is the same as none, and the key is stripped", async () => {
    const { service, fxPort } = fxTesting();
    const persist = jest.fn().mockResolvedValue({ id: "acc-1" });
    await service.run(
      {
        familyGroupId: "fg-1",
        userId: "u-1",
        entity: "Account",
        dto: { balance: 5000, fxInputs: [] },
        spec: SPEC,
      },
      persist,
    );
    expect(persist).toHaveBeenCalledWith({ balance: 5000 });
    expect(fxPort.getSnapshot).not.toHaveBeenCalled();
  });

  it("overwrites the client preview with the server conversion and records the audit row", async () => {
    const { service, prisma } = fxTesting();
    const persist = jest.fn().mockResolvedValue({ id: "acc-9" });
    await service.run(
      {
        familyGroupId: "fg-1",
        userId: "u-1",
        entity: "Account",
        dto: {
          balance: 1,
          fxInputs: [{ field: "balance", currency: "USD", amount: "100.00" }],
        },
        spec: SPEC,
      },
      persist,
    );
    expect(persist).toHaveBeenCalledWith({ balance: 1_791_390 });
    expect(prisma.fxConversion.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          familyGroupId: "fg-1",
          entity: "Account",
          entityId: "acc-9",
          field: "balance",
          originalAmount: "100.00",
          originalCurrency: "USD",
          idrAmount: "1791390",
          idrPerUnit: "17913.899851",
          rateDate: new Date("2026-09-25T00:00:00.000Z"),
          rateSource: "frankfurter",
          rateStale: false,
          createdByUserId: "u-1",
        }),
      ],
    });
  });

  it("uses entityId + fieldPrefix for action routes (e.g. liability pay)", async () => {
    const { service, prisma } = fxTesting();
    await service.run(
      {
        familyGroupId: "fg-1",
        userId: null,
        entity: "Liability",
        entityId: "liab-1",
        fieldPrefix: "pay",
        dto: {
          amount: "1",
          fxInputs: [{ field: "amount", currency: "SGD", amount: "10.00" }],
        },
        spec: { amount: { kind: "digits", positive: true } },
      },
      jest.fn().mockResolvedValue({ id: "liab-1" }),
    );
    expect(
      prisma.fxConversion.createMany.mock.calls[0][0].data[0],
    ).toMatchObject({
      entity: "Liability",
      entityId: "liab-1",
      field: "pay.amount",
      createdByUserId: null,
    });
  });

  it("locate() picks the entity from the result (held expense → AllowanceRequest)", async () => {
    const { service, prisma } = fxTesting();
    await service.run(
      {
        familyGroupId: "fg-1",
        userId: "u-1",
        entity: "Transaction",
        locate: (r: {
          held?: true;
          allowanceRequestId?: string;
          id?: string;
        }) =>
          r.held
            ? { entity: "AllowanceRequest", entityId: r.allowanceRequestId! }
            : { entity: "Transaction", entityId: r.id! },
        dto: {
          amount: 1,
          fxInputs: [{ field: "amount", currency: "USD", amount: "5.00" }],
        },
        spec: { amount: { kind: "int", positive: true } },
      },
      jest.fn().mockResolvedValue({ held: true, allowanceRequestId: "ar-1" }),
    );
    expect(
      prisma.fxConversion.createMany.mock.calls[0][0].data[0],
    ).toMatchObject({
      entity: "AllowanceRequest",
      entityId: "ar-1",
    });
  });

  it("does not call persist when resolution fails (400 before any write)", async () => {
    const { service } = fxTesting();
    const persist = jest.fn();
    await expect(
      service.run(
        {
          familyGroupId: "fg-1",
          userId: "u-1",
          entity: "Account",
          dto: {
            balance: 1,
            fxInputs: [{ field: "name", currency: "USD", amount: "1.00" }],
          },
          spec: SPEC,
        },
        persist,
      ),
    ).rejects.toThrow("fxInputs");
    expect(persist).not.toHaveBeenCalled();
  });

  it("logs and still returns when the audit insert fails", async () => {
    const { service, prisma } = fxTesting();
    prisma.fxConversion.createMany.mockRejectedValueOnce(new Error("db down"));
    const errorSpy = jest
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => undefined);
    const result = await service.run(
      {
        familyGroupId: "fg-1",
        userId: "u-1",
        entity: "Account",
        dto: {
          balance: 1,
          fxInputs: [{ field: "balance", currency: "USD", amount: "1.00" }],
        },
        spec: SPEC,
      },
      jest.fn().mockResolvedValue({ id: "acc-1" }),
    );
    expect(result).toEqual({ id: "acc-1" });
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("fx_conversions insert failed after commit"),
      expect.any(String),
    );
    errorSpy.mockRestore();
  });

  it("the transform hook runs after overrides and before persist", async () => {
    const { service } = fxTesting();
    const persist = jest.fn().mockResolvedValue({ id: "x" });
    await service.run(
      {
        familyGroupId: "fg-1",
        userId: "u-1",
        entity: "Account",
        dto: {
          balance: 1,
          fxInputs: [{ field: "balance", currency: "USD", amount: "1.00" }],
        },
        spec: SPEC,
        transform: (d) => ({ ...d, balance: (d.balance as number) + 1 }),
      },
      persist,
    );
    expect(persist).toHaveBeenCalledWith({ balance: 17_915 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `apps/api`): `pnpm exec jest src/fx/fx-input`
Expected: FAIL with `Cannot find module './fx-input.resolve'` and `Cannot find module '../src/fx/fx-input.service'`.

- [ ] **Step 3a: DTO**

Create `apps/api/src/fx/fx-input.dto.ts`:

```ts
import { applyDecorators } from "@nestjs/common";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  FOREIGN_FX_CURRENCY_CODES,
  type ForeignFxCurrencyCode,
} from "@wealthme/contracts";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from "class-validator";

export const FX_INPUTS_MAX = 64;

export class FxInputDto {
  @ApiProperty({
    example: "balance",
    description:
      "DTO property this replaces; array items as participants.0.amountOwed",
  })
  @IsString()
  @MaxLength(96)
  @Matches(/^[A-Za-z]+(\.\d{1,3}\.[A-Za-z]+)?$/)
  field!: string;

  @ApiProperty({ enum: FOREIGN_FX_CURRENCY_CODES })
  @IsIn(FOREIGN_FX_CURRENCY_CODES)
  currency!: ForeignFxCurrencyCode;

  @ApiProperty({
    example: "1250.50",
    description:
      "Canonical decimal, '.' separator, at most the currency's minor digits",
  })
  @IsString()
  @Matches(/^-?\d{1,13}(\.\d{1,2})?$/)
  amount!: string;
}

/** Revisi I — optional foreign-currency originals; the server converts them and overwrites the named IDR fields. */
export function FxInputsProperty(): PropertyDecorator {
  return applyDecorators(
    ApiPropertyOptional({
      type: [FxInputDto],
      description:
        "Foreign-currency inputs. Omit entirely for IDR. The server converts each to IDR and overwrites `field`.",
    }),
    IsOptional(),
    IsArray(),
    ArrayMaxSize(FX_INPUTS_MAX),
    ValidateNested({ each: true }),
    Type(() => FxInputDto),
  );
}
```

- [ ] **Step 3b: Resolver**

Create `apps/api/src/fx/fx-input.resolve.ts`:

```ts
import { BadRequestException } from "@nestjs/common";
import {
  convertToIdr,
  formatScaled,
  FX_CURRENCY_DECIMALS,
  parseMinor,
  type ForeignFxCurrencyCode,
} from "@wealthme/contracts";

import type { FxSnapshot } from "./fx-snapshot";

export type FxFieldKind = "int" | "digits" | "decimal2";
export interface FxFieldRule {
  kind: FxFieldKind;
  allowNegative?: boolean;
  positive?: boolean;
  max?: bigint;
}
export type FxFieldSpec = Readonly<Record<string, FxFieldRule>>;

export interface FxInputLike {
  field: string;
  currency: ForeignFxCurrencyCode;
  amount: string;
}
export interface PendingFxConversion {
  field: string;
  originalAmount: string;
  originalCurrency: ForeignFxCurrencyCode;
  idrAmount: string;
  idrPerUnit: string;
  rateDate: string;
  rateSource: string;
  rateStale: boolean;
}
export interface FxOverride {
  path: string;
  value: number | string;
}
export interface FxResolution {
  overrides: FxOverride[];
  pending: PendingFxConversion[];
}

const bad = (field: string, why: string) =>
  new BadRequestException(`fxInputs: ${field}: ${why}`);

function ruleFor(spec: FxFieldSpec, field: string): FxFieldRule | undefined {
  return spec[field] ?? spec[field.replace(/\.\d+\./, ".*.")];
}

export function resolveFxInputs(
  inputs: readonly FxInputLike[],
  spec: FxFieldSpec,
  snapshot: FxSnapshot,
): FxResolution {
  const seen = new Set<string>();
  const overrides: FxOverride[] = [];
  const pending: PendingFxConversion[] = [];
  for (const input of inputs) {
    const rule = ruleFor(spec, input.field);
    if (!rule)
      throw bad(input.field, "not a convertible money field on this route");
    if (seen.has(input.field)) throw bad(input.field, "listed twice");
    seen.add(input.field);

    const targetScale = rule.kind === "decimal2" ? 2 : 0;
    let idr: bigint;
    let original: bigint;
    try {
      original = parseMinor(input.amount, input.currency);
      idr = convertToIdr({
        amount: input.amount,
        currency: input.currency,
        idrPerUnit: snapshot.idrPerUnit[input.currency],
        targetScale,
      });
    } catch (err) {
      throw bad(
        input.field,
        err instanceof Error ? err.message : "invalid amount",
      );
    }
    const magnitude = idr < 0n ? -idr : idr;
    if (idr < 0n && !rule.allowNegative)
      throw bad(input.field, "must not be negative");
    if (rule.positive && idr <= 0n)
      throw bad(input.field, "must be greater than zero");
    if (rule.max !== undefined && magnitude > rule.max)
      throw bad(input.field, "exceeds the maximum");
    if (rule.kind === "int" && magnitude > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw bad(input.field, "exceeds the maximum");
    }

    overrides.push({
      path: input.field,
      value:
        rule.kind === "int"
          ? Number(idr)
          : rule.kind === "digits"
            ? idr.toString()
            : formatScaled(idr, 2),
    });
    pending.push({
      field: input.field,
      originalAmount: formatScaled(
        original,
        FX_CURRENCY_DECIMALS[input.currency],
      ),
      originalCurrency: input.currency,
      idrAmount: formatScaled(idr, targetScale),
      idrPerUnit: snapshot.idrPerUnit[input.currency],
      rateDate: snapshot.rateDate,
      rateSource: snapshot.source,
      rateStale: snapshot.stale,
    });
  }
  return { overrides, pending };
}

function setPath(
  target: unknown,
  [head, ...rest]: string[],
  value: unknown,
  full: string,
): unknown {
  if (head === undefined) return value;
  if (Array.isArray(target)) {
    const index = Number(head);
    if (!Number.isInteger(index) || index < 0 || index >= target.length) {
      throw bad(full, `no element ${head}`);
    }
    return target.map((el, i) =>
      i === index ? setPath(el, rest, value, full) : el,
    );
  }
  if (typeof target !== "object" || target === null)
    throw bad(full, "path does not exist");
  const record = target as Record<string, unknown>;
  return { ...record, [head]: setPath(record[head], rest, value, full) };
}

export function applyFxOverrides<T extends object>(
  dto: T,
  overrides: readonly FxOverride[],
): T {
  return overrides.reduce<unknown>(
    (acc, o) => setPath(acc, o.path.split("."), o.value, o.path),
    dto,
  ) as T;
}
```

`resolveFxInputs` builds its result arrays locally and returns them; the inputs are never mutated.

- [ ] **Step 3c: Service + specs + module**

Create `apps/api/src/fx/fx-input.service.ts`:

```ts
import { Injectable, Logger } from "@nestjs/common";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import {
  applyFxOverrides,
  resolveFxInputs,
  type FxFieldSpec,
  type PendingFxConversion,
} from "./fx-input.resolve";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { FxPort } from "./fx.port";

import type { FxInputLike } from "./fx-input.resolve";

export type FxEntity =
  | "Account"
  | "Transaction"
  | "AllowanceRequest"
  | "Budget"
  | "Goal"
  | "GoalContribution"
  | "Asset"
  | "Investment"
  | "Liability"
  | "Insurance"
  | "InheritanceAsset"
  | "Donation"
  | "SplitBill"
  | "FamilyGroup"
  | "Member";

export interface FxTarget {
  entity: FxEntity;
  entityId: string;
}

export interface FxRunArgs<TDto extends { fxInputs?: FxInputLike[] }, TResult> {
  familyGroupId: string;
  userId: string | null;
  entity: FxEntity;
  /** Set for PATCH / action routes; otherwise the result's `id` is used. */
  entityId?: string;
  /** Action routes record `pay.amount`, `trade.pricePerUnit`, … */
  fieldPrefix?: string;
  locate?: (result: TResult) => FxTarget;
  transform?: (dto: Omit<TDto, "fxInputs">) => Omit<TDto, "fxInputs">;
  dto: TDto;
  spec: FxFieldSpec;
}

function idOf(result: unknown): string | null {
  if (typeof result === "object" && result !== null && "id" in result) {
    const id = (result as { id: unknown }).id;
    return typeof id === "string" ? id : null;
  }
  return null;
}

@Injectable()
export class FxInputService {
  private readonly logger = new Logger(FxInputService.name);

  constructor(
    private readonly fx: FxPort,
    private readonly prisma: PrismaService,
  ) {}

  async run<TDto extends { fxInputs?: FxInputLike[] }, TResult>(
    args: FxRunArgs<TDto, TResult>,
    persist: (dto: Omit<TDto, "fxInputs">) => Promise<TResult>,
  ): Promise<TResult> {
    const { fxInputs, ...rest } = args.dto;
    if (!fxInputs || fxInputs.length === 0) return persist(rest);

    const snapshot = await this.fx.getSnapshot();
    const { overrides, pending } = resolveFxInputs(
      fxInputs,
      args.spec,
      snapshot,
    );
    const converted = applyFxOverrides(rest, overrides);
    const result = await persist(
      args.transform ? args.transform(converted) : converted,
    );

    const target = args.locate
      ? args.locate(result)
      : { entity: args.entity, entityId: args.entityId ?? idOf(result) };
    await this.record(args, target, pending);
    return result;
  }

  private async record<TDto extends { fxInputs?: FxInputLike[] }, TResult>(
    args: FxRunArgs<TDto, TResult>,
    target: { entity: FxEntity; entityId: string | null },
    pending: PendingFxConversion[],
  ): Promise<void> {
    const context = JSON.stringify({
      familyGroupId: args.familyGroupId,
      ...target,
      pending,
    });
    if (!target.entityId) {
      this.logger.error(
        `fx_conversions insert failed after commit: no entity id`,
        context,
      );
      return;
    }
    try {
      await this.prisma.fxConversion.createMany({
        data: pending.map((p) => ({
          familyGroupId: args.familyGroupId,
          entity: target.entity,
          entityId: target.entityId!,
          field: args.fieldPrefix ? `${args.fieldPrefix}.${p.field}` : p.field,
          originalAmount: p.originalAmount,
          originalCurrency: p.originalCurrency,
          idrAmount: p.idrAmount,
          idrPerUnit: p.idrPerUnit,
          rateDate: new Date(`${p.rateDate}T00:00:00.000Z`),
          rateSource: p.rateSource,
          rateStale: p.rateStale,
          createdByUserId: args.userId,
        })),
      });
    } catch (err) {
      this.logger.error(
        `fx_conversions insert failed after commit ${context}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
```

Create `apps/api/src/fx/fx-field-specs.ts`. It holds one rule set per route, and each field's bounds mirror that DTO's own validators.

```ts
import type { FxFieldSpec } from "./fx-input.resolve";

const MAX_12_DIGITS = 999_999_999_999n;

export function accountBalanceSpec(type?: string): FxFieldSpec {
  return { balance: { kind: "int", allowNegative: type === "cash" } };
}

export const FX_FIELD_SPECS = {
  transaction: { amount: { kind: "int", positive: true } },
  budget: { limitAmount: { kind: "int", positive: true, max: MAX_12_DIGITS } },
  goal: {
    targetAmount: { kind: "int", positive: true, max: MAX_12_DIGITS },
    currentAmount: { kind: "int", max: MAX_12_DIGITS },
    autoDebitAmount: { kind: "int", positive: true, max: MAX_12_DIGITS },
  },
  goalContribution: {
    amount: { kind: "digits", positive: true, max: MAX_12_DIGITS },
  },
  allowanceRequest: { amount: { kind: "int", positive: true } },
  asset: {
    currentValue: { kind: "digits" },
    valueChangeAmount: { kind: "digits", allowNegative: true },
  },
  assetHistory: { value: { kind: "digits" } },
  investment: { costBasisPerUnit: { kind: "decimal2" } },
  investmentPrice: { price: { kind: "decimal2", positive: true } },
  investmentTrade: { pricePerUnit: { kind: "decimal2", positive: true } },
  liability: {
    totalDebt: { kind: "digits" },
    remainingBalance: { kind: "digits" },
    minimumPayment: { kind: "digits" },
    installmentAmount: { kind: "digits" },
  },
  liabilityPayment: { amount: { kind: "digits", positive: true } },
  insurance: {
    premiumAmount: { kind: "digits" },
    coverageAmount: { kind: "digits" },
  },
  insurancePayment: { amount: { kind: "digits", positive: true } },
  inheritance: { estimatedValue: { kind: "int" } },
  donation: { amount: { kind: "digits", positive: true } },
  splitBill: {
    totalAmount: { kind: "int", positive: true },
    "participants.*.amountOwed": { kind: "int" },
  },
  goldPrice: { pricePerGram: { kind: "int", positive: true } },
  memberThreshold: { largeTxnThreshold: { kind: "int", positive: true } },
} as const satisfies Record<string, FxFieldSpec>;
```

In `apps/api/src/fx/fx.module.ts`, add `import { FxInputService } from "./fx-input.service";`, add `FxInputService` to `providers`, and change `exports` to `[FxPort, FxInputService]`.

- [ ] **Step 4: Run tests to verify they pass**

Run (from `apps/api`): `pnpm exec jest src/fx`
Expected: PASS, every suite green (resolve spec 12 tests, service spec 8).

- [ ] **Step 5: Lint + DI import check**

Run (from `apps/api`): `pnpm exec eslint src/fx test/fx-testing.ts`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/fx apps/api/test/fx-testing.ts
git commit -m "$(cat <<'EOF'
feat(fx): FxInputService converts fxInputs server-side and audits them

Controllers pass an optional fxInputs array. Each entry is checked against
a per-route field spec (kind, sign, bounds), converted with the current
snapshot, and overwrites the IDR field before the unchanged service runs.
One fx_conversions row is written per field after commit.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

After committing: `git diff HEAD~1 -- apps/api/src/fx/fx-input.service.ts | grep "^+import type"` must not include `FxPort` or `PrismaService`. If it does, restore the value imports with their eslint-disable comments and amend.

---

### Task 5: API wiring — ledger routes (accounts, transactions, budgets, goals, allowance requests) + `/akun` settings (gold price, member threshold)

**Files:**

- Modify DTOs (add `@FxInputsProperty() fxInputs?: FxInputDto[];` as the last property, plus `import { FxInputsProperty, type FxInputDto } from "../../fx/fx-input.dto";`):
  - `apps/api/src/accounts/dto/create-account.dto.ts`. `UpdateAccountDto` inherits it through `UpdateAccountBaseDto`, so confirm with `grep -n PartialType apps/api/src/accounts/dto/update-account.dto.ts`. If it does not inherit, add the property there too.
  - `apps/api/src/transactions/dto/create-transaction.dto.ts`
  - `apps/api/src/transactions/dto/update-transaction.dto.ts`
  - `apps/api/src/budgets/dto/create-budget.dto.ts`
  - `apps/api/src/budgets/dto/update-budget.dto.ts`
  - `apps/api/src/goals/dto/create-goal.dto.ts`
  - `apps/api/src/goals/dto/update-goal.dto.ts`
  - `apps/api/src/goals/dto/create-goal-contribution.dto.ts`
  - `apps/api/src/allowance-requests/dto/create-allowance-request.dto.ts`
  - `apps/api/src/family-groups/dto/update-gold-price.dto.ts`
  - `apps/api/src/family-groups/dto/update-member-role.dto.ts`
- Modify controllers:
  - `apps/api/src/accounts/accounts.controller.ts` (`create` :77, `update` :113)
  - `apps/api/src/transactions/transactions.controller.ts` (`create` :160, `update` :209)
  - `apps/api/src/budgets/budgets.controller.ts` (`create` :58, `update` :73)
  - `apps/api/src/goals/goals.controller.ts` (`create` :56, `update` :67, `contribute` :95)
  - `apps/api/src/allowance-requests/allowance-requests.controller.ts` (`create` :67)
  - `apps/api/src/family-groups/family-groups.controller.ts`
    - `updateGoldPrice` (`@Patch(":familyGroupId/gold-price")`, ~:254): add `@CheckAbility((ab: AppAbility) => ab.can("manage", "FamilyGroup"))`, the same decorator `updateReligion` uses. The route was undecorated before, so `AbilitiesGuard` let it through (fail-open) and only the service's owner check protected it.
    - `updateMemberRole` (`@Patch(":familyGroupId/members/:memberId")`, ~:295)
    - the constructor (:72-75) gains `private readonly fxInputs: FxInputService`
- Modify existing specs whose constructor or providers change:
  - `apps/api/src/allowance-requests/allowance-requests.controller.spec.ts:37`
  - `apps/api/src/goals/goals.controller.spec.ts:44`
- Modify: `apps/api/test/fx-testing.ts` (add `createFxTestApp`)
- Test: `apps/api/src/fx/fx-wiring-ledger.spec.ts`, `apps/api/src/fx/fx-wiring-family-settings.spec.ts`. Check first whether any spec constructs `FamilyGroupsController`: `grep -rln "FamilyGroupsController" apps/api/src --include='*.spec.ts'` (quote the glob). Give each hit the extra `fxTesting().service` / `...fxTesting().providers`.

**Interfaces:**

- Consumes: Task 4 `FxInputService.run`, `FX_FIELD_SPECS` (incl. `goldPrice`, `memberThreshold`), `accountBalanceSpec`, `FxInputsProperty`, `fxTesting`.
- Produces: the ledger routes and the two `/akun` settings routes accept `fxInputs`. Also `createFxTestApp({ controllers, providers, fx }): Promise<INestApplication>` in `apps/api/test/fx-testing.ts`, reused by Task 6.

- [ ] **Step 1: Write the failing tests**

Append to `apps/api/test/fx-testing.ts`:

```ts
import {
  ValidationPipe,
  type INestApplication,
  type Provider,
  type Type,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Role } from "@prisma/client";

import type { NextFunction, Request, Response } from "express";

export const FG = "fg-1";

/** Controllers + mocked services + the real FxInputService over HTTP with the production ValidationPipe. */
export async function createFxTestApp(opts: {
  controllers: Type<unknown>[];
  providers: Provider[];
  fx: ReturnType<typeof fxTesting>;
}): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    controllers: opts.controllers,
    providers: [...opts.providers, ...opts.fx.providers],
  }).compile();
  const app = moduleRef.createNestApplication();
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const member = {
      id: "m-owner",
      userId: "u-owner",
      familyGroupId: FG,
      role: Role.owner,
      rowScoped: false,
      seesSharedAccounts: true,
    };
    req.tenantContext = {
      userId: "u-owner",
      familyGroupId: FG,
      role: Role.owner,
      member,
      access: null,
    };
    next();
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  return app;
}
```

Merge these imports into the file's existing import block, keeping eslint's import order.

Create `apps/api/src/fx/fx-wiring-ledger.spec.ts`:

```ts
import "reflect-metadata";

import request from "supertest";

import { createFxTestApp, FG, fxTesting } from "../../test/fx-testing";
import { AccountsController } from "../accounts/accounts.controller";
import { AccountsService } from "../accounts/accounts.service";
import { AllowanceRequestsController } from "../allowance-requests/allowance-requests.controller";
import { AllowanceRequestsService } from "../allowance-requests/allowance-requests.service";
import { BudgetsController } from "../budgets/budgets.controller";
import { BudgetsService } from "../budgets/budgets.service";
import { GoalsController } from "../goals/goals.controller";
import { GoalsService } from "../goals/goals.service";
import { TransactionsController } from "../transactions/transactions.controller";
import { TransactionsService } from "../transactions/transactions.service";

import type { INestApplication } from "@nestjs/common";

const UUID = "5f0c1f7e-7c1a-4b8e-9d7a-2f1c3b4a5d6e";
const accounts = { create: jest.fn(), update: jest.fn(), findOne: jest.fn() };
const transactions = { create: jest.fn(), update: jest.fn() };
const budgets = { create: jest.fn(), update: jest.fn() };
const goals = { create: jest.fn(), update: jest.fn(), contribute: jest.fn() };
const allowance = { create: jest.fn() };

describe("fx wiring — ledger routes (revisi I)", () => {
  let app: INestApplication;
  const fx = fxTesting();

  beforeAll(async () => {
    app = await createFxTestApp({
      controllers: [
        AccountsController,
        TransactionsController,
        BudgetsController,
        GoalsController,
        AllowanceRequestsController,
      ],
      providers: [
        { provide: AccountsService, useValue: accounts },
        { provide: TransactionsService, useValue: transactions },
        { provide: BudgetsService, useValue: budgets },
        { provide: GoalsService, useValue: goals },
        { provide: AllowanceRequestsService, useValue: allowance },
      ],
      fx,
    });
  });
  afterAll(() => app.close());
  beforeEach(() => {
    jest.clearAllMocks();
    accounts.create.mockResolvedValue({ id: "acc-1" });
    accounts.update.mockResolvedValue({ id: "acc-1" });
    accounts.findOne.mockResolvedValue({ id: "acc-1", type: "bank" });
    transactions.create.mockResolvedValue({ id: "tx-1" });
    transactions.update.mockResolvedValue({ id: "tx-1" });
    budgets.create.mockResolvedValue({ id: "b-1" });
    goals.contribute.mockResolvedValue({
      contribution: { id: "gc-1" },
      goal: { id: "g-1" },
    });
    allowance.create.mockResolvedValue({ id: "ar-1" });
  });

  const http = () => request(app.getHttpServer());

  it("IDR create reaches the service unchanged, with no fxInputs key and no audit row", async () => {
    const body = { name: "BCA", type: "bank", balance: 5_000_000 };
    const res = await http().post(`/family-groups/${FG}/accounts`).send(body);
    expect(res.status).toBe(201);
    const sent = accounts.create.mock.calls[0][1];
    expect(sent).toEqual(expect.objectContaining(body));
    expect(sent).not.toHaveProperty("fxInputs");
    expect(fx.fxPort.getSnapshot).not.toHaveBeenCalled();
    expect(fx.prisma.fxConversion.createMany).not.toHaveBeenCalled();
  });

  it("server overwrites a tampered preview: USD 100.00 → 1.791.390", async () => {
    await http()
      .post(`/family-groups/${FG}/accounts`)
      .send({
        name: "Chase",
        type: "bank",
        balance: 1,
        fxInputs: [{ field: "balance", currency: "USD", amount: "100.00" }],
      })
      .expect(201);
    expect(accounts.create.mock.calls[0][1].balance).toBe(1_791_390);
    expect(
      fx.prisma.fxConversion.createMany.mock.calls[0][0].data[0],
    ).toMatchObject({
      familyGroupId: FG,
      entity: "Account",
      entityId: "acc-1",
      field: "balance",
      originalCurrency: "USD",
      createdByUserId: "u-owner",
    });
  });

  it("cash account accepts a negative foreign balance (USD -20.00 → -358.278)", async () => {
    await http()
      .post(`/family-groups/${FG}/accounts`)
      .send({
        name: "Dompet",
        type: "cash",
        balance: -358_278,
        fxInputs: [{ field: "balance", currency: "USD", amount: "-20.00" }],
      })
      .expect(201);
    expect(accounts.create.mock.calls[0][1].balance).toBe(-358_278);
  });

  it("bank account rejects a negative foreign balance before the service runs", async () => {
    const res = await http()
      .post(`/family-groups/${FG}/accounts`)
      .send({
        name: "BCA",
        type: "bank",
        balance: 0,
        fxInputs: [{ field: "balance", currency: "USD", amount: "-20.00" }],
      });
    expect(res.status).toBe(400);
    expect(accounts.create).not.toHaveBeenCalled();
  });

  it("cash edit without `type` still accepts USD -20 (type comes from the stored account)", async () => {
    accounts.findOne.mockResolvedValue({ id: "acc-cash", type: "cash" });
    await http()
      .patch(`/family-groups/${FG}/accounts/acc-cash`)
      .send({
        balance: 0,
        fxInputs: [{ field: "balance", currency: "USD", amount: "-20.00" }],
      })
      .expect(200);
    expect(accounts.findOne).toHaveBeenCalledWith(
      FG,
      "acc-cash",
      expect.anything(),
      expect.anything(),
      "u-owner",
    );
    expect(accounts.update.mock.calls[0][2].balance).toBe(-358_278);
  });

  it('`type: "cash"` sent for a stored bank account does NOT allow a negative foreign balance', async () => {
    accounts.findOne.mockResolvedValue({ id: "acc-1", type: "bank" });
    const res = await http()
      .patch(`/family-groups/${FG}/accounts/acc-1`)
      .send({
        type: "cash",
        balance: 0,
        fxInputs: [{ field: "balance", currency: "USD", amount: "-20.00" }],
      });
    expect(res.status).toBe(400);
    expect(accounts.update).not.toHaveBeenCalled();
  });

  it("PATCH without fxInputs never converts (editing keeps the stored IDR)", async () => {
    await http()
      .patch(`/family-groups/${FG}/accounts/acc-1`)
      .send({ name: "BCA Utama" })
      .expect(200);
    expect(accounts.findOne).not.toHaveBeenCalled();
    expect(fx.fxPort.getSnapshot).not.toHaveBeenCalled();
    expect(fx.prisma.fxConversion.createMany).not.toHaveBeenCalled();
  });

  it("rejects fxInputs naming IDR or a non-money field", async () => {
    await http()
      .post(`/family-groups/${FG}/accounts`)
      .send({
        name: "X",
        type: "bank",
        balance: 1,
        fxInputs: [{ field: "balance", currency: "IDR", amount: "1" }],
      })
      .expect(400);
    await http()
      .post(`/family-groups/${FG}/accounts`)
      .send({
        name: "X",
        type: "bank",
        balance: 1,
        fxInputs: [{ field: "name", currency: "USD", amount: "1.00" }],
      })
      .expect(400);
    expect(accounts.create).not.toHaveBeenCalled();
  });

  it("transaction create: a held expense is audited against its AllowanceRequest", async () => {
    transactions.create.mockResolvedValue({
      held: true,
      allowanceRequestId: "ar-9",
      amount: "179139",
    });
    await http()
      .post(`/family-groups/${FG}/transactions`)
      .send({
        accountId: UUID,
        amount: 1,
        type: "expense",
        occurredAt: "2026-09-26T00:00:00.000Z",
        fxInputs: [{ field: "amount", currency: "USD", amount: "10.00" }],
      });
    expect(transactions.create.mock.calls[0][1].amount).toBe(179_139);
    expect(
      fx.prisma.fxConversion.createMany.mock.calls[0][0].data[0],
    ).toMatchObject({
      entity: "AllowanceRequest",
      entityId: "ar-9",
    });
  });

  it("transaction PATCH audits against the route id", async () => {
    await http()
      .patch(`/family-groups/${FG}/transactions/tx-7`)
      .send({
        amount: 1,
        fxInputs: [{ field: "amount", currency: "JPY", amount: "1500" }],
      })
      .expect(200);
    expect(transactions.update.mock.calls[0][2].amount).toBe(170_511);
    expect(
      fx.prisma.fxConversion.createMany.mock.calls[0][0].data[0],
    ).toMatchObject({
      entity: "Transaction",
      entityId: "tx-7",
    });
  });

  it("transaction adminFee is not convertible (IDR-only by design)", async () => {
    await http()
      .post(`/family-groups/${FG}/transactions`)
      .send({
        accountId: UUID,
        toAccountId: "6f0c1f7e-7c1a-4b8e-9d7a-2f1c3b4a5d6e",
        amount: 1,
        adminFee: 1,
        type: "transfer",
        occurredAt: "2026-09-26T00:00:00.000Z",
        fxInputs: [{ field: "adminFee", currency: "USD", amount: "1.00" }],
      })
      .expect(400);
  });

  it("budget limit converts (SGD)", async () => {
    await http()
      .post(`/family-groups/${FG}/budgets`)
      .send({
        categoryId: UUID,
        period: "monthly",
        limitAmount: 1,
        fxInputs: [
          { field: "limitAmount", currency: "SGD", amount: "1500.25" },
        ],
      })
      .expect(201);
    expect(budgets.create.mock.calls[0][1].limitAmount).toBe(21_043_698);
  });

  it("goal contribution converts its digit-string amount and audits the contribution id", async () => {
    await http()
      .post(`/family-groups/${FG}/goals/g-1/contributions`)
      .send({
        amount: "1",
        accountId: UUID,
        fxInputs: [{ field: "amount", currency: "USD", amount: "10.00" }],
      })
      .expect(201);
    expect(goals.contribute.mock.calls[0][2].amount).toBe("179139");
    expect(
      fx.prisma.fxConversion.createMany.mock.calls[0][0].data[0],
    ).toMatchObject({
      entity: "GoalContribution",
      entityId: "gc-1",
    });
  });

  it("allowance request converts (JPY, whole units)", async () => {
    await http()
      .post(`/family-groups/${FG}/allowance-requests`)
      .send({
        targetAccountId: UUID,
        amount: 1,
        fxInputs: [{ field: "amount", currency: "JPY", amount: "1500" }],
      })
      .expect(201);
    expect(allowance.create.mock.calls[0][2].amount).toBe(170_511);
  });
});
```

Create `apps/api/src/fx/fx-wiring-family-settings.spec.ts`:

```ts
import "reflect-metadata";

import { APP_GUARD } from "@nestjs/core";
import { Role } from "@prisma/client";
import request from "supertest";

import { createFxTestApp, FG, fxTesting } from "../../test/fx-testing";
import { CaslAbilityFactory } from "../casl/casl-ability.factory";
import { AbilitiesGuard } from "../common/guards/abilities.guard";
import { FamilyGroupsController } from "../family-groups/family-groups.controller";
import { FamilyGroupsService } from "../family-groups/family-groups.service";
import { MemberEmailService } from "../family-groups/member-email.service";

import type { INestApplication } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

const svc = { updateGoldPrice: jest.fn(), updateMemberRole: jest.fn() };
let role: Role = Role.owner;

describe("fx wiring — /akun settings (revisi I)", () => {
  let app: INestApplication;
  const fx = fxTesting();

  beforeAll(async () => {
    app = await createFxTestApp({
      controllers: [FamilyGroupsController],
      providers: [
        CaslAbilityFactory,
        { provide: APP_GUARD, useClass: AbilitiesGuard },
        { provide: FamilyGroupsService, useValue: svc },
        { provide: MemberEmailService, useValue: {} },
      ],
      fx,
      // The controller reads req.user.sub (JWT), not only tenantContext.
      extraMiddleware: (req: Request, _res: Response, next: NextFunction) => {
        (req as Request & { user: { sub: string } }).user = { sub: "u-owner" };
        if (req.tenantContext?.member) req.tenantContext.member.role = role;
        req.tenantContext!.role = role;
        next();
      },
    });
  });
  afterAll(() => app.close());
  beforeEach(() => {
    jest.clearAllMocks();
    role = Role.owner;
    svc.updateGoldPrice.mockResolvedValue({ pricePerGram: "1" });
    svc.updateMemberRole.mockResolvedValue({ id: "m-2" });
  });
  const http = () => request(app.getHttpServer());

  it("gold price: owner converts USD per gram; admin_staff is refused", async () => {
    await http()
      .patch(`/family-groups/${FG}/gold-price`)
      .send({
        pricePerGram: 1,
        fxInputs: [
          { field: "pricePerGram", currency: "USD", amount: "100.00" },
        ],
      })
      .expect(200);
    expect(svc.updateGoldPrice.mock.calls[0][2]).toEqual({
      pricePerGram: 1_791_390,
    });
    expect(
      fx.prisma.fxConversion.createMany.mock.calls[0][0].data[0],
    ).toMatchObject({
      entity: "FamilyGroup",
      entityId: FG,
      field: "goldPrice.pricePerGram",
    });

    role = Role.admin_staff;
    await http()
      .patch(`/family-groups/${FG}/gold-price`)
      .send({ pricePerGram: 1 })
      .expect(403);
  });

  it("gold price in IDR is unchanged (no fxInputs, no snapshot)", async () => {
    await http()
      .patch(`/family-groups/${FG}/gold-price`)
      .send({ pricePerGram: 1_500_000 })
      .expect(200);
    expect(svc.updateGoldPrice.mock.calls[0][2]).toEqual({
      pricePerGram: 1_500_000,
    });
    expect(fx.fxPort.getSnapshot).not.toHaveBeenCalled();
  });

  it("member threshold converts, and null still clears", async () => {
    await http()
      .patch(`/family-groups/${FG}/members/m-2`)
      .send({
        role: "dependant",
        largeTxnThreshold: 1,
        fxInputs: [
          { field: "largeTxnThreshold", currency: "SGD", amount: "100.00" },
        ],
      })
      .expect(200);
    expect(svc.updateMemberRole.mock.calls[0][3]).toMatchObject({
      largeTxnThreshold: 1_402_679,
    });
    expect(
      fx.prisma.fxConversion.createMany.mock.calls[0][0].data[0],
    ).toMatchObject({
      entity: "Member",
      entityId: "m-2",
      field: "largeTxnThreshold",
    });

    await http()
      .patch(`/family-groups/${FG}/members/m-2`)
      .send({ role: "dependant", largeTxnThreshold: null })
      .expect(200);
    expect(svc.updateMemberRole.mock.calls[1][3]).toMatchObject({
      largeTxnThreshold: null,
    });
  });
});
```

If the `role` enum value used by `UpdateMemberRoleDto` is not `"dependant"`, use a value from that DTO's `@IsEnum`.

In `apps/api/test/fx-testing.ts`, give `createFxTestApp` an optional `extraMiddleware?: (req: Request, res: Response, next: NextFunction) => void` option. Apply it with `if (opts.extraMiddleware) app.use(opts.extraMiddleware);` right after the tenant stand-in middleware.

Golden: SGD 100.00 × 14026.793930 = 1,402,679.39 → 1,402,679.

- [ ] **Step 2: Run tests to verify they fail**

Run (from `apps/api`): `pnpm exec jest src/fx/fx-wiring-ledger.spec.ts src/fx/fx-wiring-family-settings.spec.ts`
Expected: FAIL. Every `fxInputs` test fails, because `whitelist: true` strips the unknown `fxInputs` key, so the services receive the raw preview (e.g. `balance: 1`) and no audit row is written. The two IDR/PATCH tests may already pass.

- [ ] **Step 3a: DTOs**

Add to each DTO listed under Files, as its last property:

```ts
  @FxInputsProperty()
  fxInputs?: FxInputDto[];
```

with the import:

```ts
import { FxInputsProperty, type FxInputDto } from "../../fx/fx-input.dto";
```

- [ ] **Step 3b: Controllers**

Every changed controller gains these imports and a constructor parameter:

```ts
import { accountBalanceSpec, FX_FIELD_SPECS } from "../fx/fx-field-specs";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { FxInputService } from "../fx/fx-input.service";
```

Import only the names a controller uses: `accountBalanceSpec` only in accounts. The constructor parameter is `private readonly fxInputs: FxInputService` (last position).

`accounts.controller.ts`, method bodies:

```ts
  create(
    @Param("familyGroupId") familyGroupId: string,
    @Body() dto: CreateAccountDto,
    @Req() req: Request,
  ): Promise<AccountResponseDto> {
    return this.fxInputs.run(
      { familyGroupId, userId: req.tenantContext?.userId ?? null, entity: "Account", dto, spec: accountBalanceSpec(dto.type) },
      (converted) => this.accountsService.create(familyGroupId, converted, actorOf(req)),
    );
  }
```

```ts
  async update(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
    @Body() dto: UpdateAccountDto,
    @Req() req: Request,
  ): Promise<AccountResponseDto> {
    // UpdateAccountDto is a PartialType, so `type` is optional and client-controlled. The negative
    // allowance must come from the STORED account. Only look it up when a conversion is requested.
    const storedType = dto.fxInputs?.length
      ? (
          await this.accountsService.findOne(
            familyGroupId,
            id,
            canSeePrivateItems(req.tenantContext?.member?.role),
            req.tenantContext?.member ?? null,
            req.tenantContext?.userId,
          )
        ).type
      : undefined;
    return this.fxInputs.run(
      { familyGroupId, userId: req.tenantContext?.userId ?? null, entity: "Account", entityId: id, dto, spec: accountBalanceSpec(storedType) },
      (converted) => this.accountsService.update(familyGroupId, id, converted, actorOf(req)),
    );
  }
```

`findOne` is the same tenant- and privacy-scoped read the `GET :id` route uses, so a foreign-currency PATCH on an account the caller cannot see still 404s before any conversion. `AccountsService.update` keeps its own `type`-based balance validation, unchanged. The create route may keep `accountBalanceSpec(dto.type)`, because on create `type` is required and _is_ the stored type.

`transactions.controller.ts`: in `create`, replace `const result = await this.transactionsService.create(familyGroupId, dto, req.tenantContext?.member);` with the block below. The 202 branch after it is unchanged.

```ts
const result = await this.fxInputs.run(
  {
    familyGroupId,
    userId: req.tenantContext?.userId ?? null,
    entity: "Transaction",
    locate: (r) =>
      "held" in r
        ? { entity: "AllowanceRequest", entityId: r.allowanceRequestId }
        : { entity: "Transaction", entityId: r.id },
    dto,
    spec: FX_FIELD_SPECS.transaction,
  },
  (converted) =>
    this.transactionsService.create(
      familyGroupId,
      converted,
      req.tenantContext?.member,
    ),
);
```

In `update`, replace the `return this.transactionsService.update(…)` statement with:

```ts
return this.fxInputs.run(
  {
    familyGroupId,
    userId: req.tenantContext?.userId ?? null,
    entity: "Transaction",
    entityId: id,
    dto,
    spec: FX_FIELD_SPECS.transaction,
  },
  (converted) =>
    this.transactionsService.update(
      familyGroupId,
      id,
      converted,
      req.tenantContext?.member,
      canSeePrivate,
    ),
);
```

`budgets.controller.ts`: in `create` and `update`, replace the final `return this.budgets.…` with:

```ts
return this.fxInputs.run(
  {
    familyGroupId,
    userId: req.tenantContext?.userId ?? null,
    entity: "Budget",
    dto,
    spec: FX_FIELD_SPECS.budget,
  },
  (converted) => this.budgets.create(familyGroupId, converted, canSeePrivate),
);
```

```ts
return this.fxInputs.run(
  {
    familyGroupId,
    userId: req.tenantContext?.userId ?? null,
    entity: "Budget",
    entityId: id,
    dto,
    spec: FX_FIELD_SPECS.budget,
  },
  (converted) =>
    this.budgets.update(familyGroupId, id, converted, canSeePrivate),
);
```

`goals.controller.ts` (the handlers use `@Request() req`):

```ts
// create
return this.fxInputs.run(
  {
    familyGroupId: req.params.familyGroupId,
    userId: req.tenantContext?.userId ?? null,
    entity: "Goal",
    dto,
    spec: FX_FIELD_SPECS.goal,
  },
  (converted) => this.goalsService.create(req.params.familyGroupId, converted),
);
```

```ts
// update
return this.fxInputs.run(
  {
    familyGroupId: req.params.familyGroupId,
    userId: req.tenantContext?.userId ?? null,
    entity: "Goal",
    entityId: id,
    dto,
    spec: FX_FIELD_SPECS.goal,
  },
  (converted) =>
    this.goalsService.update(req.params.familyGroupId, id, converted),
);
```

```ts
// contribute
return this.fxInputs.run(
  {
    familyGroupId: req.params.familyGroupId,
    userId: req.tenantContext?.userId ?? null,
    entity: "GoalContribution",
    locate: (r) => ({
      entity: "GoalContribution",
      entityId: r.contribution.id,
    }),
    dto,
    spec: FX_FIELD_SPECS.goalContribution,
  },
  (converted) =>
    this.goalsService.contribute(req.params.familyGroupId, id, converted),
);
```

`allowance-requests.controller.ts` `create`:

```ts
const member = requireMember(req);
return this.fxInputs.run(
  {
    familyGroupId,
    userId: member.userId,
    entity: "AllowanceRequest",
    dto,
    spec: FX_FIELD_SPECS.allowanceRequest,
  },
  (converted) =>
    this.allowanceRequestsService.create(
      familyGroupId,
      member.userId,
      converted,
    ),
);
```

`family-groups.controller.ts`. Its handlers use `@Request() req: AuthRequest` and `req.user.sub`.

```ts
  @Patch(":familyGroupId/gold-price")
  @CheckAbility((ab: AppAbility) => ab.can("manage", "FamilyGroup"))
  // …existing Api decorators unchanged…
  updateGoldPrice(
    @Request() req: AuthRequest,
    @Param("familyGroupId") familyGroupId: string,
    @Body() dto: UpdateGoldPriceDto,
  ): Promise<GoldPriceResponseDto> {
    return this.fxInputs.run(
      {
        familyGroupId,
        userId: req.user.sub,
        entity: "FamilyGroup",
        entityId: familyGroupId,
        fieldPrefix: "goldPrice",
        dto,
        spec: FX_FIELD_SPECS.goldPrice,
      },
      (converted) => this.familyGroupsService.updateGoldPrice(familyGroupId, req.user.sub, converted),
    );
  }
```

```ts
// updateMemberRole — replace the body's return:
return this.fxInputs.run(
  {
    familyGroupId,
    userId: req.user.sub,
    entity: "Member",
    entityId: memberId,
    dto,
    spec: FX_FIELD_SPECS.memberThreshold,
  },
  (converted) =>
    this.familyGroupsService.updateMemberRole(
      familyGroupId,
      memberId,
      req.user.sub,
      converted,
    ),
);
```

The `null`-clears path is untouched: with no `fxInputs`, `run` passes the DTO through, `null` included.

- [ ] **Step 3c: Existing specs**

Do not trust the two files named below as the full list. Find **every** spec that constructs or compiles a controller touched in this task:

```bash
grep -rlnE "new (Accounts|Transactions|Budgets|Goals|AllowanceRequests|FamilyGroups)Controller\(|controllers: \[[^]]*(Accounts|Transactions|Budgets|Goals|AllowanceRequests|FamilyGroups)Controller" apps/api/src apps/api/test
```

Patch each hit:

- `new XController(...)` gains a trailing `fxTesting().service` argument.
- `Test.createTestingModule({ controllers: [...] })` gains `...fxTesting().providers` in `providers`.

Expected: after patching, the Step 4 command runs every one of those specs green.

- `allowance-requests.controller.spec.ts:37`: `new AllowanceRequestsController(service as never, fxTesting().service)`.
- `goals.controller.spec.ts:44`: add `...fxTesting().providers` to `providers`.

Both specs import it as `import { fxTesting } from "../../test/fx-testing";`.

- [ ] **Step 4: Run tests to verify they pass**

Run (from `apps/api`): `pnpm exec jest src/fx src/accounts src/transactions src/budgets src/goals src/allowance-requests src/family-groups`
Expected: PASS. The 14 new ledger tests and 3 new family-settings tests are green, and every pre-existing suite in those folders stays green with unchanged counts.

Run (from `apps/api`): `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: exit 0.

- [ ] **Step 5: Lint**

Run (from `apps/api`): `pnpm exec eslint src/accounts src/transactions src/budgets src/goals src/allowance-requests src/family-groups src/fx test/fx-testing.ts`
Expected: exit 0.

- [ ] **Step 6: Commit + import check**

```bash
git add apps/api/src/accounts apps/api/src/transactions apps/api/src/budgets apps/api/src/goals apps/api/src/allowance-requests apps/api/src/family-groups apps/api/src/fx/fx-wiring-ledger.spec.ts apps/api/src/fx/fx-wiring-family-settings.spec.ts apps/api/test/fx-testing.ts
git commit -m "$(cat <<'EOF'
feat(fx): foreign-currency input on accounts, transactions, budgets, goals, allowance requests, gold price, member threshold

Each route accepts optional fxInputs; the server converts and overwrites
the IDR field, so the services and the ledger stay IDR-only. Negative
foreign balances are allowed only for cash accounts. The transfer admin
fee stays IDR. The gold-price route gains the @CheckAbility it was missing
(AbilitiesGuard fails open on undecorated routes).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
git diff HEAD~1 -- 'apps/api/src/**/*.controller.ts' 'apps/api/src/**/dto/*.ts' | grep "^+import type"
```

Expected: no output. `FxInputService`, the DTO classes and `FxInputsProperty` must stay value imports. If lint-staged rewrote any, restore it and `git commit --amend --no-edit`.

---

### Task 6: API wiring — holdings and obligations (assets, investments, liabilities, insurances, inheritance, donations, split bills)

**Files:**

- Modify DTOs (add `@FxInputsProperty() fxInputs?: FxInputDto[];` exactly as in Task 5 Step 3a):
  - assets: `apps/api/src/assets/dto/{create-asset,update-asset,record-asset-value}.dto.ts`
  - investments: `apps/api/src/investments/dto/{create-investment,update-investment,set-manual-price,create-investment-transaction}.dto.ts`
  - liabilities: `apps/api/src/liabilities/dto/{create-liability,update-liability,pay-liability,purchase-liability}.dto.ts`
  - insurances: `apps/api/src/insurances/dto/{create-insurance,update-insurance,pay-insurance}.dto.ts`
  - inheritance: `apps/api/src/inheritance/dto/create-inheritance-asset.dto.ts` (update inherits via `PartialType`)
  - donations: `apps/api/src/donations/dto/{create-donation,update-donation}.dto.ts`
  - split bills: `apps/api/src/split-bills/dto/create-split-bill.dto.ts`
- Modify controllers:
  - `assets.controller.ts` (`create` :72, `update` :83, `recordValue` :107)
  - `investments.controller.ts` (`create` :72, `update` :83, `setManualPrice` :110, `recordTransaction` :129)
  - `liabilities.controller.ts` (`create` :96, `update` :108, `pay` :133, `purchase` :153)
  - `insurances.controller.ts` (`create` :73, `update` :85, `pay` :107)
  - `inheritance.controller.ts` (`create` :55, `update` :81)
  - `donations.controller.ts` (`create` :93, `update` :119)
  - `split-bills.controller.ts` (`create` :71)
- Create: `apps/api/src/split-bills/split-fx.util.ts`
- Test: `apps/api/src/split-bills/split-fx.util.spec.ts`
- Modify existing specs:
  - `insurances/insurances.controller.spec.ts:75`
  - `liabilities/liabilities.controller.spec.ts:91` and `:147`
  - `donations/donations.controller.spec.ts:22`
- Test: `apps/api/src/fx/fx-wiring-holdings.spec.ts`

**Interfaces:**

- Consumes: Task 4 and Task 5 (`createFxTestApp`).
- Produces:
  - Every remaining in-scope route accepts `fxInputs`.
  - `assertSplitFxComplete(dto: CreateSplitBillDto): void`.
  - `settleSplitRounding<T extends { totalAmount: number; participants: { amountOwed: number }[] }>(dto: T): T`.

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/split-bills/split-fx.util.spec.ts`:

```ts
import { BadRequestException } from "@nestjs/common";

import { assertSplitFxComplete, settleSplitRounding } from "./split-fx.util";

const base = {
  title: "Makan Tokyo",
  payoutAccountId: "5f0c1f7e-7c1a-4b8e-9d7a-2f1c3b4a5d6e",
  totalAmount: 1,
  participants: [
    { name: "A", amountOwed: 1 },
    { name: "B", amountOwed: 1 },
    { name: "C", amountOwed: 1 },
  ],
};

describe("split bill FX — revisi I", () => {
  it("split bill: residue goes to participant 0 so the shares still sum to the total", () => {
    // USD 10.00 = 179139; 3.33 → 59653 (×2), 3.34 → 59832; sum 179138, residue +1.
    const out = settleSplitRounding({
      ...base,
      totalAmount: 179_139,
      participants: [
        { name: "A", amountOwed: 59_653 },
        { name: "B", amountOwed: 59_653 },
        { name: "C", amountOwed: 59_832 },
      ],
    });
    expect(out.participants.map((p) => p.amountOwed)).toEqual([
      59_654, 59_653, 59_832,
    ]);
    expect(out.participants.reduce((s, p) => s + p.amountOwed, 0)).toBe(
      out.totalAmount,
    );
  });

  it("returns the same object when there is no residue", () => {
    const dto = { ...base, totalAmount: 3 };
    expect(settleSplitRounding(dto)).toBe(dto);
  });

  it("requires the total AND every share in ONE currency", () => {
    const all = [
      { field: "totalAmount", currency: "USD" as const, amount: "10.00" },
      {
        field: "participants.0.amountOwed",
        currency: "USD" as const,
        amount: "3.33",
      },
      {
        field: "participants.1.amountOwed",
        currency: "USD" as const,
        amount: "3.33",
      },
      {
        field: "participants.2.amountOwed",
        currency: "USD" as const,
        amount: "3.34",
      },
    ];
    expect(() =>
      assertSplitFxComplete({ ...base, fxInputs: all }),
    ).not.toThrow();
    expect(() =>
      assertSplitFxComplete({ ...base, fxInputs: all.slice(0, 3) }),
    ).toThrow(BadRequestException);
    expect(() =>
      assertSplitFxComplete({
        ...base,
        fxInputs: [...all.slice(0, 3), { ...all[3], currency: "SGD" as const }],
      }),
    ).toThrow(BadRequestException);
    expect(() => assertSplitFxComplete(base)).not.toThrow();
  });
});
```

Create `apps/api/src/fx/fx-wiring-holdings.spec.ts`:

```ts
import "reflect-metadata";

import { AssetType, DonationType, InvestmentTxType } from "@prisma/client";
import request from "supertest";

import { createFxTestApp, FG, fxTesting } from "../../test/fx-testing";
import { AssetAttachmentsService } from "../assets/asset-attachments.service";
import { AssetsController } from "../assets/assets.controller";
import { AssetsService } from "../assets/assets.service";
import { DonationsController } from "../donations/donations.controller";
import { DonationsService } from "../donations/donations.service";
import { InsurancesController } from "../insurances/insurances.controller";
import { InsurancesService } from "../insurances/insurances.service";
import { InvestmentsController } from "../investments/investments.controller";
import { InvestmentsService } from "../investments/investments.service";
import { LiabilitiesController } from "../liabilities/liabilities.controller";
import { LiabilitiesService } from "../liabilities/liabilities.service";
import { SplitBillsController } from "../split-bills/split-bills.controller";
import { SplitBillsService } from "../split-bills/split-bills.service";

import type { INestApplication } from "@nestjs/common";

const UUID = "5f0c1f7e-7c1a-4b8e-9d7a-2f1c3b4a5d6e";
const assets = { create: jest.fn(), update: jest.fn(), recordValue: jest.fn() };
const investments = {
  recordTransaction: jest.fn(),
  setManualPrice: jest.fn(),
  create: jest.fn(),
};
const liabilities = {
  pay: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  purchase: jest.fn(),
};
const insurances = { pay: jest.fn() };
const donations = { create: jest.fn() };
const splitBills = { create: jest.fn() };

describe("fx wiring — holdings & obligations (revisi I)", () => {
  let app: INestApplication;
  const fx = fxTesting();

  beforeAll(async () => {
    app = await createFxTestApp({
      controllers: [
        AssetsController,
        InvestmentsController,
        LiabilitiesController,
        InsurancesController,
        DonationsController,
        SplitBillsController,
      ],
      providers: [
        { provide: AssetsService, useValue: assets },
        { provide: AssetAttachmentsService, useValue: {} },
        { provide: InvestmentsService, useValue: investments },
        { provide: LiabilitiesService, useValue: liabilities },
        { provide: InsurancesService, useValue: insurances },
        { provide: DonationsService, useValue: donations },
        { provide: SplitBillsService, useValue: splitBills },
      ],
      fx,
    });
  });
  afterAll(() => app.close());
  beforeEach(() => {
    jest.clearAllMocks();
    for (const m of [
      assets.create,
      investments.recordTransaction,
      liabilities.pay,
      liabilities.create,
      insurances.pay,
      donations.create,
      splitBills.create,
    ]) {
      m.mockResolvedValue({ id: "row-1" });
    }
  });
  const http = () => request(app.getHttpServer());

  it("asset: CNY value and a signed JPY value change", async () => {
    await http()
      .post(`/family-groups/${FG}/assets`)
      .send({
        name: "Apartemen Shanghai",
        type: Object.values(AssetType)[0],
        currentValue: "1",
        valueChangeAmount: "-1",
        fxInputs: [
          { field: "currentValue", currency: "CNY", amount: "5000.00" },
          { field: "valueChangeAmount", currency: "JPY", amount: "-1000" },
        ],
      })
      .expect(201);
    expect(assets.create.mock.calls[0][1]).toMatchObject({
      currentValue: "13342229",
      valueChangeAmount: "-113674",
    });
    expect(
      fx.prisma.fxConversion.createMany.mock.calls[0][0].data,
    ).toHaveLength(2);
  });

  it("investment buy: USD price per unit keeps sen (decimal2)", async () => {
    await http()
      .post(`/family-groups/${FG}/investments/inv-1/transactions`)
      .send({
        type: Object.values(InvestmentTxType)[0],
        quantity: "2",
        pricePerUnit: "1",
        fxInputs: [{ field: "pricePerUnit", currency: "USD", amount: "99.99" }],
      })
      .expect(201);
    expect(investments.recordTransaction.mock.calls[0][2].pricePerUnit).toBe(
      "1791210.85",
    );
    expect(
      fx.prisma.fxConversion.createMany.mock.calls[0][0].data[0],
    ).toMatchObject({
      entity: "Investment",
      entityId: "inv-1",
      field: "trade.pricePerUnit",
      idrAmount: "1791210.85",
    });
  });

  it("liability pay: SGD amount, audited as Liability pay.amount", async () => {
    await http()
      .post(`/family-groups/${FG}/liabilities/liab-1/pay`)
      .send({
        sourceAccountId: UUID,
        amount: "1",
        fxInputs: [{ field: "amount", currency: "SGD", amount: "1500.25" }],
      })
      .expect(200);
    expect(liabilities.pay.mock.calls[0][2].amount).toBe("21043698");
    expect(
      fx.prisma.fxConversion.createMany.mock.calls[0][0].data[0],
    ).toMatchObject({
      entity: "Liability",
      entityId: "liab-1",
      field: "pay.amount",
    });
  });

  it("an IDR liability save sends no fxInputs to the service", async () => {
    liabilities.update.mockResolvedValue({ id: "liab-1" });
    await http()
      .patch(`/family-groups/${FG}/liabilities/liab-1`)
      .send({ remainingBalance: "450000000" })
      .expect(200);
    const sent = liabilities.update.mock.calls[0][2];
    expect(sent).toEqual(
      expect.objectContaining({ remainingBalance: "450000000" }),
    );
    expect(sent).not.toHaveProperty("fxInputs");
    expect(fx.fxPort.getSnapshot).not.toHaveBeenCalled();
  });

  it("insurance premium pay: AUD 1,200.00", async () => {
    await http()
      .post(`/family-groups/${FG}/insurances/ins-1/pay`)
      .send({
        sourceAccountId: UUID,
        amount: "1",
        fxInputs: [{ field: "amount", currency: "AUD", amount: "1200.00" }],
      })
      .expect(200);
    expect(insurances.pay.mock.calls[0][2].amount).toBe("15112617");
  });

  it("donation: EUR 75.50", async () => {
    await http()
      .post(`/family-groups/${FG}/donations`)
      .send({
        type: Object.values(DonationType)[0],
        recipient: "UNICEF",
        amount: "1",
        donatedAt: "2026-09-26",
        fxInputs: [{ field: "amount", currency: "EUR", amount: "75.50" }],
      })
      .expect(201);
    expect(donations.create.mock.calls[0][1].amount).toBe("1542255");
  });

  it("split bill: converts total + shares and settles the residue on participant 0", async () => {
    await http()
      .post(`/family-groups/${FG}/split-bills`)
      .send({
        title: "Makan Tokyo",
        payoutAccountId: UUID,
        totalAmount: 3,
        participants: [
          { name: "A", amountOwed: 1 },
          { name: "B", amountOwed: 1 },
          { name: "C", amountOwed: 1 },
        ],
        fxInputs: [
          { field: "totalAmount", currency: "USD", amount: "10.00" },
          {
            field: "participants.0.amountOwed",
            currency: "USD",
            amount: "3.33",
          },
          {
            field: "participants.1.amountOwed",
            currency: "USD",
            amount: "3.33",
          },
          {
            field: "participants.2.amountOwed",
            currency: "USD",
            amount: "3.34",
          },
        ],
      })
      .expect(201);
    const sent = splitBills.create.mock.calls[0][1];
    expect(sent.totalAmount).toBe(179_139);
    expect(
      sent.participants.map((p: { amountOwed: number }) => p.amountOwed),
    ).toEqual([59_654, 59_653, 59_832]);
  });

  it("split bill: a partial fxInputs set is rejected before the service runs", async () => {
    await http()
      .post(`/family-groups/${FG}/split-bills`)
      .send({
        title: "X",
        payoutAccountId: UUID,
        totalAmount: 2,
        participants: [
          { name: "A", amountOwed: 1 },
          { name: "B", amountOwed: 1 },
        ],
        fxInputs: [{ field: "totalAmount", currency: "USD", amount: "10.00" }],
      })
      .expect(400);
    expect(splitBills.create).not.toHaveBeenCalled();
  });
});
```

The IDR-liability test uses a PATCH because every `UpdateLiabilityDto` field is optional, so it stays valid whatever fields sub-plan G added to the create DTO.

- [ ] **Step 2: Run tests to verify they fail**

Run (from `apps/api`): `pnpm exec jest src/split-bills/split-fx.util.spec.ts src/fx/fx-wiring-holdings.spec.ts`
Expected: FAIL. The util module is missing, and the wiring specs receive the unconverted previews.

- [ ] **Step 3a: Split util**

Create `apps/api/src/split-bills/split-fx.util.ts`:

```ts
import { BadRequestException } from "@nestjs/common";

import type { CreateSplitBillDto } from "./dto/create-split-bill.dto";

/** One currency per bill: the total and every share are converted together, or none are. */
export function assertSplitFxComplete(dto: CreateSplitBillDto): void {
  const inputs = dto.fxInputs ?? [];
  if (inputs.length === 0) return;
  const expected = [
    "totalAmount",
    ...dto.participants.map((_, i) => `participants.${i}.amountOwed`),
  ].sort();
  const given = inputs.map((i) => i.field).sort();
  const oneCurrency = new Set(inputs.map((i) => i.currency)).size === 1;
  if (
    !oneCurrency ||
    given.length !== expected.length ||
    expected.some((f, i) => f !== given[i])
  ) {
    throw new BadRequestException(
      "fxInputs: a split bill converts its total and every share, in one currency",
    );
  }
}

/** After conversion the total is authoritative; the rounding residue lands on participant 0. */
export function settleSplitRounding<
  T extends { totalAmount: number; participants: { amountOwed: number }[] },
>(dto: T): T {
  const sum = dto.participants.reduce((s, p) => s + p.amountOwed, 0);
  const residue = dto.totalAmount - sum;
  if (residue === 0) return dto;
  const first = dto.participants[0];
  if (!first || first.amountOwed + residue < 0) {
    throw new BadRequestException(
      "fxInputs: split shares do not add up to the total",
    );
  }
  return {
    ...dto,
    participants: dto.participants.map((p, i) =>
      i === 0 ? { ...p, amountOwed: p.amountOwed + residue } : p,
    ),
  };
}
```

- [ ] **Step 3b: DTOs**

Add `@FxInputsProperty() fxInputs?: FxInputDto[];` to every DTO in the Files list, exactly as in Task 5 Step 3a.

- [ ] **Step 3c: Controllers**

Add the imports and the `private readonly fxInputs: FxInputService` constructor parameter as in Task 5 Step 3b. `assets.controller.ts` already has a `/* eslint-disable @typescript-eslint/consistent-type-imports */` block; put the `FxInputService` import inside it. Where a handler has no `req`, add `@Req() req: Request` as its last parameter. `Request` is `import type { Request } from "express"`, which `liabilities.controller.ts` already has; add it to the others that lack it.

Replace each `return this.<service>.<method>(…)` with the matching block:

```ts
// assets.controller.ts — create / update / recordValue (handlers use `@Request() req`)
return this.fxInputs.run(
  {
    familyGroupId: req.params.familyGroupId,
    userId: req.tenantContext?.userId ?? null,
    entity: "Asset",
    dto,
    spec: FX_FIELD_SPECS.asset,
  },
  (converted) => this.assetsService.create(req.params.familyGroupId, converted),
);
return this.fxInputs.run(
  {
    familyGroupId: req.params.familyGroupId,
    userId: req.tenantContext?.userId ?? null,
    entity: "Asset",
    entityId: id,
    dto,
    spec: FX_FIELD_SPECS.asset,
  },
  (converted) =>
    this.assetsService.update(req.params.familyGroupId, id, converted),
);
return this.fxInputs.run(
  {
    familyGroupId: req.params.familyGroupId,
    userId: req.tenantContext?.userId ?? null,
    entity: "Asset",
    entityId: id,
    fieldPrefix: "history",
    dto,
    spec: FX_FIELD_SPECS.assetHistory,
  },
  (converted) =>
    this.assetsService.recordValue(
      req.params.familyGroupId,
      id,
      converted,
      req.tenantContext?.userId ?? null,
    ),
);
```

```ts
// investments.controller.ts — create / update / setManualPrice / recordTransaction
return this.fxInputs.run(
  {
    familyGroupId: req.params.familyGroupId,
    userId: req.tenantContext?.userId ?? null,
    entity: "Investment",
    dto,
    spec: FX_FIELD_SPECS.investment,
  },
  (converted) =>
    this.investmentsService.create(req.params.familyGroupId, converted),
);
return this.fxInputs.run(
  {
    familyGroupId: req.params.familyGroupId,
    userId: req.tenantContext?.userId ?? null,
    entity: "Investment",
    entityId: id,
    dto,
    spec: FX_FIELD_SPECS.investment,
  },
  (converted) =>
    this.investmentsService.update(req.params.familyGroupId, id, converted),
);
return this.fxInputs.run(
  {
    familyGroupId: req.params.familyGroupId,
    userId: req.tenantContext?.userId ?? null,
    entity: "Investment",
    entityId: id,
    fieldPrefix: "price",
    dto,
    spec: FX_FIELD_SPECS.investmentPrice,
  },
  (converted) =>
    this.investmentsService.setManualPrice(
      req.params.familyGroupId,
      id,
      converted,
    ),
);
return this.fxInputs.run(
  {
    familyGroupId: req.params.familyGroupId,
    userId: req.tenantContext?.userId ?? null,
    entity: "Investment",
    entityId: id,
    fieldPrefix: "trade",
    dto,
    spec: FX_FIELD_SPECS.investmentTrade,
  },
  (converted) =>
    this.investmentsService.recordTransaction(
      req.params.familyGroupId,
      id,
      converted,
    ),
);
```

```ts
// liabilities.controller.ts — create / update / pay / purchase
return this.fxInputs.run(
  {
    familyGroupId,
    userId: req.tenantContext?.userId ?? null,
    entity: "Liability",
    dto,
    spec: FX_FIELD_SPECS.liability,
  },
  (converted) => this.liabilitiesService.create(familyGroupId, converted),
);
return this.fxInputs.run(
  {
    familyGroupId,
    userId: req.tenantContext?.userId ?? null,
    entity: "Liability",
    entityId: id,
    dto,
    spec: FX_FIELD_SPECS.liability,
  },
  (converted) => this.liabilitiesService.update(familyGroupId, id, converted),
);
return this.fxInputs.run(
  {
    familyGroupId,
    userId: req.tenantContext?.userId ?? null,
    entity: "Liability",
    entityId: id,
    fieldPrefix: "pay",
    dto,
    spec: FX_FIELD_SPECS.liabilityPayment,
  },
  (converted) => this.liabilitiesService.pay(familyGroupId, id, converted),
);
return this.fxInputs.run(
  {
    familyGroupId,
    userId: req.tenantContext?.userId ?? null,
    entity: "Liability",
    entityId: id,
    fieldPrefix: "purchase",
    dto,
    spec: FX_FIELD_SPECS.liabilityPayment,
  },
  (converted) =>
    this.liabilitiesService.purchase(
      familyGroupId,
      id,
      converted,
      req.tenantContext?.member,
    ),
);
```

```ts
// insurances.controller.ts — create / update / pay
return this.fxInputs.run(
  {
    familyGroupId,
    userId: req.tenantContext?.userId ?? null,
    entity: "Insurance",
    dto,
    spec: FX_FIELD_SPECS.insurance,
  },
  (converted) => this.insurancesService.create(familyGroupId, converted),
);
return this.fxInputs.run(
  {
    familyGroupId,
    userId: req.tenantContext?.userId ?? null,
    entity: "Insurance",
    entityId: id,
    dto,
    spec: FX_FIELD_SPECS.insurance,
  },
  (converted) => this.insurancesService.update(familyGroupId, id, converted),
);
return this.fxInputs.run(
  {
    familyGroupId,
    userId: req.tenantContext?.userId ?? null,
    entity: "Insurance",
    entityId: id,
    fieldPrefix: "pay",
    dto,
    spec: FX_FIELD_SPECS.insurancePayment,
  },
  (converted) => this.insurancesService.pay(familyGroupId, id, converted),
);
```

```ts
// inheritance.controller.ts — create / update
return this.fxInputs.run(
  {
    familyGroupId,
    userId: req.tenantContext?.userId ?? null,
    entity: "InheritanceAsset",
    dto,
    spec: FX_FIELD_SPECS.inheritance,
  },
  (converted) => this.inheritanceService.create(familyGroupId, converted),
);
return this.fxInputs.run(
  {
    familyGroupId,
    userId: req.tenantContext?.userId ?? null,
    entity: "InheritanceAsset",
    entityId: id,
    dto,
    spec: FX_FIELD_SPECS.inheritance,
  },
  (converted) => this.inheritanceService.update(familyGroupId, id, converted),
);
```

```ts
// donations.controller.ts — create / update
return this.fxInputs.run(
  {
    familyGroupId,
    userId: req.tenantContext?.userId ?? null,
    entity: "Donation",
    dto,
    spec: FX_FIELD_SPECS.donation,
  },
  (converted) => this.donationsService.create(familyGroupId, converted),
);
return this.fxInputs.run(
  {
    familyGroupId,
    userId: req.tenantContext?.userId ?? null,
    entity: "Donation",
    entityId: id,
    dto,
    spec: FX_FIELD_SPECS.donation,
  },
  (converted) => this.donationsService.update(familyGroupId, id, converted),
);
```

```ts
// split-bills.controller.ts — create
assertSplitFxComplete(dto);
return this.fxInputs.run(
  {
    familyGroupId,
    userId: req.tenantContext?.userId ?? null,
    entity: "SplitBill",
    dto,
    spec: FX_FIELD_SPECS.splitBill,
    transform: settleSplitRounding,
  },
  (converted) => this.splitBillsService.create(familyGroupId, converted),
);
```

Imports for the split-bills controller: `import { assertSplitFxComplete, settleSplitRounding } from "./split-fx.util";`.

- [ ] **Step 3d: Existing specs**

Do not trust the specs named below as the full list. Find **every** spec that constructs or compiles a controller touched in this task:

```bash
grep -rlnE "new (Assets|Investments|Liabilities|Insurances|Inheritance|Donations|SplitBills)Controller\(|controllers: \[[^]]*(Assets|Investments|Liabilities|Insurances|Inheritance|Donations|SplitBills)Controller" apps/api/src apps/api/test
```

Patch each hit:

- `new XController(...)` gains a trailing `fxTesting().service` argument.
- `Test.createTestingModule({ controllers: [...] })` gains `...fxTesting().providers` in `providers`.

Expected: after patching, the Step 4 command runs every one of those specs green.

- `insurances.controller.spec.ts:75` and `liabilities.controller.spec.ts:91`: add `fxTesting().service` as the second constructor argument.
- `liabilities.controller.spec.ts:147` and `donations.controller.spec.ts:22` (`Test.createTestingModule`): add `...fxTesting().providers` to `providers`.

- [ ] **Step 4: Run tests to verify they pass**

Run (from `apps/api`): `pnpm exec jest src/fx src/split-bills src/assets src/investments src/liabilities src/insurances src/inheritance src/donations`
Expected: PASS. The new util spec (3) and wiring spec (8) are green, and every pre-existing suite stays green with unchanged counts.

Run (from `apps/api`): `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: exit 0.

- [ ] **Step 5: Lint**

Run (from `apps/api`): `pnpm exec eslint src/assets src/investments src/liabilities src/insurances src/inheritance src/donations src/split-bills src/fx`
Expected: exit 0.

- [ ] **Step 6: Commit + import check**

```bash
git add apps/api/src/assets apps/api/src/investments apps/api/src/liabilities apps/api/src/insurances apps/api/src/inheritance apps/api/src/donations apps/api/src/split-bills apps/api/src/fx/fx-wiring-holdings.spec.ts
git commit -m "$(cat <<'EOF'
feat(fx): foreign-currency input on assets, investments, liabilities, insurances, inheritance, donations, split bills

Investment unit prices convert at sen precision. Liability and insurance
payments are audited as pay.amount on the parent. A split bill converts
total and shares in one currency and puts the rounding residue on the
first participant, so sum == total still holds.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
git diff HEAD~1 -- 'apps/api/src/**/*.controller.ts' 'apps/api/src/**/dto/*.ts' | grep "^+import type"
```

Expected: only `import type { Request } from "express"` lines, if any were added. Restore any other rewritten import and amend.

---

### Task 7: Web — `MoneyInput` component, money-field hook, fx helpers, i18n

**Files:**

- Create: `apps/web/src/components/money/money-format.ts`
- Create: `apps/web/src/components/money/use-fx-snapshot.ts`
- Create: `apps/web/src/components/money/use-money-field.ts`
- Create: `apps/web/src/components/money/fx-inputs.ts`
- Create: `apps/web/src/components/money/money-input.tsx`
- Create: `apps/web/src/components/money/fx-test-rates.ts` (fixture shared by web tests)
- Create: `apps/web/src/components/money/index.ts`
- Test: `apps/web/src/components/money/money-format.test.ts`, `apps/web/src/components/money/money-input.test.tsx`
- Modify: `apps/web/src/i18n/types.ts`, `apps/web/src/i18n/id.ts`, `apps/web/src/i18n/en.ts` (new top-level `money` section, placed after `crud`)

**Interfaces:**

- Consumes:
  - From `@wealthme/contracts`: `convertToIdr`, `formatScaled`, `FX_CURRENCY_DECIMALS`, `FxRatesResponse`, `FxInput`, `FxCurrencyCode`, `ForeignFxCurrencyCode`.
  - From the web app: `CURRENCIES` (`@/hooks/currencies`), `useCurrencyPreference`, `useLocale`, `apiFetch`, `formatRupiah`, `cn`. All are imported only; none of these files is edited.
- Produces (all exported from `@/components/money`):
  - `formatMoneyTyping(raw: string, decimals: number, allowNegative?: boolean): string` gives id-ID display (`.` thousands, `,` decimals).
  - `toCanonicalAmount(display: string): string | null` gives e.g. `"1250.50"`.
  - `canonicalToTyping(canonical: string, decimals: number, allowNegative?: boolean): string` turns a stored `"12345.67"` back into the display form.
  - `idrPreview(canonical: string | null, currency: FxCurrencyCode, rates: FxRatesResponse | undefined, targetScale: 0 | 2): bigint | null`.
  - `formatIdrPreview(value: bigint, scale: 0 | 2): string`.
  - `useFxSnapshot(enabled: boolean)` is a TanStack query on `["fx","rates","IDR"]`, the same key as `useCurrencyPreference`.
  - `interface MoneyField { raw; currency; decimals; allowNegative; idrScale; setRaw(v); setCurrency(c); reset(raw?); resolved: ResolvedMoney; rates; isRateError }`.
  - `interface ResolvedMoney { canonical: string | null; idrPreview: bigint | null; isPending: boolean; fx: { currency: ForeignFxCurrencyCode; amount: string } | null }`.
  - `useDefaultMoneyCurrency(): FxCurrencyCode` returns the user's display currency (`useCurrencyPreference().currency`) when it is one of the 7 codes, else `"IDR"` (Decision 12).
  - `useMoneyField(opts?: { initialRaw?: string; isEdit?: boolean; allowNegative?: boolean; idrScale?: 0 | 2 }): MoneyField` (uncontrolled).
    - With a non-empty `initialRaw`, or `isEdit: true` (an edit form whose stored value may be empty, e.g. an asset with no fixed value change): opens on **IDR**.
    - Without it: follows `useDefaultMoneyCurrency()` until the user's first keystroke or currency pick, then stays latched.
    - `reset()` goes back to "empty, follow the default". `reset(idrRaw)` means "prefill a stored IDR value" and pins IDR.
  - `useControlledMoneyField(args: { raw: string; currency: FxCurrencyCode | null; onChange(next: { raw: string; currency: FxCurrencyCode }): void; allowNegative?: boolean; idrScale?: 0 | 2 }): MoneyField`, for callers that own the raw string (CrudModal, investasi form object).
    - `currency: null` means "not chosen yet": the effective currency is `useDefaultMoneyCurrency()`, and the first `setRaw`/`setCurrency` latches it through `onChange`.
    - Edit callers pass `"IDR"`.
  - `moneyIdr(field: MoneyField, parseIdr: (raw: string) => number): number` returns the legacy IDR number: the exact old parse for IDR, the preview for a foreign currency.
  - `moneyIdrString(field, parseIdr): string`.
  - `moneyDigits(field: MoneyField): string` is the digit-string wire value. For IDR it is the page's old strip (`/\D/g`, or `/[^-\d]/g` when `allowNegative`); for a foreign currency it is the preview's `toString()`.
  - `moneyIdrDecimal(field, idrCanonical: () => string): string`, for decimal2 fields.
  - `withFxInputs<T extends object>(body: T, entries: ReadonlyArray<readonly [string, MoneyField | null | undefined]>): T` returns **the same object** when no entry is foreign; otherwise `{ ...body, fxInputs }`.
  - `anyMoneyPending(...fields): boolean`.
  - `MoneyInput` props: `{ field: MoneyField; id?: string; ariaLabel?: string; placeholder?: string; disabled?: boolean; inputClassName?: string }`.
  - `TEST_FX_RATES: FxRatesResponse` (fixture).
  - i18n `t.money.{currencyLabel, convertedIdr, convertedDisplay, rateLine, rateStale, rateIndicative, rateLoading, rateUnavailable, serverNote, rateNotReady, storedAsIdr}`.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/components/money/fx-test-rates.ts`:

```ts
import type { FxRatesResponse } from "@wealthme/contracts";

/** ECB 2026-09-25 via Frankfurter, as served by GET /fx/rates?base=IDR (revisi I). */
export const TEST_FX_RATES: FxRatesResponse = {
  base: "IDR",
  rates: { IDR: 1, USD: 1 / 17913.899851, JPY: 1 / 113.674012 },
  rateDate: "2026-09-25",
  source: "frankfurter",
  stale: false,
  idrPerUnit: {
    IDR: "1.000000",
    USD: "17913.899851",
    SGD: "14026.793930",
    EUR: "20427.220000",
    JPY: "113.674012",
    AUD: "12593.847102",
    CNY: "2668.445873",
  },
};
```

Create `apps/web/src/components/money/money-format.test.ts`:

```ts
import { formatAmountInput } from "@/lib/format";

import { moneyDigits, withFxInputs } from "./fx-inputs";
import { TEST_FX_RATES } from "./fx-test-rates";
import {
  canonicalToTyping,
  formatIdrPreview,
  formatMoneyTyping,
  idrPreview,
  toCanonicalAmount,
} from "./money-format";

import type { MoneyField } from "./use-money-field";

describe("formatMoneyTyping — revisi I", () => {
  it.each(["1250000", "0012", "1.250.000", "abc", "", "1.250,50", "Rp 5.000"])(
    "IDR (0 decimals) matches lib/format formatAmountInput for %p",
    (raw) => {
      expect(formatMoneyTyping(raw, 0)).toBe(formatAmountInput(raw));
    },
  );

  it("2-decimal currencies keep up to 2 digits after the comma", () => {
    expect(formatMoneyTyping("1250,505", 2)).toBe("1.250,50");
    expect(formatMoneyTyping("1250,", 2)).toBe("1.250,");
    expect(formatMoneyTyping(",5", 2)).toBe("0,5");
  });

  it("0-decimal currencies drop the fraction (JPY)", () => {
    expect(formatMoneyTyping("1500,5", 0)).toBe("15.005");
  });

  it("keeps a leading minus only when allowed", () => {
    expect(formatMoneyTyping("-20,00", 2, true)).toBe("-20,00");
    expect(formatMoneyTyping("-20", 2, false)).toBe("20");
    expect(formatMoneyTyping("-", 0, true)).toBe("-");
  });
});

describe("toCanonicalAmount / canonicalToTyping — revisi I", () => {
  it("canonicalises the id-ID display", () => {
    expect(toCanonicalAmount("1.250,50")).toBe("1250.50");
    expect(toCanonicalAmount("-20")).toBe("-20");
    expect(toCanonicalAmount("0,5")).toBe("0.5");
    expect(toCanonicalAmount("")).toBeNull();
    expect(toCanonicalAmount("-")).toBeNull();
  });

  it("round-trips a stored decimal back to display", () => {
    expect(canonicalToTyping("12345.67", 2)).toBe("12.345,67");
    expect(canonicalToTyping("-358278", 0, true)).toBe("-358.278");
  });
});

describe("idrPreview / formatIdrPreview — revisi I", () => {
  it("uses the same rounding as the server", () => {
    expect(idrPreview("1250.50", "USD", TEST_FX_RATES, 0)).toBe(22_401_332n);
    expect(idrPreview("-20.00", "USD", TEST_FX_RATES, 0)).toBe(-358_278n);
    expect(idrPreview("12.34", "USD", TEST_FX_RATES, 2)).toBe(22_105_752n);
    expect(idrPreview("250000", "IDR", undefined, 0)).toBe(250_000n);
  });

  it("is null when empty or when a foreign rate is not loaded", () => {
    expect(idrPreview(null, "USD", TEST_FX_RATES, 0)).toBeNull();
    expect(idrPreview("1.00", "USD", undefined, 0)).toBeNull();
  });

  it("formats whole rupiah and sen", () => {
    expect(formatIdrPreview(22_401_332n, 0)).toBe("Rp 22.401.332");
    expect(formatIdrPreview(22_105_752n, 2)).toBe("Rp 221.057,52");
  });
});

describe("moneyDigits — revisi I", () => {
  const f = (over: Partial<MoneyField>) =>
    ({
      allowNegative: false,
      currency: "IDR",
      raw: "",
      resolved: { idrPreview: null },
      ...over,
    }) as unknown as MoneyField;

  it("IDR keeps the old digit strip (sign only when allowed)", () => {
    expect(moneyDigits(f({ raw: "1.250.000" }))).toBe("1250000");
    expect(moneyDigits(f({ raw: "-1.000", allowNegative: true }))).toBe(
      "-1000",
    );
    expect(moneyDigits(f({ raw: "-1.000" }))).toBe("1000");
  });

  it("a foreign currency sends the preview", () => {
    expect(
      moneyDigits(
        f({
          currency: "JPY",
          raw: "-1.000",
          allowNegative: true,
          resolved: { idrPreview: -113_674n } as MoneyField["resolved"],
        }),
      ),
    ).toBe("-113674");
  });
});

describe("withFxInputs — revisi I", () => {
  const field = (fx: ResolvedFx) =>
    ({ resolved: { fx } }) as unknown as MoneyField;
  type ResolvedFx = MoneyField["resolved"]["fx"];

  it("returns the SAME body object when every field is IDR (no fxInputs key)", () => {
    const body = { amount: 250_000 };
    const out = withFxInputs(body, [["amount", field(null)]]);
    expect(out).toBe(body);
    expect(out).not.toHaveProperty("fxInputs");
  });

  it("adds fxInputs for foreign fields only", () => {
    const out = withFxInputs({ amount: 1, adminFee: 0 }, [
      ["amount", field({ currency: "USD", amount: "10.00" })],
      ["adminFee", field(null)],
    ]);
    expect(out).toEqual({
      amount: 1,
      adminFee: 0,
      fxInputs: [{ field: "amount", currency: "USD", amount: "10.00" }],
    });
  });
});
```

Create `apps/web/src/components/money/money-input.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { TEST_FX_RATES } from "./fx-test-rates";
import { MoneyInput } from "./money-input";
import { useMoneyField, type MoneyField } from "./use-money-field";

const mockFx = jest.fn();
jest.mock("./use-fx-snapshot", () => ({
  useFxSnapshot: (enabled: boolean) => mockFx(enabled),
}));
const mockPref = jest.fn();
jest.mock("@/hooks/use-currency-preference", () => ({
  useCurrencyPreference: () => mockPref(),
}));

let latest: MoneyField | null = null;
function Harness({ allowNegative }: { allowNegative?: boolean }) {
  const field = useMoneyField({ allowNegative });
  latest = field;
  return <MoneyInput field={field} id="amt" ariaLabel="Jumlah" />;
}

const IDR_PREF = {
  currency: "IDR",
  isIndicative: false,
  isReady: true,
  formatMoney: (v: number) => `Rp ${v}`,
};
const USD_PREF = {
  currency: "USD",
  isIndicative: true,
  isReady: true,
  formatMoney: (v: number) => `$ ${(v / 17913.899851).toFixed(2)}`,
};

function EditHarness() {
  const field = useMoneyField({ initialRaw: "1791390" });
  latest = field;
  return <MoneyInput field={field} id="amt" ariaLabel="Jumlah" />;
}

describe("MoneyInput — revisi I", () => {
  beforeEach(() => {
    latest = null;
    mockFx.mockImplementation((enabled: boolean) => ({
      data: enabled ? TEST_FX_RATES : undefined,
      isError: false,
    }));
    mockPref.mockReturnValue(IDR_PREF);
  });

  it("defaults a create form to the display currency (USD)", async () => {
    mockPref.mockReturnValue(USD_PREF);
    render(<Harness />);
    expect(screen.getByLabelText("Mata uang")).toHaveValue("USD");
    await userEvent.type(screen.getByLabelText("Jumlah"), "100");
    expect(latest?.resolved.fx).toEqual({ currency: "USD", amount: "100" });
  });

  it("edit prefill opens on IDR even for a USD-display user", () => {
    mockPref.mockReturnValue(USD_PREF);
    render(<EditHarness />);
    expect(screen.getByLabelText("Mata uang")).toHaveValue("IDR");
    expect(screen.getByLabelText("Jumlah")).toHaveValue("1.791.390");
    expect(latest?.resolved.fx).toBeNull();
  });

  it("isEdit pins IDR even when the stored value is empty", () => {
    mockPref.mockReturnValue(USD_PREF);
    function EmptyEdit() {
      const field = useMoneyField({ isEdit: true });
      return <MoneyInput field={field} id="amt" ariaLabel="Jumlah" />;
    }
    render(<EmptyEdit />);
    expect(screen.getByLabelText("Mata uang")).toHaveValue("IDR");
  });

  it("a late-loading profile does not flip a field the user already typed in", async () => {
    const { rerender } = render(<Harness />);
    await userEvent.type(screen.getByLabelText("Jumlah"), "250000");
    mockPref.mockReturnValue(USD_PREF);
    rerender(<Harness />);
    expect(screen.getByLabelText("Mata uang")).toHaveValue("IDR");
    expect(latest?.resolved.fx).toBeNull();
  });

  it("an untouched empty field follows a late-loading profile", () => {
    const { rerender } = render(<Harness />);
    mockPref.mockReturnValue(USD_PREF);
    rerender(<Harness />);
    expect(screen.getByLabelText("Mata uang")).toHaveValue("USD");
  });

  it("an unsupported profile currency falls back to IDR", () => {
    mockPref.mockReturnValue({ ...USD_PREF, currency: "GBP" });
    render(<Harness />);
    expect(screen.getByLabelText("Mata uang")).toHaveValue("IDR");
  });

  it("defaults to IDR for an IDR-display user, groups digits like before, and shows no rate line", async () => {
    render(<Harness />);
    expect(screen.getByLabelText("Mata uang")).toHaveValue("IDR");
    await userEvent.type(screen.getByLabelText("Jumlah"), "1250000");
    expect(screen.getByLabelText("Jumlah")).toHaveValue("1.250.000");
    expect(screen.queryByText(/ECB/)).toBeNull();
    expect(latest?.resolved.fx).toBeNull();
    expect(mockFx).not.toHaveBeenCalledWith(true);
  });

  it("USD: shows the IDR preview, the ECB rate line and the server note", async () => {
    render(<Harness />);
    await userEvent.selectOptions(screen.getByLabelText("Mata uang"), "USD");
    await userEvent.type(screen.getByLabelText("Jumlah"), "1250,50");
    expect(screen.getByLabelText("Jumlah")).toHaveValue("1.250,50");
    expect(screen.getByText("≈ Rp 22.401.332")).toBeInTheDocument();
    expect(
      screen.getByText("1 USD = Rp 17.913,90 · ECB 25 Sep 2026"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Nilai rupiah final dihitung server saat disimpan."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Disimpan sebagai IDR, ditampilkan dalam IDR."),
    ).toBeInTheDocument();
    expect(latest?.resolved.fx).toEqual({ currency: "USD", amount: "1250.50" });
  });

  it("labels a stale rate", async () => {
    mockFx.mockReturnValue({
      data: { ...TEST_FX_RATES, stale: true, rateDate: "2026-09-24" },
      isError: false,
    });
    render(<Harness />);
    await userEvent.selectOptions(screen.getByLabelText("Mata uang"), "SGD");
    expect(
      screen.getByText(/Kurs terakhir tersedia 24 Sep 2026/),
    ).toBeInTheDocument();
  });

  it("labels an indicative rate", async () => {
    mockFx.mockReturnValue({
      data: { ...TEST_FX_RATES, source: "indicative", stale: true },
      isError: false,
    });
    render(<Harness />);
    await userEvent.selectOptions(screen.getByLabelText("Mata uang"), "EUR");
    expect(screen.getByText(/Kurs indikatif/)).toBeInTheDocument();
  });

  it("while the rate is loading, shows it and marks the value pending", async () => {
    mockFx.mockReturnValue({ data: undefined, isError: false });
    render(<Harness />);
    await userEvent.selectOptions(screen.getByLabelText("Mata uang"), "USD");
    await userEvent.type(screen.getByLabelText("Jumlah"), "5");
    expect(screen.getByText("Memuat kurs…")).toBeInTheDocument();
    expect(latest?.resolved.isPending).toBe(true);
  });

  it("shows an error when the rate cannot be loaded", async () => {
    mockFx.mockReturnValue({ data: undefined, isError: true });
    render(<Harness />);
    await userEvent.selectOptions(screen.getByLabelText("Mata uang"), "USD");
    expect(screen.getByRole("alert")).toHaveTextContent("Kurs tidak tersedia");
  });

  it("switching to JPY reformats the typed value without decimals", async () => {
    render(<Harness />);
    await userEvent.selectOptions(screen.getByLabelText("Mata uang"), "USD");
    await userEvent.type(screen.getByLabelText("Jumlah"), "1500,5");
    await userEvent.selectOptions(screen.getByLabelText("Mata uang"), "JPY");
    expect(screen.getByLabelText("Jumlah")).toHaveValue("15.005");
  });

  it("allowNegative keeps a leading minus in a foreign currency", async () => {
    render(<Harness allowNegative />);
    await userEvent.selectOptions(screen.getByLabelText("Mata uang"), "USD");
    await userEvent.type(screen.getByLabelText("Jumlah"), "-20");
    expect(latest?.resolved.idrPreview).toBe(-358_278n);
  });

  it("an IDR amount (edit prefill) shows the display-currency hint for a USD-display user", () => {
    mockPref.mockReturnValue(USD_PREF);
    render(<EditHarness />);
    expect(
      screen.getByText("≈ $ 100.00 (mata uang tampilan)"),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `apps/web`): `pnpm exec jest src/components/money`
Expected: FAIL with `Cannot find module './money-format'` / `'./money-input'`.

- [ ] **Step 3a: i18n**

In `apps/web/src/i18n/types.ts`, after the `crud: { … };` block (the last member, before the closing `};` of the type), add:

```ts
money: {
  currencyLabel: string;
  convertedIdr: string;
  convertedDisplay: string;
  rateLine: string;
  rateStale: string;
  rateIndicative: string;
  rateLoading: string;
  rateUnavailable: string;
  serverNote: string;
  rateNotReady: string;
  storedAsIdr: string;
}
```

In `apps/web/src/i18n/id.ts`, after the `crud: { … },` block (before `} satisfies I18nDictionary;`), add:

```ts
  money: {
    currencyLabel: "Mata uang",
    convertedIdr: "≈ {amount}",
    convertedDisplay: "≈ {amount} (mata uang tampilan)",
    rateLine: "1 {code} = Rp {rate} · ECB {date}",
    rateStale:
      "Kurs terakhir tersedia {date}: 1 {code} = Rp {rate}. Penyedia kurs sedang tidak bisa dihubungi.",
    rateIndicative: "Kurs indikatif, bukan kurs pasar: 1 {code} = Rp {rate}",
    rateLoading: "Memuat kurs…",
    rateUnavailable: "Kurs tidak tersedia. Pilih IDR atau coba lagi.",
    serverNote: "Nilai rupiah final dihitung server saat disimpan.",
    rateNotReady: "Tunggu kurs selesai dimuat sebelum menyimpan.",
    storedAsIdr: "Disimpan sebagai IDR, ditampilkan dalam {display}.",
  },
```

In `apps/web/src/i18n/en.ts`, same position:

```ts
  money: {
    currencyLabel: "Currency",
    convertedIdr: "≈ {amount}",
    convertedDisplay: "≈ {amount} (display currency)",
    rateLine: "1 {code} = Rp {rate} · ECB {date}",
    rateStale:
      "Last available rate {date}: 1 {code} = Rp {rate}. The rate provider is currently unreachable.",
    rateIndicative: "Indicative rate, not a market rate: 1 {code} = Rp {rate}",
    rateLoading: "Loading rate…",
    rateUnavailable: "Rate unavailable. Choose IDR or try again.",
    serverNote: "The final rupiah value is computed by the server when you save.",
    rateNotReady: "Wait for the exchange rate to load before saving.",
    storedAsIdr: "Stored as IDR, shown in {display}.",
  },
```

Another sub-plan may be editing the i18n files on this branch. Rebase first, then add the block at the end of each file so the diffs don't overlap.

- [ ] **Step 3b: Pure helpers**

Create `apps/web/src/components/money/money-format.ts`:

```ts
import {
  convertToIdr,
  formatScaled,
  type FxCurrencyCode,
  type FxRatesResponse,
} from "@wealthme/contracts";

import { formatRupiah } from "@/lib/format";

/** Live id-ID formatting while typing: "." thousands, "," decimals (at most `decimals`). */
export function formatMoneyTyping(
  raw: string,
  decimals: number,
  allowNegative = false,
): string {
  const negative = allowNegative && raw.trim().startsWith("-");
  const commaAt = raw.indexOf(",");
  const hasComma = decimals > 0 && commaAt !== -1;
  const intSource = hasComma ? raw.slice(0, commaAt) : raw;
  const frac = hasComma
    ? raw
        .slice(commaAt + 1)
        .replace(/\D/g, "")
        .slice(0, decimals)
    : "";
  const intDigits = intSource.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  if (!intDigits && !hasComma) return negative ? "-" : "";
  const grouped = (intDigits || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negative ? "-" : ""}${grouped}${hasComma ? `,${frac}` : ""}`;
}

export function toCanonicalAmount(display: string): string | null {
  const negative = display.trim().startsWith("-");
  const [intPart = "", fracPart = ""] = display.split(",");
  const intDigits = intPart.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  const frac = fracPart.replace(/\D/g, "");
  if (!intDigits && !frac) return null;
  const body = frac ? `${intDigits || "0"}.${frac}` : intDigits || "0";
  return negative ? `-${body}` : body;
}

export function canonicalToTyping(
  canonical: string,
  decimals: number,
  allowNegative = false,
): string {
  return formatMoneyTyping(
    canonical.replace(".", ","),
    decimals,
    allowNegative,
  );
}

export function idrPreview(
  canonical: string | null,
  currency: FxCurrencyCode,
  rates: FxRatesResponse | undefined,
  targetScale: 0 | 2,
): bigint | null {
  if (canonical === null) return null;
  const idrPerUnit = currency === "IDR" ? "1" : rates?.idrPerUnit[currency];
  if (!idrPerUnit) return null;
  try {
    return convertToIdr({
      amount: canonical,
      currency,
      idrPerUnit,
      targetScale,
    });
  } catch {
    // Unparseable while typing (e.g. "1,") simply has no preview yet.
    return null;
  }
}

export function formatIdrPreview(value: bigint, scale: 0 | 2): string {
  if (scale === 0) return formatRupiah(Number(value));
  const [intPart, frac] = formatScaled(value, 2).split(".");
  return `Rp ${Number(intPart).toLocaleString("id-ID")},${frac}`;
}

export function formatRatePerUnit(idrPerUnit: string): string {
  return Number(idrPerUnit).toLocaleString("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatRateDate(rateDate: string, locale: string): string {
  return new Date(`${rateDate}T00:00:00.000Z`).toLocaleDateString(
    locale === "en" ? "en-GB" : "id-ID",
    { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" },
  );
}
```

`formatIdrPreview(-5n, 2)` yields `"Rp -0,05"` because `Number("-0")` groups as `"0"`. Only cash balances can be negative, and they use scale 0, so this edge is unreachable.

Create `apps/web/src/components/money/use-fx-snapshot.ts`:

```ts
"use client";

import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";

import type { FxRatesResponse } from "@wealthme/contracts";

const FX_STALE_TIME_MS = 60 * 60 * 1000;

/** Same key as useCurrencyPreference, so one cached /fx/rates serves both. */
export function useFxSnapshot(enabled: boolean) {
  return useQuery<FxRatesResponse>({
    queryKey: ["fx", "rates", "IDR"],
    queryFn: () => apiFetch<FxRatesResponse>("/fx/rates?base=IDR"),
    staleTime: FX_STALE_TIME_MS,
    enabled,
  });
}
```

Create `apps/web/src/components/money/use-money-field.ts`:

```ts
"use client";

import { useMemo, useState } from "react";
import {
  FX_CURRENCY_DECIMALS,
  isFxCurrency,
  type ForeignFxCurrencyCode,
  type FxCurrencyCode,
  type FxRatesResponse,
} from "@wealthme/contracts";

import { useCurrencyPreference } from "@/hooks/use-currency-preference";

import {
  formatMoneyTyping,
  idrPreview,
  toCanonicalAmount,
} from "./money-format";
import { useFxSnapshot } from "./use-fx-snapshot";

export interface ResolvedMoney {
  canonical: string | null;
  idrPreview: bigint | null;
  isPending: boolean;
  fx: { currency: ForeignFxCurrencyCode; amount: string } | null;
}

export interface MoneyField {
  raw: string;
  currency: FxCurrencyCode;
  decimals: number;
  allowNegative: boolean;
  idrScale: 0 | 2;
  setRaw: (next: string) => void;
  setCurrency: (next: FxCurrencyCode) => void;
  reset: (raw?: string) => void;
  resolved: ResolvedMoney;
  rates: FxRatesResponse | undefined;
  isRateError: boolean;
}

interface ControlledArgs {
  raw: string;
  /** null = not chosen yet: follow the user's display currency until the first edit. */
  currency: FxCurrencyCode | null;
  onChange: (next: { raw: string; currency: FxCurrencyCode }) => void;
  allowNegative?: boolean;
  idrScale?: 0 | 2;
}

function decimalsFor(currency: FxCurrencyCode, idrScale: 0 | 2): number {
  return currency === "IDR" ? idrScale : FX_CURRENCY_DECIMALS[currency];
}

export function useDefaultMoneyCurrency(): FxCurrencyCode {
  const { currency } = useCurrencyPreference();
  return isFxCurrency(currency) ? currency : "IDR";
}

export function useControlledMoneyField({
  raw,
  currency: chosen,
  onChange,
  allowNegative = false,
  idrScale = 0,
}: ControlledArgs): MoneyField {
  const fallback = useDefaultMoneyCurrency();
  const currency = chosen ?? fallback;
  const isForeign = currency !== "IDR";
  const { data: rates, isError } = useFxSnapshot(isForeign);
  const decimals = decimalsFor(currency, idrScale);

  const resolved = useMemo<ResolvedMoney>(() => {
    const canonical = toCanonicalAmount(raw);
    const preview = idrPreview(canonical, currency, rates, idrScale);
    return {
      canonical,
      idrPreview: preview,
      isPending: isForeign && canonical !== null && preview === null,
      fx:
        isForeign && canonical !== null
          ? { currency: currency as ForeignFxCurrencyCode, amount: canonical }
          : null,
    };
  }, [raw, currency, rates, idrScale, isForeign]);

  return {
    raw,
    currency,
    decimals,
    allowNegative,
    idrScale,
    resolved,
    rates: isForeign ? rates : undefined,
    isRateError: isForeign && isError,
    // Any edit latches the effective currency (Decision 12).
    setRaw: (next) =>
      onChange({
        raw: formatMoneyTyping(next, decimals, allowNegative),
        currency,
      }),
    setCurrency: (next) =>
      onChange({
        raw: formatMoneyTyping(raw, decimalsFor(next, idrScale), allowNegative),
        currency: next,
      }),
    reset: (next = "") =>
      onChange({
        raw: formatMoneyTyping(
          next,
          decimalsFor("IDR", idrScale),
          allowNegative,
        ),
        currency: "IDR",
      }),
  };
}

export function useMoneyField(
  options: {
    initialRaw?: string;
    isEdit?: boolean;
    allowNegative?: boolean;
    idrScale?: 0 | 2;
  } = {},
): MoneyField {
  const {
    initialRaw,
    isEdit = false,
    allowNegative = false,
    idrScale = 0,
  } = options;
  // null = "not chosen yet, follow the display currency"; edit forms / stored IDR prefills pin IDR (Decision 9).
  const [state, setState] = useState<{
    raw: string;
    currency: FxCurrencyCode | null;
  }>(() => ({
    raw: formatMoneyTyping(initialRaw ?? "", idrScale, allowNegative),
    currency: initialRaw || isEdit ? "IDR" : null,
  }));
  const field = useControlledMoneyField({
    ...state,
    onChange: setState,
    allowNegative,
    idrScale,
  });
  return {
    ...field,
    reset: (next) =>
      setState(
        next
          ? {
              raw: formatMoneyTyping(next, idrScale, allowNegative),
              currency: "IDR",
            }
          : { raw: "", currency: null },
      ),
  };
}
```

Create `apps/web/src/components/money/fx-inputs.ts`:

```ts
import { formatScaled, type FxInput } from "@wealthme/contracts";

import type { MoneyField } from "./use-money-field";

/** Legacy IDR number: the exact old parse for IDR, the (informational) preview for a foreign currency. */
export function moneyIdr(
  field: MoneyField,
  parseIdr: (raw: string) => number,
): number {
  if (field.currency === "IDR") return parseIdr(field.raw);
  return field.resolved.idrPreview === null
    ? 0
    : Number(field.resolved.idrPreview);
}

export function moneyIdrString(
  field: MoneyField,
  parseIdr: (raw: string) => number,
): string {
  return String(moneyIdr(field, parseIdr));
}

/** Digit-string wire value: IDR → the old strip (keeping "-" only when allowed); foreign → the preview. */
export function moneyDigits(field: MoneyField): string {
  if (field.currency === "IDR") {
    return field.raw.replace(field.allowNegative ? /[^-\d]/g : /\D/g, "");
  }
  return field.resolved.idrPreview === null
    ? ""
    : field.resolved.idrPreview.toString();
}

/** decimal2 fields (investment unit prices): canonical rupiah with sen. */
export function moneyIdrDecimal(
  field: MoneyField,
  idrCanonical: () => string,
): string {
  if (field.currency === "IDR") return idrCanonical();
  return field.resolved.idrPreview === null
    ? "0"
    : formatScaled(field.resolved.idrPreview, 2);
}

export function withFxInputs<T extends object>(
  body: T,
  entries: ReadonlyArray<readonly [string, MoneyField | null | undefined]>,
): T {
  const fxInputs: FxInput[] = entries.flatMap(([field, money]) =>
    money?.resolved.fx ? [{ field, ...money.resolved.fx }] : [],
  );
  return fxInputs.length > 0 ? { ...body, fxInputs } : body;
}

export function anyMoneyPending(
  ...fields: ReadonlyArray<MoneyField | null | undefined>
): boolean {
  return fields.some((f) => !!f?.resolved.isPending);
}
```

- [ ] **Step 3c: Component + barrel**

Create `apps/web/src/components/money/money-input.tsx`:

```tsx
"use client";

import { CURRENCIES, type CurrencyCode } from "@/hooks/currencies";
import { useCurrencyPreference } from "@/hooks/use-currency-preference";
import { useLocale } from "@/hooks/use-locale";
import { cn } from "@/lib/utils";

import {
  formatIdrPreview,
  formatRateDate,
  formatRatePerUnit,
} from "./money-format";

import type { MoneyField } from "./use-money-field";

export interface MoneyInputProps {
  field: MoneyField;
  id?: string;
  ariaLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  inputClassName?: string;
}

export function MoneyInput({
  field,
  id,
  ariaLabel,
  placeholder = "0",
  disabled,
  inputClassName,
}: MoneyInputProps) {
  const { t } = useLocale();
  const inputMode = field.allowNegative
    ? "text"
    : field.decimals > 0
      ? "decimal"
      : "numeric";
  return (
    <div className="grid gap-1">
      <div className="flex gap-2">
        <select
          className="select w-[96px] shrink-0"
          aria-label={t.money.currencyLabel}
          value={field.currency}
          disabled={disabled}
          onChange={(e) => field.setCurrency(e.target.value as CurrencyCode)}
        >
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {`${c.flag} ${c.code}`}
            </option>
          ))}
        </select>
        <input
          id={id}
          aria-label={ariaLabel}
          className={cn("input mono min-w-0 flex-1", inputClassName)}
          inputMode={inputMode}
          placeholder={placeholder}
          value={field.raw}
          disabled={disabled}
          onChange={(e) => field.setRaw(e.target.value)}
        />
      </div>
      <MoneyHint field={field} />
    </div>
  );
}

function MoneyHint({ field }: { field: MoneyField }) {
  const { t, locale } = useLocale();
  const pref = useCurrencyPreference();
  const { resolved, currency, rates } = field;
  const displayHint =
    pref.isIndicative &&
    pref.isReady &&
    pref.currency !== currency &&
    resolved.idrPreview !== null
      ? t.money.convertedDisplay.replace(
          "{amount}",
          pref.formatMoney(Number(resolved.idrPreview) / 10 ** field.idrScale),
        )
      : null;

  if (currency === "IDR") {
    return displayHint ? <p className="t-xs t-muted">{displayHint}</p> : null;
  }
  if (field.isRateError) {
    return (
      <p className="t-xs text-destructive" role="alert">
        {t.money.rateUnavailable}
      </p>
    );
  }
  if (!rates) return <p className="t-xs t-muted">{t.money.rateLoading}</p>;

  const template =
    rates.source === "indicative"
      ? t.money.rateIndicative
      : rates.stale
        ? t.money.rateStale
        : t.money.rateLine;
  const rateText = template
    .replace("{code}", currency)
    .replace("{rate}", formatRatePerUnit(rates.idrPerUnit[currency] ?? "0"))
    .replace("{date}", formatRateDate(rates.rateDate, locale));

  return (
    <div className="t-xs t-muted" aria-live="polite">
      {resolved.idrPreview !== null && (
        <p className="t-bold">
          {t.money.convertedIdr.replace(
            "{amount}",
            formatIdrPreview(resolved.idrPreview, field.idrScale),
          )}
        </p>
      )}
      {displayHint && <p>{displayHint}</p>}
      <p>{rateText}</p>
      <p>{t.money.serverNote}</p>
      <p>{t.money.storedAsIdr.replace("{display}", pref.currency)}</p>
    </div>
  );
}
```

Create `apps/web/src/components/money/index.ts`:

```ts
export { MoneyInput } from "./money-input";
export type { MoneyInputProps } from "./money-input";
export {
  useDefaultMoneyCurrency,
  useMoneyField,
  useControlledMoneyField,
} from "./use-money-field";
export type { MoneyField, ResolvedMoney } from "./use-money-field";
export { useFxSnapshot } from "./use-fx-snapshot";
export {
  canonicalToTyping,
  formatIdrPreview,
  formatMoneyTyping,
  idrPreview,
  toCanonicalAmount,
} from "./money-format";
export {
  anyMoneyPending,
  moneyDigits,
  moneyIdr,
  moneyIdrDecimal,
  moneyIdrString,
  withFxInputs,
} from "./fx-inputs";
export { TEST_FX_RATES } from "./fx-test-rates";
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from `apps/web`): `pnpm exec jest src/components/money src/hooks/currencies.test.ts`
Expected: PASS. Every test in the two new files is green, and `currencies.test.ts` stays green.

Run (from `apps/web`): `pnpm exec tsc --noEmit`
Expected: exit 0. In particular, both `id.ts` and `en.ts` still `satisfies I18nDictionary`.

- [ ] **Step 5: Lint**

Run (from `apps/web`): `pnpm exec eslint src/components/money src/i18n/types.ts src/i18n/id.ts src/i18n/en.ts`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/money apps/web/src/i18n/types.ts apps/web/src/i18n/id.ts apps/web/src/i18n/en.ts
git commit -m "$(cat <<'EOF'
feat(web): MoneyInput with currency select, IDR preview and rate label

Amount + currency select. A foreign amount shows its IDR preview (same
BigInt rounding as the server, from @wealthme/contracts), the ECB rate
and date, a stale/indicative label, and the display-currency hint.
withFxInputs leaves IDR bodies untouched.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8a: Web — universal CRUD engine (`crud-modal` / `crud-config`) and its callers (akun, dana, rekening, quickinput, tujuan)

**Files:**

- Create: `apps/web/src/components/crud/crud-money.ts`
- Test: `apps/web/src/components/crud/crud-money.test.ts`
- Modify: `apps/web/src/components/crud/crud-modal.tsx` (`initialFieldValues` :71, `handleSave` :166, amount branch :242-256), `apps/web/src/components/crud/crud-config.ts` (tujuan `autodebit.helper`), `apps/web/src/components/crud/index.ts`
- Modify callers:
  - `apps/web/src/app/(app)/akun/page.tsx` (`handleCrudSubmit` ~3096-3125)
  - `apps/web/src/app/(app)/dana/page.tsx` (`handleSubmit` ~412-440)
  - `apps/web/src/app/(app)/rekening/page.tsx` (`handleSubmit` 577-640)
  - `apps/web/src/app/(app)/quickinput/page.tsx` (`buildRequest` 201-290, `handleSubmit` 326-345)
  - `apps/web/src/app/(app)/tujuan/page.tsx` (`handleSubmit` 457-510)
- Test: `apps/web/src/components/crud/crud-modal.test.tsx`, `apps/web/src/app/(app)/dana/dana.test.tsx`, `apps/web/src/app/(app)/rekening/rekening.test.tsx`

**Interfaces:**

- Consumes: Task 7 `@/components/money` (incl. `useDefaultMoneyCurrency`, `useControlledMoneyField`).
- Produces:
  - In CrudModal `values`, each amount field `k` gains a companion `values[`${k}\_\_currency`]`. It is set on the user's first keystroke or currency pick (latching). While it is absent, the field's effective currency is the **fallback**: `"IDR"` in edit mode (Decision 9), the user's display currency in add mode (Decision 12).
  - `normalizeCrudMoney(fields: CrudField[], values: Record<string, string>, rates: FxRatesResponse | undefined, fallbackCurrency: FxCurrencyCode): { values: Record<string, string>; pending: boolean }` runs just before `onSubmit`. For a foreign field it rewrites `values[k]` to the id-ID-formatted IDR **preview**, so every caller's existing `parseRupiah(values.k)` keeps working unchanged, and it adds `values[`${k}\_\_fx`] = JSON.stringify({ currency, amount })`. IDR fields are untouched.
  - `withCrudFx<T extends object>(body: T, values: Record<string, string>, map: Record<string, string | readonly string[]>): T` returns the same object when no mapped field is foreign.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/components/crud/crud-money.test.ts`:

```ts
import { TEST_FX_RATES } from "@/components/money";

import { CRUD_CONFIG } from "./crud-config";
import { normalizeCrudMoney, withCrudFx } from "./crud-money";

describe("normalizeCrudMoney — revisi I", () => {
  const fields = CRUD_CONFIG.cash.fields;

  it("leaves IDR values byte-identical", () => {
    const values = { nama: "Kas", saldo: "-250.000", ownerUserId: "" };
    const out = normalizeCrudMoney(fields, values, undefined, "IDR");
    expect(out).toEqual({ values, pending: false });
    expect(out.values).toBe(values);
  });

  it("rewrites a foreign amount to its IDR preview and records the original", () => {
    const out = normalizeCrudMoney(
      fields,
      { nama: "Dompet", saldo: "-20", saldo__currency: "USD", ownerUserId: "" },
      TEST_FX_RATES,
      "IDR",
    );
    expect(out.pending).toBe(false);
    expect(out.values.saldo).toBe("-358.278");
    expect(JSON.parse(out.values.saldo__fx ?? "")).toEqual({
      currency: "USD",
      amount: "-20",
    });
  });

  it("is pending when a foreign rate is not loaded", () => {
    expect(
      normalizeCrudMoney(
        fields,
        { nama: "D", saldo: "5", saldo__currency: "USD" },
        undefined,
        "IDR",
      ).pending,
    ).toBe(true);
  });

  it("an amount with no __currency key uses the fallback (a USD-display user's add form)", () => {
    const out = normalizeCrudMoney(
      fields,
      { nama: "D", saldo: "100" },
      TEST_FX_RATES,
      "USD",
    );
    expect(out.values.saldo).toBe("1.791.390");
    expect(JSON.parse(out.values.saldo__fx ?? "")).toEqual({
      currency: "USD",
      amount: "100",
    });
  });

  it("edit mode's IDR fallback leaves an untouched prefill byte-identical for a USD-display user", () => {
    const values = { nama: "D", saldo: "1.791.390" };
    expect(
      normalizeCrudMoney(fields, values, TEST_FX_RATES, "IDR").values,
    ).toBe(values);
  });
});

describe("withCrudFx — revisi I", () => {
  it("returns the same body when nothing is foreign", () => {
    const body = { balance: 5 };
    expect(withCrudFx(body, { saldo: "5" }, { saldo: "balance" })).toBe(body);
  });

  it("maps one form key to one or more API fields", () => {
    const values = {
      total: "1.791.390",
      total__fx: JSON.stringify({ currency: "USD", amount: "100.00" }),
    };
    expect(
      withCrudFx({ totalDebt: "1791390" }, values, {
        total: ["totalDebt", "remainingBalance"],
      }),
    ).toEqual({
      totalDebt: "1791390",
      fxInputs: [
        { field: "totalDebt", currency: "USD", amount: "100.00" },
        { field: "remainingBalance", currency: "USD", amount: "100.00" },
      ],
    });
  });
});
```

Append to `apps/web/src/components/crud/crud-modal.test.tsx` with this fx mock at module level:

```ts
jest.mock("@/components/money/use-fx-snapshot", () => ({
  useFxSnapshot: (enabled: boolean) => ({
    data: enabled
      ? jest.requireActual("@/components/money/fx-test-rates").TEST_FX_RATES
      : undefined,
    isError: false,
  }),
}));
```

Also add a module-level preference mock, defaulting to IDR so every pre-existing test keeps its behaviour:

```ts
const mockPref = jest.fn();
jest.mock("@/hooks/use-currency-preference", () => ({
  useCurrencyPreference: () => mockPref(),
}));
const IDR_PREF = {
  currency: "IDR",
  isIndicative: false,
  isReady: true,
  formatMoney: String,
};
const USD_PREF = {
  currency: "USD",
  isIndicative: true,
  isReady: true,
  formatMoney: String,
};
beforeEach(() => mockPref.mockReturnValue(IDR_PREF));
```

**Every other web test file touched in Tasks 8a–10b** must pin the display currency to IDR so the default is deterministic. Add `jest.mock("@/hooks/use-currency-preference", () => ({ useCurrencyPreference: () => ({ currency: "IDR", isIndicative: false, isReady: true, formatMoney: String }) }))` unless the file already mocks it or mocks `/auth/profile` without a `currency`.

New tests:

```tsx
it("revisi I — an amount field offers a currency select and hands the normalized IDR + __fx to onSubmit", async () => {
  const onSubmit = jest.fn().mockResolvedValue(undefined);
  render(
    <CrudModal
      state={{ entity: "rekening", mode: "add" }}
      onClose={() => {}}
      onSubmit={onSubmit}
    />,
  );
  await userEvent.selectOptions(screen.getByLabelText("Mata uang"), "USD");
  await userEvent.type(screen.getByLabelText("Saldo Saat Ini"), "100");
  await userEvent.click(screen.getByRole("button", { name: /simpan/i }));
  const values = onSubmit.mock.calls[0][2];
  expect(values.saldo).toBe("1.791.390");
  expect(JSON.parse(values.saldo__fx)).toEqual({
    currency: "USD",
    amount: "100",
  });
});

it("revisi I — a USD-display user's new account opens on USD", async () => {
  mockPref.mockReturnValue(USD_PREF);
  const onSubmit = jest.fn().mockResolvedValue(undefined);
  render(
    <CrudModal
      state={{ entity: "rekening", mode: "add" }}
      onClose={() => {}}
      onSubmit={onSubmit}
    />,
  );
  expect(screen.getByLabelText("Mata uang")).toHaveValue("USD");
  await userEvent.type(screen.getByLabelText("Saldo Saat Ini"), "100");
  await userEvent.click(screen.getByRole("button", { name: /simpan/i }));
  expect(JSON.parse(onSubmit.mock.calls[0][2].saldo__fx)).toEqual({
    currency: "USD",
    amount: "100",
  });
});

it("revisi I — a USD-display user's edit form opens on IDR and sends no fxInputs", async () => {
  mockPref.mockReturnValue(USD_PREF);
  const onSubmit = jest.fn().mockResolvedValue(undefined);
  render(
    <CrudModal
      state={{
        entity: "rekening",
        mode: "edit",
        initialValues: { nama: "BCA", saldo: "5000000" },
      }}
      onClose={() => {}}
      onSubmit={onSubmit}
    />,
  );
  expect(screen.getByLabelText("Mata uang")).toHaveValue("IDR");
  await userEvent.click(screen.getByRole("button", { name: /simpan/i }));
  expect(onSubmit.mock.calls[0][2]).not.toHaveProperty("saldo__fx");
  expect(onSubmit.mock.calls[0][2].saldo).toBe("5.000.000");
});

it("revisi I — IDR amounts reach onSubmit exactly as typed (no __fx key)", async () => {
  const onSubmit = jest.fn().mockResolvedValue(undefined);
  render(
    <CrudModal
      state={{ entity: "rekening", mode: "add" }}
      onClose={() => {}}
      onSubmit={onSubmit}
    />,
  );
  await userEvent.type(screen.getByLabelText("Saldo Saat Ini"), "5000000");
  await userEvent.click(screen.getByRole("button", { name: /simpan/i }));
  const values = onSubmit.mock.calls[0][2];
  expect(values.saldo).toBe("5.000.000");
  expect(values).not.toHaveProperty("saldo__fx");
});
```

If the file's `render` helper wraps providers, use it instead of RTL's `render`. The `"picks the tujuan deadline…"` test (:237) shows the call shape.

Append to `apps/web/src/app/(app)/dana/dana.test.tsx`. Arrange as in `"submits a new cash account as type 'cash' via the accounts API"` (:169), and add the fx mock at module level:

```ts
it("revisi I — a negative USD cash balance posts the preview + fxInputs", async () => {
  // Arrange: open the add-cash form exactly as in the :169 test, type the name.
  await userEvent.selectOptions(screen.getByLabelText("Mata uang"), "USD");
  await userEvent.type(screen.getByLabelText("Saldo Saat Ini"), "-20");
  // Act: click Simpan as in :169.
  const post = mockApiFetch.mock.calls.find(
    ([url, init]) =>
      String(url).endsWith("/accounts") && init?.method === "POST",
  );
  expect(JSON.parse(post![1].body)).toMatchObject({
    type: "cash",
    balance: -358_278,
    fxInputs: [{ field: "balance", currency: "USD", amount: "-20" }],
  });
});
```

Append to `apps/web/src/app/(app)/rekening/rekening.test.tsx`. Arrange as in `"edits an account whose bank was added in Master Data…"` (:270):

```ts
it("revisi I — editing a saved account without touching the amount sends no fxInputs", async () => {
  // Arrange/Act: open the edit form and save as in :270 without touching Saldo.
  const patch = mockApiFetch.mock.calls.find(
    ([, init]) => init?.method === "PATCH",
  );
  expect(JSON.parse(patch![1].body)).not.toHaveProperty("fxInputs");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `apps/web`): `pnpm exec jest src/components/crud "src/app/\(app\)/(dana|rekening)"`
Expected: FAIL. `crud-money` is missing, there is no "Mata uang" select, and bodies lack `fxInputs`. The rekening edit test may already pass; it guards the behaviour.

- [ ] **Step 3a: `crud-money.ts`**

Create `apps/web/src/components/crud/crud-money.ts`:

```ts
import {
  formatMoneyTyping,
  idrPreview,
  toCanonicalAmount,
} from "@/components/money";
import {
  isFxCurrency,
  type FxCurrencyCode,
  type FxInput,
  type FxRatesResponse,
} from "@wealthme/contracts";

import type { CrudField } from "./crud-config";

export const currencyKey = (key: string) => `${key}__currency`;
const fxKey = (key: string) => `${key}__fx`;

export function normalizeCrudMoney(
  fields: readonly CrudField[],
  values: Record<string, string>,
  rates: FxRatesResponse | undefined,
  fallbackCurrency: FxCurrencyCode,
): { values: Record<string, string>; pending: boolean } {
  let next = values;
  let pending = false;
  for (const f of fields) {
    if (f.type !== "amount") continue;
    const currency = values[currencyKey(f.key)] ?? fallbackCurrency;
    if (currency === "IDR" || !isFxCurrency(currency)) continue;
    const canonical = toCanonicalAmount(values[f.key] ?? "");
    if (canonical === null) continue;
    const preview = idrPreview(canonical, currency, rates, 0);
    if (preview === null) {
      pending = true;
      continue;
    }
    next = {
      ...next,
      [f.key]: formatMoneyTyping(preview.toString(), 0, f.allowNegative),
      [fxKey(f.key)]: JSON.stringify({ currency, amount: canonical }),
    };
  }
  return { values: next, pending };
}

export function withCrudFx<T extends object>(
  body: T,
  values: Record<string, string>,
  map: Record<string, string | readonly string[]>,
): T {
  const fxInputs: FxInput[] = Object.entries(map).flatMap(
    ([formKey, apiFields]) => {
      const raw = values[fxKey(formKey)];
      if (!raw) return [];
      const { currency, amount } = JSON.parse(raw) as Omit<FxInput, "field">;
      return (typeof apiFields === "string" ? [apiFields] : apiFields).map(
        (field) => ({ field, currency, amount }),
      );
    },
  );
  return fxInputs.length > 0 ? { ...body, fxInputs } : body;
}
```

Add to `apps/web/src/components/crud/index.ts`:

```ts
export { normalizeCrudMoney, withCrudFx } from "./crud-money";
```

- [ ] **Step 3b: CrudModal**

In `crud-modal.tsx`:

1. Add imports:

   ```ts
   import {
     MoneyInput,
     useControlledMoneyField,
     useDefaultMoneyCurrency,
     useFxSnapshot,
   } from "@/components/money";
   import { currencyKey, normalizeCrudMoney } from "./crud-money";
   import type { FxCurrencyCode } from "@wealthme/contracts";
   ```

2. In `CrudForm`, after `const [isSaving, setIsSaving] = useState(false);`, add:

   ```ts
   const displayCurrency = useDefaultMoneyCurrency();
   // Decision 9/12: an untouched field is IDR on edit, the display currency on add.
   const fallbackCurrency: FxCurrencyCode =
     state.mode === "edit" ? "IDR" : displayCurrency;
   const hasForeignAmount = config.fields.some(
     (f) =>
       f.type === "amount" &&
       (values[currencyKey(f.key)] ?? fallbackCurrency) !== "IDR",
   );
   const { data: fxRates } = useFxSnapshot(hasForeignAmount);
   ```

3. In `handleSave`, replace `await onSubmit(state.entity, state.mode, values);` with:

   ```ts
   const normalized = normalizeCrudMoney(
     config.fields,
     values,
     fxRates,
     fallbackCurrency,
   );
   if (normalized.pending) {
     toast.error(t.money.rateNotReady);
     return;
   }
   await onSubmit(state.entity, state.mode, normalized.values);
   ```

   The early `return` sits inside the existing `try`, so `finally` still resets `isSaving`.

4. Replace the `if (f.type === "amount") { … return (<input … />); }` branch with:

   ```tsx
   if (f.type === "amount") {
     return (
       <CrudAmountControl
         id={`crud-${state.entity}-${f.key}`}
         field={f}
         raw={values[f.key] ?? ""}
         currency={
           (values[currencyKey(f.key)] as FxCurrencyCode | undefined) ??
           (state.mode === "edit" ? "IDR" : null)
         }
         ariaLabel={labelOverrides?.[f.key] ?? f.label}
         onChange={(next) =>
           setValues((prev) => ({
             ...prev,
             [f.key]: next.raw,
             [currencyKey(f.key)]: next.currency,
           }))
         }
       />
     );
   }
   ```

5. At the end of the file, add:

   ```tsx
   function CrudAmountControl({
     id,
     field,
     raw,
     currency,
     ariaLabel,
     onChange,
   }: {
     id: string;
     field: CrudField;
     raw: string;
     currency: FxCurrencyCode | null;
     ariaLabel: string;
     onChange: (next: { raw: string; currency: FxCurrencyCode }) => void;
   }) {
     const money = useControlledMoneyField({
       raw,
       currency,
       onChange,
       allowNegative: field.allowNegative,
     });
     return <MoneyInput field={money} id={id} ariaLabel={ariaLabel} />;
   }
   ```

   In `renderField`, give `amount` fields the same explicit `htmlFor` pairing the `date` branch uses: `<label className="label" htmlFor={`crud-${state.entity}-${f.key}`}>` beside the control, not wrapping it. Otherwise a wrapping `<label>` would associate with the currency `<select>` (its first labelable descendant). `getByLabelText("Saldo Saat Ini")` then resolves to the amount text input.

`initialFieldValues` is unchanged. An edit prefill has no `__currency` key and its fallback is IDR, so an untouched edit never converts, even for a USD-display user (Decision 9). An add form's fields follow the display currency until touched (Decision 12).

In `crud-config.ts`, tujuan `autodebit.helper`: add as its first line

```ts
if ([v.target__currency, v.terkumpul__currency].some((c) => c && c !== "IDR"))
  return null;
```

The "Saran …/bulan" hint parses IDR digits, so it is hidden rather than wrong while a foreign amount is being typed.

- [ ] **Step 3c: CrudModal callers**

Each caller wraps the body it already builds. Import `withCrudFx` from `@/components/crud`.

- `akun/page.tsx` (`handleCrudSubmit`, the POST `/accounts` body built around :3122): `body: JSON.stringify(withCrudFx({ …existing fields…, balance: parseRupiah(values.saldo ?? "0") }, values, { saldo: "balance" }))`.
- `dana/page.tsx` (`handleSubmit` :412; both the POST and the PATCH body built around :425): wrap each body object with `withCrudFx(<body>, values, { saldo: "balance" })`.
- `rekening/page.tsx`:
  - cash-edit PATCH (:596): `body: JSON.stringify(withCrudFx({ name: values.nama, balance, type: "cash" }, values, { saldo: "balance" }))`.
  - the general POST/PATCH bodies below it: the same `withCrudFx(<body>, values, { saldo: "balance" })`.
- `tujuan/page.tsx` (`handleSubmit`): wrap the final `outgoing` object before `JSON.stringify` as `withCrudFx(outgoing, values, { target: "targetAmount", terkumpul: "currentAmount", autodebit: "autoDebitAmount" })`.
- `quickinput/page.tsx`:
  - In `buildRequest`, wrap each entity's body with its map:

    | Entity             | Map                                                                                    |
    | ------------------ | -------------------------------------------------------------------------------------- |
    | rekening / ewallet | `{ saldo: "balance" }`                                                                 |
    | aset               | `{ nilai: "currentValue" }`                                                            |
    | liabilitas         | `{ total: ["totalDebt", "remainingBalance"], cicilan: "minimumPayment" }`              |
    | asuransi           | `{ premi: "premiumAmount", pertanggungan: "coverageAmount" }`                          |
    | tujuan             | `{ target: "targetAmount", terkumpul: "currentAmount", autodebit: "autoDebitAmount" }` |

  - **Fix the pre-existing double encoding.** `buildGoalBody` (protected `lib/goals-utils.ts`) already returns a JSON **string**, and `handleSubmit` :338 stringifies it again. In the tujuan branch of `buildRequest`, return `body: withCrudFx(JSON.parse(buildGoalBody(…)) as Record<string, unknown>, v, {…})`, so every branch returns an object and the single `JSON.stringify` at :338 is correct.

- [ ] **Step 4: Run tests to verify they pass**

Run (from `apps/web`): `pnpm exec jest src/components/crud src/components/money "src/app/\(app\)/(dana|rekening|tujuan|akun|quickinput)"`
Expected: PASS. New tests are green and pre-existing test counts are unchanged. Existing tests that type into "Saldo Saat Ini" still pass, because IDR typing is byte-identical.

Run (from `apps/web`): `pnpm exec tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Lint**

Run (from `apps/web`): `pnpm exec eslint src/components/crud "src/app/(app)/akun/page.tsx" "src/app/(app)/dana/page.tsx" "src/app/(app)/rekening/page.tsx" "src/app/(app)/quickinput/page.tsx" "src/app/(app)/tujuan/page.tsx"`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/crud "apps/web/src/app/(app)/akun/page.tsx" "apps/web/src/app/(app)/dana" "apps/web/src/app/(app)/rekening" "apps/web/src/app/(app)/quickinput/page.tsx" "apps/web/src/app/(app)/tujuan/page.tsx"
git commit -m "$(cat <<'EOF'
feat(web): pick a currency on every CRUD amount field

CrudModal amount fields render MoneyInput (display currency on add, IDR
on edit) and hand callers an IDR preview plus the original, so
parseRupiah call sites stay unchanged; callers add fxInputs only for
foreign fields. Also fixes quickinput's double-encoded goal body.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8b: Web — transaction dialog (granted exception) + `/akun` gold price & member threshold

**Files:**

- Modify (granted exception, minimal): `apps/web/src/components/shell/transaction-dialog.tsx`, at lines `:91-108` (local input types), `:194`, `:496`, `:659`, `:704-770` and `:884-891`
- Modify: `apps/web/src/app/(app)/akun/page.tsx`
  - `PengaturanBody`: `goldPriceInput` state (~:1203), `saveGoldPrice` (~:1290-1302), and the gold-price `<input>` under `t.akun.pengaturan.goldPriceLabel` (~:1388)
  - `ThresholdForm`: `amount` state (~:2685), the PATCH (~:2694-2701), and `#threshold-amount` (~:2725)
- Modify: `apps/web/src/hooks/use-gold-price.ts` (not protected): the `updateGoldPrice` mutation (~:60-66)
- Test: `apps/web/src/components/shell/transaction-dialog.test.tsx`, `apps/web/src/app/(app)/akun/family-allowance-threshold.test.tsx`, `apps/web/src/app/(app)/akun/pengaturan-body.test.tsx`

**Interfaces:**

- Consumes: Task 7 `@/components/money`; Task 5 API fields (`pricePerGram`, `largeTxnThreshold`).
- Ordering: independent of Task 8a in logic. Both touch `akun/page.tsx`, in disjoint functions, so run them one after the other, not in parallel.
- Produces:
  - In the transaction dialog, `amount` state becomes `amountField: MoneyField`. `adminFee` stays IDR (Decision 11).
  - `useGoldPrice().updateGoldPrice` accepts `number | { pricePerGram: number; fxInputs?: FxInput[] }`. A plain number keeps today's body `{ pricePerGram }` byte-for-byte.

Every test file touched here also pins the display currency to IDR (Task 8a's note).

- [ ] **Step 1: Write the failing tests**

Append to `apps/web/src/components/shell/transaction-dialog.test.tsx`. Mock the snapshot at module level, next to the file's existing `jest.mock` calls:

```ts
jest.mock("@/components/money/use-fx-snapshot", () => ({
  useFxSnapshot: (enabled: boolean) => ({
    data: enabled
      ? jest.requireActual("@/components/money/fx-test-rates").TEST_FX_RATES
      : undefined,
    isError: false,
  }),
}));
```

Then add two tests, whose arrange steps are copied from the existing test `"uploads the picked file to the newly created transaction after a successful save"` (:417). They open the dialog on the expense tab and pick the account.

```ts
it("revisi I — IDR submit sends the same body as before (no fxInputs)", async () => {
  // Arrange: as in the ":417 uploads the picked file…" test, up to the account pick.
  await userEvent.type(
    screen.getByLabelText(idDict.shell.transactionDialog.amountLabel),
    "250000",
  );
  await userEvent.click(
    screen.getByRole("button", {
      name: idDict.shell.transactionDialog.saveButton,
    }),
  );
  const post = mockApiFetch.mock.calls.find(([url]) =>
    String(url).endsWith("/transactions"),
  );
  const body = JSON.parse(post![1].body);
  expect(body.amount).toBe(250_000);
  expect(body).not.toHaveProperty("fxInputs");
});

it("revisi I — a USD amount sends the preview + fxInputs", async () => {
  // Arrange: as above.
  await userEvent.selectOptions(
    screen.getByLabelText(idDict.money.currencyLabel),
    "USD",
  );
  await userEvent.type(
    screen.getByLabelText(idDict.shell.transactionDialog.amountLabel),
    "10",
  );
  await userEvent.click(
    screen.getByRole("button", {
      name: idDict.shell.transactionDialog.saveButton,
    }),
  );
  const post = mockApiFetch.mock.calls.find(([url]) =>
    String(url).endsWith("/transactions"),
  );
  expect(JSON.parse(post![1].body)).toMatchObject({
    amount: 179_139,
    fxInputs: [{ field: "amount", currency: "USD", amount: "10" }],
  });
});
```

`saveButton` stands for whatever key the existing test uses for the Simpan button. Copy it from the `:417` test; do not invent a key.

Append to `apps/web/src/app/(app)/akun/family-allowance-threshold.test.tsx`. Arrange as in `"submitting a positive value PATCHes largeTxnThreshold as that integer"`, adding the fx mock at module level:

```ts
  it("revisi I — a threshold typed in SGD PATCHes the preview + fxInputs", async () => {
    const user = userEvent.setup();
    renderWithClient(
      <ThresholdForm member={{ ...MEMBER, largeTxnThreshold: null }} familyGroupId={FAMILY_GROUP_ID} token={TOKEN} onClose={onClose} />,
      queryClient,
    );
    await user.selectOptions(screen.getByLabelText("Mata uang"), "SGD");
    await user.type(screen.getByLabelText(t.thresholdLabel), "100");
    await user.click(screen.getByRole("button", { name: t.thresholdSaveButton }));
    const patch = mockApiFetch.mock.calls.find(([, i]) => i?.method === "PATCH");
    expect(JSON.parse(patch![1].body)).toMatchObject({
      largeTxnThreshold: 1_402_679,
      fxInputs: [{ field: "largeTxnThreshold", currency: "SGD", amount: "100" }],
    });
  });

  it("revisi I — an existing IDR threshold opens on IDR and saves without fxInputs", async () => {
    const user = userEvent.setup();
    renderWithClient(
      <ThresholdForm member={MEMBER} familyGroupId={FAMILY_GROUP_ID} token={TOKEN} onClose={onClose} />,
      queryClient,
    );
    expect(screen.getByLabelText("Mata uang")).toHaveValue("IDR");
    await user.click(screen.getByRole("button", { name: t.thresholdSaveButton }));
    const patch = mockApiFetch.mock.calls.find(([, i]) => i?.method === "PATCH");
    expect(JSON.parse(patch![1].body)).not.toHaveProperty("fxInputs");
  });
```

The file's existing `mockApiFetch` implementation must use the name the file already declares.

Append to `apps/web/src/app/(app)/akun/pengaturan-body.test.tsx`. Render as the file's existing tests do, with the family's `myRole` set to `"owner"` so the gold-price field shows (`isGoldPriceOwner`); reuse the file's family-groups mock if it has one:

```ts
it("revisi I — gold price typed in USD per gram PATCHes the preview + fxInputs", async () => {
  await userEvent.selectOptions(
    within(
      screen
        .getByText(idDict.akun.pengaturan.goldPriceLabel)
        .closest(".field")!,
    ).getByLabelText("Mata uang"),
    "USD",
  );
  await userEvent.type(
    screen.getByLabelText(idDict.akun.pengaturan.goldPriceLabel),
    "100",
  );
  await userEvent.click(
    screen.getByRole("button", {
      name: idDict.akun.pengaturan.goldPriceSaveButton,
    }),
  );
  const patch = mockApiFetch.mock.calls.find(
    ([url, i]) => String(url).endsWith("/gold-price") && i?.method === "PATCH",
  );
  expect(JSON.parse(patch![1].body)).toEqual({
    pricePerGram: 1_791_390,
    fxInputs: [{ field: "pricePerGram", currency: "USD", amount: "100" }],
  });
});
```

`goldPriceSaveButton` stands for whatever key the save button next to the gold-price input actually uses. Read it from `akun/page.tsx`; do not invent a key. The gold-price `<Field>` must pair its label with the amount input (Step 3b), so `getByLabelText(goldPriceLabel)` resolves to the text input.

- [ ] **Step 2: Run tests to verify they fail**

Run (from `apps/web`): `pnpm exec jest src/components/shell/transaction-dialog.test.tsx "src/app/\(app\)/akun/(family-allowance-threshold|pengaturan-body)"`
Expected: FAIL. There is no "Mata uang" select, and bodies lack `fxInputs`.

- [ ] **Step 3a: Transaction dialog (granted exception, minimal)**

In `components/shell/transaction-dialog.tsx`:

1. Imports. Add `import { MoneyInput, moneyIdr, useMoneyField, withFxInputs } from "@/components/money";` and `import type { FxInput } from "@wealthme/contracts";`. Leave `formatAmountInput` imported only if `adminFee` still uses it, which it does.
2. Add `fxInputs?: FxInput[];` to both local types, `CreateTransactionInput` (:91) and `PurchaseLiabilityInput` (:104).
3. Replace `const [amount, setAmount] = useState("");` with `const amountField = useMoneyField();`.
4. Replace `setAmount("");` in `resetForm` with `amountField.reset();`.
5. Replace `setAmount(formatAmountInput(String(Math.round(scanResult.amount))));` with `amountField.reset(String(Math.round(scanResult.amount)));`.
6. In `saveTxn`, replace `const amountNum = parseRupiah(amount);` with:

   ```ts
   if (amountField.resolved.isPending) {
     toast.error(t.money.rateNotReady);
     return;
   }
   const amountNum = moneyIdr(amountField, parseRupiah);
   ```

7. Wrap the purchase payload as `purchaseMutation.mutate(withFxInputs({ amount: String(amountNum), … }, [["amount", amountField]]), {…})`.
8. Wrap the create payload as `createMutation.mutate(withFxInputs({ accountId, … }, [["amount", amountField]]), {…})`.
9. Replace the `<input id={amountFieldId} … />` at :884-891 with:

   ```tsx
   <MoneyInput field={amountField} id={amountFieldId} placeholder="250.000" />
   ```

   The surrounding `<Field label=… htmlFor={amountFieldId}>` keeps the label association.

No other line in this protected file changes. The admin-fee input and its `Rp` adornment stay as they are.

- [ ] **Step 3b: `/akun` gold price + member threshold**

`hooks/use-gold-price.ts`: change the mutation to accept both call shapes:

```ts
  const { mutate: updateGoldPrice, isPending: isUpdating } = useMutation({
    mutationFn: (input: number | { pricePerGram: number; fxInputs?: FxInput[] }) =>
      apiFetch<GoldPriceDto>(`/family-groups/${familyGroupId}/gold-price`, {
        method: "PATCH",
        token,
        body: JSON.stringify(typeof input === "number" ? { pricePerGram: input } : input),
      }),
```

`onSuccess` is unchanged. Import the type with `import type { FxInput } from "@wealthme/contracts";`.

In `akun/page.tsx` `PengaturanBody`:

- Replace `const [goldPriceInput, setGoldPriceInput] = useState("");` with `const goldPriceField = useMoneyField();`. The field is never prefilled, so it opens on the display currency (Decision 12). The value is still stored as IDR per gram.
- `saveGoldPrice`:

  ```ts
  function saveGoldPrice() {
    if (goldPriceField.resolved.isPending) {
      toast.error(t.money.rateNotReady);
      return;
    }
    const parsed = moneyIdr(goldPriceField, parseRupiah);
    if (!parsed || parsed <= 0) {
      toast.error(t.akun.pengaturan.toastGoldPriceInvalid);
      return;
    }
    updateGoldPrice(
      withFxInputs({ pricePerGram: parsed }, [
        ["pricePerGram", goldPriceField],
      ]),
      {
        onSuccess: () => {
          goldPriceField.reset();
          toast.success(t.akun.pengaturan.toastGoldPriceUpdated);
        },
        onError: () => toast.error(t.akun.pengaturan.toastGoldPriceFailed),
      },
    );
  }
  ```

- JSX: in the `<Field label={t.akun.pengaturan.goldPriceLabel}>` row, replace the `<input … value={goldPriceInput} …>` with `<MoneyInput field={goldPriceField} id="gold-price" placeholder={t.akun.pengaturan.goldPricePlaceholder} />`. Give that `Field` `htmlFor="gold-price"` if its API supports it; otherwise pass `ariaLabel={t.akun.pengaturan.goldPriceLabel}` to `MoneyInput`.
- The IDR path sends `{ pricePerGram }`, identical to today.

In `ThresholdForm`:

- `const amountField = useMoneyField({ initialRaw: member.largeTxnThreshold ?? "" });`
  - A saved threshold opens on IDR (Decision 9).
  - An unset one follows the display currency (Decision 12).
- In the save handler: add the pending guard (`amountField.resolved.isPending` → `toast.error(t.money.rateNotReady)` and return), then `const parsed = moneyIdr(amountField, parseRupiah);`. The body becomes:

  ```ts
  body: JSON.stringify(
    parsed > 0
      ? withFxInputs({ role: member.role, largeTxnThreshold: parsed }, [["largeTxnThreshold", amountField]])
      : { role: member.role, largeTxnThreshold: null },
  ),
  ```

  Clearing (empty or 0) still sends `null`, never `fxInputs`.

- `#threshold-amount` becomes `<MoneyInput field={amountField} id="threshold-amount" />`, keeping its `<label htmlFor="threshold-amount">` and hint.

- [ ] **Step 4: Run tests to verify they pass**

Run (from `apps/web`): `pnpm exec jest src/components/shell/transaction-dialog.test.tsx src/hooks/use-gold-price.test.ts "src/app/\(app\)/akun"`
Expected: PASS. New tests are green and pre-existing counts are unchanged.

Run (from `apps/web`): `pnpm exec tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Lint**

Run (from `apps/web`): `pnpm exec eslint src/components/shell/transaction-dialog.tsx src/hooks/use-gold-price.ts "src/app/(app)/akun/page.tsx"`
Expected: exit 0.

Run: `git diff --stat -- apps/web/src/components/shell/`
Expected: only `transaction-dialog.tsx` changed, and its diff touches only the lines listed in Step 3a.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/shell/transaction-dialog.tsx apps/web/src/components/shell/transaction-dialog.test.tsx apps/web/src/hooks/use-gold-price.ts "apps/web/src/app/(app)/akun"
git commit -m "$(cat <<'EOF'
feat(web): currency picker on the transaction dialog, gold price and member threshold

The transaction dialog swaps just its amount input (granted exception);
the admin fee stays IDR. /akun gold price per gram and the member
large-transaction threshold send fxInputs only for a foreign currency;
clearing the threshold still sends null.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Web — holdings pages (investasi "Record Investment" + buy/sell + manual price, laporan investment dialog, aset, aset history, asuransi, liabilitas)

**Files:**

- Modify: `apps/web/src/app/(app)/investasi/page.tsx`. Touch points:
  - form state (:172-182, :529-554)
  - submit (:636-644, :685-697)
  - cost-basis input (:960-988)
  - manual-price input (:1111-1122)
  - `BuySellModal` (:1212, :1263, :1383-1391)
- Modify: `apps/web/src/app/(app)/laporan/_components/laporan-inner.tsx` (:286-315) and `apps/web/src/app/(app)/laporan/_components/investment-dialogs.tsx` (:135-160)
- Modify: `apps/web/src/app/(app)/aset/page.tsx` (:202-218, :286-325, :405-420, :490-500)
- Modify: `apps/web/src/app/(app)/aset/[id]/page.tsx` (`AddHistoryDialog` :376-460)
- Modify: `apps/web/src/app/(app)/asuransi/page.tsx` (:578-590, :656-712, :806-850)
- Modify: `apps/web/src/app/(app)/liabilitas/page.tsx`. **This runs only after sub-plan G's final fix wave has merged.** It is anchored on field labels and element ids (Step 3e), never on line numbers.
- Test:
  - `apps/web/src/app/(app)/investasi/investasi.test.tsx`
  - `apps/web/src/app/(app)/aset/aset.test.tsx`
  - `apps/web/src/app/(app)/asuransi/asuransi.test.tsx`
  - `apps/web/src/app/(app)/liabilitas/liabilitas.test.tsx`
  - `apps/web/src/app/(app)/laporan/laporan-balance.test.tsx`

**Interfaces:**

- Consumes: Task 7 (`useMoneyField`, `useControlledMoneyField`, `MoneyInput`, `moneyDigits`, `moneyIdrDecimal`, `withFxInputs`, `anyMoneyPending`, `canonicalToTyping`, `toCanonicalAmount`); Task 6 API fields (`costBasisPerUnit`/`price`/`pricePerUnit` decimal2; asset `currentValue`/`valueChangeAmount`/history `value`; insurance `premiumAmount`/`coverageAmount`; liability `totalDebt`/`remainingBalance`/`minimumPayment`/`installmentAmount`/pay `amount`).
- Produces: nothing new for later tasks.

Every page applies the same pattern:

1. Replace the page's raw amount `useState("")` with `useMoneyField({ initialRaw, isEdit: !!editing })`. `initialRaw` is the value the page prefilled before.
   - Edit forms open on IDR (Decision 9).
   - Add forms open on the user's display currency (Decision 12).
   - Use `useControlledMoneyField` when the raw string lives inside a form object. Its currency state starts as `editing ? "IDR" : null`.
2. Replace the `<input>` with `<MoneyInput field={…} id={<same id>} placeholder={<same placeholder>} />`. Keep the existing `<label htmlFor>`.
3. In submit, block while `anyMoneyPending(...)` is true (`toast.error(t.money.rateNotReady)`). Then build the legacy value with `moneyDigits(field)` for digit-string fields, or `moneyIdrDecimal` for the three price fields, and wrap the body with `withFxInputs(body, [[apiField, field], …])`.

- [ ] **Step 1: Write the failing tests**

Add the fx mock at module level to each of the five test files:

```ts
jest.mock("@/components/money/use-fx-snapshot", () => ({
  useFxSnapshot: (enabled: boolean) => ({
    data: enabled
      ? jest.requireActual("@/components/money/fx-test-rates").TEST_FX_RATES
      : undefined,
    isError: false,
  }),
}));
```

`investasi.test.tsx`. Arrange as in `"offers the add/edit/delete affordances to a role with CASL's manage Investment"` (:211), then open the add modal:

```ts
it("revisi I — Record Investment in USD sends the IDR unit price with sen + fxInputs", async () => {
  // Arrange: as in :211, click the add button, fill ticker/name/quantity as the existing add test does.
  await userEvent.selectOptions(
    within(
      screen
        .getByLabelText(idDict.investasi.fieldCostBasisLabel)
        .closest(".field")!,
    ).getByLabelText("Mata uang"),
    "USD",
  );
  await userEvent.type(
    screen.getByLabelText(idDict.investasi.fieldCostBasisLabel),
    "12,34",
  );
  // Act: submit.
  const post = mockApiFetch.mock.calls.find(
    ([url, init]) =>
      String(url).endsWith("/investments") && init?.method === "POST",
  );
  expect(JSON.parse(post![1].body)).toMatchObject({
    costBasisPerUnit: "221057.52",
    fxInputs: [{ field: "costBasisPerUnit", currency: "USD", amount: "12.34" }],
  });
});

it("revisi I — buy/sell price in USD sends pricePerUnit with sen + fxInputs", async () => {
  // Arrange: open the Beli dialog as in "shows buy/sell history quantities in the instrument's unit" (:305).
  await userEvent.selectOptions(
    screen.getAllByLabelText("Mata uang").at(-1)!,
    "USD",
  );
  await userEvent.type(
    screen.getByLabelText(idDict.investasi.buySellFieldPriceLabel),
    "99,99",
  );
  // Act: submit.
  const post = mockApiFetch.mock.calls.find(([url]) =>
    String(url).endsWith("/transactions"),
  );
  expect(JSON.parse(post![1].body)).toMatchObject({
    pricePerUnit: "1791210.85",
    fxInputs: [{ field: "pricePerUnit", currency: "USD", amount: "99.99" }],
  });
});
```

`aset.test.tsx`. Arrange as in `"submits fixed mode with a signed valueChangeAmount instead of valueChangeRatePct"` (:313):

```ts
it("revisi I — CNY value and a negative JPY change post previews + fxInputs", async () => {
  // Arrange: as in :313 (fixed mode).
  const [valueCur, changeCur] = screen.getAllByLabelText("Mata uang");
  await userEvent.selectOptions(valueCur!, "CNY");
  await userEvent.clear(screen.getByLabelText(idDict.aset.fieldValueLabel));
  await userEvent.type(
    screen.getByLabelText(idDict.aset.fieldValueLabel),
    "5000",
  );
  await userEvent.selectOptions(changeCur!, "JPY");
  await userEvent.clear(
    screen.getByLabelText(idDict.aset.fieldValueChangeAmountLabel),
  );
  await userEvent.type(
    screen.getByLabelText(idDict.aset.fieldValueChangeAmountLabel),
    "-1000",
  );
  // Act: submit as in :313.
  const body = JSON.parse(
    mockApiFetch.mock.calls.find(([, i]) => i?.method === "POST")![1].body,
  );
  expect(body).toMatchObject({
    currentValue: "13342229",
    valueChangeAmount: "-113674",
    fxInputs: [
      { field: "currentValue", currency: "CNY", amount: "5000" },
      { field: "valueChangeAmount", currency: "JPY", amount: "-1000" },
    ],
  });
});

it("revisi I — the IDR create body is unchanged (no fxInputs)", async () => {
  // Arrange/Act: exactly "includes acquisitionDate in the create POST body when set" (:279).
  const body = JSON.parse(
    mockApiFetch.mock.calls.find(([, i]) => i?.method === "POST")![1].body,
  );
  expect(body).not.toHaveProperty("fxInputs");
});
```

`asuransi.test.tsx`. Arrange as in `"warns (but still saves) when total allocation is under 100%"` (:197):

```ts
it("revisi I — AUD premium posts the preview + fxInputs; coverage in IDR stays plain", async () => {
  // Arrange: as in :197 up to the premium field.
  await userEvent.selectOptions(
    screen.getAllByLabelText("Mata uang")[0]!,
    "AUD",
  );
  await userEvent.clear(
    screen.getByLabelText(idDict.asuransi.fieldPremiumLabel),
  );
  await userEvent.type(
    screen.getByLabelText(idDict.asuransi.fieldPremiumLabel),
    "1200",
  );
  await userEvent.type(
    screen.getByLabelText(idDict.asuransi.fieldCoverageLabel),
    "100000000",
  );
  // Act: save as in :197.
  const body = JSON.parse(
    mockApiFetch.mock.calls.find(([, i]) => i?.method === "POST")![1].body,
  );
  expect(body).toMatchObject({
    premiumAmount: "15112617",
    coverageAmount: "100000000",
    fxInputs: [{ field: "premiumAmount", currency: "AUD", amount: "1200" }],
  });
});
```

`liabilitas.test.tsx`. Arrange as in `"pays: submitting a valid amount + source account POSTs to /:id/pay"` (:362) and `"kendaraan: flat rate + tenor + start date…"` (:460):

```ts
it("revisi I — pay in SGD posts the preview + fxInputs", async () => {
  // Arrange: as in :362 up to the amount field.
  await userEvent.selectOptions(
    screen.getAllByLabelText("Mata uang").at(-1)!,
    "SGD",
  );
  await userEvent.clear(
    screen.getByLabelText(idDict.liabilitas.payAmountLabel),
  );
  await userEvent.type(
    screen.getByLabelText(idDict.liabilitas.payAmountLabel),
    "1500,25",
  );
  // Act: submit as in :362.
  const pay = mockApiFetch.mock.calls.find(([url]) =>
    String(url).endsWith("/pay"),
  );
  expect(JSON.parse(pay![1].body)).toMatchObject({
    amount: "21043698",
    fxInputs: [{ field: "amount", currency: "SGD", amount: "1500.25" }],
  });
});

it("revisi I — an IDR liability save sends no fxInputs", async () => {
  // Arrange/Act: exactly the :460 kendaraan test.
  const post = mockApiFetch.mock.calls.find(
    ([url, i]) => String(url).endsWith("/liabilities") && i?.method === "POST",
  );
  expect(JSON.parse(post![1].body)).not.toHaveProperty("fxInputs");
});
```

`laporan-balance.test.tsx` (the laporan investment dialog). Arrange with the file's existing laporan render helper, then open the add-investment dialog:

```ts
it("revisi I — laporan add-investment in EUR sends costBasisPerUnit with sen + fxInputs", async () => {
  // Arrange: render laporan, open the add-investment dialog, fill ticker/name/quantity.
  await userEvent.selectOptions(screen.getByLabelText("Mata uang"), "EUR");
  await userEvent.type(
    screen.getByLabelText(idDict.investasi.fieldCostBasisLabel),
    "10",
  );
  // Act: submit.
  const post = mockApiFetch.mock.calls.find(
    ([url, i]) => String(url).endsWith("/investments") && i?.method === "POST",
  );
  expect(JSON.parse(post![1].body)).toMatchObject({
    costBasisPerUnit: "204272.20",
    fxInputs: [{ field: "costBasisPerUnit", currency: "EUR", amount: "10" }],
  });
});
```

The `investment-dialogs.tsx` cost-basis `<label>` gains `htmlFor="laporan-cost-basis"` (Step 3b), so `getByLabelText` resolves it.

- [ ] **Step 2: Run tests to verify they fail**

Run (from `apps/web`): `pnpm exec jest "src/app/\(app\)/(investasi|aset|asuransi|liabilitas|laporan)"`
Expected: the new `revisi I` tests FAIL because no "Mata uang" select exists. The two IDR-unchanged tests may already pass, since they guard current behaviour.

- [ ] **Step 3a: investasi**

In `AddInvestmentModal`:

```ts
// null = follow the display currency until touched (add); edit opens on IDR (Decision 9/12).
const [costCurrency, setCostCurrency] = useState<FxCurrencyCode | null>(
  editing ? "IDR" : null,
);
const [priceCurrency, setPriceCurrency] = useState<FxCurrencyCode | null>(null);
const isKripto = form.type === "kripto";
const costField = useControlledMoneyField({
  raw: form.costBasisPerUnit,
  currency: costCurrency,
  idrScale: isKripto ? 2 : 0,
  onChange: ({ raw, currency }) => {
    setForm((f) => ({ ...f, costBasisPerUnit: raw }));
    setCostCurrency(currency);
  },
});
const manualPriceField = useControlledMoneyField({
  raw: form.manualPrice,
  currency: priceCurrency,
  idrScale: 2,
  onChange: ({ raw, currency }) => {
    setForm((f) => ({ ...f, manualPrice: raw }));
    setPriceCurrency(currency);
  },
});
```

- Edit prefill (:529-533): for kripto, replace `editing.costBasisPerUnit` with `canonicalToTyping(editing.costBasisPerUnit, 2)`. Kripto is now typed id-ID style (`12.345,67`), and the wire value is the same canonical `"12345.67"` as before.
- Submit (:640-643):

  ```ts
  if (anyMoneyPending(costField, manualPriceField)) {
    toast.error(t.money.rateNotReady);
    return;
  }
  // …
  body["costBasisPerUnit"] = moneyIdrDecimal(costField, () =>
    isKripto
      ? (toCanonicalAmount(form.costBasisPerUnit) ?? "0")
      : String(parseRupiah(form.costBasisPerUnit)),
  );
  ```

  The pending check goes at the top of the submit handler. Change `body`'s type from `Record<string, string>` to `Record<string, unknown>`, and send `JSON.stringify(isEditingLots ? body : withFxInputs(body, [["costBasisPerUnit", costField]]))`.

- Manual price (:693): `JSON.stringify(withFxInputs({ price: moneyIdrDecimal(manualPriceField, () => String(parseRupiah(form.manualPrice))), …asOf }, [["price", manualPriceField]]))`.
- JSX: replace the cost-basis `<input id="costBasisPerUnit" …>` with `<MoneyInput field={costField} id="costBasisPerUnit" disabled={isEditingLots} placeholder={isDeposito ? t.investasi.fieldDepositoNominalPlaceholder : t.investasi.fieldCostBasisPlaceholder} />`. Replace the manual-price `<input id="manualPrice" …>` with `<MoneyInput field={manualPriceField} id="manualPrice" />`. Drop the now-unused `handleChange` branch for kripto cost basis only if nothing else uses it.

In `BuySellModal`, replace `const [pricePerUnit, setPricePerUnit] = useState("");` with `const priceField = useMoneyField({ idrScale: holding?.type === "kripto" ? 2 : 0 });`.

- Submit: add `if (priceField.resolved.isPending) { toast.error(t.money.rateNotReady); return; }`. The body becomes:

  ```ts
  withFxInputs(
    {
      type: txType,
      quantity: canonicalQuantity,
      pricePerUnit: moneyIdrDecimal(priceField, () =>
        holding.type === "kripto"
          ? (toCanonicalAmount(priceField.raw) ?? "0")
          : String(parseRupiah(priceField.raw)),
      ),
      occurredAt: new Date(occurredAt).toISOString(),
      accountId: accountId || undefined,
    },
    [["pricePerUnit", priceField]],
  );
  ```

  This also fixes the pre-existing loss of kripto decimals on this field.

- JSX: `<MoneyInput field={priceField} id="tx-price" />`.
- Any other read of `pricePerUnit` (e.g. a total preview) uses `Number(moneyIdrDecimal(priceField, () => String(parseRupiah(priceField.raw))))`.

- [ ] **Step 3b: laporan investment dialog**

In `laporan-inner.tsx`, next to `invForm`:

```ts
const [invCostCurrency, setInvCostCurrency] = useState<FxCurrencyCode | null>(
  null,
);
const invCostField = useControlledMoneyField({
  raw: invForm.costBasisPerUnit,
  currency: invCostCurrency,
  idrScale: 2,
  onChange: ({ raw, currency }) => {
    setInvForm((f) => ({ ...f, costBasisPerUnit: raw }));
    setInvCostCurrency(currency);
  },
});
```

- `openEdit` calls `setInvCostCurrency("IDR")` (Decision 9). The add-reset calls `setInvCostCurrency(null)`, which follows the display currency (Decision 12).
- `handleInvSubmit`: block on `invCostField.resolved.isPending`. The body becomes `withFxInputs({ ...invForm, costBasisPerUnit: moneyIdrDecimal(invCostField, () => String(parseRupiah(invForm.costBasisPerUnit))) }, [["costBasisPerUnit", invCostField]])`.
- Pass `invCostField` to the dialog as a new prop, `costBasisField: MoneyField`.

In `investment-dialogs.tsx`, render the loop's `costBasisPerUnit` entry as `<MoneyInput field={costBasisField} id="laporan-cost-basis" />` with `<label htmlFor="laporan-cost-basis">`. `quantity` stays as it is.

- [ ] **Step 3c: aset + aset/[id]**

In `aset/page.tsx`:

```ts
const valueField = useMoneyField({
  initialRaw: editing ? BigInt(editing.currentValue).toString() : "",
  isEdit: !!editing,
});
const changeField = useMoneyField({
  initialRaw: editing?.valueChangeAmount
    ? BigInt(editing.valueChangeAmount).toString()
    : "",
  isEdit: !!editing,
  allowNegative: true,
});
```

- The projection preview (:286-298) uses `moneyDigits(valueField)` in place of `value.replace(/\D/g, "")`, and `moneyDigits(changeField)` in place of `valueChangeAmount.replace(/[^-\d]/g, "")`.
- `handleSubmit`: `const digits = moneyDigits(valueField);` and `const amountDigits = moneyDigits(changeField);`, with a pending guard `anyMoneyPending(valueField, changeField)`. Wrap the `mutation.mutate({...})` argument with `withFxInputs(<same object>, [["currentValue", valueField], ...(valueChangeMode === "fixed" ? [["valueChangeAmount", changeField] as const] : [])])`. Add `fxInputs?: FxInput[]` to the mutation's input type (:233-240).
- JSX: `<MoneyInput field={valueField} id="asset-value" placeholder={t.aset.fieldValuePlaceholder} />` and `<MoneyInput field={changeField} id="asset-value-change-amount" />`.

In `aset/[id]/page.tsx` `AddHistoryDialog`:

- `const valueField = useMoneyField();` replaces `value`.
- The body becomes `withFxInputs({ value: moneyDigits(valueField) }, [["value", valueField]])` in value mode.
- The validity check (:409-410) becomes `Number(moneyDigits(valueField) || "0") > 0 && !valueField.resolved.isPending`.
- JSX: `<MoneyInput field={valueField} id={`${fieldId}-value`} />`.

- [ ] **Step 3d: asuransi**

```ts
const premiumField = useMoneyField({
  initialRaw: editing ? BigInt(editing.premiumAmount).toString() : "",
  isEdit: !!editing,
});
const coverageField = useMoneyField({
  initialRaw: editing?.coverageAmount
    ? BigInt(editing.coverageAmount).toString()
    : "",
  isEdit: !!editing,
});
```

The edit prefill becomes dot-grouped as a side effect, which fixes the ungrouped prefill found in the inventory.

- `handleSave`: `const parsedPremium = Number(moneyDigits(premiumField) || "0");` plus the pending guard.
- In the dto: `premiumAmount: String(parsedPremium)` and `...(coverageField.raw && { coverageAmount: moneyDigits(coverageField) })`.
- Send `withFxInputs(dto, [["premiumAmount", premiumField], ["coverageAmount", coverageField.raw ? coverageField : null]])`, and add `fxInputs?` to the local `CreateInsuranceDto` type.
- JSX: `<MoneyInput field={premiumField} id="ins-premium" />` and `<MoneyInput field={coverageField} id="ins-coverage" />`.

- [ ] **Step 3e: liabilitas (runs only after sub-plan G has merged)**

Sub-plan G's final fix wave is rewriting `liabilitas/page.tsx` while this plan is written:

- the Pay dialog's principal/interest preview now comes from the server;
- `LiabilityDto` gains a field for the current installment.

So this step anchors on **field labels and element ids, never line numbers**. Before editing:

- rebase onto `development` with G merged;
- run `grep -n "fieldTotalDebtLabel\|fieldRemainingLabel\|fieldMinPaymentLabel\|fieldInstallmentLabel\|payAmountLabel\|liability-total-debt\|liability-remaining\|liability-min-payment\|liability-installment\|pay-liability-amount" "apps/web/src/app/(app)/liabilitas/page.tsx"`;
- read the liability form's submit handler and the pay mutation as G left them.

Then, for **each money `<input>` whose label is one of** `t.liabilitas.fieldTotalDebtLabel`, `fieldRemainingLabel`, `fieldMinPaymentLabel`, `fieldInstallmentLabel` (liability form) and `payAmountLabel` (pay dialog):

1. **State.** Replace its raw string state with a `MoneyField`:
   - Form fields: `useMoneyField({ initialRaw: <the digits the page prefilled before, or ""> , isEdit: <the form's edit flag> })`. Name them `totalDebtField`, `remainingField`, `minPaymentField` and `installmentField`. If G left the installment un-prefilled (placeholder only), keep `initialRaw: ""` with `isEdit`.
   - Pay dialog: `payField = useMoneyField()`, lifted to wherever G keeps the pay amount state. Every place that **prefills** the pay amount from stored IDR (preset chips, "use installment" / current-installment prefill from the new `LiabilityDto` field) calls `payField.reset(<same IDR digits>)`, which pins IDR (Decision 9).
2. **Input.** Swap the `<input>` for `<MoneyInput field={…} id={<same id>} />`, keeping its `<label htmlFor>`.
3. **Wire value.** Wherever the submit or pay body read that state through the page's digit helper, use `moneyDigits(<field>)`. Keep G's "omit when empty" / `"0"` rules exactly as they are.
4. **Body.** Wrap the liability body with `withFxInputs(body, [["totalDebt", totalDebtField], ["remainingBalance", remainingField], ["minimumPayment", minPaymentField], ["installmentAmount", installmentField]])`. Pass `null` for any field G's body omits in that branch. Wrap the pay body with `withFxInputs(<G's pay body>, [["amount", payField]])`.
5. **Server preview.** If G's server-computed pay preview is fetched from the typed amount, feed it `moneyDigits(payField)`. That is the IDR preview for a foreign amount, marked approximate by `MoneyInput`'s hint. Skip the fetch while `payField.resolved.isPending`.
6. **Pending guard.** Block both submits with `anyMoneyPending(...)` + `toast.error(t.money.rateNotReady)`.

Anything else on the page (schedule, method selector, rate fields) stays untouched.

- [ ] **Step 4: Run tests to verify they pass**

Run (from `apps/web`): `pnpm exec jest "src/app/\(app\)/(investasi|aset|asuransi|liabilitas|laporan)" src/components/money`
Expected: PASS. New tests are green and every pre-existing test in these folders stays green. IDR typing is unchanged; the only visible difference is the extra currency select.

Run (from `apps/web`): `pnpm exec tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Lint**

Run (from `apps/web`): `pnpm exec eslint "src/app/(app)/investasi/page.tsx" "src/app/(app)/laporan/_components/laporan-inner.tsx" "src/app/(app)/laporan/_components/investment-dialogs.tsx" "src/app/(app)/aset/page.tsx" "src/app/(app)/aset/[id]/page.tsx" "src/app/(app)/asuransi/page.tsx" "src/app/(app)/liabilitas/page.tsx"`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add "apps/web/src/app/(app)/investasi" "apps/web/src/app/(app)/laporan" "apps/web/src/app/(app)/aset" "apps/web/src/app/(app)/asuransi" "apps/web/src/app/(app)/liabilitas"
git commit -m "$(cat <<'EOF'
feat(web): currency picker on investments, assets, insurance and liabilities

Record Investment, buy/sell and manual price convert at sen precision
(also fixing dropped crypto decimals); asset value, value change and
history, insurance premium and coverage, liability terms and payments
send fxInputs only when a foreign currency is picked.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10a: Web — anggaran, tujuan contribute, minta dana, transaksi edit

**Files:**

- Modify: `apps/web/src/app/(app)/anggaran/page.tsx`
  - create: `amount` state, `#budget-amount` :1529, `handleCreate` :1088-1105, create `mutationFn` :902-970
  - edit: `editAmount`, `#budget-edit-amount` :1607, `openEdit` :1028, `handleSaveEdit` :1032-1045, update `mutationFn` :996-1010
- Modify: `apps/web/src/app/(app)/tujuan/_components/contribute-dialog.tsx` (:60-95, :113)
- Modify: `apps/web/src/components/allowance/minta-dana-dialog.tsx` (:81, :88-104, :153)
- Modify: `apps/web/src/app/(app)/transaksi/page.tsx` (`EditTransactionDialog` :1008-1050)
- Test:
  - `apps/web/src/app/(app)/anggaran/anggaran.test.tsx`
  - `apps/web/src/app/(app)/transaksi/edit-transaction-dialog.test.tsx`
  - new `apps/web/src/app/(app)/tujuan/_components/contribute-dialog.test.tsx`
  - new `apps/web/src/components/allowance/minta-dana-dialog.test.tsx`

**Interfaces:**

- Consumes: Task 7.
- Produces: nothing for later tasks.

- [ ] **Step 1: Write the failing tests**

Add this fx mock at module level to every test file below, and pin the display currency to IDR as described in Task 8a:

```ts
jest.mock("@/components/money/use-fx-snapshot", () => ({
  useFxSnapshot: (enabled: boolean) => ({
    data: enabled
      ? jest.requireActual("@/components/money/fx-test-rates").TEST_FX_RATES
      : undefined,
    isError: false,
  }),
}));
```

Create `apps/web/src/app/(app)/tujuan/_components/contribute-dialog.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { id as idDict } from "@/i18n/id";

import { ContributeDialog } from "./contribute-dialog";

import type { GoalDto } from "@wealthme/contracts";

const mockApiFetch = jest.fn();
jest.mock("@/lib/api-client", () => ({
  apiFetch: (...a: unknown[]) => mockApiFetch(...a),
}));
jest.mock("@/components/money/use-fx-snapshot", () => ({
  useFxSnapshot: (enabled: boolean) => ({
    data: enabled
      ? jest.requireActual("@/components/money/fx-test-rates").TEST_FX_RATES
      : undefined,
    isError: false,
  }),
}));
jest.mock("@/hooks/use-currency-preference", () => ({
  useCurrencyPreference: () => ({
    currency: "IDR",
    isIndicative: false,
    isReady: true,
    formatMoney: String,
  }),
}));
// Copy the PointerEvent polyfill block from src/components/crud/crud-modal.test.tsx (the "jsdom has no PointerEvent" block).

const goal = {
  id: "g-1",
  name: "Liburan",
  sourceAccountId: null,
} as unknown as GoalDto;

function renderDialog() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <ContributeDialog
        goal={goal}
        accounts={[]}
        familyGroupId="fg-1"
        token="tok"
        onClose={() => {}}
      />
    </QueryClientProvider>,
  );
}

describe("ContributeDialog — revisi I", () => {
  beforeEach(() =>
    mockApiFetch
      .mockReset()
      .mockResolvedValue({ contribution: { id: "gc-1" }, goal }),
  );

  it("IDR sends the same digit string as before and no fxInputs", async () => {
    renderDialog();
    await userEvent.type(
      screen.getByLabelText(idDict.tujuan.contributeAmountLabel),
      "250000",
    );
    await userEvent.click(
      screen.getByRole("button", { name: idDict.tujuan.contributeSubmit }),
    );
    const body = JSON.parse(mockApiFetch.mock.calls[0][1].body);
    expect(body.amount).toBe("250000");
    expect(body).not.toHaveProperty("fxInputs");
  });

  it("USD sends the preview + fxInputs", async () => {
    renderDialog();
    await userEvent.selectOptions(screen.getByLabelText("Mata uang"), "USD");
    await userEvent.type(
      screen.getByLabelText(idDict.tujuan.contributeAmountLabel),
      "10",
    );
    await userEvent.click(
      screen.getByRole("button", { name: idDict.tujuan.contributeSubmit }),
    );
    expect(JSON.parse(mockApiFetch.mock.calls[0][1].body)).toMatchObject({
      amount: "179139",
      fxInputs: [{ field: "amount", currency: "USD", amount: "10" }],
    });
  });
});
```

`contributeSubmit` is the submit button's existing i18n key. Read it from `contribute-dialog.tsx`; if the key has another name, use that one.

Create `apps/web/src/components/allowance/minta-dana-dialog.test.tsx` with the same scaffolding (mocks, polyfill, `QueryClientProvider`). Render inside the shell dialog so `DialogHeader` has its context:

```tsx
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { MintaDanaDialog } from "./minta-dana-dialog";
import type { AccountDto } from "@wealthme/contracts";

const source = { id: "acc-src", name: "BCA" } as AccountDto;
const target = { id: "acc-tgt", name: "Jago Anak" } as AccountDto;

function renderDialog() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <Dialog open>
        <DialogContent>
          <MintaDanaDialog
            source={source}
            targets={[target]}
            familyGroupId="fg-1"
            token="tok"
            onClose={() => {}}
          />
        </DialogContent>
      </Dialog>
    </QueryClientProvider>,
  );
}

it("revisi I — JPY request sends the preview number + fxInputs", async () => {
  renderDialog();
  await userEvent.selectOptions(screen.getByLabelText("Mata uang"), "JPY");
  await userEvent.type(
    screen.getByLabelText(idDict.rekening.mintaDanaAmountLabel),
    "1500",
  );
  await userEvent.click(
    screen.getByRole("button", { name: idDict.rekening.mintaDanaSubmit }),
  );
  expect(JSON.parse(mockApiFetch.mock.calls[0][1].body)).toMatchObject({
    amount: 170_511,
    fxInputs: [{ field: "amount", currency: "JPY", amount: "1500" }],
  });
});

it("revisi I — IDR request body is unchanged", async () => {
  renderDialog();
  await userEvent.type(
    screen.getByLabelText(idDict.rekening.mintaDanaAmountLabel),
    "50000",
  );
  await userEvent.click(
    screen.getByRole("button", { name: idDict.rekening.mintaDanaSubmit }),
  );
  const body = JSON.parse(mockApiFetch.mock.calls[0][1].body);
  expect(body.amount).toBe(50_000);
  expect(body).not.toHaveProperty("fxInputs");
});
```

The same caveat applies to `mintaDanaSubmit`: use the button's real key from the component.

`anggaran.test.tsx`. Arrange as in `"shows the existing-category picker … and submits without POSTing /categories"` (:151):

```ts
it("revisi I — budget limit in SGD posts the preview + fxInputs", async () => {
  // Arrange: as in :151 up to the amount.
  await userEvent.selectOptions(screen.getByLabelText("Mata uang"), "SGD");
  await userEvent.type(
    screen.getByLabelText(idDict.anggaran.fieldAmountLabel),
    "1500,25",
  );
  // Act: submit as in :151.
  const post = mockApiFetch.mock.calls.find(
    ([url, i]) => String(url).endsWith("/budgets") && i?.method === "POST",
  );
  expect(JSON.parse(post![1].body)).toMatchObject({
    limitAmount: 21_043_698,
    fxInputs: [{ field: "limitAmount", currency: "SGD", amount: "1500.25" }],
  });
});
```

`edit-transaction-dialog.test.tsx`. Use the file's existing render of the dialog:

```ts
it("revisi I — editing without touching the amount sends no fxInputs; a JPY amount does", async () => {
  // Arrange: render the dialog for the fixture tx; Act: save untouched.
  let patch = mockApiFetch.mock.calls.find(([, i]) => i?.method === "PATCH");
  expect(JSON.parse(patch![1].body)).not.toHaveProperty("fxInputs");
  mockApiFetch.mockClear();
  await userEvent.selectOptions(screen.getByLabelText("Mata uang"), "JPY");
  await userEvent.clear(
    screen.getByLabelText(idDict.transaksi.fieldAmountLabel),
  );
  await userEvent.type(
    screen.getByLabelText(idDict.transaksi.fieldAmountLabel),
    "1500",
  );
  // Act: save again.
  patch = mockApiFetch.mock.calls.find(([, i]) => i?.method === "PATCH");
  expect(JSON.parse(patch![1].body)).toMatchObject({
    amount: 170_511,
    fxInputs: [{ field: "amount", currency: "JPY", amount: "1500" }],
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `apps/web`): `pnpm exec jest "src/app/\(app\)/(anggaran|transaksi|tujuan)" src/components/allowance`
Expected: the new `revisi I` tests FAIL because no "Mata uang" select exists. The IDR-unchanged ones may already pass.

- [ ] **Step 3a: Single-field surfaces**

Each replaces one raw state with a money field, swaps the input, guards pending, and wraps the body.

- **anggaran create**:
  - `const amountField = useMoneyField();` replaces `amount`.
  - `handleCreate`: add the pending guard, and `const limitAmount = moneyIdr(amountField, parseRupiah);`.
  - Pass `fxInputs: withFxInputs<{ fxInputs?: FxInput[] }>({}, [["limitAmount", amountField]]).fxInputs` into `createMutation.mutate({...})`. It is `undefined` for IDR.
  - Add `fxInputs?: FxInput[]` to the create payload type (:902). In the budget POST body inside `mutationFn` (~:965), spread `...(payload.fxInputs ? { fxInputs: payload.fxInputs } : {})`.
  - `#budget-amount` becomes `<MoneyInput field={amountField} id="budget-amount" />`.
  - The reset after success calls `amountField.reset()`.
- **anggaran edit**: the same with `editField`.
  - `openEdit` (:1028): `editField.reset(String(budget.limitAmount))`.
  - `handleSaveEdit`: `moneyIdr(editField, parseRupiah)`.
  - Update payload type (:996) gets `fxInputs?`, and the PATCH body spreads it the same way.
  - `#budget-edit-amount` becomes `<MoneyInput field={editField} id="budget-edit-amount" />`.
- **tujuan contribute-dialog**:
  - `const amountField = useMoneyField();`
  - `const digits = moneyDigits(amountField);`. The existing `canSubmit` regex check `^[1-9]\d{0,11}$` on `digits` stays, and gains `&& !amountField.resolved.isPending`.
  - `mutation.mutate(withFxInputs({ amount: digits, …rest }, [["amount", amountField]]))`, with `fxInputs?` added to the local input type.
  - Input: `<MoneyInput field={amountField} id="goal-contribute-amount" />`.
- **minta-dana-dialog**:
  - `const amountField = useMoneyField();`
  - `const parsed = moneyIdr(amountField, parseRupiah);` plus the pending guard.
  - The body becomes `withFxInputs({ targetAccountId, fromAccountId: source.id, amount: parsed, note: note || undefined }, [["amount", amountField]])`.
  - Input: `<MoneyInput field={amountField} id={`${fieldId}-amount`} />`.
- **transaksi edit dialog**:
  - `const amountField = useMoneyField({ initialRaw: String(Math.round(parseFloat(tx.amount))), isEdit: true });`
  - `handleSave`: `const amountNum = moneyIdr(amountField, parseRupiah);` plus the pending guard, and `updateMutation.mutate(withFxInputs({ amount: amountNum, … }, [["amount", amountField]]))`.
  - Input: `<MoneyInput field={amountField} id={<existing id>} />`.
- [ ] **Step 4: Run tests to verify they pass**

Run (from `apps/web`): `pnpm exec jest "src/app/\(app\)/(anggaran|transaksi|tujuan)" src/components/allowance src/components/money`
Expected: PASS. New tests are green and pre-existing counts are unchanged.

Run (from `apps/web`): `pnpm exec tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Lint**

Run (from `apps/web`): `pnpm exec eslint "src/app/(app)/anggaran/page.tsx" "src/app/(app)/transaksi/page.tsx" "src/app/(app)/tujuan/_components" src/components/allowance`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add "apps/web/src/app/(app)/anggaran" "apps/web/src/app/(app)/transaksi" "apps/web/src/app/(app)/tujuan/_components" apps/web/src/components/allowance
git commit -m "$(cat <<'EOF'
feat(web): currency picker on budgets, goal top-ups, fund requests and transaction edit

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10b: Web — warisan, donation, split bill, onboarding

**Files:**

- Modify: `apps/web/src/app/(app)/warisan/page.tsx` (`valueInput`, :698, :724, :733-778, :1133)
- Modify: `apps/web/src/app/(app)/donation/page.tsx` (`jumlah`, :398-410, :414-425, :907)
- Modify: `apps/web/src/app/(app)/splitbill/page.tsx` (:98-171, :368-420, :684, :782)
- Modify: `apps/web/src/components/onboarding/guided-setup.tsx` (:325-340, :400-430, :465-475, inputs :632/:731/:822)
- Test:
  - `apps/web/src/app/(app)/warisan/warisan.test.tsx`
  - `apps/web/src/app/(app)/donation/donation.test.tsx`
  - `apps/web/src/app/(app)/splitbill/splitbill.test.tsx`
  - `apps/web/src/components/onboarding/guided-setup.test.tsx`

**Interfaces:**

- Consumes: Task 7, plus from `@wealthme/contracts`: `parseMinor`, `formatScaled` and `FX_CURRENCY_DECIMALS` (for the split bill). Also `splitEqually` / `amountsMatchTotal` / `computeRemainder` from `splitbill/split-math.ts`, which is unchanged and here operates on minor units.
- Produces: nothing for later tasks.

- [ ] **Step 1: Write the failing tests**

Add this fx mock at module level to every test file below, and pin the display currency to IDR as described in Task 8a:

```ts
jest.mock("@/components/money/use-fx-snapshot", () => ({
  useFxSnapshot: (enabled: boolean) => ({
    data: enabled
      ? jest.requireActual("@/components/money/fx-test-rates").TEST_FX_RATES
      : undefined,
    isError: false,
  }),
}));
```

`warisan.test.tsx`. Arrange as in `"surfaces the server's string message from the create mutation…"` (:216), with a successful mock:

```ts
it("revisi I — estimated value in EUR posts the preview + fxInputs", async () => {
  await userEvent.selectOptions(screen.getByLabelText("Mata uang"), "EUR");
  await userEvent.type(
    screen.getByLabelText(idDict.warisan.fieldValueLabel),
    "75,50",
  );
  // Act: save as in :216.
  const post = mockApiFetch.mock.calls.find(([, i]) => i?.method === "POST");
  expect(JSON.parse(post![1].body)).toMatchObject({
    estimatedValue: 1_542_255,
    fxInputs: [{ field: "estimatedValue", currency: "EUR", amount: "75.50" }],
  });
});
```

`donation.test.tsx`. Arrange as in `"lists Master Data lembaga …, and saves the chosen one"` (:338):

```ts
it("revisi I — donation amount in EUR posts the preview + fxInputs", async () => {
  await userEvent.selectOptions(screen.getByLabelText("Mata uang"), "EUR");
  await userEvent.type(
    screen.getByLabelText(idDict.donation.fieldJumlahLabel),
    "75,50",
  );
  // Act: save as in :338.
  const post = mockApiFetch.mock.calls.find(
    ([url, i]) => String(url).endsWith("/donations") && i?.method === "POST",
  );
  expect(JSON.parse(post![1].body)).toMatchObject({
    amount: "1542255",
    fxInputs: [{ field: "amount", currency: "EUR", amount: "75.50" }],
  });
});
```

`splitbill.test.tsx`. Arrange with the file's create-dialog steps (title, 3 participants, payout account, **custom** mode):

```ts
it("revisi I — a USD bill sends total + every share as fxInputs in one currency", async () => {
  await userEvent.selectOptions(screen.getByLabelText("Mata uang"), "USD");
  await userEvent.type(
    screen.getByLabelText(idDict.splitbill.fieldTotalLabel),
    "10",
  );
  const shares = screen.getAllByLabelText(
    new RegExp(`^${idDict.splitbill.fieldTotalLabel} `),
  );
  await userEvent.type(shares[0]!, "3,33");
  await userEvent.type(shares[1]!, "3,33");
  await userEvent.type(shares[2]!, "3,34");
  // Act: create.
  const post = mockApiFetch.mock.calls.find(
    ([url, i]) => String(url).endsWith("/split-bills") && i?.method === "POST",
  );
  const body = JSON.parse(post![1].body);
  expect(body.totalAmount).toBe(179_139);
  expect(
    body.participants.map((p: { amountOwed: number }) => p.amountOwed),
  ).toEqual([59_653, 59_653, 59_832]);
  expect(body.fxInputs).toEqual([
    { field: "totalAmount", currency: "USD", amount: "10.00" },
    { field: "participants.0.amountOwed", currency: "USD", amount: "3.33" },
    { field: "participants.1.amountOwed", currency: "USD", amount: "3.33" },
    { field: "participants.2.amountOwed", currency: "USD", amount: "3.34" },
  ]);
});
```

The client preview sums to 179.138. It is informational: the server settles the +1 residue (Task 6).

`guided-setup.test.tsx`. Extend `"creates a real account, budget, and transaction…"` (:188) with a sibling test that picks USD on the account-balance step only:

```ts
it("revisi I — a USD opening balance posts the preview + fxInputs; budget and transaction stay IDR", async () => {
  // Arrange/Act: as in :188, but before typing the balance pick USD and type "100".
  const account = mockApiFetch.mock.calls.find(([url]) =>
    String(url).endsWith("/accounts"),
  );
  expect(JSON.parse(account![1].body)).toMatchObject({
    balance: 1_791_390,
    fxInputs: [{ field: "balance", currency: "USD", amount: "100" }],
  });
  const budget = mockApiFetch.mock.calls.find(([url]) =>
    String(url).endsWith("/budgets"),
  );
  expect(JSON.parse(budget![1].body)).not.toHaveProperty("fxInputs");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `apps/web`): `pnpm exec jest "src/app/\(app\)/(warisan|donation|splitbill)" src/components/onboarding`
Expected: the new `revisi I` tests FAIL because no "Mata uang" select exists.

- [ ] **Step 3a: Single-field surfaces**

Each replaces one raw state with a money field, swaps the input, guards pending, and wraps the body.

- **warisan**:
  - `const valueField = useMoneyField();`
  - The edit prefill (:698) and the asset-pick prefill (:724) call `valueField.reset(BigInt(x).toString())`.
  - `handleSave`: `const raw = moneyDigits(valueField);` (the rest is unchanged) plus the pending guard.
  - The mutation body becomes `withFxInputs(baseFields, [["estimatedValue", valueField]])` for both create and update.
  - Input: `<MoneyInput field={valueField} id="warisan-value" />`.
- **donation**:
  - `const jumlahField = useMoneyField();`
  - The zakat/tithe prefill (:398/:403) calls `jumlahField.reset(<same digits>)`, and `setJumlah("")` becomes `jumlahField.reset()`.
  - `handleSave`: `const amountNum = moneyIdr(jumlahField, parseRupiah);` plus the pending guard, and `createMutation.mutate(withFxInputs({ …, amount: String(amountNum), … }, [["amount", jumlahField]]))`.
  - Input: `<MoneyInput field={jumlahField} id="dn-jumlah" />`.
- **guided-setup**:
  - Three fields: `balanceMoney`, `limitMoney` and `txMoney` (`useMoneyField()`).
  - Their numbers are `moneyIdr(x, parseRupiah)`.
  - Bodies: accounts `withFxInputs({ …, balance: balanceNum }, [["balance", balanceMoney]])`, budgets `[["limitAmount", limitMoney]]`, transactions `[["amount", txMoney]]`.
  - Swap the three inputs at :632/:731/:822 for `MoneyInput` with the same ids.

- [ ] **Step 3b: Split bill (one currency per bill, Decision 10)**

In `splitbill/page.tsx`:

```ts
const totalField = useMoneyField();
const billCurrency = totalField.currency;
const billDecimals = totalField.decimals;
/** Integer units in the bill currency: rupiah for IDR (unchanged parse), minor units otherwise. */
const toUnits = (raw: string): number =>
  billCurrency === "IDR"
    ? parseRupiah(raw)
    : Number(parseMinor(toCanonicalAmount(raw) ?? "0", billCurrency));
const totalNum = toUnits(totalField.raw);
const customUnits = useMemo(
  () =>
    Object.fromEntries(
      Object.entries(customAmounts).map(([k, v]) => [k, String(toUnits(v))]),
    ) as CustomAmounts,
  [customAmounts, billCurrency],
);
const unitsLabel = (units: number): string =>
  billCurrency === "IDR"
    ? formatRupiah(units)
    : `${billCurrency} ${formatScaled(BigInt(units), billDecimals).replace(".", ",")}`;
```

- Every existing call of `splitEqually`, `computeRemainder`, `amountsMatchTotal` and `splitRemainderEvenly` passes `totalNum` (now units) and `customUnits` instead of `customAmounts`. `split-math.ts` parses the digit strings with `parseRupiah`, which is exact on unit strings.
- The remainder/diff labels use `unitsLabel` instead of `formatRupiah`.
- `setTotal("")` (:171) becomes `totalField.reset()`.
- The custom share inputs (:782) keep their `aria-label` and state. Their `onChange` becomes `formatMoneyTyping(e.target.value, billDecimals)`, and their placeholder shows `billCurrency`.

In `handleCreate`, after the existing validations, add a pending guard on `totalField.resolved.isPending`. Then:

```ts
const unitsPerParticipant: number[] =
  method === "equal"
    ? participants.map((_, i) => equalShares[i] ?? 0)
    : participants.map((p) => toUnits(customAmounts[p.localId] ?? "0"));
const canonicalOf = (units: number) =>
  formatScaled(BigInt(units), billDecimals);
const idrOf = (units: number): number =>
  billCurrency === "IDR"
    ? units
    : Number(
        idrPreview(canonicalOf(units), billCurrency, totalField.rates, 0) ?? 0n,
      );
const participantDtos = participants.map((p, i) => ({
  name: p.name.trim() || t.splitbill.defaultParticipantName,
  amountOwed: idrOf(unitsPerParticipant[i] ?? 0),
}));
const base = {
  title: trimmedTitle,
  totalAmount: idrOf(totalNum),
  payoutAccountId,
  payoutInstructions: payoutInstructions.trim() || undefined,
  participants: participantDtos,
};
createMutation.mutate(
  billCurrency === "IDR"
    ? base
    : {
        ...base,
        fxInputs: [
          {
            field: "totalAmount",
            currency: billCurrency,
            amount: canonicalOf(totalNum),
          },
          ...unitsPerParticipant.map((u, i) => ({
            field: `participants.${i}.amountOwed`,
            currency: billCurrency,
            amount: canonicalOf(u),
          })),
        ],
      },
);
```

For IDR, `idrOf` is the identity and `base` equals today's body exactly. Add `fxInputs?: FxInput[]` to the local `CreateSplitBillDto` type. `#split total` (:684) becomes `<MoneyInput field={totalField} id={<existing id>} />`.

- [ ] **Step 4: Run tests to verify they pass**

Run (from `apps/web`): `pnpm exec jest "src/app/\(app\)/(warisan|donation|splitbill)" src/components/onboarding src/components/money`
Expected: PASS. New tests are green, and pre-existing counts are unchanged (including `splitbill/split-math.test.ts`, whose module is untouched).

Run (from `apps/web`): `pnpm exec tsc --noEmit`
Expected: exit 0.

Run (from `apps/web`): `grep -rn "type=\"text\"\|inputMode=\"numeric\"" src/app/\(app\)/{anggaran,warisan,donation,splitbill,transaksi}/page.tsx src/components/allowance/minta-dana-dialog.tsx src/components/onboarding/guided-setup.tsx src/app/\(app\)/tujuan/_components/contribute-dialog.tsx`
Expected: only non-money inputs remain across 10a + 10b: the percentage and tithe/zakat calculator fields listed as out of scope in the coverage table.

- [ ] **Step 5: Lint**

Run (from `apps/web`): `pnpm exec eslint "src/app/(app)/warisan/page.tsx" "src/app/(app)/donation/page.tsx" "src/app/(app)/splitbill/page.tsx" src/components/onboarding`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add "apps/web/src/app/(app)/warisan" "apps/web/src/app/(app)/donation" "apps/web/src/app/(app)/splitbill" apps/web/src/components/onboarding
git commit -m "$(cat <<'EOF'
feat(web): currency picker on inheritance, donations, split bills and onboarding

Split bills pick one currency per bill: shares are typed and checked in
that currency's minor units, and the server settles the IDR rounding
residue.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Final verification (after Task 10b)

- Run (from `apps/api`): `pnpm exec jest src/fx src/accounts src/transactions src/budgets src/goals src/allowance-requests src/family-groups src/assets src/investments src/liabilities src/insurances src/inheritance src/donations src/split-bills` → PASS.
- Run (from `apps/web`): `pnpm exec jest src/components/money src/components/crud src/components/shell src/components/allowance src/components/onboarding "src/app/\(app\)/(akun|dana|rekening|tujuan|investasi|laporan|aset|asuransi|liabilitas|anggaran|warisan|donation|splitbill|transaksi)"` → PASS.
- Run the project gates: `bash scripts/qa.sh`, `bash scripts/test.sh` and `bash scripts/security-check.sh`. `test.sh` runs the build; this is the one place a full build is allowed, because it is the repo's own gate.
- Check `git diff development --stat -- apps/web/src/lib apps/web/src/components/ui apps/web/src/components/wm apps/web/src/components/charts packages/config apps/web/src/app/globals.css apps/web/src/app/design-system.css apps/web/src/app/layout.tsx`. It must be empty. In `apps/web/src/components/shell/`, only `transaction-dialog.tsx` and its test may appear.
- Manual DEV smoke check at 390 px and 1280 px (playwright-cli):
  1. "Tambah Rekening Bank": pick USD, type 100, save. The saldo shows about Rp 1,79 jt (or the user's display currency).
  2. "Tambah Kas Tunai" with USD -20 saves a negative balance.
  3. Investasi "Record Investment" with the USD unit price shows the rate line with the ECB date.
  4. With `FX_PROVIDER=frankfurter` and the network cut (or `api.frankfurter.dev` blocked), the label switches to "Kurs terakhir tersedia …".

## Self-Review

**Spec coverage:**

| Requirement                                                                                          | Task                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Pick a currency on every money input (client)                                                        | 7 (component); 8a, 8b, 9, 10a, 10b (every in-scope surface in the coverage table)                                                                      |
| Screenshot surfaces: Record Investment, Tambah Rekening Bank, Tambah Kas Tunai                       | 9 (investasi), 8 (CrudModal via akun/rekening/dana/quickinput)                                                                                         |
| Convert to IDR server-side; server authoritative; store IDR as today                                 | 4 (`FxInputService` overwrite), 5–6 (every route); Review Focus 4                                                                                      |
| Audit trail: original amount, currency, rate, rate date, source                                      | 2 (`fx_conversions`), 4 (`record`)                                                                                                                     |
| Display follows each user's `User.currency`                                                          | Unchanged (`formatRupiah` target), plus the display hint in `MoneyInput` (7)                                                                           |
| Live FX feed with caching, fallback, and a rate label                                                | 2 (client), 3 (service + fallback chain + `/fx/rates` fields), 7 (label)                                                                               |
| BigInt / fixed-point, round-half-up to whole rupiah, JPY minor units                                 | 1 (contracts math shared by API and web), 4 (decimal2 only for Decimal(18,2) prices)                                                                   |
| Additive migration after 20260925210000                                                              | 2 (`20260926090000_…`)                                                                                                                                 |
| Protected files untouched; transaction-dialog minimal exception; `MoneyInput` in a non-protected dir | Global Constraints, 8 Step 3d, Final verification diff check                                                                                           |
| i18n in types/id/en                                                                                  | 7 Step 3a                                                                                                                                              |
| Tenant scoping + ability decorators                                                                  | No new family route. Every changed route keeps its `@CheckAbility` and `familyGroupId` param; audit rows take `familyGroupId` from the route (4, 5, 6) |
| DTO value-import convention + lint-staged guard                                                      | 4, 5, 6 (commit-step grep)                                                                                                                             |
| Tax / rekonsiliasi IDR-by-nature decision                                                            | Coverage table + Out of scope                                                                                                                          |
| Default currency = user's display currency; edit opens IDR, never re-converts (user decision 1)      | Decisions 9 + 12; 7 (`useDefaultMoneyCurrency`, `isEdit`, latching), 8a (CrudModal fallback), 8b–10b (call sites); Review Focus 5 + 10                 |
| Backdated → latest rate labelled with its date; historical rates are a follow-up (user decision 2)   | Decision 13; 7 (rate line); Out of scope                                                                                                               |
| `/akun` gold price per gram + large-transaction threshold included (user decision 3)                 | 4 (`goldPrice`/`memberThreshold` specs), 5 (API + missing `@CheckAbility` on gold-price), 8b Step 3b (web); Review Focus 12                            |
| Liabilitas anchored on labels/ids and run after G merges                                             | 9 Step 3e                                                                                                                                              |
| Existing `currency` columns                                                                          | Decision 2 (untouched, documented)                                                                                                                     |

**Judgment calls:**

- **The math lives in `@wealthme/contracts`**, so the web preview and the server can never round differently. The price is that contracts' `dist/` must be rebuilt in Task 1; this is already a repo rule.
- **`fxInputs` next to the legacy field**, rather than new per-field currency columns in every DTO. It keeps all existing validators and service signatures intact, and the server-side overwrite makes the client number irrelevant.
- **One generic `fx_conversions` table** instead of `original*` columns on 12 models. Several records have two or more money fields (liability, insurance, asset, split bill), and action routes (pay, trade) have no row of their own to hold columns.
- **Audit write after commit, logged on failure** (Decision 8), rather than threading it through every service transaction.
- **Unit prices at sen precision** (Decision 6) instead of whole rupiah.
- **`FxModule` is `@Global()`**, so 12 feature modules need no `imports` edit.

**Placeholder scan:** no TBD or TODO. Every code step has its code. Two web test arrange blocks name the exact existing test to copy from, instead of inventing selectors for dialogs this plan does not change. The three unverified i18n button keys (`contributeSubmit`, `mintaDanaSubmit`, and the transaction dialog `saveButton`) each carry an explicit "read the real key" instruction.

**Type consistency:** these names are identical across Tasks 1–10:

- Contracts and API: `FX_FIELD_SPECS.goldPrice` / `.memberThreshold`, `FxEntity` `"FamilyGroup"` / `"Member"`, `createFxTestApp({ extraMiddleware })`, `FxCurrencyCode`, `ForeignFxCurrencyCode`, `FX_CURRENCY_DECIMALS`, `FX_RATE_SCALE`, `convertToIdr`, `formatScaled`, `parseMinor`, `deriveIdrPerUnit`, `FxInput`, `FxRatesResponse`, `FxSnapshot`, `FxPort.getSnapshot`, `FrankfurterFxService`, `FrankfurterClient.fetchLatest`, `FxInputDto`, `FxInputsProperty`, `resolveFxInputs`, `applyFxOverrides`, `FxInputService.run`, `FxRunArgs`, `FxEntity`, `FX_FIELD_SPECS.*`, `accountBalanceSpec`, `assertSplitFxComplete`, `settleSplitRounding`, `fxTesting`, `createFxTestApp`, `TEST_SNAPSHOT`.
- Web: `MoneyField`, `ResolvedMoney`, `useDefaultMoneyCurrency`, `useMoneyField` (`isEdit`), `useControlledMoneyField` (`currency: FxCurrencyCode | null`), `useFxSnapshot`, `MoneyInput`, `moneyIdr`, `moneyDigits`, `moneyIdrDecimal`, `withFxInputs`, `anyMoneyPending`, `normalizeCrudMoney`, `withCrudFx`, `TEST_FX_RATES`, and `t.money.*`.

**Golden numbers** were cross-checked with Python `Decimal` (ROUND_HALF_UP = half away from zero) against the live 2026-09-25 ECB rates:

- USD 1,250.50 → 22.401.332
- USD 10.00 → 179.139
- USD −20.00 → −358.278
- USD 12.34 → 221.057,52
- USD 99.99 → 1.791.210,85
- JPY 1,500 → 170.511
- SGD 1,500.25 → 21.043.698
- SGD 100.00 → 1.402.679
- AUD 1,200 → 15.112.617
- CNY 5,000 → 13.342.229
- EUR 75.50 → 1.542.255
- 3.33/3.33/3.34 USD → 59.653/59.653/59.832, with residue +1
