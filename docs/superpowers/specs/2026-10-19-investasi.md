# Spec — Modul Investasi (user brief, 2026-10-19)

Reference images: docs/design/refs/2026-10-19/invest-0..4.jpeg (0 main page, 1 detail, 2 add drawer, 3 buy/sell, 4 price update). Images are visual reference; this text is the logic authority.

Update modul **Investasi WealthMe** berdasarkan gambar referensi dan spesifikasi berikut. Kerjakan pada aplikasi yang sudah ada, pertahankan stack serta design system WealthMe. Implementasikan UI, backend, penyimpanan data, validasi, dan perhitungannya; jangan berhenti pada mockup.

**1. Audit sebelum implementasi**

Pelajari struktur proyek, komponen, model investasi, transaksi, rekening bank, kepemilikan pengguna, sumber harga, dan perhitungan saldo yang ada.

Telusuri penyebab masalah berikut sebelum memperbaikinya:

- Saham AS ditampilkan dengan konversi lot Indonesia.
- Pembelian belum mengambil dana dari akun platform.
- Transaksi backdate gagal atau salah urutan.
- Saldo/kepemilikan menjadi minus tanpa penjelasan.
- Ticker, waktu transaksi, dan harga pasar kosong menyebabkan error atau valuasi salah.

Jangan menganggap semua masalah disebabkan UI. Pertahankan data lama dan buat migrasi yang aman; jangan menafsirkan ulang satuan data lama tanpa bukti.

**2. Design system dan halaman utama**

Ikuti referensi: forest green, lime untuk pilihan aktif, latar off-white, permukaan putih, border halus, radius konsisten, ikon sederhana, dan tipografi proporsional.

Gunakan hierarki yang jelas, hindari angka berlebihan, terlalu banyak kartu setara, serta drawer sempit dengan ruang kosong tidak berguna.

Halaman utama harus memuat:

- Filter pemilik akun, akun platform, jenis aset, pasar, dan mata uang tampilan.
- Ringkasan nilai aset, kas platform, total investasi, modal aset tersisa, serta laba/rugi terealisasi dan belum terealisasi secara terpisah.
- Tab Portofolio, Dana Platform, dan Riwayat.
- Tabel portofolio: instrumen, platform/kantong dana, kepemilikan, harga rata-rata, harga pasar, nilai pasar, laba/rugi, dan aksi detail.
- Waktu, mata uang, dan sumber harga terakhir.
- Aksi Top Up Dana, Tambah Investasi, dan Update Harga.
- Pencarian, pengurutan, pagination, serta kondisi loading, kosong, error, dan harga belum tersedia.

Kas platform hanya dihitung sekali dalam total kekayaan, walaupun juga ditampilkan di modul rekening.

**3. Platform dan kantong dana**

Pisahkan entitas platform, akun pengguna pada platform, dan kantong dana.

Satu platform dapat memiliki beberapa kantong: RDN IDR, dana kripto IDR, atau dana USD. Jangan mencampur saldo berbeda mata uang maupun berbeda produk.

Sediakan katalog platform yang dapat diperbarui, termasuk contoh Ajaib, Stockbit, IPOT, Gotrade, dan Pintu, dengan kategori produk yang sesuai. Tambahkan platform kustom. Jangan menganggap setiap platform mendukung semua jenis aset atau menawarkan bentuk kepemilikan hukum yang sama.

Tampilkan pencatatan manual atau sinkronisasi sesuai kemampuan yang benar-benar tersedia; logo platform bukan bukti integrasi.

**4. Alur dana**

Implementasikan:

Rekening bank → transfer/top up → kantong dana platform → pembelian aset.

- Top up merupakan transfer, bukan pendapatan atau keuntungan.
- Pembelian mendebit kantong dana yang dipilih, termasuk biaya.
- Penjualan mengurangi kepemilikan dan mencatat hasil bersih.
- Bedakan saldo kas tercatat, dana tertahan/belum terselesaikan, dan dana tersedia.
- Tanggal penyelesaian mengikuti konfirmasi broker atau konfigurasi pasar/produk.
- Penarikan ke bank merupakan transfer.
- Transfer lintas mata uang mencatat jumlah sumber, jumlah tujuan, kurs aktual, dan biaya.
- Pembaruan harga tidak mengubah saldo kas.
- Cegah satu transaksi tercatat dua kali akibat klik ulang, retry, atau impor ulang.

