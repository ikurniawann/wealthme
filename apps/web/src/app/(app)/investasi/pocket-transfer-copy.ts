/**
 * Copy for the top-up / withdraw dialog's empty states, amount fields and
 * field-level errors. Kept out of
 * i18n/investasi-v3.ts so this hotfix stays a self-contained set of files.
 */
const ID = {
  noPocketTitle: "Belum ada kantong dana platform",
  noPocketBody:
    "Top up memindahkan dana dari rekening ke kantong dana di platform investasi. Buat kantongnya dulu — setelah disimpan, kantong langsung terpilih di sini.",
  noPocketReadOnly:
    "Belum ada kantong dana yang bisa Anda pakai. Minta Master keluarga menambahkan platform dan kantong dananya.",
  addPocketTo: (platform: string) => `Tambah kantong di ${platform}`,
  addPlatformPocket: "Tambah platform & kantong",
  noBankTitle: "Belum ada rekening yang bisa dipakai",
  noBankBody:
    "Hanya rekening bank, kas, atau e-wallet aktif yang boleh Anda catat yang bisa menjadi sumber atau tujuan dana.",
  addBank: "Kelola rekening",
  available: "tersedia",
  firstPocket: "Kantong dana pertama",
  withdrawSub: "Catat transfer dari kantong platform kembali ke rekening.",
  landedPocket: "Jumlah masuk ke kantong",
  landedAccount: "Jumlah masuk ke rekening",
  sentAccount: "Jumlah dikirim dari rekening (tanpa biaya)",
  sentPocket: "Jumlah dikirim dari kantong (tanpa biaya)",
  fee: "Biaya admin (opsional)",
  feeHint:
    "Isi hanya bila bank atau platform menagih biaya. Biaya dicatat sebagai pengeluaran terpisah, tidak memotong jumlah di atas.",
  totalOutAccount: "Total keluar dari rekening",
  totalOutPocket: "Total keluar dari kantong",
  totalFormula: "jumlah + biaya",
  summaryFee: "Biaya admin (pengeluaran)",
  noFee: "Tanpa biaya",
  errors: {
    chooseBank: "Pilih rekening.",
    choosePocket: "Pilih kantong dana.",
    sentRequired: "Jumlah dikirim wajib diisi.",
    amountRequired: "Jumlah wajib diisi.",
    rateRequired: "Kurs wajib diisi.",
    feeTooHigh: "Biaya tidak boleh sama dengan atau melebihi jumlah transfer.",
    insufficientAccount: (available: string) =>
      `Saldo rekening sumber tidak cukup (tersedia ${available}).`,
    insufficientPocket: (available: string) =>
      `Saldo kantong tidak cukup (tersedia ${available}).`,
  },
  errorSummary: (n: number) =>
    n === 1
      ? "1 isian perlu diperbaiki — lihat pesan merah di atas."
      : `${n} isian perlu diperbaiki — lihat pesan merah di atas.`,
  fxUnavailable: "Kurs belum tersedia. Tunggu sebentar lalu coba lagi.",
};

type Copy = typeof ID;

const EN: Copy = {
  noPocketTitle: "No platform cash pocket yet",
  noPocketBody:
    "A top up moves money from an account into a cash pocket at an investment platform. Create the pocket first — once saved it is selected here automatically.",
  noPocketReadOnly:
    "There is no cash pocket you can use yet. Ask the family Master to add the platform and its cash pocket.",
  addPocketTo: (platform: string) => `Add a pocket at ${platform}`,
  addPlatformPocket: "Add platform & pocket",
  noBankTitle: "No usable account yet",
  noBankBody:
    "Only active bank, cash or e-wallet accounts you may record on can be the source or destination.",
  addBank: "Manage accounts",
  available: "available",
  firstPocket: "First cash pocket",
  withdrawSub: "Record a transfer from a platform pocket back to an account.",
  landedPocket: "Amount into the pocket",
  landedAccount: "Amount into the account",
  sentAccount: "Amount sent from the account (excl. fee)",
  sentPocket: "Amount sent from the pocket (excl. fee)",
  fee: "Admin fee (optional)",
  feeHint:
    "Fill in only when the bank or platform charged a fee. It is recorded as a separate expense and never reduces the amount above.",
  totalOutAccount: "Total out of the account",
  totalOutPocket: "Total out of the pocket",
  totalFormula: "amount + fee",
  summaryFee: "Admin fee (expense)",
  noFee: "No fee",
  errors: {
    chooseBank: "Choose an account.",
    choosePocket: "Choose a cash pocket.",
    sentRequired: "Enter the amount sent.",
    amountRequired: "Enter the amount.",
    rateRequired: "Enter the rate.",
    feeTooHigh: "The fee cannot equal or exceed the transfer amount.",
    insufficientAccount: (available: string) =>
      `Not enough balance in the source account (available ${available}).`,
    insufficientPocket: (available: string) =>
      `Not enough balance in the pocket (available ${available}).`,
  },
  errorSummary: (n: number) =>
    n === 1
      ? "1 field needs fixing — see the red message above."
      : `${n} fields need fixing — see the red messages above.`,
  fxUnavailable: "The exchange rate is not available yet. Try again shortly.",
};

export function pocketTransferCopy(locale: string): Copy {
  return locale === "en" ? EN : ID;
}
