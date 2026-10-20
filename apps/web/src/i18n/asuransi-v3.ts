/**
 * Asuransi v3 copy — the policy list / schedule / payments page (Task 24).
 * Lives in its own module (wired into id.ts / en.ts as `asuransi.v3`); the
 * dictionary parity test still checks both locales key by key.
 * `{name}`-style placeholders are filled with `fillCopy`.
 */
type BenefitKindId =
  | "life_sum_assured"
  | "health_annual_limit"
  | "per_event"
  | "daily"
  | "critical_illness"
  | "accident"
  | "other";

type ReportFieldId =
  | "policyNumber"
  | "productName"
  | "provider"
  | "policyType"
  | "holderName"
  | "insuredName"
  | "currency"
  | "premiumAmount"
  | "premiumPeriod"
  | "sumAssured"
  | "coverageStartDate"
  | "coverageEndDate"
  | "nextPremiumDueDate"
  | "reportDate"
  | "policyValue"
  | "cashValue"
  | "surrenderValue"
  | "maturityBenefit"
  | "fundCurrency"
  | "fundUnits"
  | "fundNav"
  | "fundNavDate"
  | "fundUnitsDate"
  | "fundValue";

export interface AsuransiV3Copy {
  title: string;
  subtitle: string;
  uploadReport: string;
  addPolicy: string;
  recordPayment: string;
  loading: string;
  // summary
  summaryAria: string;
  dueTitle: string;
  dueNone: string;
  overdueChip: string;
  activeChip: string;
  normalized: string;
  benefitTitle: string;
  benefitNone: string;
  benefitPolicies: string;
  benefitUnconfirmed: string;
  benefitMore: string;
  benefitKinds: Record<BenefitKindId, string>;
  valueTitle: string;
  valueNone: string;
  valueNoneHint: string;
  valueAsOf: string;
  sources: { manual: string; report: string };
  valueNetWorth: string;
  calloutTitle: string;
  calloutBody: string;
  // filters + list
  listTitle: string;
  listCount: string;
  search: string;
  searchLabel: string;
  filterHolder: string;
  filterInsured: string;
  filterProvider: string;
  filterType: string;
  filterPolicyType: string;
  filterStatus: string;
  filterDue: string;
  filterCurrency: string;
  all: string;
  moreFilters: string;
  resetFilters: string;
  policyTypes: { traditional: string; unit_link: string; unset: string };
  dueOptions: {
    overdue: string;
    d7: string;
    d30: string;
    month: string;
    d90: string;
    none: string;
  };
  colPolicy: string;
  colTypes: string;
  colPeople: string;
  colPremium: string;
  colBenefit: string;
  colDue: string;
  colStatus: string;
  colActions: string;
  viewDetail: string;
  rowMenu: string;
  edit: string;
  pay: string;
  remove: string;
  noProvider: string;
  policyNo: string;
  insuredNone: string;
  holderNone: string;
  currencyBadge: string;
  dueToday: string;
  dueIn: string;
  dueOverdue: string;
  dueUnset: string;
  paidPeriod: string;
  error: string;
  retry: string;
  empty: string;
  emptyFiltered: string;
  showMore: string;
  deleteFailed: string;
  // schedule
  scheduleTitle: string;
  scheduleSub: string;
  scheduleEmpty: string;
  seeAllSchedule: string;
  colDate: string;
  // unit link
  ulTitle: string;
  ulInfo: string;
  ulDetail: string;
  ulUpdate: string;
  ulEmpty: string;
  ulNoPolicy: string;
  ulPolicies: string;
  ulNoteTitle: string;
  ulNoteBody: string;
  // pay dialog
  payTitle: string;
  payDesc: string;
  payPolicy: string;
  payPolicyPh: string;
  payDue: string;
  payDueNone: string;
  payAccount: string;
  payAccountPh: string;
  payAmount: string;
  payAmountHint: string;
  payCurrencyNote: string;
  payDate: string;
  payTime: string;
  paySubmit: string;
  paySaving: string;
  payDone: string;
  payDoneNoNext: string;
  payReplayed: string;
  payFailed: string;
  payNoAccounts: string;
  payNoAccountsLink: string;
  payNoPolicies: string;
  payErrAccount: string;
  payErrAmount: string;
  payErrDate: string;
  payErrTime: string;
  // report dialog
  reportTitle: string;
  reportDesc: string;
  reportPolicy: string;
  reportFile: string;
  reportDate: string;
  reportUpload: string;
  reportUploading: string;
  reportUploaded: string;
  reportTooBig: string;
  reportBadType: string;
  reportFailed: string;
  reportNoPolicies: string;
  aiTitle: string;
  aiBody: string;
  aiRun: string;
  aiRunning: string;
  aiNoKey: string;
  aiSetKey: string;
  aiPdfOnly: string;
  aiPassword: string;
  aiFieldsTitle: string;
  aiStatus: {
    ai_extracted: string;
    needs_confirmation: string;
    confirmed: string;
  };
  aiPage: string;
  aiMissing: string;
  aiDrafts: string;
  aiNoDrafts: string;
  aiConfirm: string;
  aiConfirming: string;
  aiConfirmed: string;
  aiSuperseded: string;
  aiConfirmBlocked: string;
  aiEditHint: string;
  aiErrNoText: string;
  aiErrPassword: string;
  aiErrTimeout: string;
  aiErrRate: string;
  aiErrGeneric: string;
  fieldKeys: Record<ReportFieldId, string>;
}

