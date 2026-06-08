# EPIC-006: Integrations & AI

status: planned
environment: dev
phase: 6
priority: P2
area: Backend + Frontend

## Goal
Mengganti adapter mock dengan provider nyata (OCR, open banking, market data, notifikasi)
dan menghadirkan AI Advisor serta kategorisasi transaksi berbasis LLM.

## Tasks
- [ ] OCR nyata (Google Vision/Textract) menggantikan `MockOcr` + pipeline BullMQ + penyimpanan gambar
- [ ] Adapter open-banking (Brick/Ayoconnect): consent, sinkron akun, feed transaksi
- [ ] Market data nyata (IDX/RTI) menggantikan mock
- [ ] AI Advisor -> Claude via AI SDK (streaming chat), grounded pada data user (`claude-sonnet-4-6`)
- [ ] Wire halaman **AI Advisor** ke API streaming
- [ ] Kategorisasi transaksi otomatis (`claude-haiku-4-5`)
- [ ] Notifikasi email/push nyata (SendGrid/SES/FCM) menggantikan mock `NotificationPort`
- [ ] Upgrade pencarian ke Meilisearch (bila FTS tak memadai)

## Acceptance Criteria
- Scan struk nyata menghasilkan transaksi terisi otomatis.
- Akun bank tersinkron via partner (sandbox) dengan alur consent.
- Harga investasi berasal dari sumber pasar nyata.
- AI Advisor menjawab secara streaming berdasarkan data user; kategorisasi otomatis mencapai target akurasi.
- Notifikasi email/push terkirim sesuai pemicu.

## Dependencies
- EPIC-002..005 (semua port adapter & domain sudah ada dalam bentuk mock).
