/**
 * Extra copy for the "Update harga" dialog (Task 33 polish). The base strings
 * stay in i18n/investment-prices.ts; these cover the new layout (tabs, status
 * chips, summary + preview cards, feed outcomes) and keep id/en parity here.
 */
const ID = {
  close: "Tutup",
  done: "Selesai",
  platform: "Akun platform",
  allPlatforms: "Semua platform",
  unlinked: "Belum ditautkan ke platform",
  instrumentCount: (n: number) => `${n} instrumen`,
  noPlatforms: "Belum ada akun platform. Tambahkan dari tab Dana platform.",
  noPlatformsShort: "Belum ada akun platform",
  unit: "Satuan harga",
  instrument: "Instrumen",
  result: "Hasil",
  storedPrice: "Harga tersimpan",
  stale: (days: number) => `Kedaluwarsa · ${days} hari`,
  noPrice: "Belum ada harga",
  ready: "Siap",
  empty: "Belum diisi",
  willUpdate: "Akan diperbarui",
  saved: "Tersimpan",
  skipped: "Dilewati",
  failed: "Gagal",
  bulkSource: "Sumber untuk semua baris",
  bulkSourceKeep: "Atur per baris",
  referenceUrl: "Tautan atau nomor referensi",
  referenceHint: "Disimpan bersama setiap harga yang diperbarui.",
  proof: "Unggah bukti (opsional)",
  chooseFile: "Pilih file",
  proofTypes: "PNG, JPG, WEBP, atau PDF (maks. 5 MB)",
  summaryTitle: "Ringkasan perubahan",
  summaryDraft: (filled: number, empty: number) =>
    `${filled} harga diisi, ${empty} dibiarkan kosong`,
  summaryResult: (updated: number, skipped: number, failed: number) =>
    `${updated} harga diperbarui, ${skipped} dilewati${failed ? `, ${failed} gagal` : ""}`,
  summaryNote:
    "Hanya harga yang diisi dan berbeda yang diperbarui. Transaksi, modal, dan saldo kas tidak berubah.",
  summaryStale:
    "Isian berubah sejak pratinjau — pratinjau ulang sebelum menyimpan.",
  fxTitle: "Kurs valuasi",
  fxOptional: "(informasi)",
  fxNone: "Semua instrumen di pilihan ini dalam Rupiah.",
  previewTitle: "Pratinjau perubahan",
  previewHint: "Dampak pada valuasi portofolio sebelum disimpan.",
  previewEmpty:
    "Isi minimal satu harga baru, lalu tekan “Pratinjau perubahan”.",
  previousValue: "Nilai sebelumnya",
  newValue: "Nilai baru",
  impact: "Selisih",
  impactNote: "dampak ke kekayaan bersih",
  unpricedBefore: "Belum dinilai pasar",
  blankKept: (n: number) =>
    `${n} harga dibiarkan kosong — harga sebelumnya tetap dipakai, bukan nol.`,
  feedNoAuto:
    "Tidak ada instrumen dengan sumber data otomatis di pilihan ini. Saham dan kripto yang terhubung ke bursa bisa diperbarui otomatis; jenis lain memakai input manual.",
  feedIdle:
    "Belum dicek. Tekan “Perbarui dari sumber data” untuk mengambil harga terbaru.",
  feedOk: "Sumber merespons",
  feedFailed: "Sumber data gagal merespons",
  feedNoRoute: "Sumber data tidak tersedia untuk instrumen ini",
  feedManual: "Tidak ada sumber otomatis — pakai input manual",
  feedSimulated: "Harga simulasi diabaikan",
  feedUnchanged: "Harga tersimpan masih yang terbaru",
  feedSummary: (updated: number, skipped: number, failed: number) =>
    `${updated} diperbarui, ${skipped} dilewati, ${failed} gagal`,
  checkedAt: "dicek",
};

type Copy = typeof ID;

const EN: Copy = {
  close: "Close",
  done: "Done",
  platform: "Platform account",
  allPlatforms: "All platforms",
  unlinked: "Not linked to a platform",
  instrumentCount: (n: number) => `${n} instrument${n === 1 ? "" : "s"}`,
  noPlatforms: "No platform accounts yet. Add one from the Platform funds tab.",
  noPlatformsShort: "No platform accounts yet",
  unit: "Price unit",
  instrument: "Instrument",
  result: "Result",
  storedPrice: "Stored price",
  stale: (days: number) => `Stale · ${days} days`,
  noPrice: "No price yet",
  ready: "Ready",
  empty: "Not entered",
  willUpdate: "Will update",
  saved: "Saved",
  skipped: "Skipped",
  failed: "Failed",
  bulkSource: "Source for every row",
  bulkSourceKeep: "Set per row",
  referenceUrl: "Link or reference number",
  referenceHint: "Stored with every updated price.",
  proof: "Upload evidence (optional)",
  chooseFile: "Choose file",
  proofTypes: "PNG, JPG, WEBP or PDF (max. 5 MB)",
  summaryTitle: "Change summary",
  summaryDraft: (filled: number, empty: number) =>
    `${filled} prices entered, ${empty} left blank`,
  summaryResult: (updated: number, skipped: number, failed: number) =>
    `${updated} prices updated, ${skipped} skipped${failed ? `, ${failed} failed` : ""}`,
  summaryNote:
    "Only entered prices that differ are updated. Transactions, cost and cash balances do not change.",
  summaryStale:
    "Entries changed since the preview — preview again before saving.",
  fxTitle: "Valuation FX",
  fxOptional: "(information)",
  fxNone: "Every instrument in this selection is in rupiah.",
  previewTitle: "Preview changes",
  previewHint: "The effect on portfolio valuation before saving.",
  previewEmpty: "Enter at least one new price, then press “Preview changes”.",
  previousValue: "Previous value",
  newValue: "New value",
  impact: "Difference",
  impactNote: "effect on net worth",
  unpricedBefore: "Not market-valued yet",
  blankKept: (n: number) =>
    `${n} prices left blank — the previous price stays, never zero.`,
  feedNoAuto:
    "No instrument in this selection has an automated data source. Listed equities and crypto refresh automatically; other types use manual entry.",
  feedIdle:
    "Not checked yet. Press “Refresh from data sources” to fetch the latest prices.",
  feedOk: "Source responded",
  feedFailed: "The data source did not respond",
  feedNoRoute: "No data source for this instrument",
  feedManual: "No automated source — use manual entry",
  feedSimulated: "Simulated price ignored",
  feedUnchanged: "The stored price is still the latest",
  feedSummary: (updated: number, skipped: number, failed: number) =>
    `${updated} updated, ${skipped} skipped, ${failed} failed`,
  checkedAt: "checked",
};

export function priceCopy(locale: string): Copy {
  return locale === "en" ? EN : ID;
}
export type PriceCopy = Copy;
