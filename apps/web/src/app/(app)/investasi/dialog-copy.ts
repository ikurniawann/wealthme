/**
 * Copy for the shared investment dialog shell and the dialogs migrated onto
 * it (complete holding data, income / corporate action, ledger correction /
 * void, add platform / pocket) — 2026-10-20 polish. Kept beside the forms,
 * like trade-copy.ts; Indonesian first, English parity.
 */
const ID = {
  close: "Tutup",
  // complete holding data ("Lengkapi data kepemilikan")
  metaSub: "Pasar dan platform untuk data kepemilikan lama.",
  metaWhy:
    "Data lama yang belum memiliki pasar atau platform harus dilengkapi sebelum mencatat transaksi baru.",
  metaKeeps:
    "Kuantitas, modal, dan riwayat transaksi tidak berubah — hanya label kepemilikan yang dilengkapi.",
  identity: "Identitas",
  marketPlatform: "Pasar & platform",
  priceSource: "Sumber harga",
  nameHint: "Nama yang tampil di portofolio dan laporan.",
  ownerHint: "Siapa yang memegang akun ini.",
  ownerLocked: "Hanya pemilik utama atau pasangan yang dapat mengubah pemilik.",
  marketHint: "Menentukan bursa dan mata uang instrumen.",
  currencyChip: (cur: string) => `Mata uang transaksi: ${cur}`,
  currencyHint: (cur: string) =>
    `Mata uang ${cur} mengikuti catatan lama dan tidak dapat diubah.`,
  platformHint: "Sekuritas, bank, atau aplikasi tempat aset disimpan.",
  platformAny: "Semua platform",
  pocketHint:
    "Kantong dana yang dipakai untuk beli/jual dan menerima dividen berikutnya.",
  symbolHint: "Contoh: BBCA.JK atau AAPL. Kosongkan bila tidak ada.",
  // income / corporate action
  incomeSub: (name: string) => `Dividen, kupon, atau bunga untuk ${name}.`,
  corporateSub: (name: string) =>
    `Pemecahan, penggabungan, atau bonus saham ${name}.`,
  incomeSec: "Pendapatan",
  changeSec: "Perubahan kuantitas",
  whenSec: "Waktu & catatan",
  amountsSec: "Jumlah",
  pocketIncomeHint: "Dana masuk ke kantong ini.",
  noteHint: "Contoh: stock split 1:5 per 12 Juni.",
  timeHint: "Asia/Jakarta (WIB)",
  saveIncome: "Simpan pendapatan",
  saveCorporate: "Simpan aksi korporasi",
  // ledger correction / void
  correctSub: "Ubah angka catatan; saldo dan riwayat dihitung ulang.",
  voidSub: "Catatan tetap tersimpan sebagai batal, tidak dihapus.",
  whenWhat: "Waktu & nilai",
  costs: "Biaya & pajak",
  why: "Alasan",
  reasonHint: "Tersimpan di jejak audit catatan ini.",
  saveCorrection: "Simpan koreksi",
  zoneOf: (zone: string) => `Zona waktu: ${zone}`,
  // add platform / pocket
  platformSub: "Catat akun investasi dan kantong dana pertamanya.",
  pocketSub: (name: string) => `Kantong dana baru di ${name}.`,
  platformSec: "Akun platform",
  firstPocketSec: "Kantong dana pertama",
  pocketSec: "Kantong dana",
  labelHint: "Contoh: Ajaib — Bapak.",
  refHint: "Opsional, untuk mencocokkan laporan platform.",
  currencyLocked: "Mata uang mengikuti jenis kantong dana.",
};

type DialogCopy = typeof ID;

const EN: DialogCopy = {
  close: "Close",
  metaSub: "Market and platform for a legacy holding.",
  metaWhy:
    "Legacy holdings without a market or platform must be completed before new transactions can be recorded.",
  metaKeeps:
    "Quantities, cost basis, and transaction history stay unchanged — only the ownership labels are completed.",
  identity: "Identity",
  marketPlatform: "Market & platform",
  priceSource: "Price source",
  nameHint: "The name shown in the portfolio and reports.",
  ownerHint: "Who holds this account.",
  ownerLocked: "Only the primary owner or spouse can change the owner.",
  marketHint: "Sets the exchange and the instrument currency.",
  currencyChip: (cur: string) => `Transaction currency: ${cur}`,
  currencyHint: (cur: string) =>
    `${cur} comes from the original records and cannot be changed.`,
  platformHint: "The broker, bank, or app that holds the asset.",
  platformAny: "All platforms",
  pocketHint: "The cash pocket used for future buys/sells and dividends.",
  symbolHint: "For example BBCA.JK or AAPL. Leave empty if none.",
  incomeSub: (name: string) => `Dividend, coupon, or interest for ${name}.`,
  corporateSub: (name: string) =>
    `A split, reverse split, or bonus for ${name}.`,
  incomeSec: "Income",
  changeSec: "Quantity change",
  whenSec: "Date & note",
  amountsSec: "Amounts",
  pocketIncomeHint: "The money lands in this pocket.",
  noteHint: "For example: 1:5 stock split on 12 June.",
  timeHint: "Asia/Jakarta (WIB)",
  saveIncome: "Save income",
  saveCorporate: "Save corporate action",
  correctSub: "Change the entry; balances and history are recalculated.",
  voidSub: "The entry stays on record as voided; it is not deleted.",
  whenWhat: "Date & value",
  costs: "Fees & tax",
  why: "Reason",
  reasonHint: "Kept in this entry's audit trail.",
  saveCorrection: "Save correction",
  zoneOf: (zone: string) => `Time zone: ${zone}`,
  platformSub: "Record an investment account and its first cash pocket.",
  pocketSub: (name: string) => `A new cash pocket at ${name}.`,
  platformSec: "Platform account",
  firstPocketSec: "First cash pocket",
  pocketSec: "Cash pocket",
  labelHint: "For example: Ajaib — Dad.",
  refHint: "Optional, to match the platform's statements.",
  currencyLocked: "The currency follows the pocket type.",
};

export function dialogCopy(locale: string): DialogCopy {
  return locale === "en" ? EN : ID;
}
