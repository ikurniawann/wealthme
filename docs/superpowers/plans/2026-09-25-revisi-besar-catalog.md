# Revisi Besar (2026-09-25) — Evidence Catalog & Plan Split

> **Status:** catalog — recorded first, as requested ("catat terlebih dahulu").
> Each item below has been traced to code and, where the cause was not visible
> from code alone, reproduced live on `localhost:3000` (local web+api, DB on
> wit-hq dev via SSH tunnel, demo user `demo@wealthme.id`).
>
> This is **not** yet a bite-sized task plan. The 17 items span 7 independent
> subsystems, so per the writing-plans scope rule they are split into the
> sub-plans listed at the bottom. Items marked **DECISION** need one answer
> from you before their sub-plan can be written; everything else is ready.

Legend — **Size:** S (≤ 1 file, < 1 h) · M (2–5 files, ½–1 day) · L (schema/API + UI, 1–3 days)

---

## 1. Ringkasan — currency picker only offers IDR / USD / Gram Emas

**Evidence**

- `apps/web/src/app/(app)/ringkasan/_components/page-lead.tsx:16` — `DisplayCurrency = "IDR" | "USD" | "GOLD"`; options hardcoded at `:54-58`.
- `hero-stats-section.tsx:31,34,49` — conversion is special-cased on `"USD"` only.
- Supported currency universe already exists: `apps/api/src/fx/fx-mock.service.ts:12-20` (IDR, USD, SGD, EUR, JPY, AUD, CNY) and `apps/web/src/app/(app)/akun/page.tsx:1098-1109` (same 7 with flags).
- Existing reusable hook: `apps/web/src/hooks/use-currency-preference.ts` (fetches `/fx/rates?base=IDR`).

**Root cause** — Picker was built for one design decision (IDR/USD/gold), never generalised to the FX table.

**Proposed fix (Size M)**

