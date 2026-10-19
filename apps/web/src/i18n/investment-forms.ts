export interface InvestmentFormsCopy {
  settlementDate: string;
  brokerDate: string;
  pendingProceeds: string;
  netProceeds: string;
  remainingHoldings: string;
  savedTrade: string;

  proof: string;
  proofLimit: string;
  savedProofFailed: string;
  openTransaction: string;
  newPurchase: string;
  recordingMode: string;
  unknownCost: string;
  manualInstrument: string;
  instrumentName: string;
  ticker: string;
  priceSymbol: string;
  unit: string;
  principal: string;
  bankName: string;
  ratePct: string;
  startDate: string;
  maturityDate: string;
  rollover: string;
  aro: string;
  aro_plus: string;
  non_aro: string;
  bondCode: string;
  issuer: string;
  couponRate: string;
  couponFrequency: string;
  priceConvention: string;
  percent_of_par: string;
  per_unit: string;
  pricesIncludeAccrued: string;
  physical: string;
  digital: string;
  goldForm: string;
  purity: string;
  brand: string;
  valuationMethod: string;
  manual_price: string;
  fixed_cost: string;
  gross: string;
  totalDebit: string;
  estimated: string;
  openingNote: string;
  noOrder: string;
  fractionRule: string;
  invalidQuantity: string;
  currencyExecution: string;
  optionalPlatform: string;
  savedPosition: string;

  costUnknown: string;
  addPlatform: string;
  addPocket: string;
  customName: string;
  label: string;
  accountRef: string;
  pocketName: string;
  pocketKind: string;
  rdn: string;
  crypto: string;
  usd: string;
  general: string;
  cancel: string;
  save: string;
  saving: string;
  saved: string;
  failed: string;
  required: string;
  transferTitle: string;
  withdraw: string;
  transferSub: string;
  transferNote: string;
  source: string;
  destination: string;
  pocket: string;
  sourceAmount: string;
  destAmount: string;
  actualRate: string;
  fee: string;
  date: string;
  time: string;
  zone: string;
  before: string;
  after: string;
  summary: string;
  fxUnsupported: string;
  insufficient: string;
  dateOnly: string;
  currentBalance: string;
  note: string;
  choose: string;
  edit: string;
  voidAction: string;
  reason: string;
  confirmVoid: string;
  status: string;
  kind: string;
  transactionValue: string;
  quantity: string;
  executionPrice: string;
  tax: string;
  historyEmpty: string;
  transfer: string;
  linkedCash: string;
  manageTransfer: string;
  openingZero: string;
}
export const investmentFormsId: InvestmentFormsCopy = {
  settlementDate: "Tanggal penyelesaian",
  brokerDate: "Sesuai broker — dapat diubah",
  pendingProceeds: "Hasil jual belum tersedia sampai tanggal penyelesaian.",
  netProceeds: "Hasil bersih penjualan",
  remainingHoldings: "Sisa kepemilikan",
  savedTrade: "Transaksi investasi berhasil dicatat.",

  proof: "Bukti transaksi (opsional)",
  proofLimit: "Pilih JPG, PNG, WEBP, atau PDF, maksimal 5 MB.",
  savedProofFailed:
    "Investasi tersimpan, tetapi bukti gagal diunggah. Tambahkan bukti dari detail transaksi.",
  openTransaction: "Buka transaksi",
  newPurchase: "Pembelian baru",
  recordingMode: "Cara pencatatan",
  unknownCost: "Modal awal tidak diketahui",
  manualInstrument: "Instrumen manual (tanpa sumber harga otomatis)",
  instrumentName: "Nama instrumen",
  ticker: "Ticker / kode instrumen",
  priceSymbol: "Simbol penyedia harga",
  unit: "Satuan kuantitas",
  principal: "Nominal pokok",
  bankName: "Bank deposito",
  ratePct: "Bunga per tahun (%)",
  startDate: "Tanggal mulai",
  maturityDate: "Tanggal jatuh tempo",
  rollover: "Perpanjangan",
  aro: "ARO (pokok saja)",
  aro_plus: "ARO pokok + bunga",
  non_aro: "Tidak diperpanjang",
  bondCode: "Kode obligasi / ISIN",
  issuer: "Penerbit",
  couponRate: "Kupon per tahun (%)",
  couponFrequency: "Kupon per tahun (kali)",
  priceConvention: "Konvensi harga",
  percent_of_par: "% dari nominal pokok",
  per_unit: "Harga per satuan",
  pricesIncludeAccrued: "Harga sudah termasuk bunga berjalan",
  physical: "Fisik",
  digital: "Digital",
  goldForm: "Bentuk emas",
  purity: "Kadar",
  brand: "Merek / kustodian",
  valuationMethod: "Metode valuasi",
  manual_price: "Harga manual",
  fixed_cost: "Modal tercatat",
  gross: "Nilai transaksi (gross)",
  totalDebit: "Total debit termasuk biaya/pajak",
  estimated: "Estimasi — hasil akhir dihitung server",
  openingNote: "Kepemilikan awal tidak memotong saldo kantong dana.",
  noOrder:
    "Tidak ada order yang dikirim. Ini hanya pencatatan transaksi yang sudah terjadi.",
  fractionRule: "Pecahan mengikuti produk/platform; lot hanya untuk saham IDX.",
  invalidQuantity: "Kuantitas tidak sesuai aturan pasar atau platform.",
  currencyExecution: "Mata uang transaksi",
  optionalPlatform: "Tanpa platform / kustodian",
  savedPosition: "Investasi berhasil dicatat.",

  costUnknown:
    "Modal awal belum diketahui. Modal dan laba/rugi ditampilkan — sampai riwayat biaya dilengkapi. Aset tanpa harga dan tanpa modal tidak masuk total kekayaan.",
  addPlatform: "Tambah akun platform",
  addPocket: "Tambah kantong dana",
  customName: "Nama platform kustom",
  label: "Label akun",
  accountRef: "Nomor akun / kode klien",
  pocketName: "Nama kantong dana",
  pocketKind: "Jenis kantong dana",
  rdn: "RDN",
  crypto: "Dana kripto",
  usd: "Dana USD",
  general: "Umum",
  cancel: "Batal",
  save: "Simpan",
  saving: "Menyimpan…",
  saved: "Catatan berhasil disimpan.",
  failed: "Catatan gagal disimpan. Periksa isian lalu coba lagi.",
  required: "Lengkapi isian wajib dengan nilai yang valid.",
  transferTitle: "Top up dana investasi",
  withdraw: "Tarik dana",
  transferSub: "Catat transfer dari rekening ke kantong platform.",
  transferNote:
    "Transfer bukan pemasukan atau keuntungan. Biaya mengurangi kekayaan.",
  source: "Rekening sumber",
  destination: "Rekening tujuan",
  pocket: "Kantong dana platform",
  sourceAmount: "Total keluar (termasuk biaya)",
  destAmount: "Bersih diterima",
  actualRate: "Kurs aktual (IDR per 1 unit valas)",
  fee: "Biaya aktual",
  date: "Tanggal efektif",
  time: "Waktu (opsional)",
  zone: "Zona waktu",
  before: "Sebelum transfer",
  after: "Setelah transfer",
  summary: "Ringkasan transfer",
  fxUnsupported:
    "Transfer antar dua valas belum didukung. Gunakan rekening IDR.",
  insufficient:
    "Dana tersedia tidak mencukupi. Untuk backdate, saldo diperiksa kembali oleh server.",
  dateOnly:
    "Tanpa waktu berarti awal hari (Asia/Jakarta), sebelum transaksi berjam.",
  currentBalance:
    "Saldo ditampilkan adalah saldo saat ini, bukan saldo historis pada tanggal pilihan.",
  note: "Catatan",
  choose: "Pilih…",
  edit: "Koreksi",
  voidAction: "Batalkan catatan",
  reason: "Alasan koreksi / pembatalan",
  confirmVoid:
    "Batalkan catatan ini? Saldo dan riwayat terkait akan dihitung ulang.",
  status: "Status",
  kind: "Jenis aktivitas",
  transactionValue: "Nilai transaksi",
  quantity: "Kuantitas dasar",
  executionPrice: "Harga eksekusi per satuan",
  tax: "Pajak aktual",
  historyEmpty: "Belum ada aktivitas sesuai filter.",
  transfer: "Transfer dana",
  linkedCash:
    "Arus kas terhubung ke ledger investasi. Koreksi dari catatan investasinya.",
  manageTransfer: "Kelola transaksi kas",
  openingZero:
    "Kantong baru dimulai dari nol. Gunakan top up untuk memindahkan dana.",
};
export const investmentFormsEn: InvestmentFormsCopy = {
  settlementDate: "Settlement date",
  brokerDate: "As confirmed by broker — editable",
  pendingProceeds: "Sale proceeds stay held until the settlement date.",
  netProceeds: "Net sale proceeds",
  remainingHoldings: "Remaining holdings",
  savedTrade: "Investment transaction recorded.",

  proof: "Transaction proof (optional)",
  proofLimit: "Choose JPG, PNG, WEBP or PDF, up to 5 MB.",
  savedProofFailed:
    "Investment saved, but proof upload failed. Add proof from the transaction detail.",
  openTransaction: "Open transaction",
  newPurchase: "New purchase",
  recordingMode: "Recording mode",
  unknownCost: "Opening cost unknown",
  manualInstrument: "Manual instrument (no automatic price feed)",
  instrumentName: "Instrument name",
  ticker: "Ticker / instrument code",
  priceSymbol: "Price provider symbol",
  unit: "Quantity unit",
  principal: "Principal",
  bankName: "Deposit bank",
  ratePct: "Annual interest (%)",
  startDate: "Start date",
  maturityDate: "Maturity date",
  rollover: "Rollover",
  aro: "ARO (principal only)",
  aro_plus: "ARO principal + interest",
  non_aro: "No rollover",
  bondCode: "Bond code / ISIN",
  issuer: "Issuer",
  couponRate: "Annual coupon (%)",
  couponFrequency: "Coupon payments per year",
  priceConvention: "Price convention",
  percent_of_par: "% of par value",
  per_unit: "Price per unit",
  pricesIncludeAccrued: "Price includes accrued interest",
  physical: "Physical",
  digital: "Digital",
  goldForm: "Gold form",
  purity: "Fineness",
  brand: "Brand / custodian",
  valuationMethod: "Valuation method",
  manual_price: "Manual price",
  fixed_cost: "Recorded cost",
  gross: "Gross transaction value",
  totalDebit: "Total debit including fees/taxes",
  estimated: "Estimate — final result calculated by server",
  openingNote: "Opening positions do not debit cash pockets.",
  noOrder:
    "No order is sent. This only records a transaction that already occurred.",
  fractionRule:
    "Fractions depend on the product/platform; lots apply only to IDX shares.",
  invalidQuantity: "Quantity does not follow market or platform rules.",
  currencyExecution: "Execution currency",
  optionalPlatform: "No platform / custodian",
  savedPosition: "Investment recorded.",

  costUnknown:
    "Opening cost is unknown. Cost and profit/loss remain unavailable until cost history is completed. Unpriced assets with unknown cost are excluded from net worth.",
  addPlatform: "Add platform account",
  addPocket: "Add cash pocket",
  customName: "Custom platform name",
  label: "Account label",
  accountRef: "Account reference / client code",
  pocketName: "Cash pocket name",
  pocketKind: "Cash pocket kind",
  rdn: "Securities cash",
  crypto: "Crypto cash",
  usd: "USD cash",
  general: "General",
  cancel: "Cancel",
  save: "Save",
  saving: "Saving…",
  saved: "Record saved.",
  failed: "Could not save. Check the fields and retry.",
  required: "Complete required fields with valid values.",
  transferTitle: "Top up investment funds",
  withdraw: "Withdraw funds",
  transferSub: "Record a transfer from an account to a platform cash pocket.",
  transferNote: "Transfers are not income or gains. Fees reduce net worth.",
  source: "Source account",
  destination: "Destination account",
  pocket: "Platform cash pocket",
  sourceAmount: "Total leaving source (including fee)",
  destAmount: "Net received",
  actualRate: "Actual FX (IDR per foreign unit)",
  fee: "Actual fee",
  date: "Effective date",
  time: "Time (optional)",
  zone: "Time zone",
  before: "Before transfer",
  after: "After transfer",
  summary: "Transfer summary",
  fxUnsupported:
    "Transfers between two foreign currencies are not supported. Use an IDR account.",
  insufficient:
    "Insufficient available funds. Backdated balances are checked again by the server.",
  dateOnly:
    "Without a time, entries count as start of day (Asia/Jakarta), before timed entries.",
  currentBalance:
    "Displayed balances are current balances, not historical balances at the selected date.",
  note: "Note",
  choose: "Choose…",
  edit: "Correct",
  voidAction: "Void record",
  reason: "Correction / void reason",
  confirmVoid:
    "Void this record? Related balances and history will be replayed.",
  status: "Status",
  kind: "Activity kind",
  transactionValue: "Transaction value",
  quantity: "Base quantity",
  executionPrice: "Execution price per unit",
  tax: "Actual tax",
  historyEmpty: "No activity matches the filters.",
  transfer: "Funds transfer",
  linkedCash:
    "Cash movement is linked to the investment ledger. Correct it from the investment record.",
  manageTransfer: "Manage cash transaction",
  openingZero: "New cash pockets start at zero. Use a top-up to move funds.",
};
