/**
 * Aset v3 copy — the "Aset Saya" overview page (Task 19). Lives in its own
 * module (wired into id.ts / en.ts as `aset.v3`); the dictionary parity test
 * still checks both locales key by key.
 */
import { asetDetailEn, asetDetailId } from "./aset-detail";
import type { AsetDetailCopy } from "./aset-detail";

export interface AsetV3Copy {
  title: string;
  subtitle: string;
  updateValue: string;
  addAsset: string;
  // summary
  totalLabel: string;
  grossNote: string;
  classes: {
    dana_rekening: string;
    investasi: string;
    aset_fisik: string;
    polis_asuransi: string;
    lainnya: string;
  };
  asOf: string;
  currency: string;
  scopeAll: string;
  scopeFiltered: string;
  incomplete: string;
  costIncluded: string;
  netWorth: string;
  netWorthNote: string;
  netWorthUnavailable: string;
  summaryAria: string;
  // filters
  search: string;
  type: string;
  all: string;
  owner: string;
  valueRange: string;
  min: string;
  max: string;
  qtyRange: string;
  unit: string;
  unitFirst: string;
  acquired: string;
  from: string;
  to: string;
  status: string;
  statuses: { active: string; sold: string; archived: string };
  completeness: string;
  complete: string;
  incompleteOption: string;
  sort: string;
  sorts: {
    value_desc: string;
    value_asc: string;
    name_asc: string;
    acquired_desc: string;
  };
  reset: string;
  moreFilters: string;
  fewerFilters: string;
  activeFilters: string;
  removeFilter: string;
  filtersAria: string;
  // tabs
  tabAll: string;
  tabsAria: string;
  // table
  colAsset: string;
  colType: string;
  colOwner: string;
  colPlace: string;
  colQty: string;
  colAcquired: string;
  colValue: string;
  colChange: string;
  colActions: string;
  shared: string;
  multiple: string;
  firstOn: string;
  basis: {
    market: string;
    manual: string;
    stale: string;
    cost_basis: string;
    unpriced: string;
    failed: string;
    zero_valid: string;
  };
  notValued: string;
  totalUsesCost: string;
  noComparison: string;
  vsDate: string;
  up: string;
  down: string;
  flat: string;
  sourceInvestasi: string;
  sourceRekening: string;
  closed: string;
  duplicate: string;
  rowMenu: string;
  viewDetail: string;
  edit: string;
  archive: string;
  // pagination
  prev: string;
  next: string;
  pageOf: string;
  showing: string;
  paginationAria: string;
  // states
  empty: string;
  emptyCta: string;
  noResults: string;
  loadError: string;
  retry: string;
  loading: string;
  // activity
  activityTitle: string;
  activitySub: string;
  activityEmpty: string;
  activityWhen: string;
  activityAsset: string;
  activityKind: string;
  activityDetail: string;
  activityImpact: string;
  activityKinds: {
    opening: string;
    valuation: string;
    correction: string;
    buy: string;
    sell: string;
    quantity_change: string;
  };
  dateOnly: string;
  voided: string;
  // archive
  archiveTitle: string;
  archiveBody: string;
  archiveConfirm: string;
  archived: string;
  archiveFailed: string;
  // update value picker
  pickTitle: string;
  pickBody: string;
  pickNone: string;
  // asset form additions
  formUnit: string;
  formUnitPh: string;
  formModel: string;
  formModelTotal: string;
  formModelPerUnit: string;
  formModelHint: string;
  formCode: string;
  formCodePh: string;
  formCustodian: string;
  formCustodianPh: string;
  formLoadError: string;
  // detail page + drawers (Task 20)
  detail: AsetDetailCopy;
}

