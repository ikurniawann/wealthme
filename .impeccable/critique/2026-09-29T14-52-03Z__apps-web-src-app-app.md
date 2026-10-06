---
target: WealthMe app pages
total_score: 21
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 1
target_identity: "file:/Projects/wealthme-web/apps/web/src/app/(app)"
timestamp: 2026-09-29T14-52-03Z
slug: apps-web-src-app-app
---

## Kritik UX: halaman WealthMe setelah login

**Cakupan:** 28 rute halaman utama dalam shell aplikasi diperiksa melalui browser Codex dan audit struktur. Detail dinamis `/aset/[id]`, halaman publik, desktop 1440 px, serta tema gelap belum diperiksa. Screenshot langsung tersedia pada viewport ponsel 390 px untuk Beranda, Transaksi, Ringkasan, Laporan, Anggaran, dan Akun.

### Skor kesehatan desain

Skala 0–4; 0 berarti ada masalah berat dan 4 berarti sangat baik. Skor ini adalah penilaian lintas halaman, bukan sertifikasi WCAG.

| #         | Heuristik                            |      Skor | Temuan                                                                                                                                 |
| --------- | ------------------------------------ | --------: | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1         | Status sistem terlihat               |         2 | Progres, angka, dan beberapa status terlihat, tetapi beberapa empty state masih generik.                                               |
| 2         | Sesuai bahasa dan kebiasaan pengguna |         3 | Rupiah dan istilah keluarga relevan; istilah seperti Savings Rate, cash basis, COA, dan PPh/NPPN perlu bantuan konteks yang konsisten. |
| 3         | Kendali dan kebebasan pengguna       |         2 | Filter, tab, dan pengelolaan data tersedia; ada kontrol periode Beranda yang mengubah lebih dari satu konteks.                         |
| 4         | Konsistensi dan standar              |         2 | Shell dan kartu cukup seragam, tetapi palet dan tipografi menyimpang dari DESIGN.md di banyak route.                                   |
| 5         | Pencegahan kesalahan                 |         2 | Aksi edit dan hapus tersedia; halaman pajak, transaksi, dan data keluarga perlu menonjolkan konsekuensi serta pemulihan.               |
| 6         | Pengenalan daripada mengingat        |         3 | Ringkasan dan menu kategori membantu pengguna mengenali fitur.                                                                         |
| 7         | Fleksibilitas dan efisiensi          |         2 | Input cepat dan tombol tambah membantu; ringkasan vertikal membuat pengguna ponsel menggulir jauh sebelum daftar.                      |
| 8         | Minimalis dan hierarki visual        |         1 | Banyak metrik dan kartu menumpuk di viewport kecil; beberapa header profil bertumpuk.                                                  |
| 9         | Pemulihan dari kesalahan             |         2 | Belum tampak aksi coba lagi yang memadai pada kegagalan pemuatan Beranda.                                                              |
| 10        | Bantuan dan dokumentasi              |         2 | Panduan dan tooltip tersedia, tetapi belum menggantikan bantuan kontekstual di alur keuangan yang kompleks.                            |
| **Total** |                                      | **21/40** | **Fondasi fungsional ada; hierarki ponsel dan konsistensi butuh perbaikan.**                                                           |

### Temuan lintas halaman

