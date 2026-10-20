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
  seni_koleksi: string;
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
  specsTitle: string;
  create: {
    owner: string;
    ownerShared: string;
    ownerSelf: string;
    cost: string;
    costHint: string;
    valuationDate: string;
    valuationDateHint: string;
    valuationDateBeforeAcq: string;
    valuationSource: string;
    fieldRejected: string;
    sources: { manual: string; appraisal: string; market: string };
  };
  notesTooLong: string;
  projection: string;
  detail: {
    landAreaM2: string;
    buildingAreaM2: string;
    certificateType: string;
    address: string;
    brandModel: string;
    year: string;
    plateNumber: string;
    purity: string;
    issuer: string;
    serial: string;
    material: string;
    stones: string;
    warrantyUntil: string;
    artistMaker: string;
    provenance: string;
    choose: string;
    certificates: {
      SHM: string;
      HGB: string;
      SHMSRS: string;
      "Girik-AJB": string;
      Lainnya: string;
    };
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
    seni_koleksi: "Lukisan, patung, barang koleksi",
    lainnya: "Aset fisik lain",
  },
  namePh: {
    properti: "cth. Rumah Pondok Indah",
    kendaraan: "cth. Mercedes-Benz S 450 L",
    elektronik: "cth. MacBook Pro M3",
    perhiasan: "cth. Rolex Daytona",
    emas: "cth. Emas Antam 100 gram",
    seni_koleksi: "cth. Lukisan Affandi",
    lainnya: "cth. Kapal pesiar",
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
    "Nilai total untuk seluruh jumlah. Tanpa harga perolehan, nilai ini juga dicatat sebagai modal awal.",
  valueHintTotal:
    "Dicatat sebagai valuasi awal. Isi harga perolehan untuk menghitung untung/rugi.",
  valueSuffixFor: "untuk {qty}",
  moreDetails: "Detail tambahan",
  moreDetailsHint: "Spesifikasi, kode internal, dan proyeksi nilai",
  notesDocs: "Catatan & dokumen",
  notesDocsHint: "Catatan bebas dan lampiran bukti",
  notesTooLong: "Catatan melebihi 500 karakter. Persingkat catatannya.",
  projection: "Proyeksi nilai (estimasi)",
  specsTitle: "Spesifikasi",
  create: {
    owner: "Pemilik",
    ownerShared: "Bersama (keluarga)",
    ownerSelf: "Dicatat atas nama Anda.",
    cost: "Harga perolehan",
    costHint:
      "Total yang dibayar saat memperoleh aset. Kosongkan bila tidak tahu.",
    valuationDate: "Tanggal valuasi",
    valuationDateHint: "Tanggal nilai saat ini berlaku. Kosong = hari ini.",
    valuationDateBeforeAcq:
      "Tanggal valuasi tidak boleh sebelum tanggal perolehan.",
    valuationSource: "Sumber valuasi",
    fieldRejected: "Isian {field} ditolak. Periksa lalu simpan lagi.",
    sources: {
      manual: "Manual",
      appraisal: "Penilai / appraisal",
      market: "Harga pasar",
    },
  },
  detail: {
    landAreaM2: "Luas tanah (m²)",
    buildingAreaM2: "Luas bangunan (m²)",
    certificateType: "Jenis sertifikat",
    address: "Alamat",
    brandModel: "Merek / model",
    year: "Tahun",
    plateNumber: "Nomor polisi",
    purity: "Kadar",
    issuer: "Merek / penerbit",
    serial: "Nomor seri / sertifikat",
    material: "Bahan",
    stones: "Batu / permata",
    warrantyUntil: "Garansi sampai",
    artistMaker: "Seniman / pembuat",
    provenance: "Provenans / asal-usul",
    choose: "Pilih",
    certificates: {
      SHM: "SHM",
      HGB: "HGB",
      SHMSRS: "SHMSRS",
      "Girik-AJB": "Girik / AJB",
      Lainnya: "Lainnya",
    },
  },
  preview: {
    title: "Pratinjau aset",
    idle: "Isi nilai aset untuk melihat pratinjau.",
    recorded: "Nilai yang dicatat",
    perUnit: "Harga per {unit}",
    cost: "Modal awal (harga perolehan)",
    costSame: "sama dengan nilai awal",
    costNone: "Tidak dicatat",
    gain: "Untung/rugi belum direalisasi",
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
    seni_koleksi: "Paintings, sculpture, collectibles",
    lainnya: "Other physical assets",
  },
  namePh: {
    properti: "e.g. Pondok Indah house",
    kendaraan: "e.g. Mercedes-Benz S 450 L",
    elektronik: "e.g. MacBook Pro M3",
    perhiasan: "e.g. Rolex Daytona",
    emas: "e.g. Antam gold 100 gram",
    seni_koleksi: "e.g. Affandi painting",
    lainnya: "e.g. Yacht",
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
    "Total value for the whole quantity. Without a purchase price it is also recorded as the opening cost.",
  valueHintTotal:
    "Recorded as the opening valuation. Enter the purchase price to track gain or loss.",
  valueSuffixFor: "for {qty}",
  moreDetails: "More details",
  moreDetailsHint: "Specifications, internal code and value projection",
  notesDocs: "Notes & documents",
  notesDocsHint: "Free notes and proof attachments",
  notesTooLong: "Notes exceed 500 characters. Shorten them.",
  projection: "Value projection (estimate)",
  specsTitle: "Specifications",
  create: {
    owner: "Owner",
    ownerShared: "Shared (family)",
    ownerSelf: "Recorded under your name.",
    cost: "Purchase price",
    costHint: "Total paid to acquire the asset. Leave empty if unknown.",
    valuationDate: "Valuation date",
    valuationDateHint: "Date the current value applies. Empty = today.",
    valuationDateBeforeAcq:
      "The valuation date can't be before the acquisition date.",
    valuationSource: "Valuation source",
    fieldRejected: "The {field} field was rejected. Check it and save again.",
    sources: {
      manual: "Manual",
      appraisal: "Appraiser",
      market: "Market price",
    },
  },
  detail: {
    landAreaM2: "Land area (m²)",
    buildingAreaM2: "Building area (m²)",
    certificateType: "Certificate type",
    address: "Address",
    brandModel: "Make / model",
    year: "Year",
    plateNumber: "Licence plate",
    purity: "Purity",
    issuer: "Brand / issuer",
    serial: "Serial / certificate no.",
    material: "Material",
    stones: "Stones",
    warrantyUntil: "Warranty until",
    artistMaker: "Artist / maker",
    provenance: "Provenance",
    choose: "Choose",
    certificates: {
      SHM: "SHM (freehold)",
      HGB: "HGB (building rights)",
      SHMSRS: "SHMSRS (strata title)",
      "Girik-AJB": "Girik / AJB",
      Lainnya: "Other",
    },
  },
  preview: {
    title: "Asset preview",
    idle: "Enter the asset value to see a preview.",
    recorded: "Value recorded",
    perUnit: "Price per {unit}",
    cost: "Opening cost (purchase price)",
    costSame: "same as the opening value",
    costNone: "Not recorded",
    gain: "Unrealised gain/loss",
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
