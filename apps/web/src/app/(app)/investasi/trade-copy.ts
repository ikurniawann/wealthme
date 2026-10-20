/**
 * Copy for the add-investment drawer and the buy/sell dialog (2026-10-20
 * polish). Kept beside the forms, like pocket-transfer-copy.ts, so this fix
 * stays a self-contained set of files; Indonesian first, English parity.
 */
const ID = {
  close: "Tutup",
  addSub: "Pilih jenis aset dan cara pencatatan.",
  typeHint: "Isian menyesuaikan jenis aset yang dipilih.",
  newPurchaseDesc:
    "Menambahkan transaksi pembelian dan mengurangi saldo kantong dana platform.",
  openingDesc:
    "Mencatat aset yang sudah dimiliki. Tidak memotong saldo kantong dana.",
  detail: "Detail transaksi",
  instrument: "Instrumen",
  costs: "Biaya, bukti & catatan",
  buyTitle: "Catat pembelian",
  sellTitle: "Catat penjualan",
  buySub: "Catat pembelian aset untuk portofolio. Bukan perintah order.",
  sellSub: "Catat penjualan aset untuk portofolio. Bukan perintah order.",
  saveInvestment: "Simpan investasi",
  saveBuy: "Simpan pembelian",
  saveSell: "Simpan penjualan",
  buySummary: "Ringkasan pembelian",
  sellSummary: "Ringkasan penjualan",
  openingSummary: "Ringkasan kepemilikan awal",
  holdingNow: "Kepemilikan saat ini",
  fundsAfter: "Saldo setelah transaksi",
  fundsAfterSell: "Saldo setelah dana masuk",
  totalDebit: "Total debit",
  account: "Akun",
  quantityBuy: "Jumlah beli",
  quantitySell: "Jumlah jual",
  lotRule: "1 lot = 100 lembar (IDX)",
  perLembar: "per lembar",
  perShare: "per share",
  perUnit: "per unit",
  equals: (value: string, unit: string) => `= ${value} ${unit}`,
  pocketIn: (platform: string) => `di ${platform}`,
  choosePlatformFirst:
    "Pilih akun platform dulu — kantong dananya muncul di sini.",
  noPocketTitle: (currency: string) =>
    `Belum ada kantong dana ${currency} di platform ini`,
  noPlatformTitle: "Belum ada akun platform",
  noPocketBody:
    "Pembelian memotong kantong dana platform dan hasil penjualan masuk ke sana. Buat kantongnya dulu — setelah disimpan, kantong langsung terpilih di sini.",
  noPocketReadOnly:
    "Belum ada kantong dana yang bisa Anda pakai. Minta Master keluarga menambahkan platform dan kantong dananya.",
  addPocketTo: (platform: string) => `Tambah kantong di ${platform}`,
  addPlatformPocket: "Tambah platform & kantong",
  conflictFunds: (at: string, needed: string, available: string) =>
    `Dana tersedia tidak mencukupi pada ${at}: dibutuhkan ${needed}, tersedia ${available}. Top up kantong atau ubah tanggal/nominal.`,
  conflictHoldings: (at: string, needed: string, available: string) =>
    `Kepemilikan tidak mencukupi pada ${at}: dijual ${needed}, dimiliki ${available}.`,
  conflictHistory:
    "Perubahan ini membuat saldo atau kepemilikan negatif pada transaksi berikutnya. Lengkapi riwayat atau ubah transaksi yang terdampak.",
  dateOnlyFunds:
    "Tanpa waktu, transaksi dicatat di awal hari — sebelum top up berjam pada tanggal yang sama. Isi waktu transaksi bila dana baru masuk hari itu.",
  fractionAllowed: "Pecahan diizinkan oleh platform ini.",
  wholeOnly: "Hanya bilangan bulat untuk platform/pasar ini.",
};

type Copy = typeof ID;

const EN: Copy = {
  close: "Close",
  addSub: "Choose the asset type and how to record it.",
  typeHint: "Fields adapt to the selected asset type.",
  newPurchaseDesc:
    "Adds a purchase transaction and reduces the platform cash pocket.",
  openingDesc:
    "Records an asset you already own. Does not debit any cash pocket.",
  detail: "Transaction details",
  instrument: "Instrument",
  costs: "Costs, proof & note",
  buyTitle: "Record a purchase",
  sellTitle: "Record a sale",
  buySub: "Record an asset purchase for the portfolio. Not an order.",
  sellSub: "Record an asset sale for the portfolio. Not an order.",
  saveInvestment: "Save investment",
  saveBuy: "Save purchase",
  saveSell: "Save sale",
  buySummary: "Purchase summary",
  sellSummary: "Sale summary",
  openingSummary: "Opening position summary",
  holdingNow: "Current holding",
  fundsAfter: "Balance after transaction",
  fundsAfterSell: "Balance after proceeds",
  totalDebit: "Total debit",
  account: "Account",
  quantityBuy: "Quantity bought",
  quantitySell: "Quantity sold",
  lotRule: "1 lot = 100 shares (IDX)",
  perLembar: "per share",
  perShare: "per share",
  perUnit: "per unit",
  equals: (value: string, unit: string) => `= ${value} ${unit}`,
  pocketIn: (platform: string) => `at ${platform}`,
  choosePlatformFirst:
    "Choose a platform account first — its cash pockets appear here.",
  noPocketTitle: (currency: string) =>
    `No ${currency} cash pocket at this platform yet`,
  noPlatformTitle: "No platform account yet",
  noPocketBody:
    "A purchase debits a platform cash pocket and sale proceeds land there. Create the pocket first — once saved it is selected here automatically.",
  noPocketReadOnly:
    "There is no cash pocket you can use yet. Ask the family Master to add the platform and its cash pocket.",
  addPocketTo: (platform: string) => `Add a pocket at ${platform}`,
  addPlatformPocket: "Add platform & pocket",
  conflictFunds: (at: string, needed: string, available: string) =>
    `Not enough available funds on ${at}: needs ${needed}, available ${available}. Top up the pocket or change the date/amount.`,
  conflictHoldings: (at: string, needed: string, available: string) =>
    `Not enough holdings on ${at}: selling ${needed}, holding ${available}.`,
  conflictHistory:
    "This change makes a balance or holding negative on a later transaction. Complete the history or change the affected transaction.",
  dateOnlyFunds:
    "Without a time the entry sits at the start of the day — before any timed top up that day. Add the transaction time if the funds arrived that day.",
  fractionAllowed: "This platform allows fractional quantities.",
  wholeOnly: "Whole quantities only for this platform/market.",
};

export function tradeCopy(locale: string): Copy {
  return locale === "en" ? EN : ID;
}
export type TradeCopy = Copy;
