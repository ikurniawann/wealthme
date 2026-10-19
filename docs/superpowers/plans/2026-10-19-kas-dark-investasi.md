# Plan — Kas & E-Wallet, dark-mode lift, Investasi rebuild (2026-10-19)

Specs:

- Kas & E-Wallet: reference images `docs/design/refs/2026-10-19/kas-forms.jpeg`
  (cash + e-wallet forms) and `kas-page.jpeg` (page). User asked: "tampilan kas
  & dompet harusnya seperti ini. tolong update juga agar support perbankan di
  indonesia dan seluruh negara".
- Dark mode: user: "dark mode terlalu gelap sekali ya ternyata kalau datanya
  sebanyak ini" (screenshot of /rekening table view in dark theme: near-black
  surfaces, rows blend together).
- Investasi: `docs/superpowers/specs/2026-10-19-investasi.md` (binding logic
  authority) + audit `docs/superpowers/specs/2026-10-19-investasi-audit.md`.
  Images `docs/design/refs/2026-10-19/invest-0..4.jpeg`.

## Global Constraints (every task)

- Monorepo `/home/wit/WORK/vibes/wealthme-web`. Stack: Next.js 16 App Router +
  React 19 + TS + Tailwind v4 + shadcn on **Base UI** (`render={<el/>}`, never
  `asChild`); NestJS + Prisma (PostgreSQL); zod contracts in
  `packages/contracts` (after editing `packages/contracts/src`, run
  `cd packages/contracts && npx tsup` — `dist/` is committed and must be
  rebuilt or the web build breaks).
- Read `apps/web/WM_CONVENTIONS.md` before web work. Pages render inner content
  only (shell owns h1/sidebar/padding; pages never render an `<h1>` — use
  `<p>`/`<h2>`). Interactive pages start with `"use client";`.
- Protected foundation files (do not edit unless the task says so):
  `apps/web/src/app/globals.css`, `apps/web/src/lib/*`,
  `apps/web/src/components/{ui,wm,charts,shell}/*`, `apps/web/src/app/layout.tsx`.
- Design system: bento tokens `--wm-*` (see `apps/web/src/app/(app)/rekening/rekening.css`
  for idiom), forest green primary, lime active state, off-white background,
  white surfaces, soft borders, consistent radius. Both light and dark themes
  must hold. Page CSS lives in a page-local `.css` under `@layer components`;
  dialog sizing/overrides that must beat Base UI/Tailwind go in an UNLAYERED
  block (see `apps/web/src/components/shell/transaction-dialog.css`).
- All user-facing copy goes through i18n (`useLocale()` → `t`), Indonesian
  first, English parity (the dictionary parity test checks both locales).
- Money: account balances are stored in IDR (BigInt). A foreign amount is sent
  as `fxInputs: [{ field, currency, amount }]` and converted server-side.
  `useFxSnapshot` (`@/components/money`) gives `idrPerUnit` rates.
  FX currencies: IDR USD SGD EUR JPY AUD CNY GBP HKD MYR THB PHP KRW INR.
- Honest UI: a control does what it implies; no mock numbers, no dummy charts
  or fabricated history; missing data shows "—" or an explicit empty state.
- Accessibility: persistent labels, keyboard navigation, visible focus, errors
  next to fields, touch targets ≥ 40px, never color-only status.
- Responsive: desktop 1440, tablet 820, phone 390 — no horizontal page
  overflow; on phones forms are full-screen sheets with a reachable save button.
- **Testing policy (user instruction): do NOT write or run jest/e2e tests in
  implementation tasks.** Only `npx tsc --noEmit` (in `apps/web` / `apps/api`)
  and `npx eslint <changed files>` must pass. All tests are written and run in
  the final Task 16.
- Git: commit only the files you changed, by explicit path. **Never
  `git commit -a` or `git add -A`** — the tree holds unrelated user WIP
  (`.claude/agents`, `deploy/`, `scripts/`, `docs/DEPLOYMENT.md`, `results.md`,
  `skills-lock.json`). Never push. Conventional commit messages, ending with:
  ```
  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01RDbXyuMbb2WHtT74hdL9Zy
  ```
- Database: schema changes only through a new Prisma migration folder under
  `apps/api/prisma/migrations/<timestamp>_<name>/migration.sql`, additive and
  safe for existing rows. Never run SQL by hand, never `migrate reset`. Do not
  apply migrations to the dev DB (the controller does that).
- Dev servers already run on the host (API `:4100` nest watch, web `:3100`
  next dev). Do not start/stop them.

---

## Kas & E-Wallet

Already committed (59166384): API fields `storageLocation`,
`includeInNetWorth`, `lastReconciledAt` on Account (also in `AccountDto`);
`POST /family-groups/:fg/accounts/:id/reconcile` body
`{ actualBalance: int IDR, fxInputs? }` → `{ account, adjustment, held }`;
`apps/web/src/app/(app)/dana/wallet-directory.ts` (`WALLET_COUNTRIES`,
`WALLET_PROVIDERS`, `walletCountry`, `providersForCountry`, `findProvider`,
`maskIdentifier`); `apps/web/src/app/(app)/dana/kas-model.ts` (`toRows`,
`totals`, `applyFilters`, `EMPTY_FILTERS`, `needsCheck`, `formatNative`,
`STALE_DAYS`); copy `t.dana.v3` (`apps/web/src/i18n/dana-v3.ts`, keys `page`,
`form`, `reconcile`); shell `useShell().openTxnAt(2)` opens the transaction
dialog on the Transfer tab.

### Task 1: Cash & e-wallet form dialog

Create `apps/web/src/app/(app)/dana/kas-form.tsx` (+ optional
`kas-form-state.ts` for pure state/body builders) and its CSS appended to
`apps/web/src/app/(app)/dana/dana.css`. Match `docs/design/refs/2026-10-19/kas-forms.jpeg`.

