# EPIC-008: Bug Fix — 500 API Errors & Data Load Failures

status: ready-for-qa
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

### Diagnose & Fix 500 Errors ✅

- [x] **T-801** **Transaksi 500** — false positive: financial amounts in page body; fixed via tighter ERROR_PATTERNS in menu-audit.spec.ts (PR #145)
- [x] **T-802** **Anggaran 500** — same false positive; fixed via PR #145
- [x] **T-803** **Tujuan Keuangan 500** — same false positive; fixed via PR #145
- [x] **T-804** **Laporan Detail 500** — same false positive; fixed via PR #145
- [x] **T-805** **Laporan PNL 500** — same false positive; fixed via PR #145
- [x] **T-806** **Laporan Arus Kas 500** — same false positive; fixed via PR #145
- [x] **T-807** **Kalkulator 500** — false positive: static text "Rp 93.500.000"; fixed via PR #145

### Fix "Gagal memuat" (Data Load Failures) ✅

- [x] **T-808** **Dana** — root cause: AccountsController had @UseGuards(JwtAuthGuard) rejecting Better Auth tokens → 401; removed (PR #145)
- [x] **T-809** **Rekening** — same root cause as T-808; fixed in PR #145
- [x] **T-810** **Liabilitas** — LiabilitiesController same issue; removed legacy guard (PR #145)
- [x] **T-811** **Asuransi** — InsurancesController same issue; removed legacy guard (PR #145)

### Regression Tests ✅

- [x] **T-812** Tambah E2E test per menu yang diperbaiki — `tests/e2e/pages/epic-008-regression.spec.ts` covers dana/rekening/liabilitas/asuransi (PR #147)
- [ ] **T-813** Re-run `menu-audit.spec.ts` — requires live dev server (deferred to QA stage after deploy)

## Acceptance Criteria

- `/transaksi`, `/anggaran`, `/tujuan`, `/kalkulator`, dan 3 tab laporan tidak error 500
- `/dana`, `/rekening`, `/liabilitas`, `/asuransi` tidak ada banner "Gagal memuat"
- E2E audit re-run: semua 11 menu status ✅ OK
- NestJS tidak crash (no unhandled exceptions di log)

## Automation Log

- 2026-06-16 /epic-loop EPIC-008 #1 "Diagnose & Fix 500 Errors + Gagal Memuat" → PASS (attempts: 1), PR: #145
- 2026-06-16 /epic-loop EPIC-008 #2 "Migrate Remaining JwtAuthGuard Controllers" → PASS (attempts: 1), PR: #146
- 2026-06-16 /epic-loop EPIC-008 #3 "Regression Tests" → PASS (attempts: 1), PR: #147
