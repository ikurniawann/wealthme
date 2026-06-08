# EPIC-004: Reports & Calculators

status: planned
environment: dev
phase: 4
priority: P1
area: Backend + Frontend

## Goal
Menyediakan laporan keuangan teragregasi (seluruh tab), ekspor PDF/Excel, serta kalkulator
Zakat & PPh 21 yang deterministik di backend dan kalkulator finansial.

## Tasks

### Report read-models
- [ ] Reports: Ringkasan / Harian / Bulanan / Tahunan
- [ ] Reports: Group Family / Bank / Detail
- [ ] Reports: PNL / Balance Sheet / Cashflow / Aliran Dana (data Sankey)
- [ ] Wire halaman **Laporan** (16 tab) ke API report

### Export
- [ ] Export laporan ke PDF/Excel (job server-side)

### Calculators
- [ ] Service Zakat Maal (2,5% + cek nisab ~Rp 102 jt) + wire di **Donasi & Zakat**
- [ ] Service PPh 21 (tarif progresif UU HPP, PTKP, biaya jabatan, pengurang zakat) + wire di **Tax Center**
- [ ] Kalkulator finansial (investasi/KPR/pensiun/tabungan/split) parity; opsi share rumus di `@wealthme/contracts`

## Acceptance Criteria
- Setiap tab laporan menampilkan agregasi benar untuk periode terpilih.
- PNL / Balance Sheet / Cashflow seimbang dan konsisten satu sama lain.
- Ekspor PDF/Excel menghasilkan berkas yang benar.
- Hasil Zakat & PPh 21 sama persis dengan referensi perhitungan di frontend (uji nilai).
- Kalkulator finansial konsisten dengan demo.

## Dependencies
- EPIC-002 & EPIC-003 (sumber data transaksi, investasi, aset, liabilitas).