Untuk akun biasa, cegah dana tersedia atau kepemilikan negatif akibat transaksi baru. Jika data historis tidak lengkap, tampilkan konflik dan opsi melengkapi riwayat. Jangan diam-diam membuat top up, menjepit saldo menjadi nol, atau mengaktifkan margin.

**5. Tambah investasi dan drawer dinamis**

Pertahankan tujuh jenis:

Saham, Reksa Dana, Obligasi, Emas, Kripto, Deposito, dan Lainnya.

Pisahkan cara pencatatan:

- **Pembelian baru:** membuat transaksi dan mengurangi kantong dana.
- **Kepemilikan awal:** mencatat aset yang sudah dimiliki tanpa memotong dana lagi; tetap meminta tanggal posisi awal dan dasar biaya/modal jika diketahui.

Field menyesuaikan jenis aset:

- Saham: instrumen, bursa/pasar, ticker terverifikasi atau instrumen manual, kuantitas, harga eksekusi per saham.
- Reksa dana: produk, unit penyertaan, NAB per unit, tanggal transaksi.
- Obligasi: identitas instrumen, nominal pokok, konvensi harga, bunga berjalan bila relevan, kupon, dan jatuh tempo.
- Emas: fisik/digital, berat, satuan, kadar bila relevan, dan harga per satuan.
- Kripto: aset, pasangan/mata uang, kuantitas desimal, biaya beserta mata uang biaya.
- Deposito: bank, pokok, mata uang, tanggal mulai/jatuh tempo, bunga, dan instruksi perpanjangan.
- Lainnya: nama, satuan, kuantitas, serta metode valuasi yang eksplisit.

Field umum: pemilik, akun platform/kustodian bila relevan, tanggal efektif, waktu dan zona waktu jika diketahui, biaya/pajak aktual, catatan, dan bukti transaksi.

Jangan mewajibkan ticker atau jam yang dibuat-buat untuk seluruh jenis aset. Bedakan tanggal saja dari timestamp yang benar-benar diketahui.

**6. Satuan dan identitas instrumen**

- Saham BEI di pasar reguler/tunai: 1 lot = 100 lembar; harga ditampilkan per lembar.
- IHSG adalah indeks, bukan satuan pembelian saham.
- Saham AS: tampilkan shares; pecahan hanya jika produk/platform mendukung.
- Jangan menerapkan konversi lot Indonesia ke NASDAQ atau seluruh pasar dunia.
- Pasar lain mengikuti konfigurasi instrumen, bursa, produk, presisi, dan tanggal berlakunya aturan.
- Simpan kuantitas dasar secara presisi; lot merupakan representasi tampilan yang sesuai pasar.
- Gunakan identitas instrumen yang menyertakan pasar/bursa. Ticker saja tidak selalu unik.
- Pisahkan ticker pengguna dari simbol yang dibutuhkan penyedia harga.

**7. Beli, jual, dan perhitungan**

Gunakan aritmetika desimal yang aman untuk uang, kurs, serta kuantitas; jangan mengandalkan floating-point biner untuk nilai keuangan.

Untuk contoh saham sederhana:

- Nilai beli = lembar × harga eksekusi per lembar.
- Total debit = nilai beli + biaya/pajak pembelian.
- Modal tercatat mengikuti kebijakan kapitalisasi biaya yang eksplisit.
- Nilai pasar = kuantitas tersisa × harga valuasi.
- Laba/rugi belum terealisasi = nilai pasar − dasar biaya kepemilikan tersisa.
- Hasil bersih jual = nilai jual − biaya/pajak penjualan.
- Laba/rugi terealisasi = hasil bersih jual − dasar biaya bagian yang dijual.

Gunakan metode dasar biaya yang konsisten dan terdokumentasi. Periksa metode aplikasi saat ini sebelum memilih atau mengubahnya; jangan mengganti FIFO menjadi rata-rata secara diam-diam.

Tampilkan penjabaran perhitungan, estimasi sebelum simpan, serta hasil aktual. Pisahkan perubahan harga aset dari pengaruh kurs bila memungkinkan. Persentase dengan dasar biaya nol/tidak diketahui harus tampil “—”, bukan Infinity atau angka palsu.

Biaya dan pajak mengikuti transaksi aktual atau konfigurasi yang terverifikasi, bukan tarif contoh yang dipaksakan.

**8. Backdate dan konsistensi riwayat**

