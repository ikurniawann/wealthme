/**
 * Tambah / edit aset fisik — category-first drawer copy (2026-10-20 fidelity
 * pass). Wired into `aset.v3.form`; the dictionary parity test checks both
 * locales key by key.
 */
type TypeMap = {
  properti: string;
  kendaraan: string;
  elektronik: string;
  perhiasan: string;
  emas: string;
  lainnya: string;
};

export interface AsetFormCopy {
  subtitleAdd: string;
  subtitleEdit: string;
  stepTitle: string;
  stepHint: string;
  typeHints: TypeMap;
  namePh: TypeMap;
  category: string;
  change: string;
  required: string;
  secIdentity: string;
  secIdentityHint: string;
  secValue: string;
  secValueHint: string;
  secAcquisition: string;
  secAcquisitionHint: string;
  address: string;
  addressPh: string;
  weight: string;
  valueNow: string;
  valueHintPerUnit: string;
  valueHintTotal: string;
  valueSuffixFor: string;
  moreDetails: string;
  moreDetailsHint: string;
  notesDocs: string;
  notesDocsHint: string;
  detailsSaved: string;
  notesTooLong: string;
  projection: string;
  detail: {
    landArea: string;
    buildingArea: string;
    certificate: string;
    certificateOther: string;
    brandModel: string;
    year: string;
    plate: string;
    purity: string;
    issuer: string;
    serial: string;
    material: string;
    stones: string;
    warranty: string;
    choose: string;
  };
  preview: {
    title: string;
    idle: string;
    recorded: string;
    perUnit: string;
    cost: string;
    costSame: string;
    costNone: string;
    gain: string;
    effective: string;
    today: string;
    source: string;
    manual: string;
    fx: string;
    before: string;
    change: string;
    unchanged: string;
    approx: string;
  };
}

export const asetFormId: AsetFormCopy = {
  subtitleAdd: "Catat aset fisik keluarga beserta nilai dan kepemilikannya.",
  subtitleEdit: "Perbarui identitas dan detail aset ini.",
  stepTitle: "Pilih kategori aset",
  stepHint: "Kolom berikutnya menyesuaikan kategori yang dipilih.",
  typeHints: {
    properti: "Rumah, apartemen, ruko, tanah",
    kendaraan: "Mobil, motor, kapal",
    elektronik: "Laptop, gawai, peralatan",
    perhiasan: "Jam tangan, berlian, perhiasan",
    emas: "Emas batangan & logam mulia",
    lainnya: "Seni, koleksi, aset lain",
  },
  namePh: {
    properti: "cth. Rumah Pondok Indah",
    kendaraan: "cth. Mercedes-Benz S 450 L",
    elektronik: "cth. MacBook Pro M3",
    perhiasan: "cth. Rolex Daytona",
    emas: "cth. Emas Antam 100 gram",
    lainnya: "cth. Lukisan Affandi",
  },
  category: "Kategori",
  change: "Ganti",
  required: "wajib",
  secIdentity: "Identitas aset",
  secIdentityHint: "Nama dan lokasi untuk mengenali aset.",
  secValue: "Nilai & valuasi",
  secValueHint: "Nilai yang dicatat untuk kekayaan bersih.",
  secAcquisition: "Perolehan & catatan",
  secAcquisitionHint: "Kapan aset diperoleh dan informasi pendukung.",
  address: "Alamat / lokasi",
  addressPh: "cth. Jl. Metro Pondok Indah No. 10, Jakarta",
  weight: "Berat",
  valueNow: "Nilai saat ini",
  valueHintPerUnit:
    "Nilai total untuk seluruh jumlah. Dicatat juga sebagai modal awal (harga perolehan).",
  valueHintTotal:
    "Dicatat sebagai valuasi awal. Harga perolehan terpisah belum bisa dicatat di formulir ini.",
  valueSuffixFor: "untuk {qty}",
  moreDetails: "Detail tambahan",
  moreDetailsHint: "Spesifikasi, kode internal, dan proyeksi nilai",
  notesDocs: "Catatan & dokumen",
  notesDocsHint: "Catatan bebas dan lampiran bukti",
  detailsSaved:
    "Spesifikasi di atas disimpan sebagai baris pertama di catatan aset.",
  notesTooLong:
    "Catatan dan spesifikasi melebihi 500 karakter. Persingkat salah satunya.",
  projection: "Proyeksi nilai (estimasi)",
  detail: {
    landArea: "Luas tanah (m²)",
    buildingArea: "Luas bangunan (m²)",
    certificate: "Jenis sertifikat",
    certificateOther: "Lainnya",
    brandModel: "Merek / model",
    year: "Tahun",
    plate: "Nomor polisi",
    purity: "Kadar",
    issuer: "Merek / penerbit",
    serial: "Nomor seri / sertifikat",
    material: "Bahan",
    stones: "Batu / permata",
    warranty: "Garansi sampai",
    choose: "Pilih",
  },
  preview: {
    title: "Pratinjau aset",
    idle: "Isi nilai aset untuk melihat pratinjau.",
    recorded: "Nilai yang dicatat",
    perUnit: "Harga per {unit}",
    cost: "Modal awal (harga perolehan)",
    costSame: "sama dengan nilai awal",
    costNone: "Tidak dicatat",
    gain: "Keuntungan belum direalisasi",
    effective: "Tanggal valuasi",
    today: "Hari ini",
    source: "Sumber",
    manual: "Manual",
    fx: "Dikonversi ke IDR saat disimpan; angka di sini perkiraan kurs terkini.",
    before: "Nilai sebelumnya",
    change: "Perubahan",
    unchanged: "Nilai tidak berubah, jadi tidak ada valuasi baru yang dicatat.",
    approx: "≈",
  },
};

