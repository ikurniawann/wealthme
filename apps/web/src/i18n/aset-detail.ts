/**
 * Aset detail copy (Task 20) — the /aset/[id] page, the Update nilai drawer
 * and the Catat beli / Catat jual drawer. Wired through `aset.v3.detail`
 * (aset-v3.ts), so the dictionary parity test checks both locales.
 */
export interface AsetDetailCopy {
  back: string;
  notFound: string;
  loadError: string;
  retry: string;
  loading: string;
  owner: string;
  family: string;
  code: string;
  ticker: string;
  custodian: string;
  currency: string;
  sold: string;
  archived: string;
  archivedNote: string;
  linkedNote: string;
  openInvestasi: string;
  // actions
  buy: string;
  sell: string;
  updateValue: string;
  updatePrice: string;
  editInfo: string;
  actionsAria: string;
  // KPI strip
  kpiAria: string;
  kpiQty: string;
  kpiCost: string;
  kpiPrice: string;
  kpiTotalValuation: string;
  kpiValue: string;
  kpiUnrealized: string;
  kpiSincePurchase: string;
  kpiRealized: string;
  costUnknown: string;
  lastValuation: string;
  noValuation: string;
  source: string;
  dateOnly: string;
  // tabs
  tabsAria: string;
  tabSummary: string;
  tabTransactions: string;
  tabHistory: string;
  tabDocuments: string;
  // chart
  chartTitle: string;
  chartLegend: string;
  chartEmpty: string;
  chartNote: string;
  // calculation
  calcTitle: string;
  calcQty: string;
  calcPrice: string;
  calcValue: string;
  calcValueTotal: string;
  calcCost: string;
  calcDiff: string;
  calcPct: string;
  calcRealized: string;
  todayTitle: string;
  todayNone: string;
  todayVs: string;
  sinceLastTitle: string;
  sinceLastNone: string;
  up: string;
  down: string;
  flat: string;
  // history
  historyTitle: string;
  historyValueTitle: string;
  filterAll: string;
  filterBuy: string;
  filterSell: string;
  filterValuation: string;
  filtersAria: string;
  colWhen: string;
  colActivity: string;
  colQty: string;
  colPrice: string;
  colValue: string;
  colSource: string;
  colRecorder: string;
  colNote: string;
  historyEmpty: string;
  filterEmpty: string;
  system: string;
  voided: string;
  kinds: {
    opening: string;
    valuation: string;
    correction: string;
    buy: string;
    sell: string;
    quantity_change: string;
  };
  sources: {
    manual: string;
    appraisal: string;
    dealer: string;
    market: string;
    receipt: string;
    other: string;
    transaction: string;
    opening: string;
  };
  // transactions tab
  txTitle: string;
  txEmpty: string;
  txGross: string;
  txFee: string;
  txNet: string;
  txAccount: string;
  txRealized: string;
  txCashOut: string;
  txCashIn: string;
  txNoCash: string;
  // documents
  docsTitle: string;
  docsCount: string;
  upload: string;
  docsEmpty: string;
  openDoc: string;
  deleteDoc: string;
  docUploaded: string;
  docDeleted: string;
  docFailed: string;
  // Update nilai drawer
  vTitle: string;
  vInfo: string;
  vNoCash: string;
  vPriceLabel: string;
  vTotalLabel: string;
  vCurrency: string;
  vFxRate: string;
  vFxHint: string;
  vDate: string;
  vTime: string;
  vTimeHint: string;
  vZone: string;
  vSource: string;
  vSourcePick: string;
  vReference: string;
  vReferencePh: string;
  vProof: string;
  vProofHint: string;
  vProofTooBig: string;
  vNote: string;
  vNotePh: string;
  vPreviewTitle: string;
  vMore: string;
  vMoreHint: string;
  vPreviewIdle: string;
  vPreviewLoading: string;
  vQty: string;
  vNewPrice: string;
  vNewValue: string;
  vPrevValue: string;
  vPrevNone: string;
  vChange: string;
  vChangePct: string;
  vImpact: string;
  vBackdated: string;
  vNotCurrent: string;
  vCancel: string;
  vSave: string;
  vSaving: string;
  vSaved: string;
  vFailed: string;
  vProofFailed: string;
  required: string;
  priceRequired: string;
  sourceRequired: string;
  futureDate: string;
  // Catat beli / jual drawer
  tBuyTitle: string;
  tSellTitle: string;
  tBuySub: string;
  tSellSub: string;
  tQty: string;
  tAvailable: string;
  tPrice: string;
  tFee: string;
  tAccountBuy: string;
  tAccountSell: string;
  tAccountPick: string;
  tAccountNone: string;
  tBalance: string;
  tSummary: string;
  tGross: string;
  tNetBuy: string;
  tNetSell: string;
  tCostAfter: string;
  tRealizedEst: string;
  tEstimateNote: string;
  tSaveBuy: string;
  tSaveSell: string;
  tSaved: string;
  tFailed: string;
  qtyRequired: string;
  accountRequired: string;
}