export const asetV3Id: AsetV3Copy = {
  title: "Aset Saya",
  subtitle: "Seluruh aset, sumber nilai, dan kepemilikan dalam satu tempat.",
  updateValue: "Update nilai",
  addAsset: "Tambah aset",
  totalLabel: "Total aset",
  grossNote: "Aset bruto • Liabilitas ditampilkan terpisah",
  classes: {
    dana_rekening: "Dana & rekening",
    investasi: "Investasi",
    aset_fisik: "Aset fisik",
    polis_asuransi: "Polis asuransi",
    lainnya: "Lainnya",
  },
  asOf: "Semua nilai per {date}",
  currency: "Mata uang: {currency}",
  scopeAll: "Ringkasan mencakup seluruh aset",
  scopeFiltered: "Ringkasan mengikuti filter",
  incomplete: "Total belum lengkap: ada aset yang belum dinilai.",
  costIncluded: "{amount} di total memakai biaya perolehan.",
  netWorth: "Kekayaan bersih",
  netWorthNote: "Seluruh aset − liabilitas {amount}, tidak mengikuti filter",
  netWorthUnavailable: "Tidak tersedia untuk akses Anda",
  summaryAria: "Ringkasan aset",
  search: "Cari aset…",
  type: "Tipe aset",
  all: "Semua",
  owner: "Pemilik",
  valueRange: "Rentang nilai (Rp)",
  min: "Min",
  max: "Maks",
  qtyRange: "Rentang kuantitas",
  unit: "Satuan",
  unitFirst: "Isi satuan dulu",
  acquired: "Tanggal perolehan",
  from: "Dari",
  to: "Sampai",
  status: "Status",
  statuses: { active: "Aktif", sold: "Terjual", archived: "Diarsipkan" },
  completeness: "Kelengkapan valuasi",
  complete: "Lengkap",
  incompleteOption: "Belum lengkap",
  sort: "Urutkan",
  sorts: {
    value_desc: "Nilai tertinggi",
    value_asc: "Nilai terendah",
    name_asc: "Nama A–Z",
    acquired_desc: "Perolehan terbaru",
  },
  reset: "Reset filter",
  moreFilters: "Filter lainnya",
  fewerFilters: "Sembunyikan filter",
  activeFilters: "Filter aktif",
  removeFilter: "Hapus filter {label}",
  filtersAria: "Filter aset",
  tabAll: "Semua aset",
  tabsAria: "Kelas aset",
  colAsset: "Aset",
  colType: "Tipe",
  colOwner: "Pemilik",
  colPlace: "Platform / lokasi",
  colQty: "Kuantitas",
  colAcquired: "Tanggal perolehan",
  colValue: "Nilai kini",
  colChange: "Perubahan valuasi",
  colActions: "Aksi",
  shared: "Bersama",
  multiple: "Beberapa pembelian",
  firstOn: "pertama {date}",
  basis: {
    market: "Harga pasar",
    manual: "Nilai manual",
    stale: "Harga lama",
    cost_basis: "Berdasarkan biaya perolehan",
    unpriced: "Harga belum tersedia",
    failed: "Gagal mengambil harga",
    zero_valid: "Nol (tercatat)",
  },
  notValued: "Belum dinilai",
  totalUsesCost: "Total memakai biaya perolehan {amount}",
  noComparison: "Belum ada valuasi pembanding",
  vsDate: "vs {date}",
  up: "naik",
  down: "turun",
  flat: "tetap",
  sourceInvestasi: "Sumber: Investasi",
  sourceRekening: "Sumber: Rekening",
  closed: "Ditutup",
  duplicate: "Mungkin tercatat ganda",
  rowMenu: "Aksi untuk {name}",
  viewDetail: "Lihat detail",
  edit: "Edit",
  archive: "Arsipkan",
  prev: "Sebelumnya",
  next: "Berikutnya",
  pageOf: "Halaman {page} dari {pages}",
  showing: "{from}–{to} dari {total} aset",
  paginationAria: "Halaman daftar aset",
  empty: "Belum ada aset tercatat.",
  emptyCta: "Tambah aset pertama",
  noResults: "Tidak ada aset yang cocok dengan filter.",
  loadError: "Gagal memuat daftar aset.",
  retry: "Coba lagi",
  loading: "Memuat aset…",
  activityTitle: "Aktivitas aset terbaru",
  activitySub:
    "Perubahan nilai dan transaksi dari aset fisik teratas di halaman ini.",
  activityEmpty: "Belum ada aktivitas tercatat.",
  activityWhen: "Tanggal & waktu",
  activityAsset: "Aset",
  activityKind: "Aktivitas",
  activityDetail: "Detail",
  activityImpact: "Dampak nilai",
  activityKinds: {
    opening: "Kepemilikan awal",
    valuation: "Update valuasi",
    correction: "Koreksi",
    buy: "Pembelian",
    sell: "Penjualan",
    quantity_change: "Perubahan kuantitas",
  },
  dateOnly: "tanggal saja",
  voided: "dibatalkan",
  archiveTitle: "Arsipkan {name}?",
  archiveBody:
    "Aset yang punya riwayat diarsipkan: tetap tersimpan dan tidak lagi dihitung di total. Aset tanpa riwayat apa pun dihapus permanen.",
  archiveConfirm: "Arsipkan",
  archived: "Aset dikeluarkan dari total",
  archiveFailed: "Gagal mengarsipkan aset. Silakan coba lagi.",
  pickTitle: "Update nilai aset",
  pickBody:
    "Pilih aset fisik. Nilai baru dicatat di halaman detail aset, lengkap dengan tanggal dan sumbernya.",
  pickNone: "Tidak ada aset fisik yang bisa dinilai di halaman ini.",
  formUnit: "Satuan (opsional)",
  formUnitPh: "cth. gram, unit, m²",
  formModel: "Model valuasi",
  formModelTotal: "Nilai total",
  formModelPerUnit: "Per unit",
  formModelHint:
    "Per unit: nilai = kuantitas × harga per unit. Kuantitas dicatat lewat transaksi di detail aset.",
  formCode: "Kode internal (opsional)",
  formCodePh: "cth. EMAS-01",
  formCustodian: "Lokasi / kustodian (opsional)",
  formCustodianPh: "cth. Safe deposit box BCA",
  formLoadError: "Gagal memuat data aset untuk diedit.",
  detail: asetDetailId,
};

