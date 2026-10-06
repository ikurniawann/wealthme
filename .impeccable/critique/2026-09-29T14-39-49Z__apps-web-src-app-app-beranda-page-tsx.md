---
target: Beranda WealthMe
total_score: 21
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 1
target_identity: "file:/Projects/wealthme-web/apps/web/src/app/(app)/beranda/page.tsx"
target_fingerprint: "sha256:3bca04167f888697893098c816bf543de25e6b9cda60ad376545075fa89e6540"
target_path: /Projects/wealthme-web/apps/web/src/app/(app)/beranda/page.tsx
timestamp: 2026-09-29T14-39-49Z
slug: apps-web-src-app-app-beranda-page-tsx
---

## Kritik UX: Beranda

**Method: dual-agent (A: /root/impeccable_assessment_a · B: /root/impeccable_assessment_b), dilengkapi pemeriksaan browser Codex pada Beranda lokal.**

### Skor kesehatan desain

Skala mengikuti rubrik Impeccable: 0 berarti ada masalah berat, 4 berarti sangat baik.

| #         | Heuristik                            |      Skor | Temuan utama                                                                                                                                               |
| --------- | ------------------------------------ | --------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1         | Status sistem terlihat               |         2 | Progress checklist dan tanggal grafik terlihat, tetapi kegagalan data hanya menyuruh pengguna memuat ulang halaman.                                        |
| 2         | Sesuai bahasa dan kebiasaan pengguna |         3 | Rupiah, istilah keluarga, dan alur finansial terasa sesuai; beberapa istilah tetap padat untuk pengguna baru.                                              |
| 3         | Kendali dan kebebasan pengguna       |         2 | Navigasi dan checklist memberi jalan keluar, tetapi kontrol rentang grafik membingungkan.                                                                  |
| 4         | Konsistensi dan standar              |         2 | Pola kartu konsisten, tetapi judul arus kas dan rentang grafik tidak selaras.                                                                              |
| 5         | Pencegahan kesalahan                 |         2 | Beranda terutama untuk membaca data; perlindungan aksi berisiko tidak banyak terlihat di halaman ini.                                                      |
| 6         | Pengenalan daripada mengingat        |         3 | Ringkasan, aktivitas, dan progres langsung terlihat tanpa harus mengingat angka dari halaman lain.                                                         |
| 7         | Fleksibilitas dan efisiensi          |         2 | Ada tautan cepat ke beberapa bagian, tetapi belum tampak pintasan khusus di konten Beranda.                                                                |
| 8         | Minimalis dan hierarki visual        |         1 | Pada 390 px, checklist selesai mengambil ruang besar sebelum hero; hero berwarna emas-cokelat mendominasi, lalu banyak kelompok data memanjangkan halaman. |
| 9         | Pemulihan dari kesalahan             |         2 | Pesan gagal cukup jelas, tetapi tidak ada tombol coba lagi di halaman.                                                                                     |
| 10        | Bantuan dan dokumentasi              |         2 | Checklist membantu pengguna baru; penjelasan kontekstual untuk ringkasan finansial belum tampak.                                                           |
| **Total** |                                      | **21/40** | **Perlu perbaikan berarti.**                                                                                                                               |

### Putusan kekhasan desain

Konten Beranda punya ciri WealthMe: kekayaan rumah tangga, aset likuid, liabilitas, anggaran, aktivitas, dan tujuan. Namun, susunan bento dashboard masih umum untuk aplikasi finansial. Pada screenshot terang 390 px, warna emas-cokelat mengisi hampir seluruh hero. Brief produk menetapkan emas sebagai aksen yang jarang, jadi hero ini mengurangi kesan teal/navy yang tenang dan tepercaya. Konten juga menumpuk dalam satu alur gulir panjang.

Detector Impeccable tidak menemukan temuan otomatis pada file target: 0 temuan. Hasil bersih ini tidak membuktikan hierarki atau pengalaman sudah kuat.

### Bukti visual

Beranda dibuka pada browser Codex setelah login. Pemeriksaan visual tersedia pada lebar 390 px, tema terang. Checklist 5/5 tampil sebagai kartu tinggi dengan progres penuh dan lima item selesai, lalu kartu emas-cokelat “Total Kekayaan Bersih” mengambil area hero berikutnya. Pada bagian hero, jumlah aset dan liabilitas berada setelah grafik dalam gulir. Ada juga nilai negatif besar yang memerlukan konteks dan arahan berikutnya agar tidak langsung terasa seperti alarm. Lapisan live mode Impeccable menutupi sebagian bawah screenshot. Tampilan desktop 1440 px dan tema gelap belum diperiksa.

### Yang sudah bekerja