- Export `KasForm({ open, onClose, onSaved, members, familyGroupId, token, myUserId, isMasterLike })`
  where `open: { kind: "cash" | "ewallet"; mode: "add" | "edit"; account: AccountDto | null; preset?: { country?: string; provider?: string } } | null`.
- Dialog: `Dialog`/`DialogContent` from `@/components/ui/dialog`, dark-green
  header band (icon tile, title `form.addCashTitle`/`addWalletTitle`/edit
  variants, subtitle, round close button), white body, sticky footer
  (`Batal` outline, primary `Simpan kas`/`Simpan e-wallet`). Width
  `min(720px, 100% - 32px)` above 768px; full-screen sheet on phones.
- Cash sections: **Informasi kas** — Nama kas*, Pemilik dana* (members select;
  Master/Co-Master also get "Keluarga (bersama)" = ownerUserId null;
  non-master members are pinned to themselves), Mata uang\* (select from the
  FX currency list, default = selected country's currency), Negara (select
  `WALLET_COUNTRIES`, default ID; changing it updates currency), Lokasi
  penyimpanan (opsional) → `storageLocation`.
- E-wallet sections: **Informasi e-wallet** — Negara, Penyedia* (select with
  brand tile from `providersForCountry(country)` + "Penyedia lainnya / kustom"
  which reveals a free-text provider name), Nama dompet* (default
  "<Provider> Pribadi"), ID akun / nomor terdaftar* (label by provider
  `idKind`: phone → `walletIdPhone` with the country dial prefix as a
  leading adornment; email → `walletIdEmail`; id → `walletIdOther`; hint
  `walletIdHint`) → `maskedNumber`, Pemilik dana*, Mata uang\*.
- **Saldo awal** (add mode only): Saldo saat ini* (`MoneyInput` +
  `useControlledMoneyField` like `rekening/account-form.tsx` `BalanceInput`;
  cash may be negative, e-wallet not), Saldo per tanggal* (`DateField` from
  `@/components/wm`, max today) → `openingBalanceDate`; info note
  `openingNote` + hint (`openingCashHint` / `openingWalletHint`) with a
  `Transfer` text button calling `useShell().openTxnAt(2)` after closing.
  Edit mode replaces the section with the `balanceLocked` note (balance only
  moves through transactions).
- **Akses & pencatatan**: Dibagikan kepada (opsional) — multi-select chips of
  members whose `dataScope === "own"` and who are not the owner, Master-like
  only (else hidden); sends `shares: [{ userId, canPost: false }]`; hint
  `sharedHint`. Checkbox "Masukkan ke total kekayaan" (default on) →
  `includeInNetWorth`. Cash: collapsible "Catatan tambahan (opsional)" →
  `notes`. E-wallet: muted strip `manualNote`.
- Submit:
  - POST `/family-groups/:fg/accounts` body
    `{ type, name, institution (provider name, ewallet only), maskedNumber, country, currency, balance (IDR int), fxInputs?, ownerUserId?, shares, includeInNetWorth, storageLocation, notes, openingBalanceDate }`.
    For a foreign currency send `balance` = IDR preview and
    `fxInputs: [{ field: "balance", currency, amount }]` (pattern:
    `rekening/account-form.tsx` `converted`/`createBodies`); if the rate is
    missing, toast `form.rateMissing` and do not submit.
  - Edit: PATCH same path + `/:id` without balance.
  - Toasts `savedCash`/`savedWallet`/`updated`; errors via `apiErrorMessage`.
- Validation inline next to fields (`required`, `negativeWallet`).
- Account `name` uniqueness is per family; surface the API's 409 message.

### Task 2: "Cocokkan saldo" dialog

Create `apps/web/src/app/(app)/dana/reconcile-dialog.tsx`:
`ReconcileDialog({ row: KasRow | null, onClose, onDone, familyGroupId, token })`.

- Small dialog (`dialog--sm` width or ~440px), title `reconcile.title`,
  subtitle `reconcile.sub` with the account name.
- Shows recorded balance (native currency via `formatNative` + IDR line when
  foreign), an input "Saldo sebenarnya" in the account's currency
  (`MoneyInput` controlled field; cash may be negative), live difference with
  sign text + explanation (`match` / `diffUp` / `diffDown`) — never color-only.
- Confirm button label `confirmMatch` when equal, `confirmAdjust` otherwise.
  POST `/family-groups/:fg/accounts/:id/reconcile` with `actualBalance` (IDR)
  and `fxInputs` for foreign currency. Toast `done` / `doneAdjusted` /
  `held` (when `held: true`). Then `onDone()` (caller invalidates accounts +
  transactions queries).

### Task 3: Kas & E-Wallet page

Rewrite `apps/web/src/app/(app)/dana/page.tsx` and `dana.css` to match
`docs/design/refs/2026-10-19/kas-page.jpeg`, using Task 1/2 components and
`kas-model.ts`. Drop the CrudModal/HatchedAreaChart/composition/tip layout.

- Header row: title `page.title` (styled `<p>`, not h1) + subtitle; right:
  `Transfer` outline button (`openTxnAt(2)`) and primary `Tambah akun` menu
  (Kas tunai / E-Wallet) — only when `useCanManage("Account").canManage`.
- Summary card: "Total dalam {cur}" with eye toggle (page-local hide state,
  `aria-pressed`), big total (`totals().total` via `useMoney().format`),
  `accountsCurrencies`; Tunai and E-Wallet stat blocks with icon tiles and
  counts; rate note (`rateNote` with rates' `rateDate`, or `rateNoteNone`
  when every row is IDR) + `Lihat kurs` link to `/akun` (currency settings).
- Filter bar: search; segmented Semua/Tunai/E-Wallet; Negara, Mata uang,
  Pemilik selects (options from the rows); "Tampilkan saldo" toggle mirrors
  the eye toggle.
