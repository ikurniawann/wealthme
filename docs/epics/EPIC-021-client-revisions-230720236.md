# EPIC-021: Client Revision Punch-List (WealthMe 230720236)

status: backlog
environment: dev
retries: 0
priority: P1
area: Full-stack
source: client PDF `WealthMe 230720236.pdf`, received 2026-08-03

## Goal

Track and close the 30-item client revision punch-list delivered as
`WealthMe 230720236.pdf`. The PDF lives outside version control, so the items
are transcribed **verbatim** below (Indonesian shorthand preserved) with an
interpretation column, so nothing is lost or silently reinterpreted.

This epic is the canonical home for items **not already covered** by an
existing epic. Items that map onto EPIC-016/017/018/019/020 stay there — the
mapping table records where each one lives, so every PDF item is traceable to
exactly one owner.

## Verbatim Source List

Transcribed exactly as written in the PDF. Do not "fix" the shorthand here —
the interpretation belongs in the mapping table, so the original client intent
stays auditable.

1. AUD CNY
2. Bahasa Nyalan
3. Kas Tunai bisa banyak Master Data
4. Kode COA auto Gen tapi bisa Edit
5. Transfer COA jadi Mutasi
6. Consolidate Total -> Dollar Rupiah Emas
7. Transaksi di Quick Input
8. Split Bill Picture Error
9. Detail Transaksi Rekon
10. Input Split bill Masukin Calc di Masuk Per Orang
11. Ini ambil dari Asset dan Pilih Ahli Waris aja, Pencatatan dari Warisan dari
    Asset nya kesiapan ahli waris nya dan Ahli Waris
    _(screenshot: "Tambah Aset Warisan" dialog — Kategori / Nama Aset / Nilai
    Estimasi / Catatan / Dokumen Pendukung "Coming soon" / Akses Ahli Waris)_
12. Ada warisan yang belum ada ahli warisnya di catat tapi gak di set, lalu
    setiap asset ada ahli waris sesuai presentasi
13. Asuransi Pendidikan Hilang di Drop Down
14. Ahli Waris Asuransi berdasarkan seperti waris
15. Dana -> E Wallet, Rekening Cash & Bank ——> Consistent, Jadinya Cash, Bank,
    E Wallet ====== Cash itu Tunai
    _(screenshot: /aset "Dana" tab listing Dana / GoPay / OVO / Kas Tunai)_
16. Asset Fisik Detail bisa masukin Master Data
17. Depresiasi Asset
18. Apresiasi Assest
19. Ada tab category Investasi
    _(screenshot: /investasi "Tambah Investasi" dialog with a Jenis dropdown:
    Saham / Reksa Dana / Obligasi / Emas / Kripto / Lainnya)_
20. Detail Online Saham dan Investasi suku bunga
21. Data Kas bisa minus
22. Bank Rekening gak bisa minus
23. Transfer atau mutasi, Source of Fund -> Transfer Fund to (English nanti into
    nya got)
    _(screenshot: "Tambah Transaksi" dialog — Input Manual / Scan Struk, tabs
    Pemasukan / Pengeluaran / Transfer / Kartu Kredit, single "Akun" field)_
24. Mutasi Rekening per rekening
25. Dana itu Ganti Cash
26. Ewallet masuk ke Bank (Rekening)
27. Mutasi antar bank dan mutasi Ewallet
28. Mutasi Topup Ewallet nya adm nya tetep masuk ke saldo Ewallet di olah di
    ewallet
29. Reconcile ada 1000 nya gopay dll di banknya pecah jadi adm premis, deskripsi
    top up atau nomer
30. Hitungan pecahan pembagi Tujuan Keuangan
    _(screenshot: "Tambah Tujuan Keuangan" dialog — Nama Tujuan / Ikon / Target
    Jumlah / Sudah Terkumpul / Target Tanggal / Auto debit / Bulan)_

## Mapping Table

Filled in by the 2026-08-03 audit (see Automation Log). `Owner` is the epic that
will actually build it; `Status` is the audited current state of the codebase.

| #               | Interpretation | Status | Owner |
| --------------- | -------------- | ------ | ----- |
| _pending audit_ |                |        |       |

## Tasks

Task groups are defined **after** the audit lands, grouped by subsystem so each
group is one reviewable PR. Placeholder groupings (subject to audit results):

- [ ] ### A — Account taxonomy: Cash / Bank / E-Wallet (items 15, 25, 26, 21, 22)
- [ ] ### B — Transfer/Mutasi semantics: source→destination (items 5, 23, 24, 27, 28)
- [ ] ### C — Reconciliation detail + fee splitting (items 9, 29)
- [ ] ### D — Warisan/Asuransi heirs by percentage (items 11, 12, 13, 14)
- [ ] ### E — Asset depreciation/appreciation + investment detail (items 16, 17, 18, 19, 20)
- [ ] ### F — Multi-currency + consolidated total (items 1, 6)
- [ ] ### G — COA code auto-gen but editable + cash master data (items 3, 4)
- [ ] ### H — Split bill: picture bug + per-person calculator (items 8, 10)
- [ ] ### I — Quick Input transactions (item 7)
- [ ] ### J — Financial-goal per-period breakdown (item 30)
- [ ] ### K — i18n (item 2) — **owned by EPIC-018**, tracked here only for traceability

## Open Design Decisions

Recorded during the audit; must be resolved with the client before the
dependent task group starts.

1. _pending audit_

## Acceptance Criteria

- Every one of the 30 verbatim items has a row in the Mapping Table with a
  status and a named owning epic — no item silently dropped.
- Items marked `done` at audit time carry file:line evidence that survived an
  adversarial verification pass (a stub/toast-only placeholder is NOT done).
- Each implemented task group ships with gates green
  (`scripts/qa.sh`, `scripts/test.sh`, `scripts/security-check.sh`) and a
  review-QA pass against these acceptance criteria.
- Schema-affecting items (heir percentages, depreciation, negative-balance
  rules, multi-currency) ship additive migrations that apply cleanly to a DB
  with existing rows.

## Test Plan

- **Unit:** balance-rule guards (cash may go negative, bank may not); goal
  per-period divider math; depreciation/appreciation schedule math; heir
  percentage allocation sums to <= 100%.
- **Integration:** transfer/mutasi persists BOTH source and destination
  accounts; e-wallet top-up admin fee lands on the e-wallet balance;
  reconciliation split produces principal + fee rows that reconcile to the
  original bank line.
- **E2E (Playwright):** create a transfer between two accounts and confirm both
  balances move; add an inheritance asset by picking an existing asset and
  assigning heirs by percentage; switch currency and confirm consolidated total
  re-expresses.
- **Smoke:** after DEV deploy, load /aset, /transaksi, /rekonsiliasi, /warisan,
  /investasi, /tujuan.

## Automation Log

- 2026-08-03 Epic created from the client PDF `WealthMe 230720236.pdf`. All 30
  items transcribed verbatim before any interpretation, because the PDF is not
  in version control and the shorthand is lossy — several items (e.g. #28, #29)
  are only decodable with the accompanying screenshots. Audit of current
  codebase state in progress; mapping table and task groups to be filled from
  its results.