export const asuransiV3Id: AsuransiV3Copy = {
  title: "Asuransi",
  subtitle: "Pantau perlindungan, premi, dan nilai polis secara terpisah.",
  uploadReport: "Unggah laporan",
  addPolicy: "Tambah polis",
  recordPayment: "Catat pembayaran",
  loading: "Memuat asuransi…",
  summaryAria: "Ringkasan asuransi",
  dueTitle: "Premi jatuh tempo bulan ini",
  dueNone: "Tidak ada premi jatuh tempo bulan ini",
  overdueChip: "{n} terlambat · {amount}",
  activeChip: "{n} polis aktif",
  normalized: "Setara {amount}/bln — normalisasi, bukan tagihan",
  benefitTitle: "Manfaat perlindungan",
  benefitNone: "Belum ada manfaat tercatat",
  benefitPolicies: "{n} polis",
  benefitUnconfirmed: "belum dikonfirmasi",
  benefitMore: "+{n} jenis manfaat lain",
  benefitKinds: {
    life_sum_assured: "Uang pertanggungan jiwa",
    health_annual_limit: "Limit tahunan kesehatan",
    per_event: "Manfaat per kejadian",
    daily: "Manfaat harian",
    critical_illness: "Penyakit kritis",
    accident: "Kecelakaan",
    other: "Manfaat lain",
  },
  valueTitle: "Nilai investasi / nilai tunai",
  valueNone: "—",
  valueNoneHint: "Belum ada nilai polis yang dikonfirmasi",
  valueAsOf: "Per {date}",
  sources: { manual: "Input manual", report: "Laporan perusahaan" },
  valueNetWorth: "{amount} dihitung di kekayaan bersih",
  calloutTitle: "Uang pertanggungan bukan saldo aset.",
  calloutBody:
    "Uang pertanggungan adalah manfaat saat terjadi risiko, bukan nilai yang dapat dicairkan, dan tidak ditambahkan ke total kekayaan.",
  listTitle: "Daftar polis",
  listCount: "{n} dari {total} polis",
  search: "Cari polis…",
  searchLabel: "Cari nama polis, perusahaan, atau nomor polis",
  filterHolder: "Pemegang polis",
  filterInsured: "Tertanggung",
  filterProvider: "Perusahaan",
  filterType: "Jenis",
  filterPolicyType: "Tipe",
  filterStatus: "Status",
  filterDue: "Jatuh tempo",
  filterCurrency: "Mata uang",
  all: "Semua",
  moreFilters: "Filter",
  resetFilters: "Hapus filter",
  policyTypes: {
    traditional: "Tradisional",
    unit_link: "Unit Link",
    unset: "Tipe belum diisi",
  },
  dueOptions: {
    overdue: "Terlambat",
    d7: "7 hari ke depan",
    d30: "30 hari ke depan",
    month: "Bulan ini",
    d90: "90 hari ke depan",
    none: "Belum dijadwalkan",
  },
  colPolicy: "Polis",
  colTypes: "Jenis & tipe",
  colPeople: "Pemegang / tertanggung",
  colPremium: "Premi",
  colBenefit: "Manfaat utama",
  colDue: "Jatuh tempo premi",
  colStatus: "Status",
  colActions: "Aksi",
  viewDetail: "Lihat detail",
  rowMenu: "Opsi untuk {name}",
  edit: "Ubah polis",
  pay: "Catat pembayaran",
  remove: "Hapus polis",
  noProvider: "Perusahaan belum diisi",
  policyNo: "No. {no}",
  insuredNone: "tertanggung belum diisi",
  holderNone: "Pemegang & tertanggung belum diisi",
  currencyBadge: "Polis {cur}",
  dueToday: "Hari ini",
  dueIn: "{n} hari lagi",
  dueOverdue: "Terlambat {n} hari",
  dueUnset: "Belum dijadwalkan",
  paidPeriod: "Lunas periode ini",
  error: "Daftar polis gagal dimuat.",
  retry: "Coba lagi",
  empty:
    "Belum ada polis. Tambahkan polis pertama untuk memantau premi dan manfaatnya.",
  emptyFiltered: "Tidak ada polis yang cocok dengan pencarian atau filter.",
  showMore: "Tampilkan {n} lagi",
  deleteFailed: "Polis gagal dihapus.",
  scheduleTitle: "Jadwal premi berikutnya",
  scheduleSub: "Premi terlambat dan yang jatuh tempo dalam {n} hari.",
  scheduleEmpty: "Tidak ada premi yang jatuh tempo dalam {n} hari ke depan.",
  seeAllSchedule: "Lihat semua jadwal",
  colDate: "Tanggal",
  ulTitle: "Nilai polis unit link",
  ulInfo:
    "Nilai dari laporan perusahaan yang sudah Anda konfirmasi — bukan dari total premi.",
  ulDetail: "Lihat detail",
  ulUpdate: "Perbarui dari laporan",
  ulEmpty: "Belum ada nilai unit link yang dikonfirmasi.",
  ulNoPolicy: "Belum ada polis bertipe Unit Link.",
  ulPolicies: "{n} polis unit link",
  ulNoteTitle: "Tidak semua premi menjadi investasi.",
  ulNoteBody: "Premi, biaya, dan alokasi investasi dicatat terpisah.",
  payTitle: "Catat pembayaran premi",
  payDesc:
    "Mencatat satu pengeluaran dari rekening yang dipilih dan memajukan jatuh tempo berikutnya.",
  payPolicy: "Polis",
  payPolicyPh: "Pilih polis",
  payDue: "Jatuh tempo yang dibayar",
  payDueNone: "Tanpa jadwal — dicatat untuk periode berjalan",
  payAccount: "Rekening sumber",
  payAccountPh: "Pilih rekening",
  payAmount: "Jumlah dibayar (Rp)",
  payAmountHint: "Premi tercatat {amount}{period}.",
  payCurrencyNote: "Polis bermata uang {cur}; premi dicatat dalam Rupiah.",
  payDate: "Tanggal bayar",
  payTime: "Jam",
  paySubmit: "Simpan pembayaran",
  paySaving: "Menyimpan…",
  payDone: "Pembayaran dicatat. Jatuh tempo berikutnya {date}.",
  payDoneNoNext: "Pembayaran dicatat.",
  payReplayed: "Pembayaran ini sudah tercatat — tidak dicatat dua kali.",
  payFailed: "Pembayaran gagal dicatat. Coba lagi.",
  payNoAccounts:
    "Belum ada rekening untuk membayar. Tambahkan rekening dulu di halaman Rekening.",
  payNoAccountsLink: "Buka Rekening",
  payNoPolicies: "Tidak ada polis aktif yang bisa dibayar.",
  payErrAccount: "Pilih rekening sumber.",
  payErrAmount: "Isi jumlah lebih dari 0.",
  payErrDate: "Tanggal bayar tidak boleh setelah hari ini.",
  payErrTime: "Jam bayar tidak boleh setelah jam sekarang.",
  reportTitle: "Unggah laporan polis",
  reportDesc:
    "Simpan laporan perusahaan di polisnya. Nilai baru dipakai hanya setelah Anda mengonfirmasinya.",
  reportPolicy: "Polis",
  reportFile: "File laporan (PDF, JPG, PNG, maks. 5 MB)",
  reportDate: "Tanggal laporan (opsional)",
  reportUpload: "Unggah laporan",
  reportUploading: "Mengunggah…",
  reportUploaded: "Laporan tersimpan di polis.",
  reportTooBig: "Ukuran file lebih dari 5 MB.",
  reportBadType: "Hanya file PDF, JPG, atau PNG.",
  reportFailed: "Laporan gagal diunggah.",
  reportNoPolicies: "Belum ada polis. Tambahkan polis dulu.",
  aiTitle: "Baca laporan dengan AI",
  aiBody:
    "AI menyalin angka dari teks laporan beserta halaman dan cuplikannya. Perhitungan dilakukan sistem, dan tidak ada yang disimpan sebelum Anda konfirmasi.",
  aiRun: "Baca dengan AI",
  aiRunning: "Membaca laporan…",
  aiNoKey:
    "Kunci AI keluarga belum diatur, jadi pembacaan otomatis belum tersedia. Nilai tetap bisa diisi manual di formulir polis.",
  aiSetKey: "Atur kunci AI",
  aiPdfOnly: "AI hanya bisa membaca file PDF yang memiliki teks.",
  aiPassword: "Kata sandi PDF (jika ada)",
  aiFieldsTitle: "Hasil bacaan",
  aiStatus: {
    ai_extracted: "Diekstrak AI",
    needs_confirmation: "Perlu konfirmasi",
    confirmed: "Dikonfirmasi pengguna",
  },
  aiPage: "Hal. {n}",
  aiMissing: "Data belum lengkap: {fields}",
  aiDrafts: "Nilai yang akan disimpan",
  aiNoDrafts: "Tidak ada nilai polis yang bisa disusun dari laporan ini.",
  aiConfirm: "Konfirmasi nilai",
  aiConfirming: "Menyimpan…",
  aiConfirmed: "Nilai polis dikonfirmasi.",
  aiSuperseded:
    "Laporan ini lebih lama dari nilai terbaru, jadi nilai terbaru tetap dipakai.",
  aiConfirmBlocked:
    "Masih ada angka yang perlu diperiksa, jadi belum bisa dikonfirmasi di sini.",
  aiEditHint:
    "Perlu mengubah angka? Tutup dialog ini dan isi nilainya manual di formulir polis.",
  aiErrNoText:
    "Laporan tidak bisa dibaca: PDF ini tidak memiliki teks (hasil pindai).",
  aiErrPassword:
    "PDF ini dilindungi kata sandi. Isi kata sandinya lalu coba lagi.",
  aiErrTimeout:
    "Pembacaan terlalu lama. Unggah hanya halaman yang memuat nilai polis.",
  aiErrRate: "Terlalu banyak permintaan. Coba lagi sebentar lagi.",
  aiErrGeneric: "AI gagal membaca laporan. Coba lagi atau isi manual.",
  fieldKeys: {
    policyNumber: "Nomor polis",
    productName: "Nama produk",
    provider: "Perusahaan",
    policyType: "Tipe polis",
    holderName: "Pemegang polis",
    insuredName: "Tertanggung",
    currency: "Mata uang",
    premiumAmount: "Premi",
    premiumPeriod: "Periode premi",
    sumAssured: "Uang pertanggungan",
    coverageStartDate: "Mulai perlindungan",
    coverageEndDate: "Akhir perlindungan",
    nextPremiumDueDate: "Jatuh tempo premi",
    reportDate: "Tanggal laporan",
    policyValue: "Nilai polis",
    cashValue: "Nilai tunai",
    surrenderValue: "Nilai penebusan",
    maturityBenefit: "Manfaat jatuh tempo",
    fundCurrency: "Mata uang subdana",
    fundUnits: "Jumlah unit",
    fundNav: "NAB per unit",
    fundNavDate: "Tanggal NAB",
    fundUnitsDate: "Tanggal unit",
    fundValue: "Nilai subdana",
  },
};