1. **[P1] Data dan label periode Beranda dapat menyesatkan.** Tab “6 Bln / 12 Bln” mengganti judul arus kas, tetapi seri arus kas tetap bersumber dari ringkasan enam bulan; kontrol juga mengubah rentang tren kekayaan. Pisahkan dua konteks atau samakan label dengan data. Bukti: `apps/web/src/app/(app)/beranda/_components/cashflow-card.tsx:46` dan `use-beranda-data.ts`.
2. **[P2] Ringkasan Transaksi terlalu tinggi pada ponsel.** Di 390 px, banner kategori, tombol filter, lalu tiga kartu total tersusun vertikal dan mendorong daftar transaksi ke bawah layar. Tampilkan total dalam satu ringkasan kompak dan pertahankan rincian bila dibuka. Bukti: `apps/web/src/app/(app)/transaksi/page.tsx:1526` dan `:1640`.
3. **[P2] Header profil Akun bertumpuk.** Pada 390 px, tombol “Profil Saya” bertumpang tindih dengan nama atau email pada kartu identitas. Atur ulang header menjadi baris yang bisa membungkus atau pisahkan tombol dari detail identitas. Bukti visual: browser Codex, tema terang.
4. **[P2] Informasi penting muncul setelah banyak guliran.** Beranda menempatkan perhatian dan jatuh tempo setelah beberapa kartu. Ringkasan menumpuk empat metrik; Laporan memakai ruang awal untuk filter dan dua tingkat navigasi. Buat ringkasan tindakan yang ringkas di bagian atas, lalu biarkan pengguna membuka rincian.
5. **[P2] Beberapa halaman memakai istilah teknis tanpa bantuan dekat field.** Tax Center, Rekonsiliasi, Master COA, dan IAM adalah alur kompleks. Jelaskan istilah singkat tepat di titik keputusan, gunakan contoh yang aman, dan pertahankan penanda opsional yang konsisten.
6. **[P3] Penyimpangan token berulang.** Detector pada folder aplikasi menemukan 450 sinyal di 27 file: 417 peringatan advisory ukuran font, 32 advisory warna, dan satu warning aksen `border-l-4` pada judul Laporan. Advisory berarti perlu ditinjau terhadap DESIGN.md, bukan otomatis dianggap bug. Warning side-tab berada di `apps/web/src/app/(app)/laporan/_components/laporan-inner.tsx:586`.

### Halaman yang tampak kuat

- Anggaran memberi sisa dana, penggunaan, waktu tersisa, dan peringatan kategori dalam urutan yang mudah dipindai. Warna hijau dan kuning membantu membedakan status.
- Ringkasan memisahkan pilihan mata uang dan periode, lalu menampilkan nilai kekayaan bersih secara menonjol.
- Laporan sudah mengelompokkan 17 jenis laporan menjadi lima grup; grup dan tab sekunder konsisten dan dapat digeser pada layar kecil.
- Persetujuan, Split Bill, Tujuan, Input Cepat, dan Notifikasi menyediakan status atau tindakan yang mudah dikenali.

### Catatan persona dan aksesibilitas

- Pengguna lansia atau pengguna dengan penglihatan terbatas akan terbebani oleh label kecil dan banyak kartu berturut-turut; detector menemukan banyak ukuran di luar skala dokumen, tetapi ini bukan hasil uji kontras.
- Pengguna pembaca layar perlu nama kontrol yang sesuai dengan data yang benar-benar berubah, terutama di Beranda, serta ringkasan status yang tidak hanya mengandalkan warna.
- Pengguna ponsel mengandalkan sentuhan; teks Transaksi yang menyebut opsi lanjutan muncul saat “hover/focus” belum menjelaskan interaksi sentuh dengan baik.

### Beban kognitif

Perkiraan lintas halaman: 4 dari 8 pemeriksaan bermasalah, tingkat sedang. Metrik utama, kartu ringkasan, dan filter sering tampil sekaligus sebelum daftar atau tindakan utama. Istilah domain menambah kebutuhan untuk menafsirkan label.

### Perjalanan emosi

Anggaran dan Ringkasan memberi rasa kendali lewat angka dan status yang jelas. Pada halaman padat, pengguna harus menggulir sebelum sampai ke aktivitas. Nilai kekayaan bersih negatif dan status pajak perlu penjelasan berikutnya yang menenangkan dan konkret supaya pengguna tahu tindakan yang bisa dilakukan.

### Detail pemeriksaan

Rute yang diperiksa: Beranda, Ringkasan, Transaksi, Laporan, Anggaran, Tujuan, Dana, Rekening, Investasi, Aset, Liabilitas, Asuransi, Warisan, Donasi, Tax Center, Persetujuan, Split Bill, Rekonsiliasi, AI Advisor, Kalkulator, Input Cepat, Akun, Notifikasi, Master COA, Setup Master Data, IAM Roles, Panduan Fitur, dan Akses Saya.
