/**
 * Rekening v3 copy — the bank-account form and the /rekening page. Lives in
 * its own module (wired into id.ts / en.ts as `rekening.v3`) because it is
 * large; the dictionary parity test still checks both locales key by key.
 */
export interface RekeningV3Copy {
  form: {
    addTitle: string;
    editTitle: string;
    addDepositTitle: string;
    subtitleBook: string;
    subtitleDeposit: string;
    subtitleForeign: string;
    secInstitution: string;
    secProduct: string;
    secIdentity: string;
    secBalance: string;
    secPlacement: string;
    secAccess: string;
    secCompliance: string;
    country: string;
    countryDomestic: string;
    countryForeign: string;
    countryPick: string;
    bank: string;
    bankSearchHint: string;
    bankPlaceholder: string;
    bankOther: string;
    bankTyped: string;
    institutionKind: string;
    sharia: string;
    shariaHint: string;
    bankCode: string;
    swift: string;
    swiftInvalid: string;
    routing: Record<"bank_code" | "iban" | "aba" | "bsb", string>;
    routingHint: string;
    autoFilledHint: string;
    productKind: string;
    productName: string;
    productNameHint: string;
    productNamePlaceholder: string;
    accountNumber: string;
    accountNumberPlaceholder: string;
    depositNumber: string;
    currency: string;
    holder: string;
    holderHint: string;
    holderOther: string;
    holderUnset: string;
    holderOtherPlaceholder: string;
    ownershipForm: string;
    ownershipHint: string;
    displayName: string;
    displayNameHint: string;
    openingBalance: string;
    principal: string;
    asOf: string;
    placementDate: string;
    balanceLockedNote: string;
    balancesPerCurrency: string;
    addCurrency: string;
    removeCurrency: string;
    interestRate: string;
    nisbah: string;
    optional: string;
    shariaContract: string;
    taxLine: string;
    taxHint: string;
    taxForeignHint: string;
    tenor: string;
    tenorOther: string;
    monthsSuffix: string;
    interestPayout: string;
    maturityInstruction: string;
    payoutAccount: string;
    payoutNone: string;
    maturityLabel: string;
    netInterestLabel: string;
    earlyWithdrawalNote: string;
    reminder: string;
    reminderHint: string;
    insuranceTitle: string;
    insuranceBody: string;
    insuranceOver: string;
    insuranceForeign: string;
    familyShared: string;
    familySharedHint: string;
    ownedBy: string;
    sharedWith: string;
    sharedWithHint: string;
    sharedWithNone: string;
    sharedWithPrivate: string;
    shareRights: Record<"none" | "view" | "post", string>;
    privateLabel: string;
    privateHint: string;
    status: string;
    moreDetails: string;
    moreDetailsHint: string;
    branch: string;
    isPrimary: string;
    isPrimaryHint: string;
    notes: string;
    reportTax: string;
    reportTaxHint: string;
    beneficiary: string;
    beneficiaryHint: string;
    beneficiaryNone: string;
    cancel: string;
    save: string;
    saveDeposit: string;
    saving: string;
    required: string;
    rateMissing: string;
    savedToast: string;
    updatedToast: string;
    partialToast: string;
    failedToast: string;
  };
  kinds: Record<
    | "savings"
    | "current"
    | "time_deposit"
    | "planned_savings"
    | "multi_currency",
    string
  >;
  kindsForeign: Record<
    | "savings"
    | "current"
    | "time_deposit"
    | "planned_savings"
    | "multi_currency",
    string
  >;
  institutionKinds: Record<
    | "commercial"
    | "digital"
    | "sharia"
    | "rural"
    | "foreign_branch"
    | "foreign",
    string
  >;
  ownership: Record<"individual" | "joint" | "qq", string>;
  statuses: Record<"active" | "dormant" | "blocked" | "closed", string>;
  shariaContracts: Record<"wadiah" | "mudharabah", string>;
  payouts: Record<"at_maturity" | "monthly", string>;
  instructions: Record<"aro" | "aro_plus" | "non_aro", string>;
  instructionHints: Record<"aro" | "aro_plus" | "non_aro", string>;
  countries: Record<string, string>;
  page: {
    totalLabel: string;
    summary: string;
    filteredHint: string;
    axis: Record<"bank" | "kind" | "holder", string>;
    other: string;
    liquid: string;
    liquidHint: string;
    locked: string;
    lockedHint: string;
    lockedNone: string;
    insured: string;
    insuredAll: string;
    insuredGap: string;
    interest: string;
    interestHint: string;
    interestNone: string;
    attentionTitle: string;
    attentionEmpty: string;
    attnMaturity: string;
    attnMaturityToday: string;
    attnMaturityBody: string;
    attnInsuranceOver: string;
    attnInsuranceNear: string;
    attnInsuranceBody: string;
    attnIdle: string;
    attnIdleBody: string;
    attnTax: string;
    attnTaxBody: string;
    see: string;
    review: string;
    searchPlaceholder: string;
    filterBank: string;
    filterHolder: string;
    filterKind: string;
    filterAccess: string;
    filterStatus: string;
    all: string;
    access: Record<"all" | "mine" | "sharedWithMe" | "family", string>;
    status: Record<"open" | "all" | "closed", string>;
    clearFilters: string;
    scrollPrev: string;
    scrollNext: string;
    moreFilters: string;
    sortLabel: string;
    sort: Record<"balance" | "name" | "newest", string>;
    viewLabel: string;
    viewCards: string;
    viewTable: string;
    addAccount: string;
    addAtBank: string;
    hiddenEmpty: string;
    showEmpty: string;
    hideEmpty: string;
    accountsCount: string;
    shareOfTotal: string;
    insuranceChip: string;
    insuranceChipOver: string;
    colAccount: string;
    colKind: string;
    colHolder: string;
    colAccess: string;
    colTerms: string;
    colBalance: string;
    familyBadge: string;
    familyHolder: string;
    privateBadge: string;
    sharedCount: string;
    primaryBadge: string;
    perAnnum: string;
    matures: string;
    daysLeft: string;
    matured: string;
    lastActivity: string;
    noActivity: string;
    idleDays: string;
    viaRate: string;
    reportTaxBadge: string;
    noResults: string;
    emptyState: string;
    mutasi: string;
    customize: string;
    customizeShort: string;
    edit: string;
    remove: string;
    options: string;
    requestFunds: string;
  };
}

