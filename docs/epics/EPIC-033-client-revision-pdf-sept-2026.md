# EPIC-033: Client revision PDF (Revisi WealthMe, 2026-09-25)

status: on-progress
environment: dev
retries: 0

## Goal

Implement the 31-page "Revisi WealthMe.pdf" from the client (Dax). Items are
grouped by blast radius; each `###` group is one unit of work. Runs locally
first (local Postgres copy of dev data), then the normal pipeline to
`development`. Overlaps with EPIC-032 (de-slop, sidebar, istri = Co-Master)
are cross-referenced, not duplicated.

## Decisions (user-confirmed 2026-09-25)

| #   | Decision                                                                                                                                                                 | Rejected                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| R1  | Family religion has 5 options: Islam (Zakat), Kristen (Persepuluhan), Katolik (Persepuluhan), Hindu, Buddha. Hindu and Buddha get no calculator, only general donations. | Calculator for every religion |
| R2  | Only members request funds ("Minta Dana"); Master approves. Master never sees the button.                                                                                | Master requesting from self   |
| R3  | Cash and e-wallet accounts carry an owner (a member or the family). Master can use all.                                                                                  | Ownerless cash                |
| R4  | Warisan: only "Pilih dari Aset"; manual input and every "Segera Hadir" upload placeholder removed.                                                                       | Keep manual input             |

## Tasks

### 1. Small fixes and config (PDF p1, p4, p6, p7, p8, p10, p11-13, p15, p19, p9, p31)

- [x] p1 Add-member dialog role select: drop "(Dependant)"; options Istri (Co-Master), Anak, Staff Operasional, Anggota. API now accepts `member` for Master-created accounts.
- [x] p4 Default banks: BCA, Mandiri, BRI, BNI, CIMB, OCBC. Contracts defaults + crud config + migration `20260925120100_epic033_default_banks` renames seeded rows in place.
- [x] p6 Family religion enum + settings select: islam, kristen, katolik, hindu, buddha, none (R1). Migration `20260925120000_epic033_family_religion_five`. Donation page: katolik → perpuluhan calculator; hindu/buddha → general donations only.
- [x] p6 follow-up: the "Catat Donasi" type list follows the religion (Islam: zakat/infaq/wakaf + umum; Kristen/Katolik: persepuluhan + umum; Hindu/Buddha: umum only; none: all). Hindu/Buddha banner reads "Donasi umum" instead of "kalkulator tidak aktif". Existing rows keep their original type.
- [x] p10 Donation page shows no calculator until a religion is set (perpuluhan no longer shows for `null`).
- [x] p7 Master COA explainer is collapsible, default collapsed.
- [x] p8 Reconciliation "Bank yang didukung": only BCA and Mandiri.
- [x] p11 Warisan asset category: add "Emas".
- [x] p12/p13 Warisan: "Input Manual" tab and both upload placeholders removed (R4). Editing a legacy unlinked row still shows its fields.
- [x] p15 Asset dialog: the "Kategori Master Data" picker listed income/expense transaction categories (never valid for a physical asset). Removed; the type select (Properti/Kendaraan/…) saves fine locally (201). Master-data-driven asset types move to group 3.
- [ ] p19 Investment Beli/Jual: buy of 1 @ 900.000 on UBS Gold succeeds locally (201, toast). Not reproducible; re-test on dev after deploy and ask client for the exact failing input.
- [x] p9 Split-bill public page: payout account number is now decrypted server-side (`resolvePayoutAccount`).
- [~] p31 Thousand separators: Rupiah inputs in Investasi (modal, harga manual, Beli/Jual) and Laporan investment dialog now format while typing (kripto keeps raw decimals). Kalkulator already did. Remaining audit: tables/charts/tooltips.

### 2. Account ownership and Minta Dana (p2, p3, p21, p22-26)

