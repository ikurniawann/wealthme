import { LegalShell, LegalSection } from "../_components/legal-shell";

// Hardening batch G2 — akun Tentang / register / login footer all promised
// a Privacy Policy but only toasted "belum tersedia". Standard Indonesian
// draft text referencing UU PDP No. 27/2022 (Pelindungan Data Pribadi), the
// applicable law for a personal-finance product handling Indonesian users'
// financial and identity data. Marked "Draf, belum final" per PRODUCT.md's
// Honest UI mandate — this is placeholder legal text, not a reviewed policy.
export default function PrivacyPolicyPage() {
  return (
    <LegalShell title="Kebijakan Privasi" updatedAt="29 September 2026">
      <LegalSection heading="1. Ringkasan">
        <p>
          WealthMe adalah aplikasi manajemen keuangan keluarga. Kami
          mengumpulkan dan memproses data pribadi kamu untuk menyediakan fitur
          pencatatan transaksi, anggaran, aset, dan pelaporan keuangan sesuai
          dengan Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data
          Pribadi (&quot;UU PDP&quot;).
        </p>
      </LegalSection>

      <LegalSection heading="2. Data yang Kami Kumpulkan">
        <ul className="list-disc space-y-1 pl-5">
          <li>Data identitas: nama, email, nomor telepon, tanggal lahir.</li>
          <li>
            Data keuangan: saldo rekening, transaksi, anggaran, aset,
            liabilitas, dan investasi yang kamu catat sendiri.
          </li>
          <li>
            Data teknis: alamat IP, jenis perangkat, dan log aktivitas untuk
            keamanan akun.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="3. Dasar dan Tujuan Pemrosesan">
        <p>
          Data diproses berdasarkan persetujuan kamu saat mendaftar dan
          kebutuhan pelaksanaan layanan (Pasal 20 UU PDP), untuk: menyediakan
          fitur aplikasi, mengamankan akun, mengirim notifikasi terkait keuangan
          keluarga, dan meningkatkan kualitas layanan.
        </p>
      </LegalSection>

      <LegalSection heading="4. Berbagi Data dengan Anggota Keluarga">
        <p>
          Dalam satu grup keluarga, data keuangan dapat terlihat oleh anggota
          lain sesuai peran dan pengaturan visibilitas yang kamu pilih sendiri
          (mis. &quot;Sembunyikan dari Anggota Family&quot; di Pengaturan
          Privasi).
        </p>
      </LegalSection>

      <LegalSection heading="5. Penyimpanan dan Keamanan">
        <p>
          Data disimpan pada infrastruktur milik penyedia layanan yang kami
          gunakan, dengan enkripsi untuk data sensitif (mis. tanggal lahir,
          penghasilan) sesuai standar keamanan yang berlaku. Kata sandi disimpan
          dalam bentuk hash, tidak pernah dalam bentuk teks biasa.
        </p>
      </LegalSection>

      <LegalSection heading="6. Hak Kamu sebagai Subjek Data">
        <p>Sesuai Pasal 5–7 UU PDP, kamu berhak untuk:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Mengakses dan mendapatkan salinan data pribadimu.</li>
          <li>Memperbarui atau memperbaiki data yang tidak akurat.</li>
          <li>
            Meminta penghapusan data dan akunmu (tersedia di Akun &rsaquo;
            Privasi &amp; Keamanan Data).
          </li>
          <li>Menarik persetujuan pemrosesan data.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="7. Kontak">
        <p>
          Pertanyaan seputar privasi dapat dikirim ke{" "}
          <a
            href="mailto:support@wealthme.id"
            className="font-semibold text-primary hover:text-primary-strong"
          >
            support@wealthme.id
          </a>
          .
        </p>
      </LegalSection>
    </LegalShell>
  );
}
