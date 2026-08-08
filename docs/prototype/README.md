# WealthMe — Prototype UI/UX (EPIC-024 Task N)

Prototype HTML statis untuk **direview sebelum implementasi**. Tidak terhubung ke
API, tidak mengubah aplikasi, tidak ada dependensi build.

## Referensi layout

`pages/beranda.html` adalah referensi **bento dashboard** untuk revamp: grid
12 kolom di desktop menempatkan kekayaan bersih sebagai fokus, lalu membedakan
statistik, grafik, aktivitas, dan tindakan berdasarkan kepentingannya. Pada
tablet grid menjadi dua kolom, dan pada layar kecil semua konten bertumpuk
tanpa scroll horizontal. Pola ini akan menjadi acuan saat halaman lain dirapikan
setelah prototype disetujui.

## Cara membuka

```bash
xdg-open docs/prototype/index.html      # atau buka file itu di browser
```

Semua tautan relatif, jadi `file://` cukup. Yang butuh internet hanya tiga CDN
(font Sora/DM Mono, ikon lucide, ApexCharts).

Tambahkan `?static=1` pada URL untuk mematikan animasi grafik — dipakai saat
mengambil screenshot, karena bar chart yang tertangkap di tengah animasi terlihat
seperti data yang salah.

## File tunggal untuk dibagikan

Untuk menghasilkan satu HTML mandiri yang memuat seluruh halaman, CSS, font,
ikon, grafik, dan JavaScript:

```bash
node docs/prototype/build-standalone.mjs
xdg-open docs/prototype/WealthMe-Prototype-Standalone.html
```

File `WealthMe-Prototype-Standalone.html` dapat dikirim dan dibuka langsung
tanpa folder pendamping atau koneksi internet. Navigasi antarlayar serta tombol
Back/Forward browser tetap berfungsi. Generator membutuhkan internet hanya saat
build untuk mengambil versi CDN yang sudah dikunci.

## Isi

| Path                | Isi                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------ |
| `index.html`        | Daftar seluruh halaman + referensi design system (warna, tipografi, komponen, grafik)      |
| `pages/*.html`      | 25 halaman aplikasi + 7 halaman publik/auth                                                |
| `assets/tokens.css` | Token warna — **disalin dari `apps/web/src/app/globals.css`**, bukan palet baru            |
| `assets/app.css`    | Komponen (card, button, badge, table, form, dialog, toast) padanan shadcn yang dipakai app |
| `assets/shell.js`   | Sidebar, topbar, nav mobile, dialog, toast, tema. Halaman hanya menulis isinya sendiri     |
| `assets/charts.js`  | Preset ApexCharts — satu palet, satu gaya grid/tooltip untuk semua grafik                  |

## Keputusan desain

Arahnya **mengikuti standar produksi yang sudah ada**, sesuai permintaan: token
warna dan font sama persis dengan aplikasi sekarang, komponen memakai pola
shadcn/Base UI yang sudah dipakai, dan nama kelas CSS dipetakan 1:1 ke
`@/components/ui/*` + `@/components/wm/*` supaya porting balik ke React bersifat
mekanis, bukan menafsir ulang.

Grafik memakai **ApexCharts** (keputusan D18). Warnanya dibaca dari CSS custom
property, jadi ikut berganti saat tema diubah — bukan hex yang dipatok.

## Yang sengaja ditampilkan sebagai perubahan EPIC-024

Prototype ini menggambarkan **kondisi target**, bukan kondisi sekarang:

- Menu `Cash & E-Wallet` dan `Bank & Account` (item 29, 30)
- Halaman **Persetujuan** baru, dengan contoh pesan error asli dari server saat
  saldo tidak cukup (item 5)
- Menambah anggota lewat satu jalur — termasuk **Istri (Co-Master)**; tidak ada
  lagi undangan via tautan (item 4, 18)
- Liabilitas dengan aksi **Detail · Edit · Hapus · Bayar** (item 12, 34)
- Investasi: satuan **Lot/Lembar** untuk saham, koin desimal untuk kripto,
  **deposito**, dan tanggal beli (item 6, 7, 31)
- Aset: tombol gembok mati diganti **toggle privasi ikon mata**, plus penyusutan
  **Rp tetap** (item 14, 32)
- Lampiran foto/file pada transaksi (item 33)
- Laporan: tab **Ringkasan COA** berupa matriks tanggal × bulan (item 35)
- Master Data yang benar-benar bisa ditambah (item 17)
- Halaman split bill publik yang terbuka **tanpa login** (item 16)

## Setelah disetujui

Implementasi adalah pekerjaan terpisah (EPIC-024 N3). Mengganti
`components/charts/*` ke ApexCharts termasuk perubahan file fondasi yang
dilindungi, jadi butuh rencana migrasi tersendiri.
