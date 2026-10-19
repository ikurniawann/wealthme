# Audit — Modul Asuransi (read-only, 2026-10-19)

Spec: `docs/superpowers/specs/2026-10-19-asuransi.md`. No source edited, no DB queried. "(?)" = uncertain / not verified.

## 1. Data model (apps/api/prisma/schema.prisma)

`Insurance` (schema.prisma:1543-1578), table `insurances` (migration 20260610000002):
| field | type | current meaning |
|---|---|---|
| name `@db.VarChar(150)`, provider (150, null) | text | product name; insurer |
| type `InsuranceType` (197) | enum jiwa/kesehatan/kendaraan/properti/pendidikan/lainnya | the "Jenis". NO traditional/unit_link |
| status `InsuranceStatus` (206) | aktif/tidak_aktif/kadaluarsa | only 3; no grace/lapse/cancelled; payment status is separate computed `paidThisPeriod` |
| coverageAmount BigInt? | single whole-unit "uang pertanggungan" | one number for every type (no benefit structure) |
| premiumAmount BigInt | per payment, whole units | |
| premiumPeriod `PremiumPeriod` (monthly/quarterly/yearly) | | no semiannual / single-pay / custom |
| renewalDate DateTime? (timestamp, not @db.Date) | **overloaded**: UI label "Tanggal Jatuh Tempo (opsional)"; used as next premium due, paid-through marker, AND where users type coverage end | the root of "3.653 hari lagi" |
| autoRenewDate Boolean | worker auto-advances renewalDate when passed | |
| policyNumber (100), notes (500), currency (3, default IDR) | | no masking in list; plain text |
| premiumCategoryId → Category | policy's own expense category | |
| familyGroupId | tenant | only scoping key |
Relations: `beneficiaries InsuranceBeneficiary[]` (1585: name, relationship free text, sharePercent Decimal(5,2), memberUserId? soft FK), `transactions` (Transaction.insuranceId, schema ~966, SetNull), `budgets` (Budget.insuranceId, Restrict).
Missing entirely: policy holder, insured(s), payer, start date, premium-payment end, separate renewal vs coverage end, benefit structure/riders, unit-link funds, cash value, documents link (no InsuranceAttachment), paying account, report/effective-date history, owner userId. "Pemilik" is NOT an Insurance field; the only "owner" usage in the page is the family-member `role === "owner"` default relationship ("Diri sendiri") in the beneficiary picker (page.tsx ~395-410). The "Pemilik" the spec complains about is likely in the reference image / Dana module (i18n dana-v3.ts), not in this module (?).
Contracts: packages/contracts/src/insurances/index.ts mirrors the above (hand-written TS interfaces, not zod, for insurance) (?: confirm no zod elsewhere).

## 2. API (apps/api/src/insurances/\*\*)

