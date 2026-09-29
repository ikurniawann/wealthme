import { LegalShell, LegalSection } from "../_components/legal-shell";

// Hardening batch G2 — see privasi/page.tsx for the same "Draf, belum
// final" rationale. Standard Indonesian Terms & Conditions draft text.
export default function TermsPage() {
  return (
    <LegalShell title="Syarat &amp; Ketentuan" updatedAt="29 September 2026">
      <LegalSection heading="1. Penerimaan Syarat">
        <p>
          Dengan membuat akun dan menggunakan WealthMe, kamu menyetujui syarat
          dan ketentuan ini. Jika kamu tidak setuju, mohon untuk tidak
          menggunakan layanan ini.
        </p>
      </LegalSection>

      <LegalSection heading="2. Deskripsi Layanan">
        <p>
          WealthMe adalah aplikasi pencatatan dan perencanaan keuangan
          pribadi/keluarga: transaksi, anggaran, aset, liabilitas, investasi,
          dan pelaporan. WealthMe bukan lembaga jasa keuangan, tidak menyimpan
          atau memindahkan dana kamu, dan tidak memberikan nasihat investasi
          berlisensi.
        </p>
      </LegalSection>

      <LegalSection heading="3. Akun dan Tanggung Jawab Pengguna">
        <ul className="list-disc space-y-1 pl-5">
          <li>Kamu bertanggung jawab menjaga kerahasiaan kata sandi.</li>
          <li>
            Kamu bertanggung jawab atas keakuratan data yang kamu masukkan
            sendiri (saldo, transaksi, nilai aset).
          </li>
          <li>
            Master/pemilik grup keluarga bertanggung jawab mengelola akses
            anggota keluarga lain.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="4. Batasan Tanggung Jawab">
        <p>
          Fitur kalkulator, estimasi pajak, dan simulasi (mis. KPR, zakat)
          bersifat perkiraan untuk membantu perencanaan dan bukan nasihat
          keuangan, pajak, atau hukum resmi. Keputusan keuangan tetap menjadi
          tanggung jawab kamu sepenuhnya.
        </p>
      </LegalSection>

      <LegalSection heading="5. Perubahan Layanan">
        <p>
          Kami dapat mengubah, menambah, atau menghentikan fitur tertentu dari
          waktu ke waktu. Perubahan material akan diinformasikan melalui
          aplikasi.
        </p>
      </LegalSection>

      <LegalSection heading="6. Penghentian Akun">
        <p>
          Kamu dapat menghapus akunmu kapan saja melalui Akun &rsaquo; Privasi
          &amp; Keamanan Data. Kami dapat menangguhkan akun yang melanggar
          ketentuan ini atau digunakan untuk aktivitas melawan hukum.
        </p>
      </LegalSection>

      <LegalSection heading="7. Hukum yang Berlaku">
        <p>
          Syarat dan ketentuan ini tunduk pada hukum Republik Indonesia,
          termasuk Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data
          Pribadi.
        </p>
      </LegalSection>
    </LegalShell>
  );
}