export const asetDetailId: AsetDetailCopy = {
  back: "Aset Saya",
  notFound: "Aset tidak ditemukan atau Anda tidak memiliki akses.",
  loadError: "Gagal memuat detail aset.",
  retry: "Coba lagi",
  loading: "Memuat detail aset…",
  owner: "Pemilik",
  family: "Keluarga",
  code: "Kode internal",
  ticker: "Ticker",
  custodian: "Lokasi",
  currency: "Mata uang",
  sold: "Terjual",
  archived: "Diarsipkan",
  archivedNote:
    "Aset ini diarsipkan: riwayatnya tetap tersimpan, tetapi tidak dihitung dalam total dan tidak bisa diubah.",
  linkedNote:
    "Aset ini tertaut ke Investasi. Beli, jual, dan update harga dicatat lewat modul Investasi agar tidak tercatat ganda.",
  openInvestasi: "Buka di Investasi",
  buy: "Catat beli",
  sell: "Catat jual",
  updateValue: "Update nilai",
  updatePrice: "Update harga",
  editInfo: "Edit informasi",
  actionsAria: "Aksi aset",
  kpiAria: "Ringkasan nilai aset",
  kpiQty: "Kuantitas saat ini",
  kpiCost: "Modal (total)",
  kpiPrice: "Harga saat ini",
  kpiTotalValuation: "Valuasi total",
  kpiValue: "Nilai saat ini",
  kpiUnrealized: "Keuntungan belum direalisasi",
  kpiSincePurchase: "(Sejak pembelian)",
  kpiRealized: "Laba/rugi terealisasi",
  costUnknown: "Modal belum diketahui",
  lastValuation: "Terakhir valuasi: {when}",
  noValuation: "Belum ada valuasi",
  source: "Sumber: {source}",
  dateOnly: "tanggal saja",
  tabsAria: "Bagian detail aset",
  tabSummary: "Ringkasan",
  tabTransactions: "Transaksi",
  tabHistory: "Riwayat nilai",
  tabDocuments: "Dokumen",
  chartTitle: "Pergerakan nilai aset",
  chartLegend: "Nilai aset (Rp)",
  chartEmpty:
    "Grafik muncul setelah ada minimal dua nilai tersimpan. Tidak ada titik yang dibuat-buat.",
  chartNote: "Hanya dari valuasi dan transaksi yang tersimpan.",
  calcTitle: "Rincian perhitungan",
  calcQty: "Kuantitas saat ini",
  calcPrice: "Harga saat ini",
  calcValue: "Nilai aset saat ini",
  calcValueTotal: "Dinilai sebagai satu kesatuan",
  calcCost: "Modal (total)",
  calcDiff: "Selisih (keuntungan belum direalisasi)",
  calcPct: "Persentase",
  calcRealized: "Laba/rugi terealisasi (dari penjualan)",
  todayTitle: "Perubahan hari ini",
  todayNone: "Belum ada valuasi pembanding hari sebelumnya.",
  todayVs: "dibanding valuasi {date}",
  sinceLastTitle: "Sejak valuasi sebelumnya",
  sinceLastNone: "Belum ada valuasi pembanding",
  up: "naik",
  down: "turun",
  flat: "tetap",
  historyTitle: "Riwayat aset",
  historyValueTitle: "Riwayat nilai",
  filterAll: "Semua",
  filterBuy: "Beli",
  filterSell: "Jual",
  filterValuation: "Valuasi",
  filtersAria: "Saring riwayat",
  colWhen: "Waktu efektif",
  colActivity: "Aktivitas",
  colQty: "Kuantitas",
  colPrice: "Harga per {unit}",
  colValue: "Nilai sebelum → sesudah",
  colSource: "Sumber",
  colRecorder: "Pencatat",
  colNote: "Catatan",
  historyEmpty: "Belum ada riwayat untuk aset ini.",
  filterEmpty: "Tidak ada kejadian untuk filter ini.",
  system: "Sistem",
  voided: "Dibatalkan",
  kinds: {
    opening: "Kepemilikan awal",
    valuation: "Update valuasi",
    correction: "Koreksi",
    buy: "Pembelian",
    sell: "Penjualan",
    quantity_change: "Perubahan kuantitas",
  },
  sources: {
    manual: "Manual",
    appraisal: "Penilai / appraisal",
    dealer: "Penawaran dealer",
    market: "Harga pasar",
    receipt: "Nota / dokumen",
    other: "Lainnya",
    transaction: "Transaksi",
    opening: "Data awal",
  },
  txTitle: "Transaksi aset",
  txEmpty: "Belum ada transaksi beli atau jual.",
  txGross: "Nilai bruto",
  txFee: "Biaya",
  txNet: "Arus kas",
  txAccount: "Rekening",
  txRealized: "Laba/rugi terealisasi",
  txCashOut: "keluar",
  txCashIn: "masuk",
  txNoCash: "Tanpa arus kas",
  docsTitle: "Dokumen",
  docsCount: "{count} dokumen",
  upload: "Unggah dokumen",
  docsEmpty:
    "Belum ada dokumen. Unggah sertifikat, nota, atau laporan penilaian.",
  openDoc: "Buka dokumen",
  deleteDoc: "Hapus dokumen",
  docUploaded: "Dokumen diunggah",
  docDeleted: "Dokumen dihapus",
  docFailed: "Gagal memproses dokumen.",
  vTitle: "Update nilai",
  vInfo:
    "Update nilai digunakan untuk mencatat nilai pasar terbaru aset ini. Tidak mengubah saldo kas atau harga beli.",
  vNoCash: "Tidak mengubah saldo kas atau harga beli",
  vPriceLabel: "Harga baru per {unit}",
  vTotalLabel: "Nilai total baru",
  vCurrency: "Mata uang",
  vFxRate: "Kurs (Rp per 1 {currency})",
  vFxHint: "Kurs disimpan bersama valuasi ini sebagai sumber konversi.",
  vDate: "Tanggal valuasi",
  vTime: "Waktu",
  vTimeHint: "Kosongkan bila jam tidak diketahui (tanggal saja).",
  vZone: "Zona waktu",
  vSource: "Sumber",
  vSourcePick: "Pilih sumber",
  vReference: "Referensi",
  vReferencePh: "No. laporan, tautan, atau nama penilai",
  vProof: "Bukti (opsional)",
  vProofHint: "JPG, PNG, WEBP, atau PDF, maks. 5 MB. Disimpan di tab Dokumen.",
  vProofTooBig: "Ukuran bukti melebihi 5 MB.",
  vNote: "Catatan",
  vNotePh: "Opsional",
  vPreviewTitle: "Pratinjau perubahan nilai",
  vMore: "Detail tambahan",
  vMoreHint: "Mata uang, referensi, bukti, dan catatan",
  vPreviewIdle: "Isi harga atau nilai untuk melihat pratinjau.",
  vPreviewLoading: "Menghitung pratinjau…",
  vQty: "Kuantitas",
  vNewPrice: "Harga baru per {unit}",
  vNewValue: "Nilai aset baru",
  vPrevValue: "Nilai sebelumnya",
  vPrevNone: "Belum ada valuasi pembanding",
  vChange: "Perubahan",
  vChangePct: "Persentase perubahan",
  vImpact: "Dampak pada total aset",
  vBackdated:
    "Tanggal efektif sebelum hari ini (backdate). Riwayat setelahnya dihitung ulang.",
  vNotCurrent:
    "Sudah ada valuasi yang lebih baru ({date}). Nilai ini hanya masuk riwayat dan tidak mengubah nilai aset saat ini.",
  vCancel: "Batal",
  vSave: "Simpan nilai",
  vSaving: "Menyimpan…",
  vSaved: "Nilai aset disimpan",
  vFailed: "Gagal menyimpan nilai.",
  vProofFailed: "Nilai tersimpan, tetapi bukti gagal diunggah.",
  required: "wajib",
  priceRequired: "Isi harga atau nilai lebih dari 0.",
  sourceRequired: "Pilih sumber valuasi.",
  futureDate: "Tanggal dan waktu tidak boleh di masa depan.",
  tBuyTitle: "Catat beli",
  tSellTitle: "Catat jual",
  tBuySub:
    "Menambah kuantitas dan modal; dana keluar dari rekening yang dipilih.",
  tSellSub:
    "Mengurangi kuantitas; hasil bersih masuk ke rekening dan laba/rugi dicatat terealisasi.",
  tQty: "Kuantitas",
  tAvailable: "Tersedia {qty}",
  tPrice: "Harga per {unit}",
  tFee: "Biaya (opsional)",
  tAccountBuy: "Bayar dari rekening",
  tAccountSell: "Terima di rekening",
  tAccountPick: "Pilih rekening",
  tAccountNone:
    "Belum ada rekening aktif. Tambahkan rekening di menu Rekening atau Dana terlebih dahulu.",
  tBalance: "Saldo {amount}",
  tSummary: "Ringkasan transaksi",
  tGross: "Nilai bruto",
  tNetBuy: "Total dibayar",
  tNetSell: "Hasil bersih diterima",
  tCostAfter: "Kuantitas setelah transaksi",
  tRealizedEst: "Perkiraan laba/rugi terealisasi",
  tEstimateNote:
    "Perkiraan memakai harga rata-rata tertimbang; angka final dihitung server.",
  tSaveBuy: "Simpan pembelian",
  tSaveSell: "Simpan penjualan",
  tSaved: "Transaksi disimpan",
  tFailed: "Gagal menyimpan transaksi.",
  qtyRequired: "Isi kuantitas lebih dari 0.",
  accountRequired: "Pilih rekening.",
};