export const asetV3En: AsetV3Copy = {
  title: "My Assets",
  subtitle: "Every asset, value source and owner in one place.",
  updateValue: "Update value",
  addAsset: "Add asset",
  totalLabel: "Total assets",
  grossNote: "Gross assets • Liabilities shown separately",
  classes: {
    dana_rekening: "Cash & accounts",
    investasi: "Investments",
    aset_fisik: "Physical assets",
    polis_asuransi: "Insurance policies",
    lainnya: "Other",
  },
  asOf: "All values as of {date}",
  currency: "Currency: {currency}",
  scopeAll: "Summary covers all assets",
  scopeFiltered: "Summary follows the filters",
  incomplete: "Total incomplete: some assets are not valued yet.",
  costIncluded: "{amount} of the total uses acquisition cost.",
  netWorth: "Net worth",
  netWorthNote: "All assets − liabilities {amount}, ignores filters",
  netWorthUnavailable: "Not available for your access",
  summaryAria: "Asset summary",
  search: "Search assets…",
  type: "Asset type",
  all: "All",
  owner: "Owner",
  valueRange: "Value range (Rp)",
  min: "Min",
  max: "Max",
  qtyRange: "Quantity range",
  unit: "Unit",
  unitFirst: "Enter a unit first",
  acquired: "Acquisition date",
  from: "From",
  to: "To",
  status: "Status",
  statuses: { active: "Active", sold: "Sold", archived: "Archived" },
  completeness: "Valuation completeness",
  complete: "Complete",
  incompleteOption: "Incomplete",
  sort: "Sort",
  sorts: {
    value_desc: "Highest value",
    value_asc: "Lowest value",
    name_asc: "Name A–Z",
    acquired_desc: "Newest acquisition",
  },
  reset: "Reset filters",
  moreFilters: "More filters",
  fewerFilters: "Hide filters",
  activeFilters: "Active filters",
  removeFilter: "Remove filter {label}",
  filtersAria: "Asset filters",
  tabAll: "All assets",
  tabsAria: "Asset classes",
  colAsset: "Asset",
  colType: "Type",
  colOwner: "Owner",
  colPlace: "Platform / location",
  colQty: "Quantity",
  colAcquired: "Acquired",
  colValue: "Current value",
  colChange: "Valuation change",
  colActions: "Actions",
  shared: "Shared",
  multiple: "Multiple purchases",
  firstOn: "first {date}",
  basis: {
    market: "Market price",
    manual: "Manual value",
    stale: "Old price",
    cost_basis: "Based on acquisition cost",
    unpriced: "Price not available",
    failed: "Price fetch failed",
    zero_valid: "Zero (recorded)",
  },
  notValued: "Not valued",
  totalUsesCost: "Total uses acquisition cost {amount}",
  noComparison: "No comparison valuation yet",
  vsDate: "vs {date}",
  up: "up",
  down: "down",
  flat: "unchanged",
  sourceInvestasi: "Source: Investments",
  sourceRekening: "Source: Accounts",
  closed: "Closed",
  duplicate: "Possible duplicate",
  rowMenu: "Actions for {name}",
  viewDetail: "View detail",
  edit: "Edit",
  archive: "Archive",
  prev: "Previous",
  next: "Next",
  pageOf: "Page {page} of {pages}",
  showing: "{from}–{to} of {total} assets",
  paginationAria: "Asset list pages",
  empty: "No assets recorded yet.",
  emptyCta: "Add your first asset",
  noResults: "No assets match the filters.",
  loadError: "Could not load the asset list.",
  retry: "Try again",
  loading: "Loading assets…",
  activityTitle: "Recent asset activity",
  activitySub:
    "Value changes and transactions from the top physical assets on this page.",
  activityEmpty: "No activity recorded yet.",
  activityWhen: "Date & time",
  activityAsset: "Asset",
  activityKind: "Activity",
  activityDetail: "Detail",
  activityImpact: "Value impact",
  activityKinds: {
    opening: "Opening holding",
    valuation: "Valuation update",
    correction: "Correction",
    buy: "Purchase",
    sell: "Sale",
    quantity_change: "Quantity change",
  },
  dateOnly: "date only",
  voided: "voided",
  archiveTitle: "Archive {name}?",
  archiveBody:
    "An asset with history is archived: kept, and no longer counted in totals. An asset with no history at all is deleted permanently.",
  archiveConfirm: "Archive",
  archived: "Asset removed from totals",
  archiveFailed: "Could not archive the asset. Please try again.",
  pickTitle: "Update asset value",
  pickBody:
    "Pick a physical asset. The new value is recorded on the asset's detail page, with its date and source.",
  pickNone: "No physical asset on this page can be valued.",
  formUnit: "Unit (optional)",
  formUnitPh: "e.g. gram, unit, m²",
  formModel: "Valuation model",
  formModelTotal: "Total value",
  formModelPerUnit: "Per unit",
  formModelHint:
    "Per unit: value = quantity × price per unit. Quantity is recorded through transactions on the asset detail.",
  formCode: "Internal code (optional)",
  formCodePh: "e.g. GOLD-01",
  formCustodian: "Location / custodian (optional)",
  formCustodianPh: "e.g. BCA safe deposit box",
  formLoadError: "Could not load the asset for editing.",
  detail: asetDetailEn,
};
