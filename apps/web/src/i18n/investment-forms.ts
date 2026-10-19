export interface InvestmentFormsCopy {
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
