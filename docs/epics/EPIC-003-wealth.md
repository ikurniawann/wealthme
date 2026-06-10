# EPIC-003: Wealth

status: on-progress
environment: dev
phase: 3
priority: P1
area: Backend + Frontend
prd: ../product/PRD.md
stories: ../product/USER-STORIES.md (§4 Investments, §5 Assets & Liabilities, §6 Insurance)
tasks: ../product/ENGINEERING-TASKS.md (T-301 … T-312)

## Goal

Menambah domain kekayaan: investasi (dengan harga terjadwal & realtime), aset, liabilitas,
dan asuransi — serta memastikan perhitungan net worth konsisten di seluruh aplikasi.

## User Stories

- **US-INV-1..6** — tambah holding + cost basis, lihat nilai & return (Rp/%), refresh harga terjadwal, update realtime, edit/hapus, tabel scroll mobile.
- **US-ASSET-1..3** — tambah aset + riwayat nilai, tampilan grouped (cash/investasi/aset/liabilitas).
- **US-LIAB-1..2** — tambah liabilitas, rasio pembayaran/sisa saldo.
- **US-INS-1..3** — tambah polis + tanggal perpanjangan, reminder, ringkasan proteksi.

## Tasks

> Pola: tiap domain = modul **Backend** + **wiring Frontend** (TanStack Query, kontrak `@wealthme/contracts`).

### Investments ✅

- [x] **T-301** Investments API + P&L: holdings, cost basis (modal), nilai kini, return Rp & %
- [x] **T-302** `investment_prices` + `MarketDataPort` (mock)
- [x] **T-303** Cron refresh harga (BullMQ) menulis ke `investment_prices`
- [x] **T-304** Realtime price push (WebSocket gateway)
- [x] **T-305** Wire halaman **Investasi** (tabel portofolio + return live, scroll horizontal mobile)

### Assets

- [ ] **T-306** Assets API + `asset_history`
- [ ] **T-307** Net-worth rollup service (dana + investasi + aset − liabilitas), shared di `contracts`
- [ ] **T-309** Wire halaman **Aset** (grouped + tabs)

### Liabilities

- [ ] **T-308** Liabilities API: kartu kredit & pinjaman, rasio pembayaran, sisa saldo
- [ ] **T-310** Wire halaman **Liabilitas**

### Insurance

- [ ] **T-311** Insurance API: polis, premi, tanggal perpanjangan, status; renewal → trigger notifikasi
- [ ] **T-312** Wire halaman **Asuransi** (polis aktif + ringkasan proteksi)

## Acceptance Criteria

**Epic-level**

- Net worth = aset + investasi + cash − liabilitas, konsisten dengan dashboard (EPIC-002).
- Halaman Investasi/Aset/Liabilitas/Asuransi memakai data nyata (tidak ada mock tersisa).
- Unit test perhitungan P&L dan rollup lulus.

**Per-task**

- **T-301** — return Rp = nilai kini − cost basis; return % per rumus ROI di `contracts`; CRUD holding berfungsi.
- **T-302/T-303** — harga ter-refresh sesuai jadwal cron; nilai portofolio mengikuti harga terbaru.
- **T-304** — perubahan harga ter-push ke client tanpa reload (WebSocket).
- **T-305** — tabel portofolio menampilkan return live; scroll horizontal mulus di mobile.
- **T-306/T-307** — aset & riwayat tersimpan; rollup net worth cocok dengan dashboard.
- **T-308** — rasio pembayaran & sisa saldo dihitung benar di BE.
- **T-309/T-310** — grouped list & kartu liabilitas dari data nyata.
- **T-311/T-312** — polis CRUD dengan status; tanggal perpanjangan memicu notifikasi.

## Automation Log

- 2026-06-10 /epic-loop EPIC-003 #1 "Investments" → PASS (attempts: 3), PR: https://github.com/andrsrjld/wealthme-web/pull/116

## Dependencies

- EPIC-002 (akun, transaksi, dashboard aggregation).
