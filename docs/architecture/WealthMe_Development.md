# WealthMe — Personal Wealth Operating System

### Dokumentasi Pengembangan Demo

**Author:** Irfan Arsandi (WIT.ID)
**Format:** Single-file HTML (no backend, no build step)
**File:** `WealthMe_Demo.html` (~3.777 baris, ~329 KB)
**Status:** Interactive Demo / Prototype

---

## 1. Ringkasan Produk

WealthMe adalah **Personal Wealth Operating System** berbasis web + mobile — sebuah platform manajemen kekayaan personal & keluarga yang menggabungkan pencatatan transaksi, investasi, aset, laporan keuangan, perencanaan warisan, donasi/zakat, pajak pribadi, hingga AI advisor dalam satu aplikasi.

**Formula inti:**

```
Net Worth = Aset + Investasi + Cash − Liabilitas
```

**Tipe pengguna:** Personal · Family Owner · Family Member · Admin/Staf

**Target rilis (stack produksi):** Next.js + TypeScript + Tailwind + Shadcn (FE) · NestJS (BE) · PostgreSQL + Prisma (DB) · OpenAI + Claude (AI)

---

## 2. Tech Stack Demo

| Komponen         | Teknologi                                                             |
| ---------------- | --------------------------------------------------------------------- |
| Markup & Styling | HTML5 + CSS3 (CSS variables, single file)                             |
| Font             | Sora (UI) + DM Mono (angka/mono) via Google Fonts                     |
| Ikon             | Font Awesome 6.5.1 (navbar & UI), Emoji (konten)                      |
| Charts           | SVG (donut, sparkline), Canvas (wealth trend), JS-rendered bar charts |
| Interaktivitas   | Vanilla JavaScript (no framework, no dependencies)                    |
| Penyimpanan tema | `localStorage` (preferensi dark/light)                                |
| Layout           | CSS Grid + Flexbox, mobile-first responsive                           |

---

## 3. Sistem Desain

### Palet Warna (CSS Variables)

| Token                | Light                 | Fungsi               |
| -------------------- | --------------------- | -------------------- |
| `--primary`          | `#4F46E5` (indigo)    | Warna utama / aksi   |
| `--success`          | `#10B981` (hijau)     | Pemasukan, positif   |
| `--danger`           | `#EF4444` (merah)     | Pengeluaran, negatif |
| `--warning`          | `#F59E0B` (kuning)    | Peringatan           |
| `--purple`           | `#8B5CF6`             | Aksen sekunder       |
| `--cyan`             | `#06B6D4`             | Aksen data           |
| `--bg` / `--surface` | `#F8F9FC` / `#FFFFFF` | Latar & kartu        |

**Dark mode:** override penuh via class `html.dark` — background `#0F172A`, surface `#1E293B`, teks `#F1F5F9`, dengan 72+ aturan khusus untuk semua komponen.

### Prinsip UI

- Mobile-first, fully responsive (sidebar collapse → bottom nav di mobile)
- Glassmorphism & gradient hero cards
- Border-radius konsisten (`--radius: 14px`, `--radius-sm: 8px`)
- Bahasa Indonesia menyeluruh
- Format mata uang Rupiah (`Rp`, pemisah ribuan `.`)

---

## 4. Arsitektur Navigasi

Aplikasi memakai **single-page navigation** — semua halaman ada dalam satu file, ditampilkan/disembunyikan via fungsi `nav(id, el)` dengan class `.page.active`.

### Struktur Menu Sidebar

```
┌─ UTAMA
│  ├─ Beranda
│  ├─ Ringkasan
│  ├─ Transaksi
│  ├─ Anggaran
│  ├─ Laporan ▼ (collapsible)
│  │   ├─ Ringkasan
│  │   ├─ Laporan Harian
│  │   ├─ Laporan Bulanan
│  │   ├─ Laporan Tahunan
│  │   ├─ Laporan Group Family
│  │   ├─ Laporan Bank
│  │   ├─ Laporan Detail
│  │   ├─ Laporan Aliran Dana
│  │   ├─ Laporan PNL
│  │   ├─ Laporan Balance Sheet
│  │   └─ Cashflow
│  ├─ Tujuan Keuangan
│  └─ Notifikasi
│
├─ KEUANGAN
│  ├─ Dana
│  ├─ Rekening
│  ├─ Investasi
│  ├─ Aset
│  ├─ Liabilitas
│  ├─ Asuransi
│  ├─ Warisan          [New]
│  ├─ Donasi & Zakat   [New]
│  └─ Tax Center       [New]
│
└─ ALAT
   ├─ Split Bill       [New]
   ├─ Rekonsiliasi Bank
   ├─ AI Advisor
   └─ Kalkulator
```

