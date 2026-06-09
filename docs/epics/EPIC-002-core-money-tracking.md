# EPIC-002: Core Money Tracking (MVP)

status: ready-for-qa
environment: dev
phase: 2
priority: P0
area: Backend + Frontend
prd: ../product/PRD.md
stories: ../product/USER-STORIES.md (§2 Dashboard, §3 Transactions, §16 Notifications)
tasks: ../product/ENGINEERING-TASKS.md (T-201 … T-216)

## Goal

Mengirim modul inti pencatatan keuangan + menyambungkan halaman frontend ke API nyata,
sehingga aplikasi benar-benar bisa dipakai mencatat dan memantau keuangan. **Inilah batas MVP.**

## User Stories

- **US-DASH-1..6** — net worth, filter periode, donut alokasi, bar cashflow, summary cards, AI-insight banner.
- **US-TXN-1..7** — tambah manual, scan OCR, filter, grouping per tanggal, kategori/akun, transfer, search ⌘K.
- **US-NOTIF-1, US-NOTIF-3** — notifikasi in-app + badge unread; alert budget ≥80%.
- **US-ACCT-1** (turunan US-DASH-5) — kelola akun bank & e-wallet + saldo.

## Tasks

> Pola: tiap domain = modul **Backend** + **wiring Frontend** (ganti mock dengan TanStack Query).

### Accounts (bank & e-wallet) ✅

- [x] **T-201** Accounts API: CRUD, saldo, status sinkron; DTO di `@wealthme/contracts`
- [x] **T-202** Wire halaman **Rekening** + **Dana** ke API

### Transactions ✅

- [x] **T-203** Transactions API: CRUD, filter (type/account/date), pagination, grouping per tanggal, summary (income/expense/net)
- [x] **T-204** Categories API + seed default (ikon, tipe)
- [x] **T-205** OCR adapter (mock): `OcrPort` + `MockOcr`; endpoint `POST /transactions/scan` → field terisi
- [x] **T-206** Wire halaman **Transaksi** + modal Tambah Transaksi (manual + scan)

### Dashboard ✅

- [x] **T-207** Aggregation API: net worth, cashflow 6 bulan, sparkline 30 hari, alokasi (donut)
- [x] **T-208** Wire **Beranda** + **Ringkasan** ke endpoint agregasi

### Budgets ✅

- [x] **T-209** Budgets API: kategori, limit, periode, rollup pemakaian, flag ambang 80%
- [x] **T-210** Wire **Anggaran** + modal Tambah Kategori

### Goals ✅

- [x] **T-211** Goals API: target/current/auto-debit/status
- [x] **T-212** Wire **Tujuan Keuangan**

### Notifications ✅

- [x] **T-213** Notifications API: entity, mark-read, push (WebSocket/SSE)
- [x] **T-214** Wire **Notifikasi** + badge di topbar

### Search ✅

- [x] **T-215** Search API (Postgres FTS) untuk halaman/akun/investasi/goals
- [x] **T-216** Wire command palette (⌘K) ke API

## Acceptance Criteria

**Epic-level**

- User dapat membuat/mengubah/menghapus transaksi & akun; saldo ter-update otomatis.
- Filter & ringkasan transaksi akurat sesuai data DB.
- Dashboard menampilkan net worth, cashflow, alokasi, sparkline dari data nyata.
- Anggaran menghitung pemakaian dan memunculkan peringatan saat ≥80%.
- Progress tujuan dihitung dari setoran.
- Notifikasi muncul real-time; badge "unread" akurat.
- Seluruh halaman MVP tidak lagi memakai mock; e2e alur inti (login → tambah transaksi → dashboard) lulus.

**Per-task**

- **T-201/T-202** — CRUD akun mengubah saldo; Rekening & Dana dari data nyata.
- **T-203** — filter & summary cocok DB; pagination & grouping benar.
- **T-204** — kategori default ter-seed (ikon+tipe).
- **T-205/T-206** — scan mengisi field; modal manual+scan menyimpan transaksi.
- **T-207/T-208** — net worth = cash + investasi + aset − liabilitas; chart dari agregasi.
- **T-209/T-210** — rollup pemakaian & flag ≥80% berfungsi.
- **T-211/T-212** — progress tujuan dari setoran.
- **T-213/T-214** — notifikasi real-time; badge unread akurat.
- **T-215/T-216** — ⌘K mengembalikan hasil dari FTS.

## Residual / Not-100% (untuk QA)

- Verifikasi tidak ada sisa mock di seluruh halaman MVP (audit `apps/web/src/lib/data.ts`).
- Net-worth pada Beranda saat ini belum mencakup investasi/aset/liabilitas nyata (menyusul **EPIC-003 T-307** rollup); pastikan formula konsisten setelah EPIC-003.
- E2E alur inti (login → tambah transaksi → dashboard) harus hijau di CI sebelum tutup epic.

## Automation Log

- 2026-06-09 /epic-loop EPIC-002 #1 "Accounts (bank & e-wallet)" → PASS (attempts: 1), PR: https://github.com/andrsrjld/wealthme-web/pull/103
- 2026-06-09 /epic-loop EPIC-002 #2 "Transactions" → PASS (attempts: 1), PR: https://github.com/andrsrjld/wealthme-web/pull/104
- 2026-06-09 /epic-loop EPIC-002 #3 "Dashboard" → PASS (attempts: 1), PR: https://github.com/andrsrjld/wealthme-web/pull/105
- 2026-06-09 /epic-loop EPIC-002 #4 "Budgets" → PASS (attempts: 3), PR: https://github.com/andrsrjld/wealthme-web/pull/106
- 2026-06-09 /epic-loop EPIC-002 #5 "Goals" → PASS (attempts: 1), PR: https://github.com/andrsrjld/wealthme-web/pull/107
- 2026-06-09 /epic-loop EPIC-002 #6 "Notifications" → PASS (attempts: 2), PR: https://github.com/andrsrjld/wealthme-web/pull/108
- 2026-06-10 /epic-loop EPIC-002 #7 "Search" → PASS (attempts: 2), PR: https://github.com/andrsrjld/wealthme-web/pull/109
- 2026-06-10 /epic-loop EPIC-002 retry — task-1 (Accounts) PR: #113 MERGED; tasks 2-6 consolidated (TOCTOU+DoS fixes applied) PR: #115 MERGED; qa ✅ test 50/50 ✅ security ✅ deploy-dev ✅; status → ready-for-qa

## Dependencies

- EPIC-001 (auth, DB, RBAC, query client).
