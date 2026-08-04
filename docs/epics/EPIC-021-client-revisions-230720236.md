# EPIC-021: Client Revision Punch-List (WealthMe 230720236)

status: done
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

Audited 2026-08-03 by a 10-cluster parallel code audit with adversarial
verification of any "done" claim. **Result: 0/30 done, 18 missing, 10 partial,
2 unclear.** Size = XS/S/M/L/XL estimate; Layer = web/api/full-stack/schema.

| #   | Interpretation (short)                                     | Status  | Layer      | Size | Owner          |
| --- | ---------------------------------------------------------- | ------- | ---------- | ---- | -------------- |
| 1   | Add AUD + CNY to supported currencies (5 hardcoded now)    | missing | full-stack | S    | 021-F          |
| 2   | Language switch must visibly change whole app              | partial | web        | XL   | EPIC-018 A3–A6 |
| 3   | Multiple cash accounts as master data (backend already OK) | partial | web        | S    | 021-G          |
| 4   | COA code auto-generated but editable                       | missing | full-stack | M    | 021-G          |
| 5   | Relabel COA direction "Transfer" → "Mutasi"                | missing | web        | XS   | 021-B          |
| 6   | Consolidated total in USD / IDR / Gold                     | partial | full-stack | L    | 021-F          |
| 7   | Create transaction directly in Quick Input                 | partial | web        | S    | 021-I          |
| 8   | Split-bill "picture error" — no image exists in feature    | unclear | web        | S    | 021-H          |
| 9   | Reconciliation line → full transaction detail view         | missing | full-stack | M    | 021-C          |
| 10  | Per-person calculator in split-bill custom input           | missing | web        | S    | 021-H          |
| 11  | Add-inheritance picks existing Asset, not manual re-entry  | missing | full-stack | M    | 021-D          |
| 12  | Inheritance recordable w/o heirs; heirs by % later         | partial | web        | M    | 021-D          |
| 13  | "Asuransi Pendidikan" missing from type dropdown           | partial | schema     | S    | 021-D          |
| 14  | Insurance beneficiaries with % like inheritance heirs      | missing | full-stack | M    | 021-D          |
| 15  | Account taxonomy → exactly Cash/Bank/E-Wallet              | missing | full-stack | L    | 021-A          |
| 16  | Physical-asset category from master data (now hardcoded)   | missing | schema     | L    | 021-E          |
| 17  | Asset depreciation (no rate/schedule fields exist)         | missing | schema     | L    | 021-E          |
| 18  | Asset appreciation (mirror of 17)                          | missing | schema     | M    | 021-E          |
| 19  | "Tab category Investasi" — tabs vs master-data ambiguous   | unclear | web?       | S    | 021-E          |
| 20  | Online stock detail + interest-bearing investments         | partial | schema     | L    | 021-E          |
| 21  | Cash may go negative (works via txns; create API blocks)   | partial | api        | S    | 021-A          |
| 22  | Bank must NOT go negative (no guard exists at any layer)   | missing | full-stack | M    | 021-A          |
| 23  | Transfer form: Source of Fund → Transfer Fund to (2 accts) | missing | schema     | L    | 021-B          |
| 24  | Per-account statement view (API filter exists, no UI)      | partial | web        | M    | 021-B          |
| 25  | Rename "Dana" → "Cash"                                     | missing | full-stack | M    | 021-A          |
| 26  | E-wallets grouped under Bank/Rekening deliberately         | partial | web        | M    | 021-A          |
| 27  | Bank↔bank + ewallet↔ewallet transfers (same root as 23)    | missing | schema     | S    | 021-B          |
| 28  | E-wallet top-up admin fee lands on e-wallet balance        | missing | schema     | M    | 021-B          |
| 29  | Recon: split bank line into principal + admin fee + ref    | missing | schema     | L    | 021-C          |
| 30  | Goal form computes per-period saving breakdown             | missing | web        | S    | 021-J          |

Key audit evidence (full detail in the per-item audit, session 2026-08-03):

- **#23/#27/#28 root cause is one schema gap:** `Transaction` has a single
  `accountId` (`apps/api/prisma/schema.prisma:357`) — no destination FK, so no
  true account→account transfer can exist. This is the same double-entry
  primitive EPIC-019 Decision #1(A) proposes; must be built once, together.
- **#21/#22:** `applyBalanceDelta`
  (`apps/api/src/transactions/transactions.service.ts:532-553`) blindly
  increments/decrements with no balance read — cash _can_ already go negative
  (accidentally satisfying #21 via txns), and nothing stops bank overdrafts.
  Account create/update DTO has `@Min(0)` for all types.
- **#13 has a data-corruption twist:** the /asuransi page coerces a legacy
  "Pendidikan" value to `lainnya` on save, so existing education policies are
  indistinguishable from genuine `lainnya` rows after the enum is added.
- **#8:** the split-bill feature contains zero image elements (avatars are CSS
  initials); the only concrete adjacent defect found is that "Buat & Bagikan
  Link" copies `/split/<shareToken>` which 404s — the public share page was
  never built. Needs client confirmation.
