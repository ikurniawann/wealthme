# EPIC-003: Wealth

status: done
environment: dev
phase: 3
priority: P1
area: Backend + Frontend
prd: ../product/PRD.md
stories: ../product/USER-STORIES.md (§4 Investments, §5 Assets & Liabilities, §6 Insurance)
tasks: ../product/ENGINEERING-TASKS.md (T-301 ... T-312)

## Goal

Menambah domain kekayaan: investasi (dengan harga terjadwal & realtime), aset, liabilitas,
dan asuransi - serta memastikan perhitungan net worth konsisten di seluruh aplikasi.

## User Stories

- **US-INV-1..6** - tambah holding + cost basis, lihat nilai & return (Rp/%), refresh harga terjadwal, update realtime, edit/hapus, tabel scroll mobile.
- **US-ASSET-1..3** - tambah aset + riwayat nilai, tampilan grouped (cash/investasi/aset/liabilitas).
- **US-LIAB-1..2** - tambah liabilitas, rasio pembayaran/sisa saldo.
- **US-INS-1..3** - tambah polis + tanggal perpanjangan, reminder, ringkasan proteksi.

## Tasks

> Pola: tiap domain = modul **Backend** + **wiring Frontend** (TanStack Query, kontrak @wealthme/contracts).

### Investments (done)

- [x] **T-301** Investments API + P&L: holdings, cost basis (modal), nilai kini, return Rp & %
- [x] **T-302** investment_prices + MarketDataPort (mock)
- [x] **T-303** Cron refresh harga (BullMQ) menulis ke investment_prices
- [x] **T-304** Realtime price push (WebSocket gateway)
- [x] **T-305** Wire halaman Investasi (tabel portofolio + return live, scroll horizontal mobile)

### Assets (done)

- [x] **T-306** Assets API + asset_history
- [x] **T-307** Net-worth rollup service (dana + investasi + aset - liabilitas), shared di contracts
- [x] **T-309** Wire halaman Aset (grouped + tabs)

### Liabilities (done)

- [x] **T-308** Liabilities API: kartu kredit & pinjaman, rasio pembayaran, sisa saldo
- [x] **T-310** Wire halaman Liabilitas

### Insurance (done)

- [x] **T-311** Insurance API: polis, premi, tanggal perpanjangan, status; renewal -> trigger notifikasi
- [x] **T-312** Wire halaman Asuransi (polis aktif + ringkasan proteksi)

## Acceptance Criteria

**Epic-level**

- Net worth = aset + investasi + cash - liabilitas, konsisten dengan dashboard (EPIC-002).
- Halaman Investasi/Aset/Liabilitas/Asuransi memakai data nyata (tidak ada mock tersisa).
- Unit test perhitungan P&L dan rollup lulus.

**Per-task**

- **T-301** - return Rp = nilai kini - cost basis; return % per rumus ROI di contracts; CRUD holding berfungsi.
- **T-302/T-303** - harga ter-refresh sesuai jadwal cron; nilai portofolio mengikuti harga terbaru.
- **T-304** - perubahan harga ter-push ke client tanpa reload (WebSocket).
- **T-305** - tabel portofolio menampilkan return live; scroll horizontal mulus di mobile.
- **T-306/T-307** - aset & riwayat tersimpan; rollup net worth cocok dengan dashboard.
- **T-308** - rasio pembayaran & sisa saldo dihitung benar di BE.
- **T-309/T-310** - grouped list & kartu liabilitas dari data nyata.
- **T-311/T-312** - polis CRUD dengan status; tanggal perpanjangan memicu notifikasi.

## Automation Log

- 2026-06-10 /epic-loop EPIC-003 #1 "Investments" -> PASS (attempts: 3), PR: https://github.com/andrsrjld/wealthme-web/pull/116
- 2026-06-10 /epic-loop EPIC-003 #2 "Assets" -> PASS (attempts: 2), PR: https://github.com/andrsrjld/wealthme-web/pull/117
- 2026-06-14 /task-work EPIC-003 #3 "Liabilities" -> PASS, merged to development
- 2026-06-14 /task-work EPIC-003 #4 "Insurance" -> PASS, merged to development

## Dependencies

- EPIC-002 (akun, transaksi, dashboard aggregation).

- **2026-08-03/04 — /nerve QA sweep (delegated QA; user confirms from the live system). Evidence: gates green on development@5f2383f (qa/test/security); fresh DEV deploy clean (compose build, migrate+seed exit 0, api/web healthy); e2e vs https://wealthme.demo-wit.id — auth, route-protection, and all page regression specs green (57 passed, 2 flaky passed on serial retry, 0 real failures); code-level criteria verification by 4 parallel QA agents. **Verdict: QA-PASS after remediation. Investments (P&L, BullMQ price cron, WS gateway), assets+history, liabilities, insurance→notification verified. Fixed in PR #203: net-worth rollup valued investments at cost basis while the investments module used latest price — now latest-price with cost-basis fallback, and dashboard summary includes the full rollup. Status → done.
