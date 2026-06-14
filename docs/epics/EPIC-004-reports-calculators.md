# EPIC-004: Reports & Calculators

status: on-progress
environment: dev
phase: 4
priority: P1
area: Backend + Frontend
prd: ../product/PRD.md
stories: ../product/USER-STORIES.md (§7 Reports, §8 Calculators)
tasks: ../product/ENGINEERING-TASKS.md (T-401 … T-409)

## Goal

Menyediakan laporan keuangan teragregasi (seluruh tab), ekspor PDF/Excel, serta kalkulator
Zakat & PPh 21 yang deterministik di backend dan kalkulator finansial.

## User Stories

- **US-RPT-1..8** — laporan Ringkasan/Harian/Bulanan/Tahunan, Group Family, Bank, Detail, Aliran Dana (Sankey), PNL/Balance Sheet/Cashflow, ekspor PDF/Excel.
- **US-CALC-1..5** — kalkulator investasi, KPR, pensiun, Zakat Maal, PPh 21 progresif.

## Tasks

### Report read-models

- [ ] **T-401** Reports: Ringkasan / Harian / Bulanan / Tahunan
- [ ] **T-402** Reports: Group Family / Bank / Detail
- [ ] **T-403** Reports: PNL / Balance Sheet / Cashflow / Aliran Dana (data Sankey)
- [ ] **T-404** Wire halaman **Laporan** (16 tab) ke API report (scroll tab horizontal)

### Export

- [ ] **T-405** Export laporan ke PDF/Excel (job server-side BullMQ)

### Calculators

- [ ] **T-406** Service Zakat Maal (2,5% + cek nisab ~Rp 102 jt) di `contracts` + BE; uji golden-value
- [ ] **T-407** Service PPh 21 (tarif progresif UU HPP, PTKP, biaya jabatan, pengurang zakat); uji golden-value
- [ ] **T-408** Kalkulator finansial (investasi/KPR/pensiun/tabungan/split) parity; rumus share di `@wealthme/contracts`
- [ ] **T-409** Wire halaman **Kalkulator** (5 tab) + kalkulator inline di **Donasi & Zakat** dan **Tax Center**

## Acceptance Criteria

**Epic-level**

- Setiap tab laporan menampilkan agregasi benar untuk periode terpilih.
- PNL / Balance Sheet / Cashflow seimbang dan konsisten satu sama lain.
- Hasil Zakat & PPh 21 sama persis dengan referensi perhitungan di frontend/demo (uji nilai).

**Per-task**

- **T-401/T-402/T-403** — tiap read-model memberi angka benar untuk rentang periode; Sankey punya data sumber→alokasi.
- **T-404** — 16 tab terhubung ke API; scroll horizontal mulus di mobile.
- **T-405** — ekspor PDF/Excel menghasilkan berkas benar (job async, unduh siap).
- **T-406** — Zakat = 2,5% bila wealth ≥ nisab; output cocok demo (golden test).
- **T-407** — PPh 21 progresif UU HPP; PKP & tarif efektif live; zakat mengurangi PKP; cocok demo.
- **T-408** — kalkulator finansial konsisten dengan demo; rumus dipakai-ulang FE & BE.
- **T-409** — kalkulator deterministik di BE/`contracts` (bukan LLM).

## Dependencies

- EPIC-002 & EPIC-003 (sumber data transaksi, investasi, aset, liabilitas).
- **Catatan:** T-402 (Group Family/Bank) lunak bergantung pada model family EPIC-005; bila EPIC-004 jalan duluan, kirim T-402 sebagai follow-up setelah T-503.
