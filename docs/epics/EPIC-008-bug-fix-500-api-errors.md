# EPIC-008: Bug Fix — 500 API Errors & Data Load Failures

status: on-progress
environment: dev
phase: 3
priority: P0
area: Backend + Frontend
source: E2E audit 2026-06-16 (menu-audit.spec.ts)

## Goal

Memperbaiki 11 menu yang menampilkan error saat dibuka oleh user demo:

- 7 menu menampilkan **500 Internal Server Error** (API backend crash)
- 4 menu menampilkan **"Gagal memuat"** (fetch berhasil tapi data gagal di-load/parse)

Setelah epic ini selesai, semua menu tersebut harus tampil data nyata tanpa error banner.

## Evidence (E2E Audit 2026-06-16)

| Menu              | URL                  | Error        |
| ----------------- | -------------------- | ------------ |
| Transaksi         | /transaksi           | 500          |
| Anggaran          | /anggaran            | 500          |
| Tujuan Keuangan   | /tujuan              | 500          |
| Laporan: Detail   | /laporan?tab=rdetail | 500          |
| Laporan: PNL      | /laporan?tab=rpnl    | 500          |
| Laporan: Arus Kas | /laporan?tab=rkas    | 500          |
| Kalkulator        | /kalkulator          | 500          |
| Dana              | /dana                | Gagal memuat |
| Rekening          | /rekening            | Gagal memuat |
| Liabilitas        | /liabilitas          | Gagal memuat |
| Asuransi          | /asuransi            | Gagal memuat |

## Tasks

### Diagnose & Fix 500 Errors

- [ ] **T-801** **Transaksi 500** — cek API `/transactions`, lihat console error & network tab; fix query/DTO mismatch
- [ ] **T-802** **Anggaran 500** — cek API `/budgets`, fix server error (kemungkinan missing field atau BigInt serialization)
- [ ] **T-803** **Tujuan Keuangan 500** — cek API `/goals`, fix query/response error
- [ ] **T-804** **Laporan Detail 500** — cek endpoint laporan detail, fix DTO mismatch
- [ ] **T-805** **Laporan PNL 500** — cek endpoint PNL report, fix kalkulasi atau query
- [ ] **T-806** **Laporan Arus Kas 500** — cek endpoint arus kas, fix cashflow query
- [ ] **T-807** **Kalkulator 500** — cek halaman `/kalkulator`, kemungkinan route atau component import error

### Fix "Gagal memuat" (Data Load Failures)

- [ ] **T-808** **Dana** — cek query accounts/transactions summary, fix response shape mismatch
- [ ] **T-809** **Rekening** — cek query rekening/akun bank, fix missing field atau wrong endpoint
- [ ] **T-810** **Liabilitas** — cek API liabilitas, fix query atau DTO
- [ ] **T-811** **Asuransi** — cek API asuransi, fix query atau DTO

### Regression Tests

- [ ] **T-812** Tambah E2E test per menu yang diperbaiki — harus load tanpa error banner
- [ ] **T-813** Re-run `menu-audit.spec.ts` — verifikasi semua 11 menu berubah ke ✅

## Acceptance Criteria

- `/transaksi`, `/anggaran`, `/tujuan`, `/kalkulator`, dan 3 tab laporan tidak error 500
- `/dana`, `/rekening`, `/liabilitas`, `/asuransi` tidak ada banner "Gagal memuat"
- E2E audit re-run: semua 11 menu status ✅ OK
- NestJS tidak crash (no unhandled exceptions di log)

## Automation Log

<!-- Epic loop appends here -->