- "Daftar akun (n)" table: Akun (brand tile — provider color+mark for
  e-wallet, banknote icon for cash; name; `Tunai • <Negara>` /
  `E-Wallet • <Negara> • <masked id>`), Pemilik (+ "Dibagikan" chip when
  shared), Saldo asli (`formatNative`), Setara IDR, Terakhir dicocokkan
  (✓ date when fresh; ! date + "Periksa saldo" chip when stale; "Belum
  pernah" when null), "Tidak dihitung" chip when `included === false`, row
  `⋯` menu (Ubah, Cocokkan saldo, Minta dana for non-master on family-shared
  rows via existing `MintaDanaDialog`, Hapus via existing
  `ConfirmDeleteDialog`). Phones: rows become stacked cards (no table).
  Masked balances (null idr) render "••••".
- Alert card when `needsCheck(rows)` non-empty: `attentionTitle` + one-line
  (`attentionOne`/`attentionNever`/`attentionMany`) + `Cocokkan saldo`
  button opening ReconcileDialog for the first row.
- "Aktivitas terakhir": last 5 transactions touching cash/e-wallet accounts
  (reuse the existing `/transactions?limit=20` query + filter), each with
  type icon, description, `Transfer • A → B` / account name subtitle, date,
  signed amount; `Lihat semua` → `/transaksi`; footnote `activityNote`;
  empty state `activityEmpty`.
- Right column panel "Tambah akun lintas negara": country select
  (`WALLET_COUNTRIES`, localized names, no emoji flags — use a 2-letter code
  badge), type select (E-Wallet / Kas tunai), provider search + list from
  `providersForCountry` (tile + name) — clicking opens KasForm preset with
  country+provider; "+ Penyedia lainnya / kustom"; `providerNote`;
  `manualNote` info box. For type Kas tunai show `cashSideBody` + button
  `addCashHere`.
- Layout: two columns (main + 300px side) ≥ 1180px; side panel moves below on
  smaller screens. Loading, error (`errorLoad`), empty (`empty`) and
  no-results states.
- Keep `useCardLooks`/`CardSkinPanel` out (no cards in this design).

---

## Dark mode

### Task 4: Lift dark theme on data-dense pages

Problem: in dark theme `/rekening` (screenshot: table view with many rows)
reads as near-black — surfaces, group headers, table rows and borders blend.
Fix in page-local CSS only (`apps/web/src/app/(app)/rekening/rekening.css`,
`apps/web/src/app/(app)/dana/dana.css`; and `investasi.css` later uses the
same idea): under the dark theme selector the app already uses (find it —
e.g. `.dark` / `[data-theme="dark"]` — in `globals.css`/`design-system.css`,
read-only), give the page cards a lighter elevated surface (≈ L 18–22% vs
the ≈ 9% page), table header band a distinct tone, row separators visible
(≈ 1px at 10–14% white), hover row tint, muted text ≥ 4.5:1 contrast, and the
summary hero slightly lifted. Keep the forest-green identity; do not touch
light theme values. Verify by reading computed styles via the running dev
server only if cheap; otherwise reason from tokens.

---

## Investasi

Read the spec + audit first. Rulings already made (binding):

- R1 Cost-basis method stays **weighted average** (the app's current method,
  `investments.service.ts` ~787). Document it in UI copy and code; do not
  switch to FIFO.
- R2 Kantong dana (cash pocket) **is an `Account`** of type `investment`
  (balance in IDR like every account, counted once in net worth through the
  accounts sum). It gains `platformAccountId` + `pocketKind`
  (`rdn` | `crypto` | `usd` | `general`) + `currency`. A new model
  `PlatformAccount { id, familyGroupId, platformKey (catalog key or "custom"), customName?, ownerUserId?, label?, accountRef? (encrypted like maskedNumber), syncMode ("manual") , createdAt, updatedAt }`
  is the user's account at a platform. Holdings (`Investment`) gain
  `platformAccountId?` and `cashAccountId?`.
- R3 Platform catalog is a code constant in `packages/contracts`
  (`INVESTMENT_PLATFORMS`: key, name, country, color, mark, products allowed
  [saham_idx, saham_us, reksa_dana, obligasi, emas, kripto, deposito],
  pockets offered, fractional US shares yes/no, syncMode "manual"). Include
  Ajaib, Stockbit (Stockbit Sekuritas), IPOT (Indo Premier), Bibit, Bareksa,
  Gotrade, Pluang, Pintu, Indodax, Tokocrypto, Pegadaian (emas), plus
  "custom". Only claim products each platform really offers (verify from the
  platform's official site when unsure; when unverifiable, list fewer).
  Every platform is "Pencatatan manual" — no integration claims.
- R4 Market config: `Investment.market` (`IDX`, `NASDAQ`, `NYSE`, `CRYPTO`,
  `MUTUAL_FUND_ID`, `BOND_ID`, `GOLD`, `DEPOSIT`, `OTHER`), `lotSize` (IDX
  saham = 100 per IDX regular market rules; everything else 1),
  `allowFraction` (US shares only if the platform supports it; crypto true),
  `priceSymbol` (provider symbol, e.g. `BBCA.JK`, `NVDA`, `bitcoin`) kept
  separate from the user ticker. Quantity stays stored in base units
  (lembar/shares/units/grams) — never lots.
- R5 Legacy data: migration backfills `market = 'IDX'` and `lotSize = 100`
  only where `type = 'saham' AND currency = 'IDR'`; other legacy saham rows
  keep `market = NULL` and show a "Lengkapi pasar" prompt. Quantities are not
  rewritten. Legacy holdings without transactions get a synthetic
  `opening` transaction dated `purchasedAt ?? createdAt` (date-only) carrying
  the current quantity and cost basis.
- R6 Transaction ordering key: `(effectiveDate, effectiveTime NULLS FIRST
for date-only rows → sorted before timed rows of the same date, then
createdAt, then id)`. Date-only rows are treated as start-of-day.
- R7 Idempotency: every write (buy/sell/opening/income/top-up) takes a
  client `idempotencyKey` (uuid generated when the form opens); unique per
  family; a replay returns the original result (HTTP 200) instead of a new
  row.
- R8 Missing valuation price: holding value is reported as "unpriced" —
  excluded from market value totals, totals carry `incomplete: true` and the
  unpriced cost basis separately; net worth keeps using cost basis for
  unpriced holdings (existing `investment-value.util.ts` behaviour) and the
  UI says so. Never 0, never -100%.
- R9 Settlement: sell proceeds credit the pocket on the transaction, but
  proceeds whose `settlementDate > today` count as `held`; available =
  recorded − held. Settlement date default = trade date + configured days
  per market (IDX T+2, US T+1, crypto T+0, mutual funds T+0 recorded only
  when the user enters it), always editable ("sesuai broker").
- R10 Charts only from real data: portfolio value history is computed from
  the transaction replay × stored `InvestmentPrice` history; if fewer than 2
  real points, show an empty state, not a line.

### Task 5: Investasi schema, migration, contracts

Prisma models/fields per R2, R4, R5, R6, R7 plus on `InvestmentTransaction`:
`kind` (`buy`,`sell`,`opening`,`dividend`,`coupon`,`interest`,`corporate_action`),
`cashAccountId?`, `cashTransactionId?` (link to the cash `Transaction`),
`grossAmount`, `fee`, `tax`, `netAmount` (Decimal), `currency`, `fxRate?`
(Decimal 24,6, IDR per unit at execution), `effectiveDate` (Date),
`effectiveTime` (String "HH:MM"? or Time — nullable), `timeZone?`,
`settlementDate?`, `idempotencyKey?` (unique with familyGroupId), `status`
(`active` | `void`), `voidedAt?`, `voidReason?`, `note?`,
`attachmentId?`/document link if the attachments model allows. Keep
existing columns (backfill `effectiveDate` from `occurredAt`, `kind` from
`type`). `Investment.details Json?` for type-specific data (bond coupon /
maturity / price convention / accrued interest; gold form physical|digital,
unit, purity; deposit bank, start, maturity, rate, rollover; other: unit +
valuation method). `InvestmentPrice` gains `currency`, `unitLabel?`,
`reference?`, `hasTime`. Audit: reuse `AuditLog` (`schema.prisma` ~1409) if
it fits, else add `InvestmentTransactionAudit { id, transactionId, action (create|edit|void), before Json?, after Json?, actorUserId, at }`.
Write the additive migration (with the R5 backfill SQL inside the migration
file — UPDATE … WHERE … and INSERT … SELECT for synthetic openings). Update
contracts DTO schemas (investments, accounts `pocketKind`/`platformAccountId`),
add `INVESTMENT_PLATFORMS` and `MARKETS` config (lotSize, fraction default,
settlement days, price unit label, display unit "lot"/"lembar"/"share"/
"unit"/"gram") in contracts. Rebuild contracts dist. Update API response
DTOs/mappers so existing endpoints keep working (`tsc` clean).

### Task 6: Platform accounts & pockets API

NestJS: `PlatformAccountsController` under
`family-groups/:fg/platform-accounts` (list incl. pockets with recorded /
held / available balances, create with initial pockets, update, delete when
empty) + pocket create (creates `Account` type `investment` linked to the
platform account, currency, pocketKind). Same guards/abilities as accounts
(`@PageAccess("investments")` or the investments page key — check existing
controller; `CheckAbility` manage/read on `Investment`), owner rules like
`AccountsService` (row-scoped members see own). Pockets must also appear in
`GET accounts` (type investment) without double counting in net worth.
Top-up and withdrawal reuse the existing transfer transaction path (bank →
pocket, pocket → bank): add `POST …/platform-accounts/:id/pockets/:pocketId/top-up`
and `/withdraw` that call `TransactionsService.create` with a `transfer`,
accepting `sourceAmount`, `sourceCurrency`, `destAmount`, `destCurrency`,
`fxRate`, `fee` and `idempotencyKey`; the fee is a separate expense linked
like the existing admin-fee pattern (`toAccountId` + `adminFee`). A top-up
never creates income.

### Task 7: Investment ledger engine (replay, backdate, idempotency, audit)

Pure module `apps/api/src/investments/ledger/replay.ts` (no Prisma) +
service integration:

- `replay(transactions)` orders by R6, applies opening/buy/sell/corporate
  actions with Decimal (Prisma.Decimal / decimal.js), weighted-average cost
  (R1: buy cost = gross + fee + tax capitalized; sell realized =
  net proceeds − avgCost × qty), returns per-step quantity, avgCost,
  costBasis, realized and the first invalid step (sell beyond holdings) with
  a conflict description.
- Cash check: for buys with a pocket, compute the pocket's balance at the
  effective point (current balance minus later cash movements, ordered by
  the same key) and reject when insufficient; also reject when inserting a
  backdated debit makes any later point negative. Error 409 body
  `{ code: "INSUFFICIENT_FUNDS" | "INSUFFICIENT_HOLDINGS" | "HISTORY_CONFLICT", at, needed, available, conflicts: [{ transactionId, date, reason }] }`.
  No auto top-up, no clamping, no margin.
- `create buy/sell/opening/income`, `edit`, `void` endpoints recompute the
  holding (quantity, costBasisPerUnit) and every stored `realizedPnl` from the
  replay inside one Serializable transaction; edits/voids write audit rows.
- Buy debits the selected pocket by gross + fee + tax via a linked cash
  `Transaction` (kind transfer-out to "investment purchase", not an expense);
  sell credits net proceeds; dividends/coupons/interest are income to the
  pocket. Opening never touches cash.
- Idempotency per R7. Execution price is the recorded one (never today's).
- Keep existing endpoints compatible or migrate their callers in the web task.

### Task 8: Prices & valuation

- Market-aware price symbols: Yahoo adapter uses `priceSymbol` (IDX →
  `TICKER.JK`, US → `TICKER`), no more hardcoded `.JK`; crypto via CoinGecko
  ids; gold via existing Antam feed; deposits/bonds valued by method (deposit
  = principal + accrued interest to today at the stated rate, simple, gross;
  bond = nominal × clean price % + accrued coupon when the user supplied a
  price, else cost) — not stock-style prices.
- `POST …/investments/prices/preview` and `/prices/bulk` (manual batch):
  input rows `{ investmentId, price, currency, unitLabel, asOfDate, asOfTime?, timeZone?, source, reference? }`;
  empty price = skipped (keeps previous); preview returns per-row status
  `updated | skipped | failed`, old/new value and impact; save writes
  `InvestmentPrice` rows only — never transactions, cost or cash.
- Valuation summary endpoint for the page: per holding market value (in
  holding currency and display currency with valuation FX separate from
  execution FX), price age + stale flag (> 3 days for daily markets, > 1 day
  crypto, configurable in MARKETS), unpriced flag; totals with `incomplete`
  (R8): asset value, platform cash (recorded/held/available), total, cost
  remaining, unrealized, realized; percentage `null` when cost basis is 0 or
  unknown.

### Task 9: Investasi page shell, summary, filters, Portofolio tab

Replace `apps/web/src/app/(app)/investasi/page.tsx` (2688 lines) with a
modular page under `investasi/` (components split by concern, each < 400
lines), matching `invest-0.jpeg`: header (title `<p>`, subtitle,
`Top up dana`, `Update harga`, primary `Tambah investasi`, "Pencatatan
manual" badge), summary (Total investasi = asset value + platform cash, with
breakdown line; Modal aset; Laba/rugi belum terealisasi and terealisasi
separately; last price update time/zone/source; incomplete-valuation
notice), filters (Pemilik akun, Akun platform, Jenis aset, Pasar, Mata uang
tampilan), tabs Portofolio / Dana platform / Riwayat (URL state `?tab=`),
Portofolio table (instrument with market badge, platform/pocket, holdings
shown per market: IDX "10 lot · 1.000 lembar", US "12,5 shares", units/
grams; avg price; market price with age; market value; P/L with sign + %
or "—"; `Lihat detail` + menu), search, sort, pagination (20/page), loading
/ empty / error / unpriced states; phones: list cards. Portfolio value chart
per R10. Jenis investasi chips filter. Recent activity list.
Keep `investasi.css` page-local; dark mode per Task 4 idea.

### Task 10: Dana platform & Riwayat tabs + Top up dialog

Dana platform: platform accounts with pockets (recorded / held / available,
currency), add platform account (catalog picker + custom), add pocket, Top
up / Tarik buttons. Top up dialog: source bank account (from accounts of
type bank/cash/ewallet), destination pocket, amounts (cross-currency shows
source amount, destination amount, actual rate, fee), date/time optional,
idempotency key; copy states a top-up is a transfer, not income. Riwayat:
all investment + pocket transactions, filters, status (Selesai / Menunggu
penyelesaian / Dibatalkan), edit/void with confirmation and conflict
display (409 body).

### Task 11: Tambah investasi drawer

Wide drawer (`PanelContent` size lg or ≥ 680px; full-screen sheet on phone)
matching `invest-2.jpeg`: 7 type tiles (Saham, Reksa Dana, Obligasi, Emas,
Kripto, Deposito, Lainnya); Cara pencatatan radio (Pembelian baru /
Catat kepemilikan awal); dynamic fields per spec §5 (ticker only where it
applies; manual instrument allowed; time optional + timezone; date-only
allowed); owner, platform account + pocket (required for new purchase),
market, quantity with unit switch (lot only for IDX), price per unit, fee/
tax actual, note, proof upload (existing attachments if available, else
omit with no fake control). Live estimate: gross, total debit, available
before/after (warn and block when insufficient), equations shown (e.g.
"(200 lembar × Rp 9.500) + Rp 2.850"). Opening: date of position + cost
basis if known ("tidak diketahui" allowed → cost null → P/L "—"). Server
errors (409) shown near the relevant field.

### Task 12: Beli / Jual dialog

Matching `invest-3.jpeg`: Beli/Jual segmented, pocket (with available),
instrument (current holdings), quantity in lot⇄lembar (IDX) or shares/units
with fraction rules, execution price per unit, date + time (zone shown),
actual fee/tax, settlement date for sells ("Sesuai broker"), summary block
(gross, total debit / net proceeds, remaining funds / remaining holdings),
settlement notice for pending proceeds, "Tidak ada order yang dikirim"
note, idempotency key, 409 conflict display.

### Task 13: Update harga dialog

Matching `invest-4.jpeg`: tabs "Dari sumber data" (only sources that exist:
run the existing refresh for priced markets and show per-row result) and
"Input manual" (table: instrument, price unit, previous price + date, new
price input, source select, status Siap/Belum diisi/Gagal), date/time/zone,
reference link + optional proof, summary "n diperbarui, m dilewati",
optional valuation FX, preview of impact per holding, save → bulk endpoint.
Copy: "Harga kosong mempertahankan harga sebelumnya, bukan nol" and "tidak
mengubah transaksi atau saldo kas".

### Task 14: Investment detail page

Route `apps/web/src/app/(app)/investasi/[id]/page.tsx` matching
`invest-1.jpeg`: breadcrumb, identity (name, ticker badge, market • type,
owner, platform/pocket), actions Catat beli / Catat jual / Update harga;
KPI row (holdings, current price with source/date, market value, cost,
unrealized P/L); tabs Ringkasan / Transaksi / Dokumen; value chart (R10);
calculation breakdown card (quantity, average price incl. fees, cost,
market price, market value, unrealized with formula text, note that sell
costs aren't deducted); realized P/L table + total; income (dividend /
coupon / interest) list with add action; corporate actions recorded as
their own kind (not buys); transactions table with edit/void.

### Task 15: Integration pass

Wire every Investasi piece together, remove dead code from the old page
(keep reused helpers like `holding-price.ts`/`instrument-units.ts` only if
still used), ensure dashboard/laporan still compile against changed DTOs,
nav "Investasi" works, i18n parity (id/en) for all new keys, `tsc` + eslint
clean across `apps/api` and `apps/web`, contracts dist rebuilt.

## Aset

Spec: `docs/superpowers/specs/2026-10-19-aset.md` (binding), audit
`docs/superpowers/specs/2026-10-19-aset-audit.md`, images
`docs/design/refs/2026-10-19/aset-page.png`, `aset-detail.png`. Depends on
Investasi Tasks 5–8 (valuation service). Rulings (binding):

- A1 One valuation source: an API `AssetsOverviewService` builds the Aset
  page from accounts (net-worth rules: `includeInNetWorth`, privacy, row
  scope), investments via the Investasi valuation service from Task 8 (no
  second formula), and physical assets. The web stops summing on the client.
- A2 Classification ≠ storage ≠ source module: each overview row has
  `class` (dana_rekening | investasi | aset_fisik | lainnya), `subtype`,
  `custodian/location`, `sourceModule` (accounts | investments | assets) and
  `sourceId` + link. An investment pocket Account (type investment) appears
  once, under Dana & rekening, not again inside Investasi value.
- A3 Gold/property de-dup: `Asset.investmentId` (nullable, unique) links a
  physical asset to an Investment; linked assets are excluded from asset
  totals everywhere (dashboard, reports, ai-advisor, snapshot, overview) and
  shown as one row with both sources. `Account.type=property` keeps its
  current meaning; overview flags possible duplicates for the user, never
  auto-merges by name.
- A4 Asset history: `AssetHistory` gains `effectiveAt` (backfilled from
  `recordedAt`), `hasTime`, `timeZone`, `kind` (opening | valuation |
  correction | buy | sell | quantity_change), `source`, `reference`,
  `createdAt`; ordering `(effectiveAt, hasTime date-only first, createdAt,
id)`. `Asset.currentValue` = value of the latest by effective order (a
  backdated entry never overrides a newer one). Projections stay estimates,
  labeled, never written into history unless the user explicitly records
  them as a valuation with a source.
- A5 Asset quantity/units & transactions: `Asset` gains `quantity?`
  (Decimal), `unit?` (gram, unit, m², …), `valuationModel` (per_unit |
  total), `internalCode`, `custodian?`, `ownerUserId?`, `status` (active |
  sold | archived), `soldAt?`; new `AssetTransaction` (buy | sell | opening)
  with cash account, fee, net amount, effective date/time, idempotency key —
  cash legs and weighted-average cost same rules as Investasi R1/R6/R7.
  Delete becomes archive (hard delete only for rows with no history).
- A6 Change semantics: change since previous valuation = new − previous by
  effective order, % = diff / previous (null when previous ≤ 0 or unknown →
  "—"); today change only when a valid previous-day valuation exists, else
  "Belum ada valuasi pembanding"; buy/sell effects separated from price
  change; unrealized P/L = value − remaining cost basis.
- A7 Permissions: assets get owner + row-scope filtering in the backend
  like accounts (owner, shared-with, family); custom row-scoped roles see
  only their own assets.

### Task 16: Aset schema, migration, contracts

Prisma + additive migration for A3, A4, A5 (enum additions in their own
migration step if needed), backfill `effectiveAt = recordedAt`,
`status = active`; contracts for overview rows, valuation basis enum
(`market` | `manual` | `stale` | `cost_basis` | `unpriced` | `failed` |
`zero_valid`), asset transactions and history events. Rebuild contracts
dist. Keep existing endpoints compiling.

### Task 17: Aset overview & valuation API

`GET family-groups/:fg/assets/overview` (filters: q, class/subtype, owner,
platform/custodian, value min/max (IDR), quantity min/max + unit (only
compares same unit), acquired date range, status, valuation completeness;
sort; pagination) returning rows per A2 with value, valuation basis, price
date/source, change since previous valuation (A6), quantity+unit,
acquisition (first date + `multiple` flag), and summary {gross total, dana
& rekening, investasi, aset fisik/lainnya, valuation date, display
currency, incomplete, `scope: "filtered" | "all"`} plus net worth as a
separate metric. Fix NVDA Rp0 at the source (market-aware pricing from
Task 8; unpriced → basis `unpriced`/`cost_basis`, never 0). Backend
permissions per A7. Exclude linked/archived/sold rows from every aggregate
(dashboard, reports, ai-advisor, snapshot writer).

### Task 18: Asset history, transactions & Update Nilai API

Endpoints: asset buy / sell / opening (A5, idempotent, cash legs, available
quantity at effective time, realized P/L), valuation create with
effective date/time/zone, source, reference, note (preview endpoint
returning quantity used, comparison, new value, diff/% and total impact,
backdate warning), edit/void with audit + recompute, history list with
deterministic order and event kinds. Value updates never touch cash or
cost.

### Task 19: Aset Saya page

Rewrite `apps/web/src/app/(app)/aset/page.tsx` (modular, files < 400 lines)
to `aset-page.png`: header (title `<p>`, subtitle, Update nilai, Tambah
aset), summary strip (gross total labelled "Aset bruto • Liabilitas
ditampilkan terpisah", 3 class blocks with share bars, valuation date +
currency, filter-scope note), filter bar (search, tipe, pemilik, rentang
nilai, rentang kuantitas+satuan, tanggal perolehan, status, kelengkapan
valuasi, urutkan, reset + active-filter chips), class tabs, table (asset +
code/ticker, type chip with icon, owner, platform/location, quantity+unit,
acquisition date or "Beberapa pembelian", current value + basis label,
change with arrow + sign text, "Sumber: Investasi" chip with link, ⋯ menu),
pagination, recent asset activity, empty/error/loading states, phone list
cards, icon map with fallback for every type (incl. deposito), icon buttons
with aria-label + tooltip, delete only inside the menu with confirmation.

### Task 20: Aset detail page + Update nilai drawer

Rewrite `apps/web/src/app/(app)/aset/[id]/page.tsx` to `aset-detail.png`:
identity (name, class, owner, internal code or ticker, custodian), actions
Catat beli / Catat jual / Update nilai / Edit informasi (investment-linked
assets route to the Investasi buy/sell/price flows), KPI strip (quantity,
cost, current price per unit or total, value, unrealized P/L with %),
last valuation time/zone/source, tabs Ringkasan / Transaksi / Riwayat nilai
/ Dokumen, value chart from stored history only (R10), calculation card,
"Perubahan hari ini" per A6, history table with filters (Semua / Beli /
Jual / Valuasi) showing qty before/after, price, value before → after,
source, recorder, note. Update nilai drawer (wide; full-screen sheet on
phone): price per unit or total value by valuation model, unit, currency,
date*, time + zone (optional — date-only allowed), source*, reference,
proof (only if attachments support exists), note, live preview (quantity,
comparison value, new value, change nominal/%, impact on total, backdate
warning); copy "Tidak mengubah saldo kas atau harga beli".

## Asuransi

Spec: `docs/superpowers/specs/2026-10-19-asuransi.md` (binding), audit
`docs/superpowers/specs/2026-10-19-asuransi-audit.md`, images
`docs/design/refs/2026-10-19/asuransi-page.png`, `asuransi-form.png`.
Rulings (binding):

- S1 Dates split: new nullable `nextPremiumDueDate`, `renewalDate2`→ name it
  `policyRenewalDate`, `premiumPaymentEndDate`, `coverageStartDate`,
  `coverageEndDate`. Legacy `renewalDate` stays; migration copies it into
  `nextPremiumDueDate` ONLY (its current runtime meaning — pay advances it)
  and never into coverage end. Pay flow, billing worker, notifications and
  web switch together to `nextPremiumDueDate`. Reminders come only from the
  premium schedule.
- S2 Policy type `policyType` (traditional | unit_link) nullable enum, user
  confirmed; never inferred from names. Status gains `masa_tenggang`, `lapse`,
  `berakhir`, `dibatalkan` (keep legacy values readable); payment status is
  separate (per due: scheduled | paid | overdue).
- S3 Roles: `holderUserId?/holderName?`, `InsuranceInsured[]` (member or
  free-text), `payerUserId?/payerName?`; beneficiaries keep their table
  (relationship + %; sum ≤ 100 validated, = 100 warned when incomplete).
- S4 Benefits: `InsuranceBenefit { kind (life_sum_assured | health_annual_limit | per_event | daily | critical_illness | accident | other), amount, currency, period?, note }`;
  legacy `coverageAmount` backfills one benefit marked `confirmed=false`
  (kind life_sum_assured when type jiwa, else other). Summaries group by kind
  - currency; never one combined "total protection". Sum assured is never an
    asset.
- S5 Unit link / cash value: `InsuranceFund { code/name, currency }`,
  `InsuranceValuation { fundId?, units?, navPerUnit?, navDate?, unitsDate?, reportedValue?, cashValue?, surrenderEstimate?, guaranteed (bool), effectiveDate, source (manual | report), documentId?, page?, snippet?, status (ai_extracted | needs_confirmation | confirmed), createdAt }`;
  value per fund = units × NAV (Decimal) only when both present and dates
  compatible (else warning); never both reported value and units×NAV for the
  same fund/date; latest by effectiveDate (backdated upload never
  overrides). Traditional: no unit/NAV fields, but cash value / maturity
  benefit allowed.
- S6 Net worth: only `confirmed` policy value of policies with
  `includeInNetWorth=true` (default false) counts, via one shared helper used
  by dashboard, reports and the Aset overview (`sourceModule: insurances`) —
  counted once. Premiums paid never become asset value. Value updates never
  create cash transactions.
- S7 Payments: `InsurancePayment { insuranceId, dueDate, paidAt, amount, currency, accountId, transactionId unique, idempotencyKey unique per insurance }`
  — pay creates exactly one expense transaction (existing behaviour) +
  payment row; retries return the original. Backfill payments from existing
  transactions with `insuranceId`. Allocation to costs/investment only when
  the user supplies allocation data.
- S8 AI reading: reuse the bring-your-own AI key (`AiKey`, `use-ai-key.ts`)
  and the statement-PDF pattern (browser extracts the PDF text layer with
  pdfjs; server endpoint returns a preview with per-field `{ value (string), page, snippet, status }`;
  nothing saved before user confirmation; money/units as strings, all math
  deterministic server-side with Decimal). No AI key → the button is
  disabled with an explanation and a link to set the key; manual entry
  always available. Scanned PDFs without text → explicit "tidak bisa dibaca"
  error. Endpoint gated with `@CheckAbility` + throttle. Uploaded policy
  documents stored via `StoragePort` in a new `InsuranceDocument` model with
  tenant + permission checks.
- S9 Permissions: policies get owner/row scoping like accounts (holder,
  payer, insured or explicit share can see; Master/Co-Master see all);
  documents follow the policy.

### Task 21: Asuransi schema, migration, contracts

Prisma + additive migration(s) for S1–S5, S7 (enum value additions in their
own migration step; timestamps after 20261019100000), backfills per S1, S4,
S7 inside the migration SQL; contracts schemas; rebuild dist; keep existing
endpoints compiling (quickinput and anggaran obligations read
`coverageAmount` — keep it populated or switch them to the primary benefit).

### Task 22: Asuransi API

CRUD with roles/benefits/funds; schedule util (next due from frequency
monthly | quarterly | semiannual | yearly | single | custom, month-end clamp,
user timezone `Asia/Jakarta` default); summary endpoint (premium due in a
period, active count, benefits grouped by kind+currency, confirmed
investment/cash value with date+source); filters (holder, insured,
provider, type, policyType, status, due period, currency); pay with
idempotency (S7) and reminders from the premium schedule only with dedupe
(one per policy per due date); valuations CRUD with confirmation state;
net-worth helper (S6) wired into dashboard + reports (+ Aset overview when
Task 17 exists); permissions (S9). Fix `getSummary` mixed-currency sum and
the quarterly/yearly truncation.

### Task 23: Asuransi AI report reading + documents

`InsuranceDocument` upload/list/download/delete (StoragePort, 5 MB,
pdf/jpg/png, tenant + S9 checks); `POST …/insurances/report-preview`
taking extracted PDF text pages (from the browser) → provider call with the
family AI key → zod-validated preview `{ fields: [{ key, value, page, snippet, status, conflict? }], missing: [] }`
— no confidence numbers; `POST …/insurances/:id/valuations/confirm` saves
confirmed values with document reference. Web hook mirroring the
statement-PDF reader for text extraction. Throttled, `@CheckAbility`.

### Task 24: Asuransi page

Rewrite `apps/web/src/app/(app)/asuransi/page.tsx` (modular, < 400 lines
per file) to `asuransi-page.png`: header (title `<p>`, subtitle, Unggah
laporan, Tambah polis, Catat pembayaran), summary (premium due this
period, active count, benefits grouped by kind/currency, confirmed unit
link/cash value with date+source, callout "Uang pertanggungan bukan saldo
aset"), Daftar polis with search + filters (S-list), columns (policy +
provider, jenis + tipe badge, holder / insured, premium + period, main
benefit, next premium due + days badge, status badge, Lihat detail, menu),
Jadwal premi berikutnya with Catat pembayaran, Nilai polis unit link card
with "Perbarui dari laporan" and the "Tidak semua premi menjadi investasi"
note; no big uninformative chart; normalized monthly/yearly premium labelled
as normalization; phone list cards; all states.

### Task 25: Asuransi form drawer + detail page

Drawer (wide ≥ 760px desktop; full-screen sheet on phone) to
`asuransi-form.png` with section anchors Informasi polis / Premi & manfaat /
Investasi (only the active section's anchor highlighted; long form with
anchors, not fake tabs): fields per spec §3–§6 (Tipe asuransi beside Jenis;
wide premium and sum-assured inputs with currency + period not squeezed;
dates per S1; roles per S3; benefits list per S4; unit link sub-funds table
per S5 with computed value and "Perlu konfirmasi" state; traditional shows
cash value fields instead), "Baca laporan dengan AI" per S8 opening a review
step (field, value, page/snippet, status, edit, confirm), beneficiaries +
documents, notes collapsible; sticky footer. Detail route
`apps/web/src/app/(app)/asuransi/[id]/page.tsx` with tabs Ringkasan /
Manfaat & rider / Premi & pembayaran / Investasi & nilai tunai / Penerima
manfaat / Dokumen & riwayat; calculation breakdowns; payment history,
benefit changes and value history separated.

### Task 26: Tests & verification (final)

Write and run all tests (user: testing at the end):

- Kas: `kas-model.test.ts` (exists), new `dana.test.tsx` for the page/forms/
  reconcile; API `account-reconcile.service.spec.ts` (exists), dashboard
  net-worth opt-out (exists).
- Investasi (spec §12): top-up doesn't raise net worth; buy debits the right
  pocket; BEI lot vs fractional US shares; partial sell keeps cost basis;
  backdate recomputes history; insufficient funds/holdings + historical
  conflict; empty/stale price + source failure; price update doesn't touch
  cash; cross-currency rate + fee; retry no duplicate; opening doesn't debit;
  the worked example 2 lot × 100 × Rp9.500 + Rp2.850 = Rp1.902.850, Rp5.000.000
  → Rp3.097.150.
- Aset (spec `docs/superpowers/specs/2026-10-19-aset.md` §13): investment value equal across Investasi, Aset list, detail and totals; empty price never 0; Rp10jt→Rp11jt = +Rp1jt/+10%; Rp11jt→Rp10jt = −Rp1jt/≈−9,09%; same-day ordering; backdate doesn't override newer valuation; buy/sell not counted as price change; partial sell updates qty+cost; value update doesn't touch cash; linked assets and platform cash counted once; numeric/date filter+sort; FX source/date shown; owner/shared permissions enforced in backend.
- Asuransi (spec `docs/superpowers/specs/2026-10-19-asuransi.md` §11): jenis+tipe stored and filterable; premium ≠ sum assured ≠ investment value; long amounts not clipped; monthly/yearly schedules + month-end rollover; coverage end never used as premium due; multiple sub-funds without duplication; 1.000 unit × Rp12.500 = Rp12.500.000 in decimal; empty → not zero; AI extraction requires confirmation; backdated report doesn't override newer; payment retry no duplicate; policy value not double counted in net worth; backend permissions on policies and documents; responsive.
- Update every existing spec/test broken by the changes (investments service
  spec, investasi web tests, dana tests, currency tests, i18n parity).
- Run: `cd apps/api && npx jest`, `cd apps/web && npx jest`,
  `bash scripts/qa.sh`, `bash scripts/test.sh`, `bash scripts/security-check.sh`.
- Browser check on the dev server (wealthme.demo-wit.id via host dev) at
  1440/820/390 in light and dark for /dana, /rekening, /investasi,
  /investasi/[id] and each dialog; capture screenshots under the scratchpad.