- Controller `family-groups/:familyGroupId/insurances`: GET (list), GET summary, POST, PATCH :id, POST :id/pay, DELETE :id. `@PageAccess("insurances")`, CASL `read/manage Insurance`. FX via `FxInputService` + `FX_FIELD_SPECS.insurance` (premiumAmount, coverageAmount digits) and `insurancePayment`.
- Service (1043 lines). `findAll` = `where {familyGroupId}` only: no row scoping. Every role holding `read Insurance` sees every policy (CASL: owner/member/spouse/admin_staff manage; dependant/operational: no Insurance read seen in lines 310-345 (?)). resource-access.ts:72 `insurances: read [asuransi, anggaran], write [asuransi]`.
- `daysUntilRenewal` = `calendarDaysUntil(renewalDate)` (common/utils/due-window.util.ts:22) UTC-day math. Computed server-side, no user timezone. Web `daysUntilDue` (lib/due-date.ts) uses LOCAL day: API and web disagree 00:00-07:00 WIB.
- **"3.653 hari lagi" source**: `renewalDate` (coverage-end typed into "Tanggal Jatuh Tempo") -> `daysUntilRenewal` -> page.tsx `daysUntilRenewalLabel` (148) rendered in PolicyTile (224-227), hero KPI "Perpanjangan berikutnya" (1608), nearest-renewal tip (1429-1433, 1496). 3653 d ≈ 10 yr. Confirmed path; the single column cannot distinguish premium due from coverage end.
- Reminders: only `maybeNotifyRenewal` (service.ts:1003) fired fire-and-forget on create/update, window `isInsuranceRenewalSoon` 0..30 days (due-window.util.ts:45), pref `billDue`. No scheduler/cron premium reminder (?: grep'd notifications.service/billDue; billDue appears in notification-prefs.ts and notifications.service.ts, not inspected in depth). No dedupe: every PATCH within window creates another Notification row. Not tz-aware. Uses renewalDate (so would also fire off a coverage end).
- billing-cycle.processor.ts:53-70: for `autoRenewDate && renewalDate<=now` advances renewalDate by period (`advanceUntilFuture`, no month-end clamp) — no payment created.
- `pay` (service.ts:665-840), `POST :id/pay` `{sourceAccountId, amount?}`: Serializable+retry; guards: `assertNotAlreadyPaidThisPeriod` (renewalDate>now => 409; or any linked txn in current calendar period => 409); account tenant check; overdraft floor; decrements account; creates ONE expense `Transaction` (insuranceId, categoryId, "Premi {name}", occurredAt=now); advances renewalDate by one period anchored max(renewalDate, now) (nextRenewalDate util: month-end clamp, UTC). NO idempotency key (contrast `LiabilityPrepayment @@unique([liabilityId, idempotencyKey])`); retry safety only via the period guard — a retry after commit gets 409, a payment for a past period, partial/extra payment, or 2nd payment in same period is impossible. Paying a policy with no renewalDate: allowed repeatedly only once per calendar period. Amount defaults to premiumAmount; account currency vs policy currency not reconciled (?). Transaction has no currency/premium-vs-investment split. Linked txn is locked from edit/delete (transactions.service.ts:1035).
- `getSummary`: sums active policies' monthly-equivalent premium (integer division quarterly/3, yearly/12 => truncation) and returns `currency: "IDR"` hard-coded; mixed-currency policies are added raw. Premium normalization has no label as "normalized" in API.
- No investment/cash-value logic anywhere. `grep` found no unit/NAV code (only InvestmentType reksa_dana in Investment module).
- Beneficiaries: validate sum <=100 (partial allowed), memberUserId tenant-checked, live-linked name/relationship from Member. Update with `beneficiaries` replaces all (deleteMany+create).
- remove: refused (409) if a Budget line references it; transactions SetNull.
- Budget sync: each policy gets its own FIXED budget line = monthly-equivalent premium.

## 3. Web (apps/web/src/app/(app)/asuransi/\*\*)

Files: page.tsx (1846 lines), asuransi.css, asuransi.test.tsx (14 cases), premium-trend.ts(+test).

- Layout (page.tsx 1519-1700, asuransi.css grid 12 col): BentoHero (monthly premium total + stacked `HatchedBarChart` by type, KPIs: active count, "Pertanggungan" total, nearest renewal), CompositionStack of coverage by type, policy tiles (2-up) with Detail/Bayar/menu, "Tips" card, beneficiary list. "Bayar Premi" header button + "Tambah". No search/filters, no Unggah Laporan, no tabs.
- **Spec violation**: `totalCoverageAktif` (1432-1435) sums coverageAmount across all types AND currencies into one KPI and a composition donut (lines ~1400-1422). Monthly premium hero likewise ignores currency.
- Chart: PREMIUM_TREND_MONTHS = 1 (premium-trend.ts:4) => a one-bar "trend"; legend rendered in hero controls; "Tips" card and chart sit in the hero; labels over chart: legend `.wm-legend` in hero ctrl; no avg line found in page.tsx — the "rata-rata"/notes overlay is in shared `components/charts/bento-charts` (HatchedBarChart `highlight`, `wide`) (?: not opened; protected path).
- Form (InsuranceModal, 566-990): `Dialog` side panel `wm-form-panel`; fields: name, provider, type (Jenis), status, premium (useMoneyField) + period in `wm-form__grid--two`, coverage + renewalDate in `wm-form__grid--two` (bento.css:3998 `repeat(2,minmax(0,1fr))`, gap 12px) => premium/coverage inputs are half-width of a narrow side panel; this is why long numbers clip. Also policyNumber, autoRenew switch, notes (500), beneficiaries in AdvancedDisclosure. No currency selector visible in modal (currency via fxInputs path in `useMoneyField`?(?)), no holder/insured/payer, no tabs/anchors.
- Icons: `INSURANCE_TYPE_LUCIDE` map with `?? FileText` fallback (166/183).
- policyNumber shown only in edit form (no masking logic in list found).
- Roles: beneficiaries only; family members list used to link `memberUserId`.

## 4. Net worth

`dashboard.service.ts:329-405` net worth = cash accounts(includeInNetWorth) + investments (`investmentPositionValue`) + assets − liabilities. `grep -i insurance|coverage|premium` over api/src/dashboard and api/src/reports: NO hits. So coverageAmount, premiums, policy value are NOT in net worth today. Premiums reach reports only as expense Transactions. AssetType enum has no insurance/policy type; Investment has none for unit link. Double-count risks for the future: (a) linking unit-link value as Asset/Investment AND keeping it on the policy; (b) any "cash value" counted + a premium txn already expensed (acceptable, not duplicate); (c) `reports-dashboard-networth-parity.spec.ts` pins dashboard==reports parity — any new component must be added to both.

## 5. AI infrastructure

- Bring-your-own key: `AiKey` (family-level, CASL `manage` owner/spouse, `read` member/others; ai-advisor/ai-key.service.ts, web `hooks/use-ai-key.ts` `useAiKeyStatus` => `configured`, `scanAvailable`). Encrypted via CryptoService; providers claude/openai/gemini; model selectable. No server-key fallback, no mock (explicit in docs).
- Receipt OCR: `transactions/ocr/*` — `OcrPort.extractTransaction(imageBase64)` zod `ocrResultSchema`, adapters per provider, `OcrFactory.create(provider,key,model)`. Image only, receipt-specific schema (amount/description/date).
- Statement PDF: web `hooks/statement-pdf.ts` extracts text layer in browser (pdfjs; password never sent), POST `reconciliation/statement-pdf` (+`/page`, `/preview`, `/confirm`), 5/min throttle, `StatementReaderFactory` + zod port where **money fields are strings, model never produces final amounts** (statement-reader.port.ts), totals cross-check (`statement-totals.util`), draft->preview->confirm flow, nothing persisted until confirm, error codes (STATEMENT_AI_NOT_CONFIGURED 412, AI_KEY_CORRUPTED 409, etc.). This is the closest template for "Baca Laporan dengan AI": same gating, preview/confirm, string-money rule. Scanned (no-text) PDFs are refused (`pdf-no-text-layer`); no vision-PDF fallback. No page/snippet citation field in current schemas (must add) (?).
- ai-advisor chat (`ai-advisor/*`): separate chat service/tools; not extraction.
- Gate: CASL `create Reconciliation` for statements; `Insurance` has no AI route. A new route needs its own `@CheckAbility` (AbilitiesGuard fails open on ungated routes — repo memory).
- Documents: `TransactionAttachment` (attachments/\*; routes under `transactions/:txId/attachments`) and `AssetAttachment` (assets/asset-attachments.service.ts). Storage = `StoragePort` -> `StorageDiskService` (server disk volume `attachments_data`, NOT MinIO; S3 swap deferred, storage-disk.service.ts:18). Limits: jpg/png/webp/pdf, ≤5 MB, signature-sniffed (`file-signature.util`), tenant-scoped GET, no client-visible path. No insurance attachment model — would need `InsuranceDocument` table + service mirroring AssetAttachment; MinIO env mentioned in deploy docs but unused by storage module (?).

## 6. Notifications / timezone

- Only create/update-time notification (see §2), `billDue` pref (notification-prefs.ts), in-app `Notification` rows (title "Polis Hampir Jatuh Tempo", body "{name} jatuh tempo dalam N hari"). No user/family timezone column in schema (grep timezone: none). Dates are UTC midnight; web page formats with `timeZone:"UTC"` (page.tsx 130-141) to avoid shift; due-date.ts uses local day for "now". Spec requires user-tz reminders: needs a timezone field (or default Asia/Jakarta) + daily job.

## 7. Existing tests

API: `insurances.service.spec.ts` (1419 lines, ~60 cases: summary, findAll, paidThisPeriod, create, budget line, remove, beneficiaries, live-link, pendidikan, pay), `insurances.controller.spec.ts`, `next-renewal-date.util.spec.ts`, `dto/create-insurance.dto.spec.ts`, `dto/create-insurance-beneficiary.dto.spec.ts`. (update dto spec absent.) billing-cycle processor spec (?).
Web: `asuransi.test.tsx` (14), `premium-trend.test.ts`, `anggaran/obligations-section.test.tsx` (coverageAmount mention).
E2E (apps/web/tests/e2e): audit/modal-geometry.spec.ts, pages/ui-journeys.spec.ts, menu-audit.spec.ts, epic-008-regression, epic-015.

## 8. Migration-safety notes

1. **Policy type**: add enum `InsurancePolicyType {traditional, unit_link}` as NULLABLE (or `unspecified`), no backfill from name (spec forbids inference). Existing rows => null = "belum ditentukan"; filter must expose it. Adding enum values to `InsuranceType` (pendidikan was added in later migration) needs separate `ALTER TYPE ... ADD VALUE` outside txn.
2. **Dates**: keep `renewalDate` column with ambiguous history. Add `nextPremiumDueDate`, `renewalDate` (policy renewal), `premiumPaymentEndDate`, `coverageStartDate`, `coverageEndDate` as new nullable columns. Do NOT auto-copy renewalDate into coverageEnd (can't tell which meaning each user typed; 3653-day rows are likely coverage end). Option: keep renewalDate as legacy = "nextPremiumDueDate" only where payment/autoRenew has touched it; else needs user-confirmation flag `legacyDateMeaning`. `pay()`, billing-cycle worker, `paidThisPeriod`, budget sync, `maybeNotifyRenewal`, web hero/tips all read renewalDate and must switch together; mark uncertain which existing rows are which.
3. **Roles**: add `policyHolder`, `payer` and `InsuranceInsured[]` (member link or free-text name); beneficiaries table exists (sharePercent Decimal(5,2), cap 100 check in service only; DB has no constraint). Don't repurpose "owner". Keep beneficiary % <=100 validation but spec asks validation per chosen rule (100% exact optional).
4. **Benefit structure**: new `InsuranceBenefit` (kind: life_sum_assured | health_annual_limit | per_event | daily | other, amount Decimal/BigInt, currency, unit). Backfill `coverageAmount` into one benefit of kind by type (jiwa->life_sum_assured, kesehatan->health_annual_limit?) only as `unconfirmed`/kind `legacy_coverage`; keep `coverageAmount` column read-only until UI migrated. `quickinput/page.tsx:312` and `anggaran/obligations-section` read coverageAmount.
5. **Unit-link funds**: new `InsuranceFund` (code/name, currency, units Decimal(24,8), nav Decimal(24,8), navDate, source, valueComputed (derived, not stored or via Decimal), confirmationStatus extracted/needs_confirmation/confirmed) + `InsuranceValuationReport` (effectiveDate vs uploadedAt, source doc). Use Decimal, not Float/BigInt (units/NAV fractional; IDR BigInt elsewhere). Latest-by-effectiveDate selection rule so backdated upload doesn't override. FX: store original amount+rate+rateDate+source (existing `fx` module `FxInputService` stores fxInputs (?) — inspect before reuse).
6. **Payments**: add `InsurancePayment` (insuranceId, transactionId UNIQUE, periodDue date, paidAt, amount, currency, idempotencyKey `@@unique([insuranceId, idempotencyKey])`) and backfill from existing Transactions where `insuranceId` not null (txn.occurredAt as paidAt; periodDue unknown => null). Today the only link is Transaction.insuranceId; no key => add key at API (pay) + keep period guard. Add `paymentAccountId` default on policy. Keep the 409 behavior compatible.
7. **Status**: extend `InsuranceStatus` with grace/lapse/cancelled (enum ADD VALUE is not reversible/txn-unsafe in Postgres); `kadaluarsa` -> map to "berakhir" label, no data change. Never derive lapse from late payment.
8. **Documents**: new `InsuranceDocument` modeled on `AssetAttachment`; reuse `StoragePort`; tenant-scoped GET; PII-sensitive => restrict read to roles with Insurance manage.
9. **Net worth**: introduce nothing into dashboard/report until a single-identity link (e.g. `Asset.insuranceId` or Investment `insuranceFundId`) with unique constraint exists; update parity spec.
10. **Summary DTO/response**: additive fields only (contracts/dist is committed: rebuild after editing src); API clients on old shape keep working. `currency` hard-coded "IDR" in summary must be replaced by per-currency groups.
11. Concurrency/stateful: Prisma migrations only, never hand-DDL (repo memory); migration timestamps must not collide across parallel epics (latest 20261019100000).

## Key gaps vs spec (short)

No policy type, roles, separate dates, benefit grouping, unit-link, documents, AI endpoint, filters/search, user-tz reminders, payment idempotency key, per-currency summaries; KPI/donut sums coverage across types+currencies (violates §2); narrow half-width money inputs; single overloaded `renewalDate` drives "3.653 hari lagi".