export const rekeningV3Id: RekeningV3Copy = {
  form: {
    addTitle: "Tambah Rekening Bank",
    editTitle: "Edit Rekening Bank",
    addDepositTitle: "Tambah Deposito",
    subtitleBook: "Isi sesuai buku tabungan atau e-statement.",
    subtitleDeposit: "Isi sesuai bilyet atau konfirmasi penempatan.",
    subtitleForeign: "Rekening di luar Indonesia.",
    secInstitution: "Lembaga",
    secProduct: "Produk",
    secIdentity: "Identitas rekening",
    secBalance: "Saldo & imbal hasil",
    secPlacement: "Penempatan",
    secAccess: "Kepemilikan & akses",
    secCompliance: "Kepatuhan & perlindungan",
    country: "Negara bank",
    countryDomestic: "Indonesia",
    countryForeign: "Luar negeri",
    countryPick: "Negara",
    bank: "Bank",
    bankSearchHint: "pilih atau ketik",
    bankPlaceholder: "Pilih bank",
    bankOther: "Bank lain (ketik nama)",
    bankTyped: "Nama bank",
    institutionKind: "Jenis lembaga",
    sharia: "Bank / unit syariah",
    shariaHint: "Imbal hasil memakai akad dan nisbah, bukan bunga.",
    bankCode: "Kode bank",
    swift: "SWIFT / BIC",
    swiftInvalid: "SWIFT/BIC berisi 8 atau 11 huruf/angka, mis. CENAIDJA.",
    routing: {
      bank_code: "Kode bank",
      iban: "IBAN",
      aba: "Routing number (ABA)",
      bsb: "BSB",
    },
    routingHint: "Kode yang dipakai untuk transfer ke rekening ini.",
    autoFilledHint: "Terisi otomatis dari daftar bank. Ubah bila berbeda.",
    productKind: "Jenis simpanan",
    productName: "Nama produk",
    productNameHint: "ketik bebas",
    productNamePlaceholder: "cth: Tahapan Xpresi",
    accountNumber: "Nomor rekening",
    accountNumberPlaceholder: "cth: 0087366463",
    depositNumber: "No. bilyet",
    currency: "Mata uang",
    holder: "Atas nama",
    holderHint:
      "Nama di buku tabungan. Pilih anggota keluarga, atau ketik nama lain (mis. anak tanpa akun).",
    holderOther: "Nama lain (ketik)",
    holderUnset: "— Belum diisi —",
    holderOtherPlaceholder: "Nama sesuai buku tabungan",
    ownershipForm: "Bentuk kepemilikan",
    ownershipHint:
      "Gabungan = joint account (dan/atau). QQ = atas nama orang lain, mis. anak di bawah umur.",
    displayName: "Nama tampilan",
    displayNameHint: "opsional — otomatis dari bank & produk",
    openingBalance: "Saldo awal",
    principal: "Nominal pokok",
    asOf: "Per tanggal",
    placementDate: "Tgl penempatan",
    balanceLockedNote: "Setelah disimpan, saldo hanya berubah lewat transaksi.",
    balancesPerCurrency: "Saldo per mata uang",
    addCurrency: "+ Tambah mata uang",
    removeCurrency: "Hapus mata uang",
    interestRate: "Bunga p.a.",
    nisbah: "Nisbah nasabah",
    optional: "opsional",
    shariaContract: "Akad",
    taxLine: "PPh final 20%",
    taxHint: "Pajak bunga tidak dipotong bila saldo ≤ Rp 7,5 juta.",
    taxForeignHint: "Pajak bunga mengikuti aturan negara bank.",
    tenor: "Tenor",
    tenorOther: "Lain",
    monthsSuffix: "bln",
    interestPayout: "Pembayaran bunga",
    maturityInstruction: "Instruksi jatuh tempo",
    payoutAccount: "Rekening tujuan bunga / pencairan",
    payoutNone: "Belum dipilih",
    maturityLabel: "Jatuh tempo",
    netInterestLabel: "Perkiraan bunga bersih per tenor",
    earlyWithdrawalNote:
      "Pencairan sebelum jatuh tempo umumnya kena penalti. Cek syarat di bilyet.",
    reminder: "Ingatkan 7 hari sebelum jatuh tempo",
    reminderHint: "Muncul di notifikasi keluarga.",
    insuranceTitle: "Penjaminan {insurer}",
    insuranceBody:
      "Total di {bank} atas nama {holder}: {total} dari batas {cap} per nasabah per bank.",
    insuranceOver: "{over} di atas batas tidak dijamin.",
    insuranceForeign: "Dijamin {insurer} sampai {cap} per nasabah per bank.",
    familyShared: "Rekening bersama keluarga",
    familySharedHint:
      "Matikan bila rekening ini milik pribadi orang yang namanya tertera.",
    ownedBy: "Milik pribadi: {name}",
    sharedWith: "Dibagikan kepada",
    sharedWithHint:
      "Untuk anggota dengan akses “data sendiri”. Master, Co-Master dan anggota berakses keluarga sudah bisa melihat semua rekening.",
    sharedWithNone: "Belum ada anggota dengan akses data sendiri.",
    sharedWithPrivate:
      "Rekening privat hanya terlihat oleh Master & Co-Master, jadi tidak bisa dibagikan.",
    shareRights: { none: "Tidak", view: "Lihat saja", post: "Bisa catat" },
    privateLabel: "Rekening privat",
    privateHint: "Hanya Master & Co-Master yang melihat.",
    status: "Status",
    moreDetails: "Detail lainnya",
    moreDetailsHint: "Cabang · rekening utama · catatan",
    branch: "Cabang",
    isPrimary: "Rekening utama / payroll",
    isPrimaryHint: "Ditandai di daftar rekening.",
    notes: "Catatan",
    reportTax: "Laporkan di SPT tahunan",
    reportTaxHint:
      "Harta di luar negeri wajib dilaporkan wajib pajak Indonesia.",
    beneficiary: "Penerima manfaat",
    beneficiaryHint: "Jika bank mendukung (nominee / payable-on-death).",
    beneficiaryNone: "Tidak ada",
    cancel: "Batal",
    save: "Simpan rekening",
    saveDeposit: "Simpan deposito",
    saving: "Menyimpan…",
    required: "Wajib diisi.",
    rateMissing: "Kurs belum tersedia. Coba lagi sebentar.",
    savedToast: "Rekening ditambahkan.",
    updatedToast: "Rekening diperbarui.",
    partialToast:
      "{ok} dari {total} mata uang tersimpan. Yang gagal: {failed}.",
    failedToast: "Gagal menyimpan rekening.",
  },
  kinds: {
    savings: "Tabungan",
    current: "Giro",
    time_deposit: "Deposito",
    planned_savings: "Tab. Berjangka",
    multi_currency: "Multi mata uang",
  },
  kindsForeign: {
    savings: "Savings",
    current: "Current",
    time_deposit: "Time deposit",
    planned_savings: "Planned savings",
    multi_currency: "Multi-currency",
  },
  institutionKinds: {
    commercial: "Bank Umum",
    digital: "Bank Digital",
    sharia: "Bank Syariah",
    rural: "BPR / BPRS",
    foreign_branch: "Kantor cabang bank asing",
    foreign: "Bank luar negeri",
  },
  ownership: { individual: "Perorangan", joint: "Gabungan", qq: "QQ" },
  statuses: {
    active: "Aktif",
    dormant: "Dorman",
    blocked: "Diblokir",
    closed: "Ditutup",
  },
  shariaContracts: {
    wadiah: "Wadiah (titipan)",
    mudharabah: "Mudharabah (bagi hasil)",
  },
  payouts: { at_maturity: "Saat jatuh tempo", monthly: "Tiap bulan" },
  instructions: { aro: "ARO", aro_plus: "ARO+", non_aro: "Non-ARO" },
  instructionHints: {
    aro: "pokok diperpanjang",
    aro_plus: "pokok+bunga",
    non_aro: "dicairkan",
  },
  countries: {
    ID: "Indonesia",
    SG: "Singapura",
    US: "Amerika Serikat",
    AU: "Australia",
    JP: "Jepang",
    CN: "Tiongkok",
    DE: "Jerman",
    NL: "Belanda",
    FR: "Prancis",
  },
  page: {
    totalLabel: "Total di bank",
    summary: "{accounts} rekening · {banks} bank",
    filteredHint: "Sesuai filter",
    axis: { bank: "Per bank", kind: "Per jenis", holder: "Per atas nama" },
    other: "Lainnya",
    liquid: "Likuid",
    liquidHint: "tabungan & giro, bisa ditarik",
    locked: "Terkunci",
    lockedHint: "{n} jatuh tempo ≤ 30 hari",
    lockedNone: "tidak ada deposito",
    insured: "Dalam batas penjaminan",
    insuredAll: "semua di bawah batas",
    insuredGap: "{amount} di atas batas",
    interest: "Bunga bersih / bulan",
    interestHint: "perkiraan, setelah PPh final",
    interestNone: "isi bunga p.a. di rekening",
    attentionTitle: "Perlu perhatian",
    attentionEmpty:
      "Semua rekening aman. Tidak ada yang perlu ditindaklanjuti.",
    attnMaturity: "{name} jatuh tempo {days} hari lagi",
    attnMaturityToday: "{name} jatuh tempo hari ini",
    attnMaturityBody: "{amount} · {instruction} · {date}",
    attnInsuranceOver: "{bank} a.n. {holder} melewati batas {insurer}",
    attnInsuranceNear: "{bank} a.n. {holder} mendekati batas {insurer}",
    attnInsuranceBody: "{total} dari {cap}",
    attnIdle: "{n} rekening tanpa transaksi 90+ hari",
    attnIdleBody: "Bisa menjadi dorman. Cek atau ubah statusnya.",
    attnTax: "{n} rekening luar negeri belum ditandai lapor SPT",
    attnTaxBody: "Harta luar negeri wajib dilaporkan di SPT tahunan.",
    see: "Lihat",
    review: "Tinjau",
    searchPlaceholder: "Cari nama, nomor, produk…",
    filterBank: "Bank",
    filterHolder: "Atas nama",
    filterKind: "Jenis",
    filterAccess: "Akses",
    filterStatus: "Status",
    all: "Semua",
    access: {
      all: "Semua",
      mine: "Milik saya",
      sharedWithMe: "Dibagikan ke saya",
      family: "Bersama keluarga",
    },
    status: { open: "Belum ditutup", all: "Semua", closed: "Ditutup" },
    clearFilters: "Reset filter",
    scrollPrev: "Bank sebelumnya",
    scrollNext: "Bank berikutnya",
    moreFilters: "Filter lainnya",
    sortLabel: "Urutkan",
    sort: {
      balance: "Saldo terbesar",
      name: "Nama A–Z",
      newest: "Transaksi terbaru",
    },
    viewLabel: "Tampilan",
    viewCards: "Kartu",
    viewTable: "Tabel",
    addAccount: "Tambah rekening",
    addAtBank: "Tambah rekening {bank}",
    hiddenEmpty: "{n} rekening saldo Rp 0 disembunyikan",
    showEmpty: "Tampilkan",
    hideEmpty: "Sembunyikan saldo Rp 0",
    accountsCount: "{n} rekening",
    shareOfTotal: "{p}% dari total",
    insuranceChip: "{insurer} {p}%",
    insuranceChipOver: "{insurer} {p}% — lewat batas",
    colAccount: "Rekening",
    colKind: "Jenis",
    colHolder: "Atas nama",
    colAccess: "Akses",
    colTerms: "Bunga / jatuh tempo",
    colBalance: "Saldo",
    familyBadge: "Bersama",
    familyHolder: "Keluarga",
    privateBadge: "Privat",
    sharedCount: "+{n} dibagikan",
    primaryBadge: "Utama",
    perAnnum: "{rate}% p.a.",
    matures: "jatuh tempo {date}",
    daysLeft: "{n} hari lagi",
    matured: "sudah jatuh tempo",
    lastActivity: "transaksi terakhir {date}",
    noActivity: "belum ada transaksi",
    idleDays: "{n} hari tanpa transaksi",
    viaRate: "≈ {amount} · kurs hari ini",
    reportTaxBadge: "lapor SPT",
    noResults: "Tidak ada rekening yang cocok dengan filter.",
    emptyState: "Belum ada rekening bank.",
    mutasi: "Mutasi",
    customize: "Ubah tampilan kartu",
    customizeShort: "Tampilan kartu",
    edit: "Edit",
    remove: "Hapus",
    options: "Opsi rekening",
    requestFunds: "Minta Dana",
  },
};

