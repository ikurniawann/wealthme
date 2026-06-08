# EPIC-005: Family & Tools

status: planned
environment: dev
phase: 5
priority: P1
area: Backend + Frontend

## Goal
Mengaktifkan family finance multi-tenant penuh + RBAC, serta tools: split bill, warisan,
donasi/zakat, tax center, multi-mata uang, dan rekonsiliasi bank.

## Tasks

### Family & RBAC
- [ ] Family group + members + undangan via email
- [ ] Peran admin/staf + izin terbatas (input-only, kategori dibatasi, tak lihat saldo pribadi)
- [ ] Wire **Akun -> Family** + modal Tambah Admin

### Split Bill
- [ ] Split bills + participants + share-link API (link publik, settle/bayar)
- [ ] Wire halaman **Split Bill** + modal buat/detail

### Warisan
- [ ] Inheritance + heirs + visibility API
- [ ] Wire halaman **Warisan** + modal Tambah Aset

### Donations & Tax
- [ ] Donations/Zakat records API (memberi input pengurang pajak)
- [ ] Wire halaman **Donasi & Zakat**
- [ ] Tax records + documents API + `StoragePort` (MinIO upload/download)
- [ ] Wire halaman **Tax Center**

### Multi-currency & Reconciliation
- [ ] `FxPort` (kurs BI) + ganti mata uang (IDR/USD/SGD/EUR/JPY)
- [ ] Rekonsiliasi: upload rekening koran + parser + pencocokan
- [ ] Wire stepper **Rekonsiliasi Bank**

## Acceptance Criteria
- Owner mengundang member; member melihat saldo bersama, bukan saldo pribadi member lain.
- Admin/staf hanya bisa input transaksi sesuai izin; setiap aksi tercatat di audit log.
- Share link split bill dapat dibuka publik & status bayar ter-update.
- Aset warisan terlihat oleh ahli waris sesuai pengaturan visibilitas.
- Dokumen pajak/warisan tersimpan di MinIO dan dapat diunduh.
- Mengganti mata uang mengubah seluruh nilai yang ditampilkan.
- Rekonsiliasi mencocokkan transaksi & menyarankan entri yang hilang.

## Dependencies
- EPIC-001 (RBAC/tenancy), EPIC-002 (transaksi), EPIC-004 (Zakat/PPh untuk Donasi & Tax).