- **#6:** consolidated net worth already exists
  (`dashboard.service.ts:246-295`) with single-currency display conversion
  (EPIC-016 B2); missing: simultaneous multi-denomination display + any gold
  price source. FX is a hardcoded mock (`fx-mock.service.ts`).
- **#3 backend already supports N cash accounts** (`AccountType.cash`,
  uniqueness per name not per type); only the UI fixes a single "Kas Tunai".
- **#24 backend filter already exists** (`list-transactions-query.dto.ts:20-23`
  `accountId`); the web never passes it.

## Tasks

Task groups are defined **after** the audit lands, grouped by subsystem so each
group is one reviewable PR. Placeholder groupings (subject to audit results):

- [x] ### A — Account taxonomy: Cash / Bank / E-Wallet (items 15, 25, 26, 21, 22)
- [x] ### B — Transfer/Mutasi semantics: source→destination (items 5, 23, 24, 27, 28)
- [x] ### C — Reconciliation detail + fee splitting (items 9, 29)
- [x] ### D — Warisan/Asuransi heirs by percentage (items 11, 12, 13, 14)
- [x] ### E — Asset depreciation/appreciation + investment detail (items 16, 17, 18, 19, 20)
- [x] ### F — Multi-currency + consolidated total (items 1, 6)
- [x] ### G — COA code auto-gen but editable + cash master data (items 3, 4)
- [x] ### H — Split bill: picture bug + per-person calculator (items 8, 10)
- [x] ### I — Quick Input transactions (item 7)
- [x] ### J — Financial-goal per-period breakdown (item 30)
- [x] ### K — i18n (item 2) — **owned by EPIC-018**, tracked here only for traceability

## Open Design Decisions

Recorded during the audit; must be resolved with the client before the
dependent task group starts.