export const rekeningV3En: RekeningV3Copy = {
  form: {
    addTitle: "Add Bank Account",
    editTitle: "Edit Bank Account",
    addDepositTitle: "Add Time Deposit",
    subtitleBook: "Fill in as shown on the passbook or e-statement.",
    subtitleDeposit: "Fill in as shown on the deposit certificate.",
    subtitleForeign: "An account outside Indonesia.",
    secInstitution: "Institution",
    secProduct: "Product",
    secIdentity: "Account identity",
    secBalance: "Balance & yield",
    secPlacement: "Placement",
    secAccess: "Ownership & access",
    secCompliance: "Compliance & protection",
    country: "Bank country",
    countryDomestic: "Indonesia",
    countryForeign: "Abroad",
    countryPick: "Country",
    bank: "Bank",
    bankSearchHint: "pick or type",
    bankPlaceholder: "Choose a bank",
    bankOther: "Other bank (type the name)",
    bankTyped: "Bank name",
    institutionKind: "Institution type",
    sharia: "Sharia bank / unit",
    shariaHint: "Returns follow a contract and profit share, not interest.",
    bankCode: "Bank code",
    swift: "SWIFT / BIC",
    swiftInvalid: "A SWIFT/BIC has 8 or 11 letters/digits, e.g. CENAIDJA.",
    routing: {
      bank_code: "Bank code",
      iban: "IBAN",
      aba: "Routing number (ABA)",
      bsb: "BSB",
    },
    routingHint: "The code used to transfer into this account.",
    autoFilledHint: "Filled in from the bank list. Change it if it differs.",
    productKind: "Deposit type",
    productName: "Product name",
    productNameHint: "free text",
    productNamePlaceholder: "e.g. Tahapan Xpresi",
    accountNumber: "Account number",
    accountNumberPlaceholder: "e.g. 0087366463",
    depositNumber: "Certificate no.",
    currency: "Currency",
    holder: "Account holder",
    holderHint:
      "The name on the passbook. Pick a family member, or type another name (e.g. a child without a login).",
    holderOther: "Someone else (type)",
    holderUnset: "— Not recorded —",
    holderOtherPlaceholder: "Name as on the passbook",
    ownershipForm: "Ownership",
    ownershipHint:
      "Joint = a joint account (and/or). QQ = held on someone else's behalf, e.g. a minor.",
    displayName: "Display name",
    displayNameHint: "optional — built from bank & product",
    openingBalance: "Opening balance",
    principal: "Principal",
    asOf: "As of",
    placementDate: "Placement date",
    balanceLockedNote:
      "After saving, the balance only changes through transactions.",
    balancesPerCurrency: "Balance per currency",
    addCurrency: "+ Add currency",
    removeCurrency: "Remove currency",
    interestRate: "Interest p.a.",
    nisbah: "Customer profit share",
    optional: "optional",
    shariaContract: "Contract",
    taxLine: "20% final tax",
    taxHint:
      "Interest tax is not withheld when the balance is Rp 7.5 million or less.",
    taxForeignHint: "Interest is taxed under the bank country's rules.",
    tenor: "Tenor",
    tenorOther: "Other",
    monthsSuffix: "mo",
    interestPayout: "Interest payout",
    maturityInstruction: "At maturity",
    payoutAccount: "Interest / proceeds go to",
    payoutNone: "Not chosen",
    maturityLabel: "Matures",
    netInterestLabel: "Estimated net interest per tenor",
    earlyWithdrawalNote:
      "Withdrawing before maturity usually carries a penalty. Check the certificate terms.",
    reminder: "Remind me 7 days before maturity",
    reminderHint: "Shown in the family notifications.",
    insuranceTitle: "{insurer} protection",
    insuranceBody:
      "Total at {bank} in {holder}'s name: {total} of the {cap} cap per depositor per bank.",
    insuranceOver: "{over} above the cap is not insured.",
    insuranceForeign:
      "Insured by {insurer} up to {cap} per depositor per bank.",
    familyShared: "Shared family account",
    familySharedHint:
      "Turn off when the account personally belongs to the named holder.",
    ownedBy: "Personally owned by {name}",
    sharedWith: "Shared with",
    sharedWithHint:
      "For members with “own data” access. Master, Co-Master and members with family access already see every account.",
    sharedWithNone: "No member has own-data access yet.",
    sharedWithPrivate:
      "A private account is visible only to Master & Co-Master, so it cannot be shared.",
    shareRights: { none: "No", view: "View only", post: "Can record" },
    privateLabel: "Private account",
    privateHint: "Visible only to Master & Co-Master.",
    status: "Status",
    moreDetails: "More details",
    moreDetailsHint: "Branch · primary account · notes",
    branch: "Branch",
    isPrimary: "Primary / payroll account",
    isPrimaryHint: "Marked in the account list.",
    notes: "Notes",
    reportTax: "Report in the annual tax return",
    reportTaxHint: "Indonesian taxpayers must report assets held abroad.",
    beneficiary: "Beneficiary",
    beneficiaryHint: "If the bank supports it (nominee / payable-on-death).",
    beneficiaryNone: "None",
    cancel: "Cancel",
    save: "Save account",
    saveDeposit: "Save deposit",
    saving: "Saving…",
    required: "Required.",
    rateMissing: "Exchange rate not available yet. Try again shortly.",
    savedToast: "Account added.",
    updatedToast: "Account updated.",
    partialToast: "{ok} of {total} currencies saved. Failed: {failed}.",
    failedToast: "Could not save the account.",
  },
  kinds: {
    savings: "Savings",
    current: "Current",
    time_deposit: "Time deposit",
    planned_savings: "Planned savings",
    multi_currency: "Multi-currency",
  },
  kindsForeign: {
    savings: "Savings",
    current: "Current",
    time_deposit: "Time deposit",
    planned_savings: "Planned savings",
    multi_currency: "Multi-currency",
  },
  institutionKinds: {
    commercial: "Commercial bank",
    digital: "Digital bank",
    sharia: "Sharia bank",
    rural: "Rural bank (BPR)",
    foreign_branch: "Foreign bank branch",
    foreign: "Foreign bank",
  },
  ownership: { individual: "Individual", joint: "Joint", qq: "QQ" },
  statuses: {
    active: "Active",
    dormant: "Dormant",
    blocked: "Blocked",
    closed: "Closed",
  },
  shariaContracts: {
    wadiah: "Wadiah (safekeeping)",
    mudharabah: "Mudharabah (profit share)",
  },
  payouts: { at_maturity: "At maturity", monthly: "Monthly" },
  instructions: { aro: "ARO", aro_plus: "ARO+", non_aro: "Non-ARO" },
  instructionHints: {
    aro: "principal rolls over",
    aro_plus: "principal+interest",
    non_aro: "paid out",
  },
  countries: {
    ID: "Indonesia",
    SG: "Singapore",
    US: "United States",
    AU: "Australia",
    JP: "Japan",
    CN: "China",
    DE: "Germany",
    NL: "Netherlands",
    FR: "France",
  },
  page: {
    totalLabel: "Total in banks",
    summary: "{accounts} accounts · {banks} banks",
    filteredHint: "Matching filters",
    axis: { bank: "By bank", kind: "By type", holder: "By holder" },
    other: "Other",
    liquid: "Liquid",
    liquidHint: "savings & current, withdrawable",
    locked: "Locked",
    lockedHint: "{n} maturing within 30 days",
    lockedNone: "no time deposits",
    insured: "Within insurance cap",
    insuredAll: "everything under the cap",
    insuredGap: "{amount} above the cap",
    interest: "Net interest / month",
    interestHint: "estimate, after final tax",
    interestNone: "add the rate p.a. on an account",
    attentionTitle: "Needs attention",
    attentionEmpty: "All accounts are fine. Nothing to follow up.",
    attnMaturity: "{name} matures in {days} days",
    attnMaturityToday: "{name} matures today",
    attnMaturityBody: "{amount} · {instruction} · {date}",
    attnInsuranceOver: "{bank} for {holder} is over the {insurer} cap",
    attnInsuranceNear: "{bank} for {holder} is near the {insurer} cap",
    attnInsuranceBody: "{total} of {cap}",
    attnIdle: "{n} accounts with no transaction for 90+ days",
    attnIdleBody: "They may turn dormant. Check them or update their status.",
    attnTax: "{n} foreign accounts not marked for the tax return",
    attnTaxBody: "Assets abroad must be reported in the annual tax return.",
    see: "View",
    review: "Review",
    searchPlaceholder: "Search name, number, product…",
    filterBank: "Bank",
    filterHolder: "Holder",
    filterKind: "Type",
    filterAccess: "Access",
    filterStatus: "Status",
    all: "All",
    access: {
      all: "All",
      mine: "Mine",
      sharedWithMe: "Shared with me",
      family: "Family shared",
    },
    status: { open: "Not closed", all: "All", closed: "Closed" },
    clearFilters: "Reset filters",
    scrollPrev: "Previous banks",
    scrollNext: "More banks",
    moreFilters: "More filters",
    sortLabel: "Sort",
    sort: {
      balance: "Largest balance",
      name: "Name A–Z",
      newest: "Latest transaction",
    },
    viewLabel: "View",
    viewCards: "Cards",
    viewTable: "Table",
    addAccount: "Add account",
    addAtBank: "Add a {bank} account",
    hiddenEmpty: "{n} accounts at Rp 0 hidden",
    showEmpty: "Show",
    hideEmpty: "Hide Rp 0 balances",
    accountsCount: "{n} accounts",
    shareOfTotal: "{p}% of total",
    insuranceChip: "{insurer} {p}%",
    insuranceChipOver: "{insurer} {p}% — over cap",
    colAccount: "Account",
    colKind: "Type",
    colHolder: "Holder",
    colAccess: "Access",
    colTerms: "Rate / maturity",
    colBalance: "Balance",
    familyBadge: "Shared",
    familyHolder: "Family",
    privateBadge: "Private",
    sharedCount: "+{n} shared",
    primaryBadge: "Primary",
    perAnnum: "{rate}% p.a.",
    matures: "matures {date}",
    daysLeft: "{n} days left",
    matured: "matured",
    lastActivity: "last transaction {date}",
    noActivity: "no transactions yet",
    idleDays: "{n} days without a transaction",
    viaRate: "≈ {amount} · today's rate",
    reportTaxBadge: "tax return",
    noResults: "No account matches the filters.",
    emptyState: "No bank accounts yet.",
    mutasi: "Statement",
    customize: "Customize card",
    customizeShort: "Card look",
    edit: "Edit",
    remove: "Delete",
    options: "Account options",
    requestFunds: "Request funds",
  },
};

/** Replaces `{key}` placeholders. */
export function fill(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) =>
    k in values ? String(values[k]) : m,
  );
}
