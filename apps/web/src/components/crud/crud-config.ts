// Universal CRUD form definitions, ported from the demo's crudConfig
// (docs/WealthMe_Demo.html — "UNIVERSAL CRUD ENGINE").

export type CrudFieldType =
  | "text"
  | "number"
  | "amount"
  | "date"
  | "select"
  | "textarea"
  | "iconpick"
  | "toggle";

export interface CrudField {
  key: string;
  label: string;
  type: CrudFieldType;
  placeholder?: string;
  options?: string[];
  /** Sub-copy shown under the label — used by the "toggle" field type. */
  helperText?: string;
}

export interface CrudEntityConfig {
  title: string;
  fields: CrudField[];
}

export type CrudEntity =
  | "rekening"
  | "ewallet"
  | "investasi"
  | "aset"
  | "liabilitas"
  | "asuransi"
  | "tujuan"
  | "member"
  | "mdbank"
  | "mdtxntype"
  | "mdkategori"
  | "mdinvtype"
  | "mdasettype"
  | "mdewallet"
  | "mdinstype"
  | "mdlembaga";

export const CRUD_CONFIG: Record<CrudEntity, CrudEntityConfig> = {
  rekening: {
    title: "Rekening Bank",
    fields: [
      {
        key: "bank",
        label: "Nama Bank",
        type: "select",
        options: [
          "BCA",
          "Mandiri",
          "BNI",
          "BRI",
          "CIMB Niaga",
          "Permata",
          "Bank Lainnya",
        ],
      },
      {
        key: "nama",
        label: "Nama Rekening",
        type: "text",
        placeholder: "cth: BCA Tahapan",
      },
      {
        key: "norek",
        label: "Nomor Rekening",
        type: "text",
        placeholder: "cth: 1234567890",
      },
      { key: "saldo", label: "Saldo Saat Ini", type: "amount" },
      {
        key: "jenis",
        label: "Jenis",
        type: "select",
        options: ["Tabungan", "Giro", "Deposito"],
      },
      {
        key: "isPrivate",
        label: "Rekening Privat",
        type: "toggle",
        helperText: "Sembunyikan dari anggota keluarga lain",
      },
    ],
  },
  ewallet: {
    title: "E-Wallet",
    fields: [
      {
        key: "nama",
        label: "E-Wallet",
        type: "select",
        options: ["GoPay", "OVO", "DANA", "LinkAja", "ShopeePay"],
      },
      {
        key: "phone",
        label: "Nomor Terdaftar",
        type: "text",
        placeholder: "08xxxxxxxxxx",
      },
      { key: "saldo", label: "Saldo Saat Ini", type: "amount" },
    ],
  },
  investasi: {
    title: "Investasi",
    fields: [
      {
        key: "nama",
        label: "Nama Instrumen",
        type: "text",
        placeholder: "cth: Bank Central Asia",
      },
      {
        key: "ticker",
        label: "Kode / Ticker",
        type: "text",
        placeholder: "cth: BBCA",
      },
      {
        key: "jenis",
        label: "Jenis",
        type: "select",
        options: ["Saham", "Reksa Dana", "Obligasi", "Emas", "Crypto"],
      },
      { key: "modal", label: "Modal Awal", type: "amount" },
      { key: "nilai", label: "Nilai Sekarang", type: "amount" },
    ],
  },
  aset: {
    title: "Aset",
    fields: [
      {
        key: "nama",
        label: "Nama Aset",
        type: "text",
        placeholder: "cth: Apartemen Kelapa Gading",
      },
      {
        key: "kategori",
        label: "Kategori",
        type: "select",
        options: [
          "Properti",
          "Kendaraan",
          "Elektronik",
          "Perhiasan",
          "Lainnya",
        ],
      },
      { key: "nilai", label: "Nilai Estimasi", type: "amount" },
      {
        key: "dokumen",
        label: "No. Dokumen",
        type: "text",
        placeholder: "cth: SHM No. 1234",
      },
    ],
  },
  liabilitas: {
    title: "Liabilitas",
    fields: [
      {
        key: "nama",
        label: "Nama Liabilitas",
        type: "text",
        placeholder: "cth: KTA Bank Mandiri",
      },
      {
        key: "jenis",
        label: "Jenis",
        type: "select",
        options: [
          "Kartu Kredit",
          "KTA",
          "KPR",
          "Cicilan Kendaraan",
          "Pinjaman Lain",
        ],
      },
      { key: "total", label: "Total Utang", type: "amount" },
      { key: "cicilan", label: "Cicilan / Bulan", type: "amount" },
      { key: "tenor", label: "Sisa Tenor (bulan)", type: "number" },
    ],
  },
  asuransi: {
    title: "Asuransi",
    fields: [
      {
        key: "nama",
        label: "Nama Polis",
        type: "text",
        placeholder: "cth: Asuransi Jiwa Prudential",
      },
      {
        key: "jenis",
        label: "Jenis",
        type: "select",
        options: ["Jiwa", "Kesehatan", "Kendaraan", "Properti", "Pendidikan"],
      },
      { key: "premi", label: "Premi / Bulan", type: "amount" },
      { key: "pertanggungan", label: "Uang Pertanggungan", type: "amount" },
      { key: "jatuhtempo", label: "Jatuh Tempo", type: "date" },
    ],
  },
  tujuan: {
    title: "Tujuan Keuangan",
    fields: [
      {
        key: "nama",
        label: "Nama Tujuan",
        type: "text",
        placeholder: "cth: Dana Liburan",
      },
      {
        key: "icon",
        label: "Ikon",
        type: "iconpick",
        options: ["🛡️", "✈️", "🏠", "🏖️", "🚗", "🎓", "💍", "👶"],
      },
      { key: "target", label: "Target Jumlah", type: "amount" },
      { key: "terkumpul", label: "Sudah Terkumpul", type: "amount" },
      { key: "deadline", label: "Target Tanggal", type: "date" },
      { key: "autodebit", label: "Auto-debit / Bulan", type: "amount" },
    ],
  },
  member: {
    title: "Anggota Family",
    fields: [
      {
        key: "nama",
        label: "Nama Lengkap",
        type: "text",
        placeholder: "cth: Siti Arsandi",
      },
      {
        key: "email",
        label: "Email / No. HP",
        type: "text",
        placeholder: "email atau nomor",
      },
      {
        key: "hubungan",
        label: "Hubungan",
        type: "select",
        options: ["Pasangan", "Anak", "Orang Tua", "Saudara", "Lainnya"],
      },
      {
        key: "role",
        label: "Peran",
        type: "select",
        options: ["Member", "Co-Owner"],
      },
    ],
  },
  mdbank: {
    title: "Bank",
    fields: [
      {
        key: "nama",
        label: "Nama Bank",
        type: "text",
        placeholder: "cth: Bank Jago",
      },
      {
        key: "kode",
        label: "Kode Bank",
        type: "text",
        placeholder: "cth: 542",
      },
    ],
  },
  mdtxntype: {
    title: "Jenis Transaksi",
    fields: [
      {
        key: "nama",
        label: "Nama Jenis",
        type: "text",
        placeholder: "cth: Investasi",
      },
      {
        key: "arah",
        label: "Arah",
        type: "select",
        options: ["Masuk", "Keluar", "Netral"],
      },
    ],
  },
  mdkategori: {
    title: "Kategori",
    fields: [
      {
        key: "icon",
        label: "Ikon",
        type: "iconpick",
        options: ["🍽️", "🚗", "🏥", "🎮", "🛒", "💡", "📱", "🎓", "🏠", "✈️"],
      },
      {
        key: "nama",
        label: "Nama Kategori",
        type: "text",
        placeholder: "cth: Pendidikan",
      },
      {
        key: "tipe",
        label: "Tipe",
        type: "select",
        options: ["Pengeluaran", "Pemasukan"],
      },
      {
        // Options are injected at runtime via CrudModal `dynamicOptions`
        // (the family's COA accounts). EPIC-017: category → COA mapping.
        key: "coaAccountId",
        label: "Akun COA",
        type: "select",
        options: [],
      },
      {
        key: "isPrivate",
        label: "Kategori Privat",
        type: "toggle",
        helperText: "Sembunyikan dari anggota keluarga lain",
      },
    ],
  },
  mdinvtype: {
    title: "Jenis Investasi",
    fields: [
      {
        key: "nama",
        label: "Nama Jenis",
        type: "text",
        placeholder: "cth: P2P Lending",
      },
      {
        key: "risiko",
        label: "Tingkat Risiko",
        type: "select",
        options: ["Rendah", "Menengah", "Tinggi"],
      },
    ],
  },
  mdasettype: {
    title: "Jenis Aset",
    fields: [
      {
        key: "nama",
        label: "Nama Jenis",
        type: "text",
        placeholder: "cth: Tanah",
      },
      {
        key: "penyusutan",
        label: "Penyusutan/Apresiasi",
        type: "select",
        options: ["Apresiasi", "Penyusutan", "Stabil"],
      },
    ],
  },
  mdewallet: {
    title: "E-Wallet",
    fields: [
      {
        key: "nama",
        label: "Nama E-Wallet",
        type: "text",
        placeholder: "cth: Jenius",
      },
    ],
  },
  mdinstype: {
    title: "Jenis Asuransi",
    fields: [
      {
        key: "nama",
        label: "Nama Jenis",
        type: "text",
        placeholder: "cth: Asuransi Perjalanan",
      },
    ],
  },
  mdlembaga: {
    title: "Lembaga Donasi",
    fields: [
      {
        key: "nama",
        label: "Nama Lembaga",
        type: "text",
        placeholder: "cth: ACT, Kitabisa",
      },
      {
        key: "jenis",
        label: "Jenis",
        type: "select",
        options: ["Zakat", "Donasi Umum", "Wakaf", "Gereja", "Lainnya"],
      },
    ],
  },
};
