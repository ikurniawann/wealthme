# EPIC-006: Integrations & AI

status: on-progress
environment: dev
phase: 6
priority: P2
area: Backend + Frontend
prd: ../product/PRD.md
stories: ../product/USER-STORIES.md (§15 AI Advisor, §2/§3 OCR & categorization, §16 Notifications)
tasks: ../product/ENGINEERING-TASKS.md (T-601 … T-608)

## Goal

Mengganti adapter mock dengan provider nyata (OCR, open banking, market data, notifikasi)
dan menghadirkan AI Advisor serta kategorisasi transaksi berbasis LLM.

## User Stories

- **US-AI-1..4** — chat advisor grounded data user (streaming), analisa wealth/spending, rekomendasi.
- **US-TXN-2** — scan struk nyata (OCR) mengisi transaksi otomatis.
- **US-TXN-5** — kategorisasi transaksi otomatis.
- **US-NOTIF-1..2** — notifikasi email/push nyata + toggle per kategori.
- **US-RECON-1** — sinkron akun bank via open banking.

## Tasks

### OCR Provider ✅

- [x] **T-601** OCR nyata (Claude Vision via AI SDK) menggantikan `MockOcr` + pipeline BullMQ + penyimpanan gambar

### Open Banking & Market Data ✅

- [x] **T-602** Adapter open-banking (Brick/Ayoconnect): consent, sinkron akun, feed transaksi (`BankSyncPort` real)
- [x] **T-603** Market data nyata (Yahoo Finance / IDX) menggantikan mock

### AI Advisor ✅

- [x] **T-604** AI Advisor → Claude via AI SDK (streaming chat), grounded pada data user (`claude-sonnet-4-6`) di balik `AiAdvisorPort`
- [x] **T-605** Wire halaman **AI Advisor** ke API streaming + shortcut pertanyaan + disclaimer

### Auto Categorization & Notifications ✅

- [x] **T-606** Kategorisasi transaksi otomatis (`claude-haiku-4-5`)
- [x] **T-607** Notifikasi email/push nyata (SendGrid/SES/FCM) menggantikan mock `NotificationPort`

### Search Upgrade ✅

- [x] **T-608** Upgrade pencarian ke Meilisearch (bila FTS tak memadai)

## Acceptance Criteria

**Epic-level**

- Scan struk nyata menghasilkan transaksi terisi otomatis (dengan konfirmasi manusia sebelum simpan).
- Akun bank tersinkron via partner (sandbox) dengan alur consent.
- Harga investasi berasal dari sumber pasar nyata.
- AI Advisor menjawab secara streaming berdasarkan data user; kategorisasi otomatis mencapai target akurasi.
- Notifikasi email/push terkirim sesuai pemicu.

**Per-task**

- **T-601** — OCR provider nyata mengisi field transaksi; gambar tersimpan via `StoragePort`.
- **T-602** — alur consent open-banking jalan di sandbox; akun & transaksi tersinkron.
- **T-603** — `MarketDataPort` real mengganti mock tanpa ubah konsumen (port stabil).
- **T-604/T-605** — advisor streaming grounded data user; math keuangan tetap deterministik di BE (advisor menjelaskan, tidak menghitung zakat/pajak); disclaimer tampil.
- **T-606** — akurasi kategorisasi memenuhi target; bisa dikoreksi user.
- **T-607** — email/push terkirim pada pemicu (budget ≥80%, renewal asuransi, dll).
- **T-608** — pencarian tetap berfungsi; Meilisearch hanya bila FTS tak memadai.

## Automation Log

- 2026-06-14 /epic-loop EPIC-006 #1 "OCR Provider" → PASS (attempts: 2), PR: https://github.com/andrsrjld/wealthme-web/pull/130
- 2026-06-14 /epic-loop EPIC-006 #2 "Open Banking & Market Data" → PASS (attempts: 3), PR: https://github.com/andrsrjld/wealthme-web/pull/131
- 2026-06-14 /epic-loop EPIC-006 #3 "AI Advisor" → PASS (attempts: 2), PR: https://github.com/andrsrjld/wealthme-web/pull/132
- 2026-06-14 /epic-loop EPIC-006 #4 "Auto Categorization & Notifications" → PASS (attempts: 2), PR: https://github.com/andrsrjld/wealthme-web/pull/133

## Dependencies

- EPIC-002..005 (semua port adapter & domain sudah ada dalam bentuk mock).