export const asuransiV3En: AsuransiV3Copy = {
  title: "Insurance",
  subtitle: "Track protection, premiums and policy values separately.",
  uploadReport: "Upload report",
  addPolicy: "Add policy",
  recordPayment: "Record payment",
  loading: "Loading insurance…",
  summaryAria: "Insurance summary",
  dueTitle: "Premiums due this month",
  dueNone: "No premiums due this month",
  overdueChip: "{n} overdue · {amount}",
  activeChip: "{n} active policies",
  normalized: "Equals {amount}/mo — a normalization, not a bill",
  benefitTitle: "Protection benefits",
  benefitNone: "No benefits recorded yet",
  benefitPolicies: "{n} policies",
  benefitUnconfirmed: "unconfirmed",
  benefitMore: "+{n} other benefit types",
  benefitKinds: {
    life_sum_assured: "Life sum assured",
    health_annual_limit: "Annual health limit",
    per_event: "Per-event benefit",
    daily: "Daily benefit",
    critical_illness: "Critical illness",
    accident: "Accident",
    other: "Other benefit",
  },
  valueTitle: "Investment / cash value",
  valueNone: "—",
  valueNoneHint: "No confirmed policy value yet",
  valueAsOf: "As of {date}",
  sources: { manual: "Manual entry", report: "Company report" },
  valueNetWorth: "{amount} counted in net worth",
  calloutTitle: "Sum assured is not an asset balance.",
  calloutBody:
    "Sum assured is paid when a risk occurs; it is not a value you can cash out and is not added to your net worth.",
  listTitle: "Policies",
  listCount: "{n} of {total} policies",
  search: "Search policies…",
  searchLabel: "Search policy name, company or policy number",
  filterHolder: "Policyholder",
  filterInsured: "Insured",
  filterProvider: "Company",
  filterType: "Kind",
  filterPolicyType: "Type",
  filterStatus: "Status",
  filterDue: "Due",
  filterCurrency: "Currency",
  all: "All",
  moreFilters: "Filters",
  resetFilters: "Clear filters",
  policyTypes: {
    traditional: "Traditional",
    unit_link: "Unit link",
    unset: "Type not set",
  },
  dueOptions: {
    overdue: "Overdue",
    d7: "Next 7 days",
    d30: "Next 30 days",
    month: "This month",
    d90: "Next 90 days",
    none: "Not scheduled",
  },
  colPolicy: "Policy",
  colTypes: "Kind & type",
  colPeople: "Holder / insured",
  colPremium: "Premium",
  colBenefit: "Main benefit",
  colDue: "Premium due",
  colStatus: "Status",
  colActions: "Actions",
  viewDetail: "View details",
  rowMenu: "Options for {name}",
  edit: "Edit policy",
  pay: "Record payment",
  remove: "Delete policy",
  noProvider: "Company not set",
  policyNo: "No. {no}",
  insuredNone: "insured not set",
  holderNone: "Holder & insured not set",
  currencyBadge: "{cur} policy",
  dueToday: "Today",
  dueIn: "in {n} days",
  dueOverdue: "{n} days overdue",
  dueUnset: "Not scheduled",
  paidPeriod: "Paid this period",
  error: "Could not load policies.",
  retry: "Try again",
  empty:
    "No policies yet. Add your first policy to track its premiums and benefits.",
  emptyFiltered: "No policies match the search or filters.",
  showMore: "Show {n} more",
  deleteFailed: "Could not delete the policy.",
  scheduleTitle: "Upcoming premiums",
  scheduleSub: "Overdue premiums and those due within {n} days.",
  scheduleEmpty: "No premiums due in the next {n} days.",
  seeAllSchedule: "See full schedule",
  colDate: "Date",
  ulTitle: "Unit link policy value",
  ulInfo:
    "Values from company reports you have confirmed — never derived from total premiums.",
  ulDetail: "View details",
  ulUpdate: "Update from report",
  ulEmpty: "No confirmed unit link value yet.",
  ulNoPolicy: "No unit link policies yet.",
  ulPolicies: "{n} unit link policies",
  ulNoteTitle: "Not every premium becomes an investment.",
  ulNoteBody:
    "Premiums, charges and investment allocation are recorded separately.",
  payTitle: "Record premium payment",
  payDesc:
    "Records one expense from the chosen account and moves the next due date forward.",
  payPolicy: "Policy",
  payPolicyPh: "Choose a policy",
  payDue: "Due date being paid",
  payDueNone: "No schedule — recorded for the current period",
  payAccount: "Source account",
  payAccountPh: "Choose an account",
  payAmount: "Amount paid (Rp)",
  payAmountHint: "Recorded premium {amount}{period}.",
  payCurrencyNote: "This is a {cur} policy; the premium is recorded in Rupiah.",
  payDate: "Payment date",
  payTime: "Time",
  paySubmit: "Save payment",
  paySaving: "Saving…",
  payDone: "Payment recorded. Next due {date}.",
  payDoneNoNext: "Payment recorded.",
  payReplayed: "This payment was already recorded — it was not recorded twice.",
  payFailed: "Could not record the payment. Please try again.",
  payNoAccounts:
    "No account to pay from yet. Add one on the Accounts page first.",
  payNoAccountsLink: "Open Accounts",
  payNoPolicies: "No active policy to pay.",
  payErrAccount: "Choose a source account.",
  payErrAmount: "Enter an amount above 0.",
  payErrDate: "The payment date cannot be after today.",
  payErrTime: "The payment time cannot be later than now.",
  reportTitle: "Upload policy report",
  reportDesc:
    "Store the company report on its policy. New values are used only after you confirm them.",
  reportPolicy: "Policy",
  reportFile: "Report file (PDF, JPG, PNG, max 5 MB)",
  reportDate: "Report date (optional)",
  reportUpload: "Upload report",
  reportUploading: "Uploading…",
  reportUploaded: "Report stored on the policy.",
  reportTooBig: "The file is larger than 5 MB.",
  reportBadType: "Only PDF, JPG or PNG files.",
  reportFailed: "Could not upload the report.",
  reportNoPolicies: "No policies yet. Add a policy first.",
  aiTitle: "Read the report with AI",
  aiBody:
    "AI copies figures from the report text with their page and snippet. The system does the math, and nothing is saved until you confirm.",
  aiRun: "Read with AI",
  aiRunning: "Reading the report…",
  aiNoKey:
    "The family AI key is not set, so automatic reading is unavailable. You can still enter values manually in the policy form.",
  aiSetKey: "Set AI key",
  aiPdfOnly: "AI can only read PDF files that contain text.",
  aiPassword: "PDF password (if any)",
  aiFieldsTitle: "What was read",
  aiStatus: {
    ai_extracted: "AI extracted",
    needs_confirmation: "Needs confirmation",
    confirmed: "Confirmed by you",
  },
  aiPage: "p. {n}",
  aiMissing: "Incomplete data: {fields}",
  aiDrafts: "Values to be saved",
  aiNoDrafts: "No policy value could be assembled from this report.",
  aiConfirm: "Confirm values",
  aiConfirming: "Saving…",
  aiConfirmed: "Policy value confirmed.",
  aiSuperseded:
    "This report is older than the latest value, so the latest value stays in use.",
  aiConfirmBlocked:
    "Some figures still need checking, so they cannot be confirmed here.",
  aiEditHint:
    "Need to change a figure? Close this dialog and enter the value manually in the policy form.",
  aiErrNoText: "The report cannot be read: this PDF has no text (a scan).",
  aiErrPassword:
    "This PDF is password-protected. Enter the password and try again.",
  aiErrTimeout:
    "Reading took too long. Upload only the pages with the policy value.",
  aiErrRate: "Too many requests. Please try again shortly.",
  aiErrGeneric: "AI could not read the report. Try again or enter it manually.",
  fieldKeys: {
    policyNumber: "Policy number",
    productName: "Product name",
    provider: "Company",
    policyType: "Policy type",
    holderName: "Policyholder",
    insuredName: "Insured",
    currency: "Currency",
    premiumAmount: "Premium",
    premiumPeriod: "Premium period",
    sumAssured: "Sum assured",
    coverageStartDate: "Coverage start",
    coverageEndDate: "Coverage end",
    nextPremiumDueDate: "Premium due",
    reportDate: "Report date",
    policyValue: "Policy value",
    cashValue: "Cash value",
    surrenderValue: "Surrender value",
    maturityBenefit: "Maturity benefit",
    fundCurrency: "Fund currency",
    fundUnits: "Units",
    fundNav: "NAV per unit",
    fundNavDate: "NAV date",
    fundUnitsDate: "Units date",
    fundValue: "Fund value",
  },
};
