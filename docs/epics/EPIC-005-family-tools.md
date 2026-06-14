# EPIC-005: Family & Tools

status: on-progress
environment: dev
phase: 5
priority: P1
area: Backend + Frontend
prd: ../product/PRD.md
stories: ../product/USER-STORIES.md (§1 Auth & Profile, §9 Family, §10 Inheritance, §11 Donations, §12 Tax, §13 Split Bill, §14 Reconciliation)
tasks: ../product/ENGINEERING-TASKS.md (T-501 … T-517)

## Goal

Mengaktifkan family finance multi-tenant penuh + RBAC, serta tools: split bill, warisan,
donasi/zakat, tax center, multi-mata uang, rekonsiliasi bank, dan halaman Akun/Profil lengkap.

## User Stories

- **US-FAM-1..7** — buat family group, undang member, admin-staf input-only, isolasi saldo privat, shared goals, audit log, RBAC server-side.
- **US-AUTH-4..8** — ganti password/PIN/biometrik, edit profil, preferensi (mata uang/bahasa/tema), sesi aktif, ekspor & hapus akun.
- **US-INH-1..4** — aset warisan + ahli waris + visibilitas + dokumen.
- **US-DON-1..5** — catat donasi/zakat (→ pengurang pajak).
- **US-TAX-1..4** — kalkulator PPh 21, status SPT, dokumen pajak, pengurang zakat.
- **US-SPLIT-1..4** — buat split, share link, lacak bayar, reminder WhatsApp.
- **US-RECON-1..3** — unggah rekening koran, pencocokan, saran entri hilang.

## Tasks

### Family & RBAC ✅

- [x] **T-501** Family group + members + undangan via email
- [x] **T-502** Peran admin/staf + izin terbatas (input-only, kategori dibatasi, tak lihat saldo pribadi); CASL abilities
- [x] **T-503** Enforcement tenancy: TenantInterceptor + Postgres RLS; jaminan isolasi member
- [x] **T-504** Audit logging aksi admin/staf (`audit_logs`)
- [x] **T-505** Wire halaman **Akun** lengkap: profil, keamanan (password/PIN/biometrik), sesi aktif, preferensi (mata uang/bahasa/format tanggal/tema), privasi (ekspor/hapus akun), panel **Family** + modal Tambah Admin

### Split Bill ✅

- [x] **T-506** Split bills + participants + share-link API (link publik, settle/bayar)
- [x] **T-507** Wire halaman **Split Bill** + modal buat/detail + reminder WhatsApp

### Warisan ✅

- [x] **T-508** Inheritance + heirs + visibility API
- [x] **T-509** Wire halaman **Warisan** + modal Tambah Aset + toggle visibilitas + unggah dokumen

### Donations & Tax ✅

- [x] **T-510** `StoragePort` (MinIO) upload/download dokumen (warisan, pajak)
- [x] **T-511** Donations/Zakat records API (memberi input pengurang pajak)
- [x] **T-512** Wire halaman **Donasi & Zakat** + kalkulator zakat inline
- [x] **T-513** Tax records + documents API (konsumsi pengurang zakat)
- [x] **T-514** Wire halaman **Tax Center** + kalkulator PPh 21 + status SPT + dokumen

### Multi-currency & Reconciliation ✅

- [x] **T-515** `FxPort` (kurs BI) + ganti mata uang (IDR/USD/SGD/EUR/JPY)
- [x] **T-516** Rekonsiliasi: upload rekening koran + parser + pencocokan (`BankSyncPort` mock)
- [x] **T-517** Wire stepper **Rekonsiliasi Bank** (upload→pindai→cocokkan→selesai) + saran

## Acceptance Criteria

**Epic-level**

- Owner mengundang member; member melihat saldo bersama, bukan saldo pribadi member lain.
- Admin/staf hanya bisa input transaksi sesuai izin; setiap aksi tercatat di audit log.
- RBAC dipaksakan di server (bukan hanya UI) — diverifikasi uji E2E isolasi.

**Per-task**

- **T-501/T-502/T-503** — undangan email berfungsi; CASL membatasi admin-staf; RLS + interceptor mencegah member query saldo member lain (uji E2E).
- **T-504** — semua aksi admin tercatat di `audit_logs` dengan aktor & entitas.
- **T-505** — perubahan profil/preferensi persisten & tampil lintas halaman; ganti password aman (argon2id); ekspor/hapus akun jalan; panel Family + Tambah Admin berfungsi.
- **T-506/T-507** — share link split dibuka publik (`wealthme.id/split/...`); status bayar per peserta ter-update; reminder terkirim.
- **T-508/T-509** — aset warisan terlihat oleh ahli waris sesuai visibilitas; dokumen tersimpan & dapat diunduh oleh yang berhak.
- **T-510** — dokumen pajak/warisan tersimpan di MinIO; download terbatas pada yang berizin.
- **T-511/T-512** — record donasi/zakat persisten; zakat menghasilkan input pengurang pajak yang dikonsumsi service PPh 21.
- **T-513/T-514** — PPh 21 memakai pengurang zakat; status SPT & dokumen tampil.
- **T-515** — mengganti mata uang mengubah seluruh nilai yang ditampilkan (display-only, IDR tetap otoritatif).
- **T-516/T-517** — rekonsiliasi mencocokkan transaksi & menyarankan entri yang hilang; split-view ✅/⚠️/❌.

## Automation Log

- 2026-06-14 /epic-loop EPIC-005 #1 "Family & RBAC" → PASS (attempts: 3), PR: https://github.com/andrsrjld/wealthme-web/pull/124
- 2026-06-14 /epic-loop EPIC-005 #2 "Split Bill" → PASS (attempts: 1), PR: https://github.com/andrsrjld/wealthme-web/pull/125
- 2026-06-14 /epic-loop EPIC-005 #3 "Warisan" → PASS (attempts: 2), PR: https://github.com/andrsrjld/wealthme-web/pull/126
- 2026-06-14 /epic-loop EPIC-005 #4 "Donations & Tax" → PASS (attempts: 2), PR: https://github.com/andrsrjld/wealthme-web/pull/127
- 2026-06-14 /epic-loop EPIC-005 #5 "Multi-currency & Reconciliation" → PASS (attempts: 2), PR: pending

## Dependencies

- EPIC-001 (RBAC/tenancy, auth), EPIC-002 (transaksi), EPIC-004 (Zakat/PPh untuk Donasi & Tax).
