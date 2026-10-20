/**
 * Copy for the top-up / withdraw dialog's empty states. Kept out of
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
};

export function pocketTransferCopy(locale: string): Copy {
  return locale === "en" ? EN : ID;
}
