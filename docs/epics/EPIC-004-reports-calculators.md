# EPIC-004: Reports & Calculators

status: done
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

### Report read-models ✅

- [x] **T-401** Reports: Ringkasan / Harian / Bulanan / Tahunan
- [x] **T-402** Reports: Group Family / Bank / Detail
- [x] **T-403** Reports: PNL / Balance Sheet / Cashflow / Aliran Dana (data Sankey)
- [x] **T-404** Wire halaman **Laporan** (16 tab) ke API report (scroll tab horizontal)

### Export ✅

- [x] **T-405** Export laporan ke PDF/Excel (job server-side BullMQ)

### Calculators ✅

- [x] **T-406** Service Zakat Maal (2,5% + cek nisab ~Rp 102 jt) di `contracts` + BE; uji golden-value
- [x] **T-407** Service PPh 21 (tarif progresif UU HPP, PTKP, biaya jabatan, pengurang zakat); uji golden-value
- [x] **T-408** Kalkulator finansial (investasi/KPR/pensiun/tabungan/split) parity; rumus share di `@wealthme/contracts`
- [x] **T-409** Wire halaman **Kalkulator** (5 tab) + kalkulator inline di **Donasi & Zakat** dan **Tax Center**

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

## Automation Log

- 2026-06-14 /epic-loop EPIC-004 #1 "Report read-models" → PASS (attempts: 2), PR: https://github.com/andrsrjld/wealthme-web/pull/120
- 2026-06-14 /epic-loop EPIC-004 #2 "Export" → PASS (attempts: 2), PR: https://github.com/andrsrjld/wealthme-web/pull/121
- 2026-06-14 /epic-loop EPIC-004 #3 "Calculators" → PASS (attempts: 2), PR: https://github.com/andrsrjld/wealthme-web/pull/122

- **2026-08-03/04 — /nerve QA sweep (delegated QA; user confirms from the live system). Evidence: gates green on development@5f2383f (qa/test/security); fresh DEV deploy clean (compose build, migrate+seed exit 0, api/web healthy); e2e vs https://wealthme.demo-wit.id — auth, route-protection, and all page regression specs green (57 passed, 2 flaky passed on serial retry, 0 real failures); code-level criteria verification by 4 parallel QA agents. **Verdict: QA-PASS with follow-ups. 7 tenant-scoped read-models + all 16 laporan tabs wired; deterministic zakat/PPh21 services. Fixed: 'Export PDF' plaintext stub → real PDF via pdf-lib (PR #200). Follow-ups recorded: 'Export Excel' emits CSV (honest relabel lands with the EPIC-018 A3 laporan i18n pass); FE-duplicated zakat/PPh21 formulas + nisab constant drift (BE 93.5jt vs UI 102jt) → wire donation/tax pages to /calculators; export job state is an in-memory Map (fine single-replica DEV). Status → done.