- [~] Members must not see another member's private bank accounts (p2/p3 bug 1). Not reproducible on current code: an operational member (dataScope `own`) lists only family-shared accounts; another member's owned account is hidden. Re-verify on dev after deploy.
- [x] "Minta Dana" only for members, never Master/Co-Master (p3 bug 2, p21) (R2). Header button removed; card button shows only on family-shared accounts for non-owner/spouse roles.
- [x] Cash and e-wallet owner picker ("Pemilik": Keluarga / member) on add + edit, backed by the existing `Account.ownerUserId` (p22, p23, p25) (R3). No migration.
- [x] R3 follow-up (user found 2026-09-25): a child/member with "Kelola" on Rekening or Dana could pick any member or "Keluarga" as Pemilik. Now the picker collapses to themselves and the API pins `ownerUserId` to the caller for every role other than owner/spouse (403 when another owner is sent; editing someone else's account is 403 too). Verified as the `operational` test member: other owner → 403, omitted owner → 201 owned by self.
- [x] Members request funds FROM a family-shared account INTO their own (p26) (R5): shared `MintaDanaDialog` on /rekening and /dana; API `CreateAllowanceRequestDto.fromAccountId` (must be family-shared, non-private); approve defaults to the requested source, Master may override. Verified locally end to end: Kas Tunai 3.000.000 → 2.900.000, Kas Dede 0 → 100.000.
- [x] Cash accounts no longer listed on Bank & Account (p24).
- [x] Liability/insurance auto-categories are named `Utang: <nama>` / `Asuransi: <nama>` (no raw id suffix). Existing rows keep their old names.
- [x] Dana page: edit/delete affordances hidden for members without manage rights (was visible, API refused).
- Depends on EPIC-032 Task 4 (istri = Co-Master) for who counts as approver.

### 3. Asset and investment price history (p14, p16, p17, p18)

- [x] Asset documents (p14): `asset_attachments` table (migration `20260925180000_epic033_asset_attachments`), `AssetAttachmentsService` + `POST/GET/DELETE /assets/:id/attachments[/:attachmentId]` (sniffed mime jpg/png/webp/pdf, ≤5MB, key `<fg>/assets/<id>/<uuid>.<ext>` on `StoragePort`). `/aset/[id]` "Dokumen" card: upload, open in a new tab, delete. Tambah Aset dialog: optional document uploaded right after create. Local dev needs `STORAGE_DIR` in `.env` (API default `/data/storage`).
- [x] Asset detail page `/aset/[id]` (p16/p17): asset name on the card links to it; left column = dated valuations; right = `TrendChart` of values; below = change list with percent vs previous, who recorded it, and note. "Tambah Riwayat" dialog takes a date plus either the new value or a percent change (computed server-side). `POST /assets/:id/history` (manage Asset) appends `asset_history` with `recordedByUserId` + `note` (migration `20260925150000_epic033_asset_history_actor`) and moves `currentValue` when the entry is the newest.
- [x] Investment detail: "Riwayat Harga" list from the new `GET /investments/:id/prices` (existing `investment_prices` rows: manual + feed, with source and as-of date).

### 4. Calculations and reports (p20, p28)

- [x] Liabilities: credit-card figures wrong (p20). Reproduced with a real scenario: (a) a card purchase incremented `totalDebt`, which the UI shows as "Limit Kredit", so the limit grew with every purchase; (b) interest was computed as annual/12 while the card UI labels the rate "Bunga/Bulan". Fixed: purchases raise the running bill only; `kartu_kredit` uses the rate per month in `splitPayment` and in the web amortisation preview. Verified: limit 20.000.000 stays; bill 3.000.000, pay 1.000.000 @ 2%/bln → interest 60.000, principal 940.000, bill 2.060.000, source account −1.000.000.
- [x] PNL: investment buy/sell now moves money when a settlement account is chosen (p28). `POST :id/transactions` accepts optional `accountId`; buy = transfer out (allocation, not an expense), sell = transfer in of the cost portion + `Hasil Investasi` income for the realised gain. Beli/Jual dialog gets a "Rekening (opsional)" picker. Verified: buy 100 @ 10.000 → −1.000.000; sell 40 @ 12.500 → +500.000 with realised 100.000 appearing under Hasil Investasi in the P&L. Realised losses are booked as an expense "Rugi jual …" under `Rugi Investasi` (expense category on COA 20099, created on first use); transfer-in = cost portion. Verified: buy 100 @ 10.000, sell 50 @ 8.000 → account +400.000 net, expense 100.000 in the P&L expense breakdown.

### 5. New features (p27, p29, p30)

- [x] Goals: `autoDebitDay` (1-28) on create/edit + "tgl D" on the card (p27). Migration `20260925160000_epic033_autodebit_day`. `lib/goals-utils.ts` (protected) gained a 4-line passthrough, reviewed foundation change.
- [x] Budget category: `autoDebitDay` (1-28) on add/edit + "autodebet tgl D" in the usage list (p29). Same migration.
- [x] Ringkasan: display-currency segmented control (IDR / USD / Emas) on the headline figures, using the shared FX cache and the family's gold price; trend ranges now 1 Bln / 3 Bln / 6 Bln / 12 Bln / Tahun Ini / Semua / Kustom (from-to dates), cut client-side from the widest history fetch (p30).

## Acceptance Criteria

- Each PDF page maps to a checked task above, or is explicitly deferred with a reason in the Automation Log.
- No member can see a private account they do not own.
- Religion select shows 5 religions; donation calculators follow R1.
- Every currency/number surface uses thousand separators.

## Automation Log

- 2026-09-25 — PDF digested into 26 items, grouped 1-5. R1-R4 confirmed by user. Starting group 1 locally.
- 2026-09-25 — Group 1 done locally except p19 (not reproducible: buy 1 @ 900.000 → 201) and the display side of p31. Both migrations applied to the local DB only. Gates: web tsc/eslint clean, jest 773 passed; api jest 245 passed across family-groups, split-bills, assets, investments, reference-items. Verified in local browser: role select, 5 religions, COA toggle, reconciliation chips, warisan dialog/placeholders, asset save with Kendaraan. Not committed yet.
- 2026-09-25 — Groups 3-5 done locally, driven by real-number scenarios run through the browser session against the API (`scenario*.js` in the session scratchpad): salary/expense/transfer balances, budget spend, card purchase + payment (found and fixed the limit-growth and annual/12 bugs), buy/sell with settlement (found the P&L gap), goal/budget autodebit days, asset valuation history (-2.50% entry attributed to the acting user), Ringkasan USD + custom range. Full suites: api 1638 passed, web 772 passed. EPIC-032 T2 (sidebar accordion) and T4 (istri = Co-Master) landed in the same branch.
- 2026-09-25 — Group 2 done locally (R2, R3, R5). New shared `components/allowance/minta-dana-dialog.tsx`, `hooks/use-family-members.ts`. Gates: web jest 772 passed (one cash-on-rekening test retired), api allowance-requests 28 passed, security-check OK. End-to-end as test member `bidedetest@keluarga-seedfg` (local DB only): request 100.000 from Kas Tunai → Master approves with prefilled source → balances moved.
- 2026-09-25 — p14 and the investment loss booking closed (both were listed as deferred). Verified through the browser session against the API: upload 201 → list 1 → stream 200 image/png → html upload 400 → delete 204; loss sell books `Rugi Investasi` 100.000 and the account moves +400.000. Tambah Aset with a document creates the asset (201) and attaches the file. Notification bodies now `Rp 3.000.000 · Belanja`. Full suites: api 1639 passed, web 774 passed (one anggaran test flaked once in a full run, green on rerun and on the second full run).
- 2026-09-25 — Review round on PR #333: IAM two-column dialog alignment, duplicate React keys on /iam and /investasi, Base UI `nativeButton={false}` on the Tax link button, donation types filtered by religion, and the account owner lock for non-Master members (API + Rekening + Dana). Console sweep across all 28 app pages: clean except the socket.io reconnect warning on /investasi.