export const asetDetailEn: AsetDetailCopy = {
  back: "My Assets",
  notFound: "Asset not found, or you do not have access.",
  loadError: "Could not load the asset.",
  retry: "Try again",
  loading: "Loading asset…",
  owner: "Owner",
  family: "Family",
  code: "Internal code",
  ticker: "Ticker",
  custodian: "Location",
  currency: "Currency",
  sold: "Sold",
  archived: "Archived",
  archivedNote:
    "This asset is archived: its history is kept, but it is not counted in totals and cannot be changed.",
  linkedNote:
    "This asset is linked to Investments. Buys, sells and price updates are recorded there so nothing is counted twice.",
  openInvestasi: "Open in Investments",
  buy: "Record buy",
  sell: "Record sale",
  updateValue: "Update value",
  updatePrice: "Update price",
  editInfo: "Edit details",
  actionsAria: "Asset actions",
  kpiAria: "Asset value summary",
  kpiQty: "Current quantity",
  kpiCost: "Cost (total)",
  kpiPrice: "Current price",
  kpiTotalValuation: "Total valuation",
  kpiValue: "Current value",
  kpiUnrealized: "Unrealized gain",
  kpiSincePurchase: "(Since purchase)",
  kpiRealized: "Realized gain/loss",
  costUnknown: "Cost not known",
  lastValuation: "Last valuation: {when}",
  noValuation: "No valuation yet",
  source: "Source: {source}",
  dateOnly: "date only",
  tabsAria: "Asset detail sections",
  tabSummary: "Summary",
  tabTransactions: "Transactions",
  tabHistory: "Value history",
  tabDocuments: "Documents",
  chartTitle: "Asset value over time",
  chartLegend: "Asset value (Rp)",
  chartEmpty:
    "The chart appears once at least two values are stored. No points are made up.",
  chartNote: "Only from stored valuations and transactions.",
  calcTitle: "Calculation",
  calcQty: "Current quantity",
  calcPrice: "Current price",
  calcValue: "Current asset value",
  calcValueTotal: "Valued as a whole",
  calcCost: "Cost (total)",
  calcDiff: "Difference (unrealized gain)",
  calcPct: "Percentage",
  calcRealized: "Realized gain/loss (from sales)",
  todayTitle: "Change today",
  todayNone: "No comparison valuation from the previous day yet.",
  todayVs: "vs the {date} valuation",
  sinceLastTitle: "Since previous valuation",
  sinceLastNone: "No comparison valuation yet",
  up: "up",
  down: "down",
  flat: "unchanged",
  historyTitle: "Asset history",
  historyValueTitle: "Value history",
  filterAll: "All",
  filterBuy: "Buy",
  filterSell: "Sell",
  filterValuation: "Valuation",
  filtersAria: "Filter history",
  colWhen: "Effective time",
  colActivity: "Activity",
  colQty: "Quantity",
  colPrice: "Price per {unit}",
  colValue: "Value before → after",
  colSource: "Source",
  colRecorder: "Recorded by",
  colNote: "Note",
  historyEmpty: "No history for this asset yet.",
  filterEmpty: "No events for this filter.",
  system: "System",
  voided: "Voided",
  kinds: {
    opening: "Opening holding",
    valuation: "Valuation update",
    correction: "Correction",
    buy: "Purchase",
    sell: "Sale",
    quantity_change: "Quantity change",
  },
  sources: {
    manual: "Manual",
    appraisal: "Appraiser",
    dealer: "Dealer quote",
    market: "Market price",
    receipt: "Receipt / document",
    other: "Other",
    transaction: "Transaction",
    opening: "Opening data",
  },
  txTitle: "Asset transactions",
  txEmpty: "No buy or sell transactions yet.",
  txGross: "Gross amount",
  txFee: "Fee",
  txNet: "Cash flow",
  txAccount: "Account",
  txRealized: "Realized gain/loss",
  txCashOut: "out",
  txCashIn: "in",
  txNoCash: "No cash movement",
  docsTitle: "Documents",
  docsCount: "{count} documents",
  upload: "Upload document",
  docsEmpty: "No documents yet. Upload a certificate, receipt or appraisal.",
  openDoc: "Open document",
  deleteDoc: "Delete document",
  docUploaded: "Document uploaded",
  docDeleted: "Document deleted",
  docFailed: "Could not process the document.",
  vTitle: "Update value",
  vInfo:
    "Use Update value to record this asset's latest market value. It does not change cash balances or the purchase price.",
  vNoCash: "Does not change cash balances or the purchase price",
  vPriceLabel: "New price per {unit}",
  vTotalLabel: "New total value",
  vCurrency: "Currency",
  vFxRate: "Rate (Rp per 1 {currency})",
  vFxHint: "The rate is stored with this valuation as its conversion source.",
  vDate: "Valuation date",
  vTime: "Time",
  vTimeHint: "Leave empty when the time is unknown (date only).",
  vZone: "Time zone",
  vSource: "Source",
  vSourcePick: "Choose a source",
  vReference: "Reference",
  vReferencePh: "Report no., link, or appraiser name",
  vProof: "Proof (optional)",
  vProofHint: "JPG, PNG, WEBP or PDF, max 5 MB. Stored under Documents.",
  vProofTooBig: "The proof is larger than 5 MB.",
  vNote: "Note",
  vNotePh: "Optional",
  vPreviewTitle: "Value change preview",
  vMore: "More details",
  vMoreHint: "Currency, reference, proof and note",
  vPreviewIdle: "Enter a price or value to see the preview.",
  vPreviewLoading: "Calculating preview…",
  vQty: "Quantity",
  vNewPrice: "New price per {unit}",
  vNewValue: "New asset value",
  vPrevValue: "Previous value",
  vPrevNone: "No comparison valuation yet",
  vChange: "Change",
  vChangePct: "Change percentage",
  vImpact: "Impact on total assets",
  vBackdated:
    "The effective date is before today (backdated). Later history is recalculated.",
  vNotCurrent:
    "A newer valuation exists ({date}). This value goes into history only and does not change the asset's current value.",
  vCancel: "Cancel",
  vSave: "Save value",
  vSaving: "Saving…",
  vSaved: "Asset value saved",
  vFailed: "Could not save the value.",
  vProofFailed: "The value was saved, but the proof could not be uploaded.",
  required: "required",
  priceRequired: "Enter a price or value above 0.",
  sourceRequired: "Choose a valuation source.",
  futureDate: "The date and time cannot be in the future.",
  tBuyTitle: "Record buy",
  tSellTitle: "Record sale",
  tBuySub: "Adds quantity and cost; cash leaves the chosen account.",
  tSellSub:
    "Reduces quantity; net proceeds arrive in the account and the gain/loss is realized.",
  tQty: "Quantity",
  tAvailable: "{qty} available",
  tPrice: "Price per {unit}",
  tFee: "Fee (optional)",
  tAccountBuy: "Pay from account",
  tAccountSell: "Receive in account",
  tAccountPick: "Choose an account",
  tAccountNone: "No active account yet. Add one under Accounts or Cash first.",
  tBalance: "Balance {amount}",
  tSummary: "Transaction summary",
  tGross: "Gross amount",
  tNetBuy: "Total paid",
  tNetSell: "Net proceeds received",
  tCostAfter: "Quantity after this transaction",
  tRealizedEst: "Estimated realized gain/loss",
  tEstimateNote:
    "The estimate uses the weighted-average cost; the server computes the final figure.",
  tSaveBuy: "Save purchase",
  tSaveSell: "Save sale",
  tSaved: "Transaction saved",
  tFailed: "Could not save the transaction.",
  qtyRequired: "Enter a quantity above 0.",
  accountRequired: "Choose an account.",
};