**Total: 21 halaman** + 4 menu akun (subpage panel).

---

## 5. Daftar Fitur Lengkap

### 5.1 Autentikasi

- **Login page** dengan email/password pre-filled (demo)
- Toggle show/hide password, tombol Google login
- Enter key support, fade transition ke aplikasi

### 5.2 Beranda (Dashboard)

- Hero card kekayaan bersih **Rp 1.256.780.000** dengan grafik sparkline (Canvas, edge-to-edge)
- Tab periode (1M/3M/6M/1Y/All)
- Donut alokasi kekayaan (Investasi/Rekening/Aset/Lainnya)
- 5 summary cards (Dana, Rekening, Investasi, Aset, Liabilitas)
- Bar chart arus kas bulanan
- Aktivitas terbaru, progress tujuan, AI insight banner

### 5.3 Transaksi

- Filter (Semua/Masuk/Keluar/Transfer/Kartu Kredit)
- Summary bar (pemasukan/pengeluaran/selisih)
- Daftar transaksi per tanggal
- **Modal Tambah Transaksi** dengan 2 mode:
  - **Input Manual** — jumlah, kategori, akun, tanggal, deskripsi
  - **Scan Struk/Bon (OCR)** — simulasi kamera + viewfinder, deteksi otomatis field (tanggal, merchant, kategori, total, detail item)

### 5.4 Anggaran

- Budget overview per kategori dengan progress bar + warning state
- Kategori termasuk **Liburan/Holiday** ✈️
- **Modal Tambah Kategori** — nama, pilih ikon (8 pilihan), budget, periode

### 5.5 Laporan (16 tab)

Tab dasar: Ringkasan, Arus Kas, Investasi, Aset & Liabilitas, Performa, Pajak.
**10 sub-laporan tambahan:**

| Laporan       | Isi                                                    |
| ------------- | ------------------------------------------------------ |
| Harian        | Pemasukan/pengeluaran/net hari ini + transaksi per jam |
| Bulanan       | Tren bar chart 6 bulan + rekap tabel                   |
| Tahunan       | Total tahunan + pertumbuhan net worth 2023–2025        |
| Group Family  | Saldo bersama + pengeluaran per anggota                |
| Bank          | Saldo per rekening + mutasi masuk/keluar               |
| Detail        | Tabel transaksi lengkap + export                       |
| Aliran Dana   | Visualisasi Sankey-style sumber → alokasi              |
| PNL           | Profit & Loss statement (akuntansi)                    |
| Balance Sheet | Neraca Aset vs Liabilitas+Ekuitas                      |
| Cashflow      | Arus kas Operasi/Investasi/Pendanaan                   |

Tab di-scroll horizontal (seamless), responsive di mobile.

### 5.6 Tujuan Keuangan

- 4 goal cards (Dana Darurat, Liburan Jepang, DP Rumah, Pensiun)
- Progress bar + status badge (On Track / Perlu Boost) + auto-debit info

### 5.7 Dana, Rekening, Investasi, Aset, Liabilitas, Asuransi

- **Dana** — dana tunai & e-wallet (GoPay/LinkAja)
- **Rekening** — kartu bank (BCA/Mandiri/BNI) dengan action
- **Investasi** — tabel portofolio (saham, reksa dana, emas, obligasi) dengan return %; tabel scroll horizontal di mobile
- **Aset** — grouped list (Dana/Investasi/Aset/Liabilitas)
- **Liabilitas** — kartu kredit & pinjaman dengan rasio
- **Asuransi** — polis aktif (jiwa, kendaraan, properti)

### 5.8 Warisan ⭐ (New)

- Hero total nilai warisan **Rp 2.145.300.000**
- 4 kategori: **Aset/Properti, Cash/Tunai, Surat Berharga, Saham**
- Daftar ahli waris yang bisa mengakses (transparan untuk semua anggota keluarga)
- Detail aset per kategori (no. SHM, BPKB, sertifikat)
- **Modal Tambah Aset Warisan** — kategori, nilai, dokumen, toggle visibilitas

### 5.9 Donasi & Zakat ⭐ (New)

- Hero total donasi 2025 **Rp 42.850.000**
- 4 kategori: Zakat, Sedekah/Infak, Donasi Sosial, Wakaf
- **Kalkulator Zakat Maal** interaktif (2,5% + cek nisab 85gr emas)
- Riwayat donasi (BAZNAS, Dompet Dhuafa, dll)
- **Modal Catat Donasi** — jenis, jumlah, lembaga, sumber dana
- Integrasi: zakat → pengurang pajak di Tax Center