1. **Transfer data model (gates B, and C's split target) — PIVOTAL.** Add a
   nullable `toAccountId` to `Transaction` (one row, two FKs) vs paired
   debit/credit legs linked by a `transferGroupId`. Must be decided **jointly
   with EPIC-019 Decision #1** (its option A builds the same primitive).
   Recommendation: single row + nullable `toAccountId` (simpler, reversible,
   additive migration; paired legs can be derived later if double-entry
   reporting demands it).
2. **#8 split-bill "picture error"** — feature has no images at all. Confirm
   with client whether the real defect is the share link 404
   (`/split/<shareToken>` page never built) or something else entirely.
3. **#19 "tab category Investasi"** — filter tabs on /investasi (web-only, S)
   vs master-data-driven investment categories in the add dialog (full-stack,
   M)? Recommendation: filter tabs (matches /aset pattern, cheap, matches the
   screenshot context).
4. **#25 rename "Dana"→"Cash"** — label-only vs route rename (`/dana` →
   `/cash`). Recommendation: label-only (route rename needs redirects + nav id
   union change + i18n interplay: "Cash" EN / "Tunai" ID per #15).
5. **#26 e-wallet under Bank** — regroup in UI only vs change `AccountType`
   (destructive migration losing the ewallet distinction). Recommendation: UI
   grouping only; keep the enum.
6. **#6 gold denomination** — unit (gram vs troy oz) and price source
   undefined; FX source for USD is currently `FxMockService` (hardcoded
   rates). Adding AUD/CNY (#1) touches the same mock. Client must supply a
   rate policy (manual-entry master data vs live API).
7. **#22 bank-overdraft rule** — hard 400 reject vs soft warning; and what to
   do with existing already-negative bank rows before a constraint ships.
   Recommendation: hard reject at service layer (no DB CHECK until data
   cleaned), seed data audited first.
8. **#17/#18 depreciation model** — one signed value-change rate per
   asset(-type) covering both directions vs two features; auto-post period
   entries vs compute-on-read. Recommendation: one signed rate,
   compute-on-read + snapshot into existing `AssetHistory`.
9. **#12/#14 heirs** — free-text name/relationship (current schema) vs picked
   from family-group members; and must percentages sum to exactly 100 once
   set? Applies to warisan AND asuransi ("berdasarkan seperti waris" = same
   mechanism, so share one beneficiary shape).
10. **#29 recon fee split** — produce real Transactions (principal + fee
    expense with its own COA) vs annotate `BankSyncEntry` only. Must agree
    with #28 on which account bears the fee. Recommendation: real
    transactions (reconciliation should converge to the ledger, not a
    side-table).
11. **#4 COA code editing** — `Category` links COA by `coaAccountId` (id FK),
    so code edits are referentially safe, but a rule is needed: keep
    first-digit == group invariant, uniqueness per tenant, and history of
    renames? Recommendation: allow edit with group-prefix validation only.

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
- 2026-08-03 Code audit completed (10 parallel read-only clusters + adversarial
  verification of every "done" claim; 11 agents, ~516k tokens). **0/30 done,
  18 missing, 10 partial, 2 unclear** — mapping table filled with file:line
  evidence. 11 Open Design Decisions recorded; the pivotal one is the transfer
  data model (single `toAccountId` vs paired legs), which must be resolved
  jointly with EPIC-019 Decision #1 because both build the same double-entry
  primitive. Items #8 and #19 need client clarification before implementation.
  Audit also flagged `docs/epics/README.md` registry as stale (EPIC-016/017
  listed as backlog; 019/020/021 absent) — fixed in the same docs PR.
  Implementation order: quick wins with no open decisions first (#5, #7, #24,
  #30, #21 test-lock), then decision-gated groups as the client answers.

## Automation Log

- **2026-08-04 — /nerve wave: groups B, D, E, G, H shipped (I and J had landed
  earlier as quick wins).** Open Design Decisions resolved as recorded below and
  implemented:
  - **B (#207, items 5/23/27/28)** — Decision #1 = single `Transaction` row with a
    nullable `toAccountId` (not paired legs). Source debited and destination
    credited atomically; Transfer tab now has Sumber Dana → Transfer ke plus an
    optional Biaya Admin recorded as a standalone expense on the destination
    (#28); any account→any account covers bank↔bank and ewallet↔ewallet (#27);
    per-account mutasi now matches source **or** destination so incoming transfers
    appear. Review caught and fixed a real corruption path: deleting a transfer
    **source** account would cascade-delete the row while the destination kept the
    credit — now rejected 409, as is deleting a destination (P2003 mapped).
  - **D (#210, items 11–14)** — Decision #9 = free-text heir/beneficiary with an
    optional family-member link; percentages sum ≤ 100 (partial allocation shown
    as "belum dialokasikan"); warisan and asuransi share one shape. `pendidikan`
    added to `InsuranceType` and the legacy coercion that silently saved it as
    `lainnya` removed. Inheritance can now link an existing Asset instead of
    manual re-entry. Review fixed: `memberUserId` was not tenant-validated (HIGH);
    a stale `assetId` permanently blocked edits.
  - **E (#211, items 16–20)** — Decision #8 = one signed value-change rate per
    asset, compute-on-read, floored at 0, labeled "estimasi"; #19 = filter tabs on
    /investasi; assets link to real master-data categories; interest-bearing
    investments show rate + projected annual yield with "no rate set" distinguished
    from "not applicable".
  - **G (#212, items 3/4)** — Decision #11 = COA codes auto-generate when blank
    (smallest free `{groupNum}{0001..}` per group) and are editable with
    group-prefix + tenant-uniqueness validation. Cash is no longer one hardcoded
    "Kas Tunai": /dana lists real plural cash accounts with full CRUD.
  - **H (#208, items 8/10)** — Decision #2 = the "picture error" is the share link
    404; the public `/split/[shareToken]` page now exists. Custom split gained a
    per-person calculator with live remainder, "bagi rata sisa", and a save block
    when amounts ≠ total.
    Every group shipped with gates green and adversarial review rounds (TypeScript,
    database, security, React reviewers as applicable); all findings were fixed
    before merge. Groups A (taxonomy + balance rules), C (recon detail + fee split)
    and F (multi-currency + consolidated total) are in flight; K is owned by
    EPIC-018 and is complete except `/laporan`.

- **2026-08-04 — groups A, C, F closed; all 30 punch-list items addressed; epic
  done.** A (#217) applied the Cash/Bank/E-Wallet taxonomy as label-only
  dictionary changes (routes and `AccountType` ids untouched, per Decisions
  #4/#5), let **cash** balances go negative (#21) and made **bank** overdrafts a
  hard service-layer reject (#22) — deliberately exempting the revert/reapply
  paths of update and delete, because reversal integrity outranks the invariant.
  C (#218) gave every reconciliation line a detail view (#9) and a "Pecah"
  action that splits a composite bank line into **real ledger entries** —
  principal as a transfer, admin fee as its own expense (#29, Decision #10).
  F (#219) added AUD + CNY to the indicative rate table (#1) and a consolidated
  IDR + USD + gram-emas total (#6); per Decision #6 **no gold feed was
  invented** — the price is an owner-maintained value, always labeled "diinput
  manual", and an unset price shows a prompt rather than a number. K was
  delivered by EPIC-018 (all 25 pages bilingual).
  Final DEV deploy applied all four new migrations cleanly; api and web healthy;
  the e2e suite passed 55 with the usual tunnel-latency flakes (each green on a
  serial retry) and zero real failures.