- Nilai kekayaan bersih ditempatkan sebagai informasi utama, dengan tautan dari kartu ringkasan ke halaman terkait.
- Kartu memakai data keluarga yang tersedia dan Rupiah, bukan contoh angka yang dibuat-buat.
- Struktur halaman memecah informasi ke kelompok seperti komposisi kekayaan, arus kas, aktivitas, anggaran, perhatian, dan tujuan.
- Checklist selesai menunjukkan 5/5 dan menyediakan tombol tutup.

### Prioritas perbaikan

1. **[P1] Selaraskan kontrol rentang dengan data yang berubah.** Tombol “6 Bln / 12 Bln” mengganti judul kartu menjadi “Arus Kas 12 Bulan”, tetapi seri arus kas tetap berasal dari ringkasan enam bulan. Tombol itu juga mengubah rentang riwayat kekayaan. Pengguna bisa salah membaca data. Pisahkan kontrol rentang kekayaan dari kartu arus kas, atau sediakan data 12 bulan yang benar. Saran: `/impeccable clarify` atau `/impeccable shape`. Bukti: `apps/web/src/app/(app)/beranda/_components/cashflow-card.tsx:43` dan `apps/web/src/app/(app)/beranda/_components/use-beranda-data.ts:30`.
2. **[P2] Tambahkan aksi coba lagi saat data Beranda gagal dimuat.** Saat ini dashboard diganti dengan pesan untuk memuat ulang browser. Tombol coba lagi akan membantu pengguna pulih tanpa kehilangan konteks. Saran: `/impeccable harden`. Bukti: `apps/web/src/app/(app)/beranda/page.tsx:41`.
3. **[P2] Naikkan perhatian yang mendesak dan ringkas area awal di ponsel.** Persetujuan dan jatuh tempo tampil setelah hero, ringkasan, serta arus kas. Checklist yang sudah 5/5 juga tetap mengambil banyak area sebelum hero, walau bisa ditutup. Uji ringkasan perhatian yang ringkas lebih awal dan simpan checklist selesai tanpa membuatnya mendominasi layar. Saran: `/impeccable layout`. Bukti: `apps/web/src/app/(app)/beranda/page.tsx:66`.
4. **[P2] Kembalikan emas ke peran aksen.** Hero emas-cokelat sangat dominan pada viewport 390 px dan tidak mengikuti arahan emas sebagai aksen jarang. Pertahankan diferensiasi hero lewat hierarki, bukan bidang warna emas sebesar ini. Saran: `/impeccable colorize`. Bukti visual: screenshot browser Codex 390 px.
5. **[P3] Periksa keterbacaan label kecil.** Label metrik di footer hero memakai ukuran 11 px dan opacity 0,8. Ini belum membuktikan gagal WCAG, tetapi layak diuji untuk pengguna lansia dan layar kecil. Saran: `/impeccable audit`. Bukti: `apps/web/src/app/design-system.css:1534`.

### Tanda bahaya persona

- **Alex, pengguna mahir:** Kontrol periode saat ini mengubah beberapa konteks berbeda. Pengguna yang ingin membandingkan rentang dapat sulit memahami grafik mana yang ikut berubah.
- **Sam, pengguna aksesibilitas:** Nama aksesibel kontrol menyebut “Rentang tren kekayaan”, sementara judul kartu menyebut arus kas. Periksa alur pembaca layar dan keyboard setelah kontrol dipisahkan.
- **Anggota keluarga lansia atau anak:** Checklist selesai mengambil banyak ruang awal, hero menggunakan bidang warna luas dan angka besar, sedangkan label pendamping kecil. Kode yang diperiksa juga belum menunjukkan penyajian Beranda yang disederhanakan menurut peran.

### Beban kognitif

Perkiraan berbasis kode dan tampilan 390 px: 4 dari 8 pemeriksaan bermasalah, tingkat sedang. Fokus halaman terbagi ke beberapa tujuan; informasi disajikan sekaligus tanpa banyak pengungkapan bertahap; checklist selesai masih dominan; dan setelah sapaan, pengguna harus menafsirkan banyak kelompok angka. Pengelompokan kartu dan nilai ringkasan membantu, tetapi tidak menyelesaikan bentang informasinya.

### Perjalanan emosi

Sapaan dan angka kekayaan memberi orientasi personal, lalu kartu memberi konteks finansial. Namun, hero emas yang berat terasa lebih seperti penanda promosi daripada buku besar keluarga yang tenang. Nilai kekayaan bersih negatif perlu konteks yang jelas. Isu kontrol periode dapat mengurangi kepercayaan pada angka; jika data gagal, pengguna juga kehilangan gambaran saat diarahkan untuk reload.

### Pertanyaan untuk dipikirkan

Saat keluarga membuka Beranda, sebaiknya layar pertama menjawab “Bagaimana kondisi keuangan kita?” atau “Apa yang perlu ditindaklanjuti hari ini?”