export const asetFormEn: AsetFormCopy = {
  subtitleAdd: "Record a family physical asset with its value and ownership.",
  subtitleEdit: "Update this asset's identity and details.",
  stepTitle: "Choose an asset category",
  stepHint: "The next fields adapt to the category you pick.",
  typeHints: {
    properti: "House, apartment, shophouse, land",
    kendaraan: "Car, motorbike, boat",
    elektronik: "Laptop, devices, equipment",
    perhiasan: "Watches, diamonds, jewellery",
    emas: "Gold bars & precious metal",
    lainnya: "Art, collectibles, other",
  },
  namePh: {
    properti: "e.g. Pondok Indah house",
    kendaraan: "e.g. Mercedes-Benz S 450 L",
    elektronik: "e.g. MacBook Pro M3",
    perhiasan: "e.g. Rolex Daytona",
    emas: "e.g. Antam gold 100 gram",
    lainnya: "e.g. Affandi painting",
  },
  category: "Category",
  change: "Change",
  required: "required",
  secIdentity: "Asset identity",
  secIdentityHint: "Name and location to recognise the asset.",
  secValue: "Value & valuation",
  secValueHint: "The value recorded for net worth.",
  secAcquisition: "Acquisition & notes",
  secAcquisitionHint: "When it was acquired and supporting details.",
  address: "Address / location",
  addressPh: "e.g. 10 Metro Pondok Indah St, Jakarta",
  weight: "Weight",
  valueNow: "Current value",
  valueHintPerUnit:
    "Total value for the whole quantity. Also recorded as the opening cost (purchase price).",
  valueHintTotal:
    "Recorded as the opening valuation. A separate purchase price can't be recorded in this form yet.",
  valueSuffixFor: "for {qty}",
  moreDetails: "More details",
  moreDetailsHint: "Specifications, internal code and value projection",
  notesDocs: "Notes & documents",
  notesDocsHint: "Free notes and proof attachments",
  detailsSaved:
    "The specifications above are saved as the first lines of the asset notes.",
  notesTooLong:
    "Notes and specifications exceed 500 characters. Shorten one of them.",
  projection: "Value projection (estimate)",
  detail: {
    landArea: "Land area (m²)",
    buildingArea: "Building area (m²)",
    certificate: "Certificate type",
    certificateOther: "Other",
    brandModel: "Make / model",
    year: "Year",
    plate: "Licence plate",
    purity: "Purity",
    issuer: "Brand / issuer",
    serial: "Serial / certificate no.",
    material: "Material",
    stones: "Stones",
    warranty: "Warranty until",
    choose: "Choose",
  },
  preview: {
    title: "Asset preview",
    idle: "Enter the asset value to see a preview.",
    recorded: "Value recorded",
    perUnit: "Price per {unit}",
    cost: "Opening cost (purchase price)",
    costSame: "same as the opening value",
    costNone: "Not recorded",
    gain: "Unrealised gain",
    effective: "Valuation date",
    today: "Today",
    source: "Source",
    manual: "Manual",
    fx: "Converted to IDR on save; figures here use the latest rate.",
    before: "Previous value",
    change: "Change",
    unchanged: "The value is unchanged, so no new valuation is recorded.",
    approx: "≈",
  },
};
