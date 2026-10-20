/** Investasi rebuild — Indonesian and English parity. */
export interface InvestasiV3Copy {
  title: string;
  subtitle: string;
  manual: string;
  topUp: string;
  updatePrice: string;
  add: string;
  total: string;
  assetValue: string;
  cash: string;
  capital: string;
  unrealized: string;
  realized: string;
  lastPrice: string;
  incomplete: string;
  unpricedCost: string;
  hiddenCash: string;
  owner: string;
  platform: string;
  type: string;
  market: string;
  currency: string;
  all: string;
  family: string;
  unassigned: string;
  portfolio: string;
  funds: string;
  history: string;
  chart: string;
  chartEmpty: string;
  chartNote: string;
  fxHistory: string;
  search: string;
  sort: string;
  name: string;
  valueHigh: string;
  valueLow: string;
  instrument: string;
  holdings: string;
  average: string;
  price: string;
  value: string;
  pnl: string;
  detail: string;
  actions: string;
  buy: string;
  sell: string;
  opening: string;
  dividend: string;
  coupon: string;
  interest: string;
  corporate_action: string;
  typesTitle: string;
  activity: string;
  allHistory: string;
  empty: string;
  noResults: string;
  error: string;
  retry: string;
  loading: string;
  activityEmpty: string;
  activityError: string;
  previous: string;
  next: string;
  page: string;
  shares: string;
  lembar: string;
  lot: string;
  units: string;
  gram: string;
  perUnit: string;
  noPrice: string;
  stale: string;
  days: string;
  costBasis: string;
  completeMarket: string;
  legacy: string;
  weighted: string;
  available: string;
  held: string;
  recorded: string;
  saham: string;
  reksa_dana: string;
  obligasi: string;
  emas: string;
  kripto: string;
  deposito: string;
  lainnya: string;
  pending: string;
  settled: string;
  void: string;
  noFunds: string;
  priceSource: string;
  displayFx: string;
  unavailableFx: string;
  futureTask: string;
  colDate: string;
  colKind: string;
  colAmount: string;
  colStatus: string;
}
export const investasiV3Id: InvestasiV3Copy = {
  title: "Investasi",
  subtitle: "Pantau aset dan dana investasi per akun.",
  manual: "Pencatatan manual",
  topUp: "Top up dana",
  updatePrice: "Update harga",
  add: "Tambah investasi",
  total: "Total investasi",
  assetValue: "Nilai aset",
  cash: "Kas platform",
  capital: "Modal aset tersisa",
  unrealized: "Laba/rugi belum terealisasi",
  realized: "Laba/rugi terealisasi",
  lastPrice: "Harga terakhir",
  incomplete:
    "Valuasi belum lengkap. Aset tanpa harga tidak masuk nilai pasar; total kekayaan memakai modal tersisa.",
  unpricedCost: "Modal aset tanpa harga",
  hiddenCash: "Sebagian saldo kantong disembunyikan; total kas belum lengkap.",
  owner: "Pemilik akun",
  platform: "Akun platform",
  type: "Jenis aset",
  market: "Pasar",
  currency: "Mata uang tampilan",
  all: "Semua",
  family: "Keluarga (bersama)",
  unassigned: "Belum ditautkan",
  portfolio: "Portofolio",
  funds: "Dana platform",
  history: "Riwayat",
  chart: "Nilai portofolio",
  chartEmpty: "Belum ada dua titik valuasi nyata yang lengkap untuk grafik.",
  chartNote:
    "Nilai aset dalam IDR dari transaksi dan harga tersimpan; tidak termasuk kas platform.",
  fxHistory:
    "Grafik belum mencakup posisi valas karena kurs historis belum tersedia.",
  search: "Cari instrumen atau ticker…",
  sort: "Urutan",
  name: "Nama instrumen",
  valueHigh: "Nilai tertinggi",
  valueLow: "Nilai terendah",
  instrument: "Instrumen",
  holdings: "Kepemilikan",
  average: "Harga rata-rata",
  price: "Harga pasar",
  value: "Nilai pasar",
  pnl: "Laba/rugi",
  detail: "Lihat detail",
  actions: "Aksi investasi",
  buy: "Catat beli",
  sell: "Catat jual",
  opening: "Kepemilikan awal",
  dividend: "Dividen",
  coupon: "Kupon",
  interest: "Bunga",
  corporate_action: "Aksi korporasi",
  typesTitle: "Jenis investasi",
  activity: "Aktivitas investasi terbaru",
  allHistory: "Lihat semua riwayat",
  empty:
    "Belum ada investasi. Catat kepemilikan awal atau pembelian pertama Anda.",
  noResults: "Tidak ada investasi sesuai filter.",
  error: "Data investasi gagal dimuat.",
  retry: "Coba lagi",
  loading: "Memuat investasi…",
  activityEmpty: "Belum ada aktivitas investasi.",
  activityError: "Riwayat aktivitas gagal dimuat.",
  previous: "Sebelumnya",
  next: "Berikutnya",
  page: "Halaman",
  shares: "shares",
  lembar: "lembar",
  lot: "lot",
  units: "unit",
  gram: "gram",
  perUnit: "per satuan",
  noPrice: "Harga belum tersedia",
  stale: "Harga lama",
  days: "hari",
  costBasis: "Dinilai dari modal",
  completeMarket: "Lengkapi pasar",
  legacy: "Dari data lama — lengkapi riwayat",
  weighted: "Metode modal: rata-rata tertimbang, termasuk biaya pembelian.",
  available: "Dana tersedia",
  held: "Dana tertahan",
  recorded: "Kas tercatat",
  saham: "Saham",
  reksa_dana: "Reksa Dana",
  obligasi: "Obligasi",
  emas: "Emas",
  kripto: "Kripto",
  deposito: "Deposito",
  lainnya: "Lainnya",
  pending: "Menunggu penyelesaian",
  settled: "Selesai",
  void: "Dibatalkan",
  noFunds: "Belum ada kantong dana platform.",
  priceSource: "Sumber harga",
  displayFx: "Kurs tampilan",
  unavailableFx: "Kurs tampilan belum tersedia.",
  futureTask: "Form ini sedang diperbarui.",
  colDate: "Tanggal",
  colKind: "Jenis",
  colAmount: "Jumlah",
  colStatus: "Status",
};
export const investasiV3En: InvestasiV3Copy = {
  title: "Investments",
  subtitle: "Track assets and investment cash by account.",
  manual: "Manual recording",
  topUp: "Top up funds",
  updatePrice: "Update prices",
  add: "Add investment",
  total: "Total investments",
  assetValue: "Asset value",
  cash: "Platform cash",
  capital: "Remaining asset cost",
  unrealized: "Unrealized profit/loss",
  realized: "Realized profit/loss",
  lastPrice: "Latest price",
  incomplete:
    "Valuation is incomplete. Unpriced assets are excluded from market totals; net worth uses remaining cost.",
  unpricedCost: "Unpriced asset cost",
  hiddenCash: "Some pocket balances are hidden; cash totals are incomplete.",
  owner: "Account owner",
  platform: "Platform account",
  type: "Asset type",
  market: "Market",
  currency: "Display currency",
  all: "All",
  family: "Family (shared)",
  unassigned: "Unlinked",
  portfolio: "Portfolio",
  funds: "Platform funds",
  history: "History",
  chart: "Portfolio value",
  chartEmpty: "Not enough complete, real valuation points to draw a chart.",
  chartNote:
    "Asset values in IDR from transactions and stored prices; excludes platform cash.",
  fxHistory:
    "Foreign positions cannot be charted until historical FX is available.",
  search: "Search instrument or ticker…",
  sort: "Sort",
  name: "Instrument name",
  valueHigh: "Highest value",
  valueLow: "Lowest value",
  instrument: "Instrument",
  holdings: "Holdings",
  average: "Average price",
  price: "Market price",
  value: "Market value",
  pnl: "Profit/loss",
  detail: "View details",
  actions: "Investment actions",
  buy: "Record purchase",
  sell: "Record sale",
  opening: "Opening position",
  dividend: "Dividend",
  coupon: "Coupon",
  interest: "Interest",
  corporate_action: "Corporate action",
  typesTitle: "Investment types",
  activity: "Recent investment activity",
  allHistory: "View all history",
  empty:
    "No investments yet. Record an opening position or your first purchase.",
  noResults: "No investments match your filters.",
  error: "Could not load investments.",
  retry: "Try again",
  loading: "Loading investments…",
  activityEmpty: "No investment activity yet.",
  activityError: "Could not load activity.",
  previous: "Previous",
  next: "Next",
  page: "Page",
  shares: "shares",
  lembar: "shares",
  lot: "lots",
  units: "units",
  gram: "grams",
  perUnit: "per unit",
  noPrice: "Price unavailable",
  stale: "Stale price",
  days: "days",
  costBasis: "Valued at cost",
  completeMarket: "Complete market details",
  legacy: "From legacy data — complete history",
  weighted: "Cost method: weighted average, including purchase fees.",
  available: "Available funds",
  held: "Held funds",
  recorded: "Recorded cash",
  saham: "Stocks",
  reksa_dana: "Mutual funds",
  obligasi: "Bonds",
  emas: "Gold",
  kripto: "Crypto",
  deposito: "Term deposits",
  lainnya: "Other",
  pending: "Awaiting settlement",
  settled: "Completed",
  void: "Voided",
  noFunds: "No platform cash pockets yet.",
  priceSource: "Price source",
  displayFx: "Display FX",
  unavailableFx: "Display FX is unavailable.",
  futureTask: "This form is being updated.",
  colDate: "Date",
  colKind: "Type",
  colAmount: "Amount",
  colStatus: "Status",
};