Simpan tanggal efektif transaksi terpisah dari waktu pencatatannya.

Transaksi backdate harus:

- Memakai harga eksekusi yang dicatat, bukan harga pasar hari ini.
- Memeriksa dana dan kepemilikan pada waktu efektif.
- Menghitung ulang saldo, dasar biaya, serta transaksi berikutnya yang terdampak.
- Menampilkan konflik jika perubahan membuat transaksi berikutnya tidak valid.
- Memiliki urutan deterministik ketika tanggal/waktu sama.
- Menyimpan jejak audit untuk edit, koreksi, dan pembatalan.

Jangan memaksa pengguna mengetahui jam historis yang tidak tersedia. Gunakan kebijakan urutan yang jelas untuk catatan bertanggal saja.

**9. Detail investasi**

Tampilkan identitas aset, jenis produk, pemilik, platform, mata uang, kuantitas, modal tersisa, biaya, harga rata-rata, nilai pasar, dan sumber/tanggal harga.

Sediakan:

- Penjabaran rumus perhitungan.
- Riwayat beli/jual dan kepemilikan awal.
- Pendapatan seperti dividen, kupon, atau bunga sesuai jenis aset.
- Dokumen.
- Aksi beli, jual/pencairan, dan update harga yang relevan.
- Penanganan aksi korporasi tanpa dianggap pembelian biasa.

Grafik harus berasal dari data nyata. Jangan membuat riwayat atau grafik dummy agar halaman terlihat penuh.

**10. Update harga**

Pisahkan harga eksekusi transaksi, harga valuasi, dan kurs valuasi.

Sediakan input manual dan sumber data yang benar-benar tersedia, dengan tanggal, waktu bila diketahui, mata uang, satuan harga, serta referensi.

Sebelum simpan, tampilkan instrumen yang berubah, dilewati, atau gagal dan dampaknya pada valuasi.

- Harga kosong tidak menjadi nol.
- Harga lama tetap memiliki tanggal aslinya dan penanda kedaluwarsa.
- Aset tanpa harga tidak otomatis dianggap rugi 100%.
- Total harus menandai valuasi yang belum lengkap.
- Update harga tidak mengubah transaksi historis, modal, atau saldo.
- Deposito dan obligasi memakai metode valuasi sesuai produknya, bukan dipaksa seperti harga saham.

**11. Responsif dan aksesibilitas**

Desktop: tabel jelas dan drawer cukup lebar.

Tablet: susun ulang kolom sesuai ruang.

Mobile: form satu kolom dalam sheet layar penuh, tombol simpan tetap mudah dijangkau, konten dapat di-scroll tanpa tertutup footer, dan ringkasan tabel berubah menjadi daftar yang tetap informatif.

Gunakan label persisten, navigasi keyboard, focus state, kontras cukup, error dekat field, dan target sentuh nyaman. Jangan mengandalkan warna saja untuk menyatakan untung/rugi atau status.

**12. Verifikasi dan hasil akhir**

Tambahkan pengujian bermakna untuk:

- Top up tidak menambah total kekayaan.
- Pembelian menggunakan kantong dana yang tepat.
- Lot BEI dan fractional shares tidak tertukar.
- Penjualan parsial mempertahankan dasar biaya yang benar.
- Backdate menghitung ulang riwayat.
- Dana/kepemilikan tidak cukup dan konflik historis.
- Harga kosong, harga lama, serta kegagalan sumber harga.
- Update harga tidak mengubah kas.
- Kurs dan biaya lintas mata uang.
- Retry tidak membuat transaksi ganda.
- Kepemilikan awal tidak mendebit wallet.

Contoh verifikasi: pembelian 2 lot × 100 lembar × Rp9.500 + biaya Rp2.850 = total debit Rp1.902.850. Saldo awal Rp5.000.000 menjadi Rp3.097.150.

Jalankan build dan pemeriksaan yang relevan serta tinjau tampilan desktop, tablet, dan mobile. Laporkan perubahan, migrasi, pengujian yang dijalankan, serta keterbatasan yang belum selesai.

Gunakan gambar sebagai referensi visual; spesifikasi tertulis menjadi acuan logika. Jangan menyalin ketidakkonsistenan angka atau grafik ilustrasi dari gambar. Verifikasi aturan pasar dari sumber resmi sebelum mengodekannya dan jangan mengklaim kepatuhan seluruh negara.
