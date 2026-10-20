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

// ── Task 25 — form drawer + policy detail ─────────────────────────────────
// The Indonesian objects define the shape; the English ones must match it
// key for key (typed against `typeof`), like the rest of this module.

const asuransiFormId = {
  addTitle: "Tambah asuransi",
  editTitle: "Ubah asuransi",
  desc: "Catat polis, perlindungan, dan nilai investasi.",
  anchorsLabel: "Bagian formulir",
  anchors: {
    info: "Informasi polis",
    premium: "Premi & manfaat",
    invest: "Investasi",
  },
  infoTitle: "Informasi polis",
  infoSub: "Detail dasar dari polis asuransi Anda.",
  name: "Nama polis",
  namePh: "mis. Proteksi Jiwa Keluarga",
  provider: "Perusahaan (opsional)",
  providerPh: "mis. nama perusahaan asuransi",
  type: "Jenis",
  policyType: "Tipe asuransi",
  policyTypeHint:
    "Pastikan dari dokumen polis — tidak ditebak dari nama produk.",
  policyTypeUnset: "Belum ditentukan",
  holder: "Pemegang polis",
  payer: "Pembayar premi",
  payerHint: "Isi bila berbeda dari pemegang polis.",
  payerSame: "Sama dengan pemegang polis",
  personNone: "Pilih anggota keluarga",
  personOther: "Orang lain (ketik nama)",
  personNamePh: "Nama lengkap",
  insured: "Tertanggung",
  insuredEmpty:
    "Belum ada tertanggung. Tambahkan satu atau lebih orang yang dilindungi.",
  addInsured: "Tambah tertanggung",
  relationship: "Hubungan",
  remove: "Hapus",
  policyNumber: "No. polis (opsional)",
  policyNumberHint: "Di daftar polis hanya 4 digit terakhir yang ditampilkan.",
  status: "Status polis",
  statusHint: "Status pembayaran premi dicatat terpisah.",
  currency: "Mata uang",
  currencyHint: "Mata uang polis dan manfaatnya.",
  coverageStart: "Tanggal mulai perlindungan",
  coverageEnd: "Berakhir perlindungan",
  coverageEndHint: "Bukan jatuh tempo premi.",
  policyRenewal: "Perpanjangan polis (opsional)",
  policyRenewalHint: "Tanggal polis diperpanjang, terpisah dari jadwal premi.",
  premiumTitle: "Premi & perlindungan",
  premiumSub: "Catat nominal premi dan nilai perlindungan.",
  premium: "Premi per pembayaran",
  period: "Periode premi",
  premiumHint:
    "Premi dicatat dalam rupiah; nominal valas dikonversi dengan kurs hari ini.",
  nextDue: "Jatuh tempo premi berikutnya",
  nextDueHint: "Pengingat dihitung dari tanggal ini.",
  premiumEnd: "Akhir masa pembayaran premi",
  payAccount: "Rekening pembayaran",
  payAccountHint: "Dipakai sebagai pilihan awal saat mencatat pembayaran.",
  payAccountNone: "Pilih saat membayar",
  benefits: "Manfaat perlindungan",
  benefitsHint:
    "Catat per jenis manfaat. Manfaat berbeda tidak dijumlahkan menjadi satu angka.",
  benefitKind: "Jenis manfaat",
  benefitPeriod: "Periode manfaat",
  benefitPeriodNone: "Tanpa periode",
  benefitPeriods: {
    per_year: "per tahun",
    per_event: "per kejadian",
    per_day: "per hari",
    per_policy_term: "selama masa polis",
    lifetime: "seumur hidup",
  },
  sumAssured: "Uang pertanggungan",
  benefitAmount: "Nilai manfaat",
  benefitNote: "Catatan manfaat",
  benefitNotePh: "mis. rider, kamar, batas per kejadian",
  addBenefit: "Tambah manfaat",
  sumAssuredNoteTitle: "Uang pertanggungan tidak dihitung sebagai aset.",
  sumAssuredNoteBody:
    "Uang pertanggungan adalah manfaat saat terjadi risiko, bukan nilai yang dapat dicairkan.",
  investTitle: "Investasi unit link",
  investSub: "Catat subdana dan unggah laporan untuk bantu membaca nilainya.",
  investSubTrad:
    "Polis tradisional tidak memakai unit/NAB, tetapi bisa memiliki nilai tunai atau manfaat jatuh tempo.",
  investNoType:
    "Pilih Tipe asuransi (Tradisional atau Unit Link) di Informasi polis untuk mencatat nilai investasi atau nilai tunai.",
  fund: "Subdana",
  fundName: "Subdana",
  fundNamePh: "Nama subdana",
  fundCode: "Kode (opsional)",
  units: "Jumlah unit",
  nav: "NAB per unit",
  navDate: "Tanggal NAB",
  unitsDate: "Tanggal unit",
  unitsDateHint: "Kosongkan bila sama dengan tanggal NAB.",
  fundValue: "Nilai investasi",
  datesDiffer: "tanggal unit dan NAB berbeda",
  fundLatest: "Nilai terakhir {value} · {date} · {status}",
  fundsEmpty: "Belum ada subdana.",
  addFund: "Tambah subdana",
  fundsNote:
    "Nilai = jumlah unit × NAB, dihitung ulang oleh sistem dengan desimal. Tidak dihitung dari total premi dan tidak membuat transaksi kas.",
  confirmTick: "Sudah saya periksa dengan laporan — tandai dikonfirmasi",
  fromReport: "Dari laporan, halaman {page}",
  cashValue: "Nilai tunai",
  surrender: "Estimasi nilai penarikan",
  maturity: "Manfaat jatuh tempo",
  effectiveDate: "Tanggal nilai",
  guaranteed: "Manfaat ini dijamin dalam kontrak",
  cashNote:
    "Nilai tunai, estimasi penarikan, dan manfaat dijamin/tidak dijamin dicatat terpisah. Tidak membuat transaksi kas.",
  includeNetWorth: "Hitung nilai terkonfirmasi di kekayaan bersih",
  includeNetWorthHint:
    "Hanya nilai yang sudah dikonfirmasi; uang pertanggungan dan premi tidak pernah dihitung.",
  aiButton: "Baca laporan dengan AI",
  aiHint: "Unggah laporan perusahaan; periksa hasil sebelum disimpan.",
  aiChecking: "Memeriksa kunci AI keluarga…",
  aiNoKey:
    "Fitur ini butuh kunci AI keluarga. Isi formulir secara manual, atau",
  aiReviewTitle: "Baca laporan dengan AI",
  aiReviewDesc:
    "AI hanya menyalin teks dari laporan. Periksa setiap nilai, halaman dan cuplikannya. Tidak ada yang disimpan sebelum Anda menyimpan polis.",
  aiFile: "Laporan polis (PDF)",
  aiFileHint: "PDF dengan teks (bukan hasil pindai), maks. 5 MB.",
  aiNoFields: "AI tidak menemukan data yang bisa dibaca dari laporan ini.",
  aiValue: "nilai",
  aiApply: "Terapkan {n} ke formulir",
  aiApplyHint:
    "Yang diterapkan hanya mengisi formulir. Subdana masuk sebagai “Perlu konfirmasi”.",
  aiApplied: "Hasil AI diterapkan ke formulir — periksa lalu simpan.",
  aiWarning: {
    dates_incompatible: "Tanggal unit & NAB berbeda",
    incomplete: "Data belum lengkap",
    value_mismatch: "Nilai tercetak tidak cocok",
  },
  aiConflict: {
    multiple_values: "beberapa nilai berbeda",
    not_in_source: "tidak ditemukan di halaman",
    unparseable: "tidak terbaca",
    ambiguous_number: "angka ambigu",
    unclear: "tidak jelas",
    value_mismatch: "nilai tidak cocok",
    policy_type_mismatch: "tipe polis berbeda",
  },
  moreTitle: "Penerima manfaat & dokumen",
  moreSub: "Tambahkan penerima manfaat dan unggah dokumen terkait.",
  optional: "(opsional)",
  docsTitle: "Dokumen polis",
  docsPending: "Disimpan bersama polis:",
  docsAfterSave: "Dokumen dapat diunggah setelah polis disimpan.",
  docsEmpty: "Belum ada dokumen.",
  docsError: "Dokumen gagal dimuat.",
  docsOpenFailed: "Dokumen gagal dibuka.",
  docsAdd: "Unggah dokumen",
  docsReportDate: "laporan",
  docsUploaded: "diunggah",
  docsDelete: "Hapus dokumen",
  docsDeleteTitle: "Hapus dokumen?",
  docsDeleteBody:
    "File dihapus dari penyimpanan. Nilai yang pernah mengutip dokumen ini tetap menyimpan halaman dan cuplikannya.",
  docsDeleted: "Dokumen dihapus",
  docsDeleteFailed: "Dokumen gagal dihapus",
  notesTitle: "Catatan tambahan",
  notesSub: "Tambahkan catatan untuk memudahkan pengelolaan di kemudian hari.",
  save: "Simpan polis",
  saveFailed: "Polis gagal disimpan",
  savedPartially: "Polis sudah tersimpan, tetapi sebagian nilai belum:",
  fixErrors: "Periksa kolom yang ditandai.",
  issues: {
    nameRequired: "Nama polis wajib diisi.",
    premiumPositive: "Premi harus lebih dari 0.",
    holderRequired: "Pilih pemegang polis.",
    coverageOrder: "Akhir perlindungan tidak boleh sebelum tanggal mulai.",
    premiumEndOrder:
      "Akhir pembayaran premi tidak boleh sebelum tanggal mulai.",
    fundName: "Nama subdana wajib diisi.",
    fundPair: "Isi jumlah unit dan NAB bersama-sama.",
    fundDate: "Isi tanggal NAB.",
    futureDate: "Tanggal nilai tidak boleh setelah hari ini.",
    cashDate: "Isi tanggal nilai.",
    benefitAmount: "Nominal manfaat tidak valid.",
  },
};

