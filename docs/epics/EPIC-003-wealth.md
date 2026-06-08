# EPIC-003: Wealth

status: planned
environment: dev
phase: 3
priority: P1
area: Backend + Frontend

## Goal
Menambah domain kekayaan: investasi (dengan harga terjadwal & realtime), aset, liabilitas,
dan asuransi — serta memastikan perhitungan net worth konsisten di seluruh aplikasi.

## Tasks

### Investments
- [ ] Investments API + P&L: holdings, cost basis (modal), nilai kini, return Rp & %
- [ ] `investment_prices` + `MarketDataPort` (mock) + cron refresh harga (BullMQ)
- [ ] Realtime price push (WebSocket gateway)
- [ ] Wire halaman **Investasi** (tabel portofolio + return live)

### Assets
- [ ] Assets API + net-worth rollup (dana + investasi + aset - liabilitas)
- [ ] Wire halaman **Aset** (grouped + tabs)

### Liabilities
- [ ] Liabilities API: kartu kredit & pinjaman, rasio pembayaran
- [ ] Wire halaman **Liabilitas**

### Insurance
- [ ] Insurance API: polis, premi, tanggal perpanjangan, status
- [ ] Wire halaman **Asuransi**

## Acceptance Criteria
- Harga investasi ter-refresh sesuai jadwal; nilai portofolio & return akurat.
- Perubahan harga ter-push ke client tanpa reload (WebSocket).
- Net worth = aset + investasi + cash - liabilitas, konsisten dengan dashboard (EPIC-002).
- Halaman Investasi/Aset/Liabilitas/Asuransi memakai data nyata.
- Unit test perhitungan P&L dan rollup lulus.

## Dependencies
- EPIC-002 (akun, transaksi, dashboard aggregation).