- `DisplayCurrency = CurrencyCode | "GOLD"`; drive the segmented control from the same 7-code list as `/akun` (move that list + flags into a shared constant under `apps/web/src/lib/currencies.ts` — one source of truth).
- Replace the USD-only branch with `fx.rates[displayCurrency]`; keep the "kurs indikatif" label (FX is a mock table — Open Design Decision #6).
- UI: segmented `IDR | Emas | [currency ▾]` — the third segment opens a small menu of the 6 foreign codes (per your "klik dolarnya lalu pilih currency").

---

## 2. Ringkasan — "Tren Kekayaan Bersih" chart often empty / appears late

**Evidence (live)** — `GET /dashboard/net-worth/history?range=12m` → **54 points**, 2026-07-21 → 2026-09-25, one per day (`net-worth-snapshot.scheduler.ts` cron `0 2 * * *`).

- `use-ringkasan-data.ts:75-87 groupHistoryPointsByMonth()` collapses those 54 daily points to **3 monthly** points.
- `trend-composition-section.tsx:72` renders the empty state when `values.length < 2`.

**Root cause**

1. Monthly bucketing is applied to _every_ range, so `1m` → 1 bucket → empty state, `3m` → ≤ 3 points → a 2–3 point "line".
2. Data only exists from the first 02:00 cron after a family is created; a brand-new family sees nothing for up to a day, and there is no on-demand snapshot.

**Proposed fix (Size M)**

- Bucket by range: `1m`/`3m` → daily (raw), `6m` → weekly (last point per ISO week), `12m`/`ytd`/`all`/`custom` → monthly. Unit-test the bucketer.
- API: append a **live "today" point** to `getNetWorthHistory` computed from the same rollup as `/dashboard/net-worth` (so the chart is never behind by a day and new families get their first point immediately). Keep the persisted snapshots as the historical series.
- Copy in the empty state: "Tren mulai terisi setelah snapshot harian pertama (02:00)" instead of a generic "Belum ada data".

---

## 3. Laporan — date picker z-index broken; make it the ONE date picker everywhere

**Evidence (live)** — with the picker open on `/laporan`, the popover's ancestor `.card.report-filter-card` has `transform: matrix(1,0,0,1,0,0)`, `animation-name: page-in`, `fill-mode: both`.

- `apps/web/src/app/design-system.css:4534-4541` — `.page > * > * { animation: page-in .55s … both }`; `page-in` animates `transform`, and `both` keeps an identity transform applied → **each card becomes its own stacking context**, so `.date-range__pop { z-index: 65 }` (`:2376-2380`) cannot escape the filter card and the next card paints over it.
- Picker component: `apps/web/src/components/wm/date-range-field.tsx` (`DateRangeFilterField`, range-only, in-flow `position:absolute`).
- Native `<input type="date">` still used in **12 files**: `akun`, `aset/[id]`, `aset`, `asuransi`, `donation`, `investasi`, `laporan/…/harian-section`, `liabilitas`, `ringkasan/page-lead` (custom range!), `transaksi`, `components/crud/crud-modal.tsx`, `components/shell/transaction-dialog.tsx` (+ `hooks/receipt-scan.ts`).

**Proposed fix (Size L, foundation change — touches protected `design-system.css` + `components/wm`)**

- Stacking: render `.date-range__pop` through a portal (`createPortal` to `document.body`, positioned from the trigger's rect) so no ancestor transform can trap it. This is more robust than removing the animation.
- Add a single-date sibling `DateField` in the same file sharing the calendar grid (`from === to`, one click applies), same `.date-range__*` class contract.
- Migrate the 12 native inputs to `DateField` / `DateRangeFilterField`. One sub-task per page; visual check via playwright-cli at 390 px and 1280 px.

---

## 4. Anggaran — what does "auto-debet" do? How does it behave for weekly/daily budgets?

**Evidence**

- `schema.prisma:865 Budget.autoDebitDay Int?`; written by `budgets.service.ts:256,319`; displayed at `anggaran/page.tsx:138`, input at `:814-1120` (1–28, "day of month").
- **No consumer**: only `GoalAutoDebitScheduler` exists (`apps/api/src/goals/`). No budget scheduler/processor reads `Budget.autoDebitDay`.

**Root cause** — Dead field: it is stored and shown but never acted on. Its semantics ("day of month") are also meaningless for `weekly`/`daily` periods.

**DECISION needed** — pick one:

- **(a) Remove** `autoDebitDay` from Budget UI + DTOs (keep the column, no migration) — Size S. Budgets are spending _limits_; automatic money movement belongs to Tujuan/Liabilitas.
- **(b) Implement** it as "auto-create the obligation transaction on day N of each period" — requires a source account, a scheduler, weekly/daily semantics (day-of-week / every day), and idempotency. Size L.

Recommendation: **(a)**. Nothing in the product currently needs money to move out of a budget automatically.

---

## 5. Tujuan — you can add a goal, but how do you _pay into_ it?

**Evidence**

- `goals.controller.ts` exposes only `GET / POST / PATCH :id` — **no contribution endpoint**.
- `goals.service.ts:287-321 runAutoDebit()` — runs on cron `0 3 1 * *` (`goal-auto-debit.scheduler.ts:9`), bumps `currentAmount` only, **ignores `autoDebitDay`**, does **not** debit any account or create a Transaction.
- `Goal.currentAmount` is otherwise only editable via `PATCH` (a raw number).

**Root cause** — Goals are not connected to money at all; "auto-debit" is a monthly counter increment.

**Proposed fix (Size L)**

- Add `GoalContribution` (goalId, amount, accountId?, occurredAt, source: manual|auto, transactionId?) and `POST /goals/:id/contributions` which (optionally) debits a source account by creating a Transaction and increments `currentAmount` atomically. Also `GET /goals/:id/contributions` for history.
- UI on `/tujuan`: a **"Setor"** button per goal → dialog (amount, source account, date) + a contribution history list in the detail.
- Auto-debit: honour `autoDebitDay` (run the cron daily, debit goals whose day matches), require a `sourceAccountId` when auto-debit is set, and record each run as a contribution.

---

## 6. Rekening → "Mutasi" should land on Transaksi already filtered to that account

**Evidence (live)** — clicking the per-card **"Mutasi"** footer button → `/transaksi` (no query); Transaksi account filter shows "Semua Akun".

- `rekening/page.tsx:362` — footer button pushes `"/transaksi"` (no `accountId`).
- `rekening/page.tsx:296` — the kebab-menu item _does_ push `/transaksi?accountId=…`.
- `transaksi/page.tsx:1119-1182` already reads `accountId` and applies it.

**Root cause** — one wrong `router.push` on the more visible of the two buttons.

**Proposed fix (Size S)** — `:362` → `router.push(\`/transaksi?accountId=${account.id}\`)`; add a test asserting both entry points carry the id.

---

## 7. Rekening — what does "Privat" mean if Master can still transact on it?

**Evidence**

- `schema.prisma:603-605` — "Owner-set flag: hides this account (and its transactions transitively) from `member` viewers … Owner/admin_staff always see it."
- `common/utils/privacy.util.ts:9-13,25-29,77` — `isPrivate` only filters reads for non-privileged roles.
- No write-side restriction anywhere.

**Root cause** — Working as designed: _privat = disembunyikan dari anggota biasa_, not _terkunci_. The UI never says this, so it reads as a bug.

**DECISION needed**

- **(a) Keep semantics, fix the copy** — badge tooltip + form hint: "Hanya terlihat oleh Master/Co-Master; anggota lain tidak melihat rekening ini maupun transaksinya." Size S.
- **(b) Add "hanya pemilik yang bisa transaksi"** — a second flag (`isLocked`) or make private accounts only transactable by their `ownerMemberId`. Size M (API guard + UI).

Recommendation: **(a)** now; (b) only if a real family asks for it.

---

## 8. Investasi — Beli allows Lot/Lembar, Jual only Lembar

**Evidence**

- `investasi/page.tsx:802-830` — the Lot/Lembar toggle exists only in the **add/edit holding** form (`form.type === "saham"`).
- `investasi/page.tsx:1089-1290 BuySellModal` — a single `<input type="number">` for quantity (`:1212-1220`), **no unit toggle for either buy or sell**; the API stores canonical lembar.

**Root cause** — The unit toggle was never ported to the transaction modal.

**Proposed fix (Size S/M)** — Reuse the same `QuantityUnit` state + `divideBy100`/`multiplyBy100` helpers in `BuySellModal` for `saham` (buy _and_ sell); label shows the unit; convert to lembar at submit. Combine with item 9's per-type unit map.

---

## 8b. Investasi — detail pop-up too small; needs the two-column layout; history filter by date

**Evidence**

- `investasi/page.tsx:1608` — `<DialogContent className="max-w-lg">`.
- History already loaded from `GET /investments/:id/transactions` (`:1743-1790`) and price history (`:1705-1712`); no date filter.

**Proposed fix (Size M)** — `max-w-4xl` with a two-column body (left: metrics + price history; right: buy/sell history) per your screenshot; add a `DateRangeFilterField` (from item 3) above the history list, filtering client-side (`occurredAt` within range). Mobile: stack to one column.

---

## 9. Investasi — quantity unit must follow the instrument (gram for emas, etc.)

**Evidence**

- `i18n/id.ts:1597` — `fieldQuantityLabel: "Jumlah (lot/unit)"` used for **every** type.
- `investasi/page.tsx:352-390` — display already knows `emas → gram` (`:275,387`) and `kripto → coin`, but the **form** label/placeholder do not.
- Types: `schema.prisma:90-100` — `saham, reksa_dana, obligasi, emas, kripto, lainnya, deposito`.

**Proposed fix (Size S)** — one `UNIT_BY_TYPE` map used by form label, placeholder, list, detail and BuySellModal:

| type       | unit           | notes                                    |
| ---------- | -------------- | ---------------------------------------- |
| saham      | lot ⇄ lembar   | toggle, canonical lembar                 |
| reksa_dana | unit (UP)      | 4 dp                                     |
| obligasi   | unit / nominal | `Rp` nominal, price in % of par optional |
| emas       | gram           | 3 dp                                     |
| kripto     | coin           | 8 dp                                     |
| deposito   | —              | nominal only (already exempt)            |
| lainnya    | unit           | free                                     |

---

## 10. Aset — add "Emas" as an asset type

**Evidence** — `schema.prisma:75-81 AssetType { properti, kendaraan, elektronik, perhiasan, lainnya }`; `packages/contracts/src/assets/index.ts` mirrors it.

**Proposed fix (Size M)** — Prisma migration adding `emas` to `AssetType`; contracts + web select + i18n; optional `weightGram` so Aset-emas can be valued from the family gold price (item 11). Physical gold held as an asset (perhiasan/batangan simpanan) vs. investment gold stays a user choice — both exist.

---

## 11. Investasi emas — current price should come from Settings › Harga Emas

**Evidence**

- Family gold price exists: `FamilyGroup.goldPricePerGram` (`schema.prisma:461`), `GET/PATCH /family-groups/:id/gold-price` (`family-groups.controller.ts:111,254`), web hook `hooks/use-gold-price.ts`.
- `investasi/page.tsx:128` — `AUTOMATED_PRICE_TYPES = ["saham","kripto"]`; `emas` is "manual-priced" and the form asks for a manual price every time; `investments.service.ts:574` confirms manual is the only path.

**Proposed fix (Size M)** — Treat `emas` as **family-priced**: `investments.service` values emas holdings as `quantity × familyGroup.goldPricePerGram` when set (fallback: last manual price); the form hides the manual price field for emas and shows "Harga dari Pengaturan › Harga Emas (Rp X/gram, diperbarui …)" with a link. Optionally auto-write a price-history row whenever the family gold price changes.

---

## 12. Liabilitas — interest must reflect how KK / kendaraan / KPR actually work

**Evidence**

- `schema.prisma:1178-1207 Liability` — fields: `totalDebt, remainingBalance, minimumPayment, interestRate (Decimal 5,2), dueDate, autoAdvanceDueDate`. **No tenor, no start date, no interest method, no installment amount.**
- `liabilities/amortisation.util.ts` — one model only: effective interest on remaining balance (`monthlyRate = annual/12`, or per-month for `kartu_kredit`).

**Root cause** — One formula for all `LiabilityType`s. Real products differ: KPR = anuitas (fixed→floating), kendaraan/multiguna = **flat** on original principal, kartu kredit = per-month on outstanding + min-payment.

**Proposed fix (Size L)**

- Schema: `interestMethod enum { efektif, flat, anuitas }`, `tenorMonths Int?`, `startDate DateTime?`, `installmentAmount BigInt?` (computed for anuitas/flat, editable), `fixedRateMonths Int?` + `floatingRate Decimal?` for KPR.
- Util: `computeInstallment()` + `splitPayment()` per method, golden-tested against a bank-style schedule for each of the three products.
- UI: type-driven form (KK: bunga/bulan + min payment; kendaraan: flat rate + tenor; KPR: anuitas + fixed period); show the schedule in the detail.

---

## 13. Asuransi — the error

**Evidence (live)** — "Bayar Premi" on the seeded _Asuransi Jiwa Prudential_ → `POST …/insurances/:id/pay` → **409** `"…sudah dibayar periode ini — koreksi transaksi yang ada, jangan bayar dua kali"`, shown as a raw toast.

- `insurances.service.ts:838-841` — `pay()` rejects whenever `renewalDate > now`.
- `insurances.service.ts:295-316 paidThisPeriodIds()` — the **list** marks `paidThisPeriod` only if a payment _Transaction_ exists inside the current period.
- `asuransi/page.tsx:259` disables the button on `paidThisPeriod` — which is `false` here, so the button is enabled and the API refuses.

**Root cause** — Two different definitions of "already paid": the list uses transactions, `pay()` uses `renewalDate`. Any policy created with a future renewal date (seed, or a user entering next month's date) is stuck: button enabled, payment refused.

**Proposed fix (Size S/M)** — One rule, used by both: `paidThisPeriod = hasPaymentTxInPeriod || (renewalDate && renewalDate > periodEnd)`. Prefer dropping the `renewalDate` guard in `pay()` (the transaction check at `:844-857` already prevents double pay) and instead let `pay()` **advance** a future renewal date correctly. Surface a friendly toast + disabled button with tooltip. Unit tests for both paths.

---

## 14. Pajak — deduction should be the donation total; result always 0; summary empty

**Evidence**

- Deduction: `donations.service.ts:58-62,282-300` — only donations with `isTaxDeductible = true` **and** type ∈ {`zakat_maal`, `zakat_fitrah`, `persepuluhan`} count (PP 60/2010 — only zakat / mandatory religious contributions to recognised bodies are deductible; `infaq/sedekah/wakaf` are not).
- Always 0: `tax/page.tsx:200-245` posts `grossIncome` (as typed) + `ptkp = 54_000_000` to `POST /calculators/pph21` — **and `/calculators/pph21` is broken by item 15's bug (request DTO stripped → 0)**. Secondary: the input never says _annual_ — a monthly figure < PTKP also yields 0.

**Root cause** — (1) item 15's controller bug; (2) UX: no annual/monthly toggle; (3) deduction rule is legally intentional but invisible.

**Proposed fix (Size M, after item 15)**

- Fix comes free with item 15 for the number itself.
- Add "Penghasilan: per bulan / per tahun" toggle (×12), show PTKP status selector (TK/0…K/3) instead of a fixed 54 jt, and show the bracket breakdown.
- Deduction card: show _which_ donations counted ("3 zakat maal · Rp X") and a hint "infaq/sedekah/wakaf tidak termasuk pengurang (PP 60/2010)". **DECISION** if you want _all_ donations counted regardless — I recommend keeping the legal rule and explaining it.
- Ringkasan pajak: same data source once the calculator returns real numbers.

---

## 15. Kalkulator — every result is 0 ← **root cause found, high value, tiny fix**

**Evidence (live)** — `POST /calculators/zakat` with `{cash: 100000000, …, haulConfirmed: true}` → `200 {"zakatable": null, "zakat": 0, …}` (also unauthenticated — route is `@Public()`).

- `calculators.controller.ts:13-24` — **all six request DTOs are imported as `type`-only**: `type ZakatRequestDto`, `type Pph21RequestDto`, `type PerpuluhanRequestDto`, `import type { InvestmentCalcRequestDto, KprCalcRequestDto, RetirementCalcRequestDto }`.
- With `emitDecoratorMetadata`, a type-only import erases the class from the `@Body()` param's runtime metadata → `ValidationPipe({ whitelist: true })` (`main.ts:34`) validates against `Object`, strips **every** property → service computes `undefined + undefined` → `NaN` → JSON `null` / `0`.
- This is a **regression**: commits `25eb351` "remove type-only DTO imports that broke NestJS DI and ValidationPipe" and `6dd8aac` fixed exactly this; the shared lint rule `packages/config/eslint.base.js:32-34` (`consistent-type-imports`, `fixStyle: inline-type-imports`) re-adds `type` on every `eslint --fix`.
- Affects: Zakat, PPh21 (item 14), Perpuluhan, Investasi, KPR, Pensiun. (Tabungan and Split Group are client-side and fine — matches your "hasil 0" being API-backed tabs.)

**Proposed fix (Size S)**

1. Remove `type` from those imports.
2. Prevent recurrence: in `eslint.base.js` add an override for `apps/api/**/*.controller.ts` → `"@typescript-eslint/consistent-type-imports": ["error", { prefer: "no-type-imports" }]` (or `disallowTypeAnnotations` + `fixStyle: separate-type-imports` and a lint rule forbidding `import type` of `*Dto` in controllers).
3. Add an e2e/spec that posts to each calculator and asserts a non-null numeric result (would have caught this).

---

## 16. Master Data — audit; drop what does nothing; make it feed the real dropdowns

**Evidence**

- Groups: `schema.prisma:259-267 ReferenceItemGroup { bank, ewallet, txntype, invtype, lembaga, asettype, instype }`, served by `GET/POST/DELETE /family-groups/:id/reference-items`.
- **Only consumer:** `masterdata/page.tsx` itself. `grep -rl reference-items apps/web/src` → 1 file.
- Meanwhile the real dropdowns are hardcoded: `components/crud/crud-config.ts:94-291` (bank list, `["Tabungan","Giro","Deposito"]`, e-wallets `["GoPay","OVO","DANA","LinkAja","ShopeePay"]`, investment types, insurance types), `donation/page.tsx:108 LEMBAGA_OPTIONS`, and `invtype/asettype/instype/txntype` duplicate **Prisma enums** (`InvestmentType`, `AssetType`, `InsuranceType`) that cannot be extended per family anyway.

**Root cause** — Master Data was built as a standalone CRUD; nothing was ever wired to read it, and 4 of 7 groups mirror enums.

**Proposed fix (Size M)**

- **Remove** groups that duplicate enums: `txntype`, `invtype`, `asettype`, `instype` (UI + seed; keep rows harmless, or migrate-delete).
- **Keep & wire** `bank`, `ewallet`, `lembaga`: a `useReferenceItems(group)` hook feeding the bank select in Rekening (crud-config `bank`, `ewallet`), the Lembaga select in Donasi, and the institution field in Asuransi/Liabilitas (add group `institusi` if you want insurers/lenders too — **DECISION**).
- Selects get an inline "＋ Tambah ke Master Data" affordance so users never have to leave the form.

---

## 17. IAM — "Hubungan Keluarga" vs "Peran"; custom role "sopir" missing when adding a member

**Evidence**

- `iam/_components/add-member-dialog.tsx:84-101` — `role` is a hardcoded union `"dependant" | "operational" | "member" | "spouse"` (system permission tier); `relationship` is `MemberRelationship` (`packages/contracts/src/members/index.ts:9-18`: istri, anak, kakek, nenek, bibi, **supir**, sekretaris, bendahara) — a kinship/household label.
- Custom access roles (`AccessRole`, `schema.prisma:1559`, e.g. "sopir") are only assignable **after** creation via `member-access-dialog.tsx` (`PUT /members/:id/access`, `accessRoleId`).
- So there are **three** overlapping concepts on screen: relationship (label), system role (tier), access role (custom permissions).

**Root cause** — Three concepts, two of which look like "role" to the user, and the add flow only exposes two of them.

**Proposed fix (Size M)**

- Add-member dialog: third field **"Hak Akses"** = select of `AccessRole`s (`GET /access-roles`) with "Bawaan (ikuti peran)" default; POST includes `accessRoleId` so "sopir" appears immediately.
- Rename in UI: _Hubungan_ (kinship) · _Peran sistem_ (tier, keep the 4 fixed) · _Hak akses_ (custom). One `InfoTip` each explaining the difference (component already exists: `components/wm/info-tip.tsx`).
- Optional: when a custom role is chosen, hide/auto-set the system tier to `member` to reduce the choice surface.

---

## Plan split (one sub-plan each, in recommended order)

| #   | Sub-plan                                                                                                      | Items            | Size | Blocked by decision?               |
| --- | ------------------------------------------------------------------------------------------------------------- | ---------------- | ---- | ---------------------------------- |
| A   | **Calculators & Pajak fix** — type-import regression + lint guard + tax UX                                    | 15, 14           | S+M  | 14: keep legal deduction rule?     |
| B   | **Quick fixes bundle** — mutasi link, asuransi paid-state, private copy                                       | 6, 13, 7         | S    | 7: (a) copy only vs (b) lock       |
| C   | **Date picker foundation** — portal + `DateField` + migrate 12 inputs                                         | 3                | L    | — (protected files; needs your OK) |
| D   | **Investasi & Aset** — units per type, buy/sell toggle, detail layout, gold pricing, Aset emas                | 8, 8b, 9, 10, 11 | M+M  | —                                  |
| E   | **Ringkasan** — all currencies, trend bucketing + live point                                                  | 1, 2             | M    | —                                  |
| F   | **Money movement** — Tujuan contributions + auto-debit that moves money; Anggaran auto-debit remove/implement | 5, 4             | L    | 4: (a) remove vs (b) implement     |
| G   | **Liabilitas interest engine** — flat / efektif / anuitas                                                     | 12               | L    | —                                  |
| H   | **Master Data & IAM** — prune + wire reference items; access role in add-member                               | 16, 17           | M    | 16: add `institusi` group?         |

### Decisions I need from you before writing the sub-plans

1. **Item 4 (Anggaran auto-debet):** (a) remove, or (b) implement money movement? — _recommend (a)_
2. **Item 7 (Rekening privat):** (a) explain-only, or (b) also lock transactions to owner? — _recommend (a)_
3. **Item 14 (Pajak deduction):** keep the PP 60/2010 rule (zakat + persepuluhan only, explained in UI), or count every donation? — _recommend keep_
4. **Item 16 (Master Data):** wire `bank`/`ewallet`/`lembaga` only, or also add an `institusi` group for insurers/lenders?
5. **Item 3:** OK to touch the protected `design-system.css` / `components/wm` for the portal + `DateField`?

Everything else is ready to be expanded into bite-sized TDD tasks. I recommend starting with **A** (biggest user-visible win, smallest change) and **B** while you decide the rest.