export type AsuransiFormCopy = typeof asuransiFormId;

const asuransiFormEn: AsuransiFormCopy = {
  addTitle: "Add insurance",
  editTitle: "Edit insurance",
  desc: "Record the policy, its protection and its investment value.",
  anchorsLabel: "Form sections",
  anchors: {
    info: "Policy info",
    premium: "Premium & benefits",
    invest: "Investment",
  },
  infoTitle: "Policy information",
  infoSub: "The basic details of your policy.",
  name: "Policy name",
  namePh: "e.g. Family Life Protection",
  provider: "Insurer (optional)",
  providerPh: "e.g. insurance company name",
  type: "Category",
  policyType: "Policy type",
  policyTypeHint:
    "Confirm it from the policy document — never guessed from the product name.",
  policyTypeUnset: "Not set",
  holder: "Policyholder",
  payer: "Premium payer",
  payerHint: "Fill in when different from the policyholder.",
  payerSame: "Same as policyholder",
  personNone: "Choose a family member",
  personOther: "Someone else (type a name)",
  personNamePh: "Full name",
  insured: "Insured",
  insuredEmpty: "No insured person yet. Add one or more people covered.",
  addInsured: "Add insured person",
  relationship: "Relationship",
  remove: "Remove",
  policyNumber: "Policy no. (optional)",
  policyNumberHint: "The policy list shows only the last 4 digits.",
  status: "Policy status",
  statusHint: "Premium payment status is tracked separately.",
  currency: "Currency",
  currencyHint: "Currency of the policy and its benefits.",
  coverageStart: "Coverage start",
  coverageEnd: "Coverage end",
  coverageEndHint: "Not the premium due date.",
  policyRenewal: "Policy renewal (optional)",
  policyRenewalHint:
    "When the policy renews, separate from the premium schedule.",
  premiumTitle: "Premium & protection",
  premiumSub: "Record the premium and the protection amounts.",
  premium: "Premium per payment",
  period: "Premium frequency",
  premiumHint:
    "Premiums are recorded in rupiah; a foreign amount converts at today's rate.",
  nextDue: "Next premium due",
  nextDueHint: "Reminders are computed from this date.",
  premiumEnd: "Premium payment end",
  payAccount: "Payment account",
  payAccountHint: "Pre-selected when you record a payment.",
  payAccountNone: "Choose when paying",
  benefits: "Protection benefits",
  benefitsHint:
    "Record each benefit by kind. Different benefits are never added into one figure.",
  benefitKind: "Benefit kind",
  benefitPeriod: "Benefit period",
  benefitPeriodNone: "No period",
  benefitPeriods: {
    per_year: "per year",
    per_event: "per event",
    per_day: "per day",
    per_policy_term: "for the policy term",
    lifetime: "lifetime",
  },
  sumAssured: "Sum assured",
  benefitAmount: "Benefit amount",
  benefitNote: "Benefit note",
  benefitNotePh: "e.g. rider, room class, per-event limit",
  addBenefit: "Add benefit",
  sumAssuredNoteTitle: "The sum assured is not counted as an asset.",
  sumAssuredNoteBody:
    "The sum assured is paid when a risk occurs; it is not a value you can withdraw.",
  investTitle: "Unit-link investment",
  investSub: "Record sub-funds and upload a report to help read their value.",
  investSubTrad:
    "Traditional policies have no units/NAV, but may have a cash value or maturity benefit.",
  investNoType:
    "Choose the Policy type (Traditional or Unit link) under Policy info to record an investment or cash value.",
  fund: "Sub-fund",
  fundName: "Sub-fund",
  fundNamePh: "Sub-fund name",
  fundCode: "Code (optional)",
  units: "Units",
  nav: "NAV per unit",
  navDate: "NAV date",
  unitsDate: "Units date",
  unitsDateHint: "Leave empty when it equals the NAV date.",
  fundValue: "Investment value",
  datesDiffer: "units and NAV dates differ",
  fundLatest: "Last value {value} · {date} · {status}",
  fundsEmpty: "No sub-fund yet.",
  addFund: "Add sub-fund",
  fundsNote:
    "Value = units × NAV, recomputed by the system with decimals. Never derived from premiums paid and never creates a cash transaction.",
  confirmTick: "I checked it against the report — mark as confirmed",
  fromReport: "From the report, page {page}",
  cashValue: "Cash value",
  surrender: "Estimated surrender value",
  maturity: "Maturity benefit",
  effectiveDate: "Value date",
  guaranteed: "This benefit is guaranteed in the contract",
  cashNote:
    "Cash value, surrender estimate and guaranteed/non-guaranteed benefits are recorded separately. No cash transaction is created.",
  includeNetWorth: "Count the confirmed value in net worth",
  includeNetWorthHint:
    "Confirmed values only; the sum assured and premiums are never counted.",
  aiButton: "Read report with AI",
  aiHint: "Upload the insurer's report; review the result before saving.",
  aiChecking: "Checking the family AI key…",
  aiNoKey: "This needs the family AI key. Fill in the form manually, or",
  aiReviewTitle: "Read report with AI",
  aiReviewDesc:
    "The AI only copies text from the report. Check every value, its page and snippet. Nothing is stored until you save the policy.",
  aiFile: "Policy report (PDF)",
  aiFileHint: "A text PDF (not a scan), max 5 MB.",
  aiNoFields: "The AI found no readable data in this report.",
  aiValue: "value",
  aiApply: "Apply {n} to the form",
  aiApplyHint:
    "Applying only fills the form. Sub-funds arrive as “Needs confirmation”.",
  aiApplied: "AI results applied to the form — review, then save.",
  aiWarning: {
    dates_incompatible: "Units & NAV dates differ",
    incomplete: "Incomplete data",
    value_mismatch: "Printed value does not match",
  },
  aiConflict: {
    multiple_values: "several different values",
    not_in_source: "not found on the page",
    unparseable: "unreadable",
    ambiguous_number: "ambiguous number",
    unclear: "unclear",
    value_mismatch: "value mismatch",
    policy_type_mismatch: "policy type differs",
  },
  moreTitle: "Beneficiaries & documents",
  moreSub: "Add beneficiaries and upload related documents.",
  optional: "(optional)",
  docsTitle: "Policy documents",
  docsPending: "Saved with the policy:",
  docsAfterSave: "Documents can be uploaded once the policy is saved.",
  docsEmpty: "No documents yet.",
  docsError: "Documents failed to load.",
  docsOpenFailed: "The document could not be opened.",
  docsAdd: "Upload document",
  docsReportDate: "report",
  docsUploaded: "uploaded",
  docsDelete: "Delete document",
  docsDeleteTitle: "Delete document?",
  docsDeleteBody:
    "The file is removed from storage. Values that cited it keep their page and snippet.",
  docsDeleted: "Document deleted",
  docsDeleteFailed: "The document could not be deleted",
  notesTitle: "Additional notes",
  notesSub: "Add notes to make the policy easier to manage later.",
  save: "Save policy",
  saveFailed: "The policy could not be saved",
  savedPartially: "The policy was saved, but some values were not:",
  fixErrors: "Check the highlighted fields.",
  issues: {
    nameRequired: "The policy name is required.",
    premiumPositive: "The premium must be greater than 0.",
    holderRequired: "Choose the policyholder.",
    coverageOrder: "Coverage end cannot be before the start date.",
    premiumEndOrder: "Premium payment end cannot be before the start date.",
    fundName: "The sub-fund name is required.",
    fundPair: "Fill in units and NAV together.",
    fundDate: "Fill in the NAV date.",
    futureDate: "The value date cannot be after today.",
    cashDate: "Fill in the value date.",
    benefitAmount: "The benefit amount is not valid.",
  },
};