### 5.10 Tax Center — Pajak Pribadi ⭐ (New)

- Hero estimasi pajak terutang **Rp 18.240.000**
- Status SPT (2024 lapor, 2025 belum, PPh dipotong)
- **Kalkulator PPh 21** tarif progresif UU HPP (5/15/25/30/35%)
  - Input bruto, status PTKP (TK/0–K/3), biaya jabatan otomatis, zakat pengurang
  - Output PKP, pajak terutang, tarif efektif (live)
- Rincian tarif progresif per lapisan
- Dokumen pajak (1721-A1, BPE, bukti setor zakat)
- Tombol Lapor SPT (e-Filing) & unduh ringkasan

### 5.11 Split Bill ⭐ (New)

- Stats: total ditalangin / sudah dibayar / belum dibayar
- Daftar split aktif dengan progress bar + tombol Bagikan Link
- **Modal Buat Split Bill** — judul, total, metode (rata/custom), peserta dinamis
- **Modal Detail/Share** — status bayar per orang, link `wealthme.id/split/...`, WhatsApp/Salin/Ingatkan

### 5.12 Rekonsiliasi Bank

- Flow 4 langkah: Upload → Pindai → Cocokkan → Selesai
- Stepper visual, drag & drop area, daftar bank didukung
- Simulasi AI scan dengan progress + scan log
- Tabel pencocokan split-view (rekening koran vs sistem), icon ✅/⚠️/❌
- AI suggestion auto-tambah transaksi missing

### 5.13 AI Advisor

- Chat interface dengan 6 shortcut pertanyaan
- Pre-built responses (analisa keuangan, target, rekomendasi, dll)

### 5.14 Kalkulator (5 tab)

- **Investasi** — proyeksi compound interest
- **Kredit/KPR** — cicilan & bunga
- **Pensiun** — dana pensiun
- **Tabungan** — estimasi waktu capai target
- **Split Group** ⭐ — patungan cafe/acara dengan pajak/tip + rincian per orang

### 5.15 Notifikasi

- 3 notif baru + riwayat
- Toggle: klik bell saat sudah di halaman notif → kembali ke halaman sebelumnya

### 5.16 Akun

- Profil hero (tanpa badge premium)
- Group Family card
- Sub-menu dengan slide-in panel:
  - **Profil Saya** — form edit lengkap
  - **Keamanan & Password** — password, PIN, biometrik, sesi aktif
  - **Koneksi Bank & E-Wallet** — rekening & e-wallet terhubung
  - **Pengaturan Umum** — **mata uang (IDR/USD/SGD/EUR/JPY)**, bahasa, format tanggal, tema
  - **Notifikasi** — toggle per kategori
  - **Privasi & Data** — visibilitas, ekspor, hapus akun
  - **Pusat Bantuan** — 6 FAQ accordion + panduan
  - **Hubungi Kami** — chat, email, telepon, WhatsApp, feedback
  - **Tentang Aplikasi** — versi, kebijakan
  - **Arsandi Family** — anggota + **Admin/Staf** (sekretaris, supir, ART yang bisa input transaksi)

### 5.17 Dark / Light Mode

- Tombol toggle 🌙/☀️ di topbar & mobile header
- Preferensi persisten via `localStorage`
- 72+ aturan dark mode untuk semua komponen

---

## 6. Identitas Demo

| Atribut       | Nilai                                |
| ------------- | ------------------------------------ |
| Nama pengguna | **Irfan Arsandi**                    |
| Email         | `irfan.arsandi@wealthme.id`          |
| Avatar        | IA                                   |
| Family Group  | Arsandi Family (4 anggota + 2 admin) |
| Net Worth     | Rp 1.256.780.000                     |

---

## 7. Riwayat Pengembangan (Changelog)

### Iterasi 1 — Fondasi

Demo awal: Beranda, Transaksi, Investasi, Aset, Laporan, Tujuan, Akun, AI Advisor, Notifikasi. Ikon emoji, belum ada login.

### Iterasi 2 — Polish & Login

1. FA icons di navbar
2. Laporan mobile responsive
3. Nama Irfan Arsandi di semua tempat
4. Login page dengan demo input
5. Semua halaman dilengkapi (Ringkasan, Anggaran, Dana, Rekening, Liabilitas, Asuransi, Kalkulator 4 tab, dll)

### Iterasi 3 — Search & Akun

1. Search bar → search modal (bukan tambah transaksi)
2. Hapus badge premium
3. Sub-menu akun lengkap dengan slide-in panel (termasuk change currency)

### Iterasi 4 — OCR & Rekonsiliasi

