# EPIC-002: Core Money Tracking (MVP)

status: on-progress
environment: dev
phase: 2
priority: P0
area: Backend + Frontend

## Goal

Mengirim modul inti pencatatan keuangan + menyambungkan halaman frontend ke API nyata,
sehingga aplikasi benar-benar bisa dipakai mencatat dan memantau keuangan. **Inilah batas MVP.**

## Tasks

> Pola: tiap domain = modul **Backend** + **wiring Frontend** (ganti mock dengan TanStack Query).

### Accounts (bank & e-wallet) ✅

- [x] Accounts API: CRUD, saldo, status sinkron; DTO di `@wealthme/contracts`
- [x] Wire halaman **Rekening** + **Dana** ke API

### Transactions ✅

- [x] Transactions API: CRUD, filter (type/account/date), pagination, grouping per tanggal, summary (income/expense/net)
- [x] Categories API + seed default (ikon, tipe)
- [x] OCR adapter (mock): `OcrPort` + `MockOcr`; endpoint `POST /transactions/scan` → field terisi
- [x] Wire halaman **Transaksi** + modal Tambah Transaksi (manual + scan)

### Dashboard

- [ ] Aggregation API: net worth, cashflow 6 bulan, sparkline 30 hari, alokasi (donut)
- [ ] Wire **Beranda** + **Ringkasan** ke endpoint agregasi

### Budgets

- [ ] Budgets API: kategori, limit, periode, rollup pemakaian, flag ambang 80%
- [ ] Wire **Anggaran** + modal Tambah Kategori

### Goals

- [ ] Goals API: target/current/auto-debit/status
- [ ] Wire **Tujuan Keuangan**

### Notifications

- [ ] Notifications API: entity, mark-read, push (WebSocket/SSE)
- [ ] Wire **Notifikasi** + badge di topbar

### Search

- [ ] Search API (Postgres FTS) untuk halaman/akun/investasi/goals
- [ ] Wire command palette (⌘K) ke API

## Acceptance Criteria

- User dapat membuat/mengubah/menghapus transaksi & akun; saldo ter-update otomatis.
- Filter & ringkasan transaksi akurat sesuai data DB.
- Dashboard menampilkan net worth, cashflow, alokasi, sparkline dari data nyata.
- Anggaran menghitung pemakaian dan memunculkan peringatan saat ≥80%.
- Progress tujuan dihitung dari setoran.
- Notifikasi muncul real-time; badge "unread" akurat.
- Seluruh halaman MVP tidak lagi memakai mock; e2e alur inti (login → tambah transaksi → dashboard) lulus.

## Automation Log

- 2026-06-09 /epic-loop EPIC-002 #1 "Accounts (bank & e-wallet)" → PASS (attempts: 3), PR: https://github.com/andrsrjld/wealthme-web/pull/103
- 2026-06-09 /epic-loop EPIC-002 #2 "Transactions" → PASS (attempts: 2), PR: https://github.com/andrsrjld/wealthme-web/pull/104

## Dependencies

- EPIC-001 (auth, DB, RBAC, query client).