const asuransiDetailId = {
  back: "Asuransi",
  loadError: "Polis gagal dimuat.",
  notFound: "Polis tidak ditemukan atau Anda tidak memiliki akses.",
  edit: "Ubah polis",
  tabsAria: "Bagian detail polis",
  tabs: {
    ringkasan: "Ringkasan",
    manfaat: "Manfaat & rider",
    premi: "Premi & pembayaran",
    investasi: "Investasi & nilai tunai",
    penerima: "Penerima manfaat",
    dokumen: "Dokumen & riwayat",
  },
  policyCard: "Polis",
  provider: "Perusahaan",
  policyNumber: "No. polis",
  showNumber: "Tampilkan",
  hideNumber: "Sembunyikan",
  holder: "Pemegang polis",
  insured: "Tertanggung",
  payer: "Pembayar premi",
  payerSameAsHolder: "Sama dengan pemegang polis",
  currency: "Mata uang polis",
  coverageStart: "Mulai perlindungan",
  coverageEnd: "Berakhir perlindungan",
  coverageEndHint: "Bukan jatuh tempo premi",
  policyRenewal: "Perpanjangan polis",
  premiumCard: "Premi",
  perPeriod: "per pembayaran · {period}",
  nextDue: "Jatuh tempo premi berikutnya",
  premiumEnd: "Akhir pembayaran premi",
  payAccount: "Rekening pembayaran",
  valueCard: "Nilai polis terkonfirmasi",
  showCalc: "Lihat perhitungan",
  policyLevel: "Nilai polis",
  inNetWorth: "Nilai terkonfirmasi dihitung di kekayaan bersih.",
  notInNetWorth: "Tidak dihitung di kekayaan bersih (bisa diubah di formulir).",
  benefitsTitle: "Manfaat & rider",
  benefitsNote:
    "Setiap jenis manfaat ditampilkan terpisah dan tidak dijumlahkan. Uang pertanggungan tidak masuk total kekayaan.",
  benefitChanges: "Perubahan manfaat",
  benefitChangesNote:
    "Kapan setiap manfaat dicatat atau diubah. Nilai sebelum perubahan belum disimpan.",
  recordedOn: "dicatat {date}",
  changedOn: "diubah {date}",
  scheduleTitle: "Jadwal premi",
  dueStatus: { scheduled: "Terjadwal", overdue: "Terlambat" },
  scheduledAmount: "Premi terjadwal",
  autoRenew: "Majukan jatuh tempo otomatis",
  yes: "Ya",
  no: "Tidak",
  projectedTitle: "Proyeksi jatuh tempo berikutnya",
  projectedTag: "proyeksi, belum tagihan",
  historyTitle: "Riwayat pembayaran",
  historySub: "Premi yang sudah dibayar. Premi tidak menjadi nilai aset.",
  historyEmpty: "Belum ada pembayaran tercatat.",
  historyError: "Riwayat pembayaran gagal dimuat.",
  paidOn: "Dibayar {date}",
  forDue: "Jatuh tempo {date}",
  noDue: "Tanpa jatuh tempo",
  voidButton: "Batalkan pembayaran",
  voidTitle: "Batalkan pembayaran ini?",
  voidBody:
    "{amount} dikembalikan ke {account}, transaksi pengeluarannya dihapus, dan jatuh tempo {date} kembali menjadi belum dibayar.",
  voidBodyNoDue:
    "{amount} dikembalikan ke {account} dan transaksi pengeluarannya dihapus. Jadwal premi tidak berubah.",
  voidConfirm: "Batalkan pembayaran",
  voiding: "Membatalkan…",
  voidDone: "Pembayaran dibatalkan. Jatuh tempo berikutnya {date}.",
  voidDoneNoDue: "Pembayaran dibatalkan.",
  voidFailed: "Pembayaran gagal dibatalkan",
  valueTitle: "Nilai subdana",
  cashTitle: "Nilai tunai",
  updateValue: "Perbarui nilai",
  noPolicyType:
    "Tipe asuransi belum ditentukan — pilih di formulir untuk mencatat nilai.",
  valueError: "Nilai polis gagal dimuat.",
  noFunds: "Belum ada subdana.",
  noStatement: "Belum ada nilai tercatat.",
  unitsWord: "unit",
  navOn: "NAB per {date}",
  unitsOn: "unit per {date}",
  datesWarning: "tanggal unit & NAB berbeda — bukan nilai resmi satu tanggal",
  incomplete: "data belum lengkap",
  reportedValue: "Nilai dilaporkan",
  cashValue: "Nilai tunai",
  surrender: "Estimasi penarikan",
  maturity: "Manfaat jatuh tempo",
  guaranteed: "dijamin",
  notGuaranteed: "tidak dijamin",
  confirmValue: "Konfirmasi nilai",
  confirmDone: "Nilai dikonfirmasi",
  confirmFailed: "Nilai gagal dikonfirmasi",
  officialStill:
    "Nilai resmi masih {value} per {date} sampai nilai ini dikonfirmasi.",
  valueHistory: "Riwayat nilai",
  valueHistorySub:
    "Tanggal efektif terpisah dari waktu pencatatan; laporan lama tidak menggantikan nilai yang lebih baru.",
  valueHistoryEmpty: "Belum ada riwayat nilai.",
  effectiveOn: "efektif {date}",
  beneficiariesTitle: "Penerima manfaat",
  beneficiariesNote:
    "Penerima manfaat polis berbeda dari anggota yang bisa mengakses aplikasi.",
  beneficiariesEmpty: "Belum ada penerima manfaat.",
  editBeneficiaries: "Ubah penerima",
  familyMember: "Anggota keluarga",
  outsideFamily: "Di luar keluarga",
  sharesFull: "Total 100%",
  sharesPartial: "Total {pct}% — sisa belum dialokasikan",
  docsTitle: "Dokumen",
  docsSub:
    "Polis dan laporan perusahaan. Hanya yang berhak melihat polis ini yang bisa membukanya.",
  logTitle: "Riwayat pencatatan",
  logSub: "Kapan polis, pembayaran dan nilai dicatat.",
  evCreated: "Polis dicatat",
  evUpdated: "Polis terakhir diubah",
  evPayment: "Pembayaran premi dicatat",
  evValuation: "Nilai polis dicatat",
};