1. Input transaksi via scan struk/bon (OCR)
2. Fitur Rekonsiliasi Bank (flow 4 langkah)

### Iterasi 5 — Responsive & Dark Mode

1. Investasi tabel scroll horizontal di mobile
2. Laporan tab scroll + lebih tebal
3. Grafik home edge-to-edge (Canvas)
4. Notifikasi toggle kembali
5. Dark/Light mode

### Iterasi 6 — Fix Root Cause Responsive

- `.main{min-width:0}` — fix flex item tidak mau menyusut (penyebab halaman lebih lebar dari viewport)
- Scoped overflow control pada `.page` & `.card`

### Iterasi 7 — Fitur Kolaborasi

1. Anggaran: modal tambah kategori + budget Liburan
2. Family: Add Admin (sekretaris/supir/ART input transaksi)
3. Split Bill (menu baru)
4. Kalkulator tab Split Group

### Iterasi 8 — Sub-Laporan

10 sub-menu laporan: Harian, Bulanan, Tahunan, Group Family, Bank, Detail, Aliran Dana, PNL, Balance Sheet, Cashflow

### Iterasi 9 — Collapse Nav & Warisan

1. Menu Laporan jadi collapsible (buka-tutup) dengan 11 sub-item
2. Fitur Warisan (Aset, Cash, Surat Berharga, Saham — bisa dilihat ahli waris)

### Iterasi 10 — Fix Kalkulator

- Perbaikan tag `<div class="page" id="page-kalkulator">` yang hilang (kalkulator muncul di semua halaman)

### Iterasi 11 — Donation & Tax Center

1. Menu Donasi & Zakat (kalkulator zakat maal + riwayat)
2. Menu Tax Center / Pajak Pribadi (kalkulator PPh 21 progresif + dokumen pajak)

---

## 8. Komponen Teknis Utama

### Fungsi JavaScript Inti

| Fungsi                               | Tujuan                                |
| ------------------------------------ | ------------------------------------- |
| `nav(id, el)`                        | Navigasi antar halaman                |
| `toggleNavCollapse(subId, el)`       | Buka-tutup sub-menu Laporan           |
| `navReport(secId)`                   | Buka laporan + aktifkan tab spesifik  |
| `setRtab(el, id)`                    | Switch tab laporan                    |
| `toggleTheme()`                      | Dark/light mode + simpan localStorage |
| `renderSparkline()`                  | Render grafik Canvas edge-to-edge     |
| `renderBar(chartId, labelId, max)`   | Render bar chart                      |
| `openOCRModal()` / `showOCRResult()` | Flow scan struk                       |
| `advanceRekon(step)`                 | Stepper rekonsiliasi                  |
| `hitungZakat()`                      | Kalkulator zakat 2,5% + nisab         |
| `hitungPPh()`                        | Kalkulator PPh 21 progresif UU HPP    |
| `hitungSplit()`                      | Kalkulator split bill group           |
| `recalcSplitModal()`                 | Hitung ulang split per peserta        |
| `openSubPage(id)`                    | Slide-in panel sub-menu akun          |

### Validasi

- ✅ Struktur `<div>` balance (buka = tutup)
- ✅ JavaScript syntax valid (no errors)
- ✅ 21 halaman dengan struktur `.page` lengkap

---

## 9. Roadmap Produksi (Belum Diimplementasi)

| Fase | Lingkup                                           |
| ---- | ------------------------------------------------- |
| 1    | Auth (NextAuth) + Dashboard real-time             |
| 2    | Transaksi + kategorisasi + DB (PostgreSQL/Prisma) |
| 3    | Investasi (harga real via API) + Aset             |
| 4    | Laporan + Goals + export PDF/Excel                |
| 5    | Family Finance (multi-tenant) + role/permission   |
| 6    | AI Advisor (OpenAI/Claude) + Open Banking         |

### Catatan Teknis Produksi

- **Real-time investment price** — perlu integrasi API (RTI, IDX, atau provider data pasar)
- **Family Finance** = mini multi-tenant system (kompleks; perlu desain RBAC matang)
- **OCR** — perlu service OCR sungguhan (Google Vision / AWS Textract / Tesseract)
- **Rekonsiliasi** — parsing PDF/Excel rekening koran per format bank
- **Open Banking Indonesia** — keterbatasan regulasi & ketersediaan API bank
- **Skema DB** — tambahkan tabel `investment_prices`, `heirs`, `donations`, `tax_records`

---

_Dokumen ini merangkum seluruh tahap pengembangan demo WealthMe. File demo (`WealthMe_Demo.html`) bersifat self-contained — buka langsung di browser tanpa instalasi._
