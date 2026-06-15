# EPIC-009: Missing Pages MVP — 404 & Placeholder Features

status: backlog
environment: dev
phase: 3
priority: P1
area: Frontend + Backend
source: E2E audit 2026-06-16 (menu-audit.spec.ts)

## Goal

Membangun halaman/fitur yang belum ada (404) dan yang masih placeholder,
agar semua menu di sidebar dapat diakses dan memberikan value nyata kepada user.

## Evidence (E2E Audit 2026-06-16)

| Menu                  | URL                  | Status                             |
| --------------------- | -------------------- | ---------------------------------- |
| AI Advisor            | /ai-advisor          | 404 — halaman belum ada            |
| Donasi & Zakat        | /donasi              | 404 — halaman belum ada            |
| Laporan: Investasi    | /laporan?tab=rinv    | 404 — tab tidak render             |
| Quick Input           | /quick-input         | 404 — halaman belum ada            |
| Setup Master Data     | /setup               | 404 — halaman belum ada            |
| Split Bill            | /split-bill          | 404 — halaman belum ada            |
| Tax Center            | /tax-center          | 404 — halaman belum ada            |
| Laporan: Group Family | /laporan?tab=rfamily | Placeholder — "dalam pengembangan" |
| Laporan: Pajak        | /laporan?tab=rpajak  | Placeholder — "dalam pengembangan" |

## Tasks

### Group A — Laporan Tab Fixes (quick wins)

- [ ] **T-901** **Laporan: Investasi tab** — debug mengapa tab `rinv` mengembalikan 404; fix routing atau conditional render di `laporan/page.tsx`
- [ ] **T-902** **Laporan: Group Family** — implementasi data nyata dari family group API; hapus placeholder text
- [ ] **T-903** **Laporan: Pajak** — implementasi estimasi PPh 21 sederhana dari data income; hapus placeholder

### Group B — New Pages (Frontend MVP)

- [ ] **T-904** **Quick Input** `/quick-input` — form transaksi cepat (nominal + kategori + akun dalam 1 tap); kirim ke `POST /transactions`
- [ ] **T-905** **Setup Master Data** `/setup` — wizard setup awal: kategori default, akun pertama, target tabungan; gunakan existing API
- [ ] **T-906** **Donasi & Zakat** `/donasi` — CRUD donasi & zakat dengan perhitungan nisab; `donations` table sudah ada
- [ ] **T-907** **Tax Center** `/tax-center` — dashboard pajak: estimasi PPh 21, ringkasan tahunan; sambungkan ke transaksi income
- [ ] **T-908** **Split Bill** `/split-bill` — buat & kelola tagihan bersama (split equal/custom); MVP tanpa payment gateway

### Group C — AI Advisor

- [ ] **T-909** **AI Advisor** `/ai-advisor` — chat interface dengan AI untuk analisis keuangan personal; context dari ringkasan keuangan user via API

### Regression Tests

- [ ] **T-910** E2E smoke test untuk setiap halaman baru (load tanpa 404, konten ada)
- [ ] **T-911** Re-run `menu-audit.spec.ts` — semua 9 item berubah ke ✅

## Acceptance Criteria

- Tidak ada halaman dari sidebar yang mengembalikan 404
- Tab Laporan Investasi menampilkan data investasi user
- `/quick-input` bisa tambah transaksi dalam < 5 detik
- `/donasi`, `/tax-center`, `/split-bill`, `/setup` memiliki UI MVP fungsional
- `/ai-advisor` bisa diajak chat dengan konteks keuangan user
- E2E audit re-run: semua 9 menu berubah ke ✅

## Priority Order

1. T-901 (Laporan Investasi tab — quick fix)
2. T-904 (Quick Input — high-usage)
3. T-905 (Setup Master Data — onboarding)
4. T-909 (AI Advisor — differentiator)
5. T-906, T-907, T-908 (Donasi, Tax, Split Bill)
6. T-902, T-903 (Laporan Group Family & Pajak)

## Automation Log

<!-- Epic loop appends here -->