export type AsuransiDetailCopy = typeof asuransiDetailId;

const asuransiDetailEn: AsuransiDetailCopy = {
  back: "Insurance",
  loadError: "The policy failed to load.",
  notFound: "Policy not found, or you do not have access.",
  edit: "Edit policy",
  tabsAria: "Policy detail sections",
  tabs: {
    ringkasan: "Summary",
    manfaat: "Benefits & riders",
    premi: "Premiums & payments",
    investasi: "Investment & cash value",
    penerima: "Beneficiaries",
    dokumen: "Documents & history",
  },
  policyCard: "Policy",
  provider: "Insurer",
  policyNumber: "Policy no.",
  showNumber: "Show",
  hideNumber: "Hide",
  holder: "Policyholder",
  insured: "Insured",
  payer: "Premium payer",
  payerSameAsHolder: "Same as policyholder",
  currency: "Policy currency",
  coverageStart: "Coverage start",
  coverageEnd: "Coverage end",
  coverageEndHint: "Not the premium due date",
  policyRenewal: "Policy renewal",
  premiumCard: "Premium",
  perPeriod: "per payment · {period}",
  nextDue: "Next premium due",
  premiumEnd: "Premium payment end",
  payAccount: "Payment account",
  valueCard: "Confirmed policy value",
  showCalc: "Show calculation",
  policyLevel: "Policy value",
  inNetWorth: "The confirmed value counts in net worth.",
  notInNetWorth: "Not counted in net worth (change it in the form).",
  benefitsTitle: "Benefits & riders",
  benefitsNote:
    "Each benefit kind is shown separately and never added up. The sum assured is not part of net worth.",
  benefitChanges: "Benefit changes",
  benefitChangesNote:
    "When each benefit was recorded or changed. Values before a change are not stored yet.",
  recordedOn: "recorded {date}",
  changedOn: "changed {date}",
  scheduleTitle: "Premium schedule",
  dueStatus: { scheduled: "Scheduled", overdue: "Overdue" },
  scheduledAmount: "Scheduled premium",
  autoRenew: "Auto-advance the due date",
  yes: "Yes",
  no: "No",
  projectedTitle: "Projected upcoming dues",
  projectedTag: "projection, not a bill",
  historyTitle: "Payment history",
  historySub: "Premiums already paid. Premiums never become asset value.",
  historyEmpty: "No payment recorded yet.",
  historyError: "Payment history failed to load.",
  paidOn: "Paid {date}",
  forDue: "Due {date}",
  noDue: "No due date",
  voidButton: "Void payment",
  voidTitle: "Void this payment?",
  voidBody:
    "{amount} goes back to {account}, its expense transaction is deleted and the {date} due becomes unpaid again.",
  voidBodyNoDue:
    "{amount} goes back to {account} and its expense transaction is deleted. The premium schedule does not change.",
  voidConfirm: "Void payment",
  voiding: "Voiding…",
  voidDone: "Payment voided. Next due {date}.",
  voidDoneNoDue: "Payment voided.",
  voidFailed: "The payment could not be voided",
  valueTitle: "Sub-fund values",
  cashTitle: "Cash value",
  updateValue: "Update value",
  noPolicyType:
    "Policy type not set — choose it in the form to record a value.",
  valueError: "Policy values failed to load.",
  noFunds: "No sub-fund yet.",
  noStatement: "No value recorded yet.",
  unitsWord: "units",
  navOn: "NAV as of {date}",
  unitsOn: "units as of {date}",
  datesWarning: "units & NAV dates differ — not an official value for one date",
  incomplete: "incomplete data",
  reportedValue: "Reported value",
  cashValue: "Cash value",
  surrender: "Surrender estimate",
  maturity: "Maturity benefit",
  guaranteed: "guaranteed",
  notGuaranteed: "not guaranteed",
  confirmValue: "Confirm value",
  confirmDone: "Value confirmed",
  confirmFailed: "The value could not be confirmed",
  officialStill:
    "The official value stays {value} as of {date} until this one is confirmed.",
  valueHistory: "Value history",
  valueHistorySub:
    "The effective date is kept apart from when it was recorded; an old report never replaces a newer value.",
  valueHistoryEmpty: "No value history yet.",
  effectiveOn: "effective {date}",
  beneficiariesTitle: "Beneficiaries",
  beneficiariesNote:
    "Policy beneficiaries are not the same as members with app access.",
  beneficiariesEmpty: "No beneficiaries yet.",
  editBeneficiaries: "Edit beneficiaries",
  familyMember: "Family member",
  outsideFamily: "Outside the family",
  sharesFull: "Total 100%",
  sharesPartial: "Total {pct}% — the rest is unallocated",
  docsTitle: "Documents",
  docsSub:
    "Policy and insurer reports. Only people who may see this policy can open them.",
  logTitle: "Record history",
  logSub: "When the policy, payments and values were recorded.",
  evCreated: "Policy recorded",
  evUpdated: "Policy last changed",
  evPayment: "Premium payment recorded",
  evValuation: "Policy value recorded",
};

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
  otherFilters: string;
  showResults: string;
  complete: string;
  completeAria: string;
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
  dueConfirm: string;
  dueConfirmHelp: string;
  dueConfirmAction: string;
  scheduleConfirmTitle: string;
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
  form: AsuransiFormCopy;
  detail: AsuransiDetailCopy;
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
  otherFilters: "Filter lainnya",
  showResults: "Tampilkan {n} polis",
  complete: "Lengkapi",
  completeAria: "Lengkapi data {name}",
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
  dueConfirm: "Perlu dikonfirmasi",
  dueConfirmHelp:
    "Tanggal lama mungkin akhir perlindungan. Periksa dan isi jatuh tempo premi berikutnya.",
  dueConfirmAction: "Periksa tanggal",
  scheduleConfirmTitle: "Perlu dikonfirmasi",
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
  form: asuransiFormId,
  detail: asuransiDetailId,
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
  otherFilters: "More filters",
  showResults: "Show {n} policies",
  complete: "Complete",
  completeAria: "Complete details for {name}",
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
  dueConfirm: "Needs confirmation",
  dueConfirmHelp:
    "The old date may be the coverage end. Check it and enter the next premium due date.",
  dueConfirmAction: "Check dates",
  scheduleConfirmTitle: "Needs confirmation",
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
  form: asuransiFormEn,
  detail: asuransiDetailEn,
};
