/**
 * Kas & E-Wallet v3 copy — the /dana page, its cash and e-wallet forms and
 * the "Cocokkan saldo" dialog. Wired into id.ts / en.ts as `dana.v3`.
 */
export interface DanaV3Copy {
  page: {
    title: string;
    subtitle: string;
    transfer: string;
    addAccount: string;
    addCash: string;
    addEwallet: string;
    totalIn: string;
    showBalance: string;
    hideBalance: string;
    accountsCurrencies: string;
    filteredHint: string;
    clearFilters: string;
    cash: string;
    ewallet: string;
    accountsN: string;
    rateNote: string;
    rateNoteNone: string;
    viewRates: string;
    search: string;
    all: string;
    country: string;
    currency: string;
    owner: string;
    allCountries: string;
    allCurrencies: string;
    allOwners: string;
    family: string;
    listTitle: string;
    colAccount: string;
    colOwner: string;
    colNative: string;
    colIdr: string;
    colChecked: string;
    shared: string;
    never: string;
    checkBalance: string;
    excluded: string;
    rowMenu: string;
    edit: string;
    reconcile: string;
    remove: string;
    customize: string;
    request: string;
    empty: string;
    noResults: string;
    attentionTitle: string;
    attentionOne: string;
    attentionNever: string;
    attentionMany: string;
    reconcileCta: string;
    activityTitle: string;
    viewAll: string;
    activityEmpty: string;
    activityNote: string;
    sideTitle: string;
    sideSub: string;
    pickProvider: string;
    searchProvider: string;
    otherProvider: string;
    providerNote: string;
    manualNote: string;
    addCashHere: string;
    cashSideBody: string;
    loading: string;
    errorLoad: string;
    deleted: string;
    deleteFailed: string;
    filtersLabel: string;
    kindLabel: string;
    viewOnlyNote: string;
  };
  form: {
    addCashTitle: string;
    addCashSub: string;
    editCashTitle: string;
    addWalletTitle: string;
    addWalletSub: string;
    editWalletTitle: string;
    close: string;
    secCash: string;
    secWallet: string;
    secOpening: string;
    secAccess: string;
    cashName: string;
    cashNamePh: string;
    owner: string;
    familyOwner: string;
    currency: string;
    country: string;
    location: string;
    locationPh: string;
    optional: string;
    provider: string;
    providerCustom: string;
    providerCustomPh: string;
    walletName: string;
    walletNameSuffix: string;
    walletIdPhone: string;
    walletIdEmail: string;
    walletIdOther: string;
    walletIdHint: string;
    balanceNow: string;
    balanceDate: string;
    openingNote: string;
    openingCashHint: string;
    openingWalletHint: string;
    transferLink: string;
    balanceLocked: string;
    sharedWith: string;
    sharedPh: string;
    sharedHint: string;
    noShareable: string;
    includeNetWorth: string;
    includeCashHint: string;
    includeWalletHint: string;
    notes: string;
    manualNote: string;
    cancel: string;
    saveCash: string;
    saveWallet: string;
    saving: string;
    required: string;
    negativeWallet: string;
    rateMissing: string;
    savedCash: string;
    savedWallet: string;
    updated: string;
    failed: string;
    removeShare: string;
  };
  reconcile: {
    title: string;
    sub: string;
    recorded: string;
    counted: string;
    countedHint: string;
    diff: string;
    match: string;
    diffUp: string;
    diffDown: string;
    cancel: string;
    confirmMatch: string;
    confirmAdjust: string;
    done: string;
    doneAdjusted: string;
    held: string;
    failed: string;
  };
}

export const danaV3Id: DanaV3Copy = {
  page: {
    title: "Kas & E-Wallet",
    subtitle: "Kelola uang tunai dan saldo dompet digital lintas negara.",
    transfer: "Transfer",
    addAccount: "Tambah akun",
    addCash: "Kas tunai",
    addEwallet: "E-Wallet",
    totalIn: "Total dalam {cur}",
    showBalance: "Tampilkan saldo",
    hideBalance: "Sembunyikan saldo",
    accountsCurrencies: "{n} akun • {c} mata uang",
    filteredHint: "Sesuai filter",
    clearFilters: "Hapus filter",
    cash: "Tunai",
    ewallet: "E-Wallet",
    accountsN: "{n} akun",
    rateNote: "Kurs per {date}",
    rateNoteNone: "Semua saldo dalam Rupiah",
    viewRates: "Lihat kurs",
    search: "Cari nama akun atau penyedia…",
    all: "Semua",
    country: "Negara",
    currency: "Mata uang",
    owner: "Pemilik",
    allCountries: "Semua negara",
    allCurrencies: "Semua mata uang",
    allOwners: "Semua pemilik",
    family: "Keluarga",
    listTitle: "Daftar akun",
    colAccount: "Akun",
    colOwner: "Pemilik",
    colNative: "Saldo asli",
    colIdr: "Setara {cur}",
    colChecked: "Terakhir dicocokkan",
    shared: "Dibagikan",
    never: "Belum pernah",
    checkBalance: "Periksa saldo",
    excluded: "Tidak dihitung",
    rowMenu: "Menu {name}",
    edit: "Ubah",
    reconcile: "Cocokkan saldo",
    remove: "Hapus",
    customize: "Tampilan kartu",
    request: "Minta dana",
    empty: "Belum ada kas atau e-wallet. Tambahkan yang pertama.",
    noResults: "Tidak ada akun yang cocok dengan filter.",
    attentionTitle: "Saldo perlu diperiksa",
    attentionOne: "{name} terakhir dicocokkan {days} hari lalu.",
    attentionNever: "{name} belum pernah dicocokkan.",
    attentionMany: "{n} akun belum dicocokkan lebih dari {days} hari.",
    reconcileCta: "Cocokkan saldo",
    activityTitle: "Aktivitas terakhir",
    viewAll: "Lihat semua",
    activityEmpty: "Belum ada transaksi di kas atau e-wallet.",
    activityNote:
      "Transfer antar akun tidak menambah total kekayaan. Biaya admin dicatat terpisah.",
    sideTitle: "Tambah akun lintas negara",
    sideSub: "Pilih negara dan jenis akun.",
    pickProvider: "Pilih penyedia",
    searchProvider: "Cari penyedia…",
    otherProvider: "Penyedia lainnya / kustom",
    providerNote:
      "Daftar penyedia mengikuti negara. Ketersediaan layanan dapat berbeda.",
    manualNote: "Pencatatan manual • Tidak tersinkron otomatis.",
    addCashHere: "Tambah kas tunai ({cur})",
    cashSideBody:
      "Uang fisik dicatat dalam mata uang negaranya dan dikonversi ke Rupiah dengan kurs hari ini.",
    loading: "Memuat…",
    errorLoad: "Data kas dan e-wallet gagal dimuat. Coba muat ulang halaman.",
    deleted: "Akun dihapus",
    deleteFailed: "Gagal menghapus akun",
    filtersLabel: "Filter akun",
    kindLabel: "Jenis akun",
    viewOnlyNote: "Hanya pengelola akun yang bisa menambah akun baru.",
  },
  form: {
    addCashTitle: "Tambah Kas Tunai",
    addCashSub: "Catat uang fisik yang Anda pegang.",
    editCashTitle: "Ubah Kas Tunai",
    addWalletTitle: "Tambah E-Wallet",
    addWalletSub: "Catat saldo dompet digital Anda.",
    editWalletTitle: "Ubah E-Wallet",
    close: "Tutup",
    secCash: "Informasi kas",
    secWallet: "Informasi e-wallet",
    secOpening: "Saldo awal",
    secAccess: "Akses & pencatatan",
    cashName: "Nama kas",
    cashNamePh: "Dompet Harian",
    owner: "Pemilik dana",
    familyOwner: "Keluarga (bersama)",
    currency: "Mata uang",
    country: "Negara",
    location: "Lokasi penyimpanan",
    locationPh: "Dompet pribadi, brankas rumah…",
    optional: "(opsional)",
    provider: "Penyedia",
    providerCustom: "Nama penyedia",
    providerCustomPh: "Tulis nama penyedia",
    walletName: "Nama dompet",
    walletNameSuffix: "Pribadi",
    walletIdPhone: "Nomor ponsel terdaftar",
    walletIdEmail: "Email terdaftar",
    walletIdOther: "ID akun / nomor terdaftar",
    walletIdHint: "Gunakan nomor ponsel atau ID sesuai penyedia.",
    balanceNow: "Saldo saat ini",
    balanceDate: "Saldo per tanggal",
    openingNote: "Dicatat sebagai saldo awal, bukan pemasukan.",
    openingCashHint: "Dana dari akun lain? Gunakan",
    openingWalletHint: "Untuk top up dari rekening, gunakan",
    transferLink: "Transfer",
    balanceLocked:
      "Saldo hanya berubah lewat transaksi. Pakai “Cocokkan saldo” bila berbeda dari kenyataan.",
    sharedWith: "Dibagikan kepada",
    sharedPh: "Pilih pengguna",
    sharedHint: "Berbagi akses tidak mengubah pemilik dana.",
    noShareable: "Tidak ada anggota yang perlu dibagikan akses.",
    includeNetWorth: "Masukkan ke total kekayaan",
    includeCashHint: "Saldo kas ini akan dihitung dalam total kekayaan Anda.",
    includeWalletHint:
      "Saldo e-wallet ini akan dihitung dalam total kekayaan Anda.",
    notes: "Catatan tambahan",
    manualNote: "Pencatatan manual • Saldo diperbarui melalui transaksi",
    cancel: "Batal",
    saveCash: "Simpan kas",
    saveWallet: "Simpan e-wallet",
    saving: "Menyimpan…",
    required: "Wajib diisi",
    negativeWallet: "Saldo e-wallet tidak boleh minus",
    rateMissing: "Kurs belum tersedia. Coba lagi sebentar.",
    savedCash: "Kas tunai ditambahkan",
    savedWallet: "E-wallet ditambahkan",
    updated: "Perubahan disimpan",
    failed: "Gagal menyimpan",
    removeShare: "Hapus {name}",
  },
  reconcile: {
    title: "Cocokkan saldo",
    sub: "{name} • hitung uangnya atau buka aplikasinya, lalu isi saldo sebenarnya.",
    recorded: "Saldo tercatat",
    counted: "Saldo sebenarnya",
    countedHint: "Dalam {cur}.",
    diff: "Selisih",
    match: "Sudah cocok — tidak ada transaksi baru.",
    diffUp: "Dicatat sebagai pemasukan “Penyesuaian saldo”.",
    diffDown: "Dicatat sebagai pengeluaran “Penyesuaian saldo”.",
    cancel: "Batal",
    confirmMatch: "Tandai sudah cocok",
    confirmAdjust: "Catat selisih & tandai",
    done: "Saldo ditandai cocok",
    doneAdjusted: "Selisih dicatat, saldo sudah cocok",
    held: "Penyesuaian menunggu persetujuan kepala keluarga",
    failed: "Gagal mencocokkan saldo",
  },
};

export const danaV3En: DanaV3Copy = {
  page: {
    title: "Cash & E-Wallets",
    subtitle: "Manage cash and digital wallet balances across countries.",
    transfer: "Transfer",
    addAccount: "Add account",
    addCash: "Cash",
    addEwallet: "E-wallet",
    totalIn: "Total in {cur}",
    showBalance: "Show balances",
    hideBalance: "Hide balances",
    accountsCurrencies: "{n} accounts • {c} currencies",
    filteredHint: "Matching filters",
    clearFilters: "Clear filters",
    cash: "Cash",
    ewallet: "E-wallets",
    accountsN: "{n} accounts",
    rateNote: "Rates as of {date}",
    rateNoteNone: "All balances in Rupiah",
    viewRates: "View rates",
    search: "Search account or provider…",
    all: "All",
    country: "Country",
    currency: "Currency",
    owner: "Owner",
    allCountries: "All countries",
    allCurrencies: "All currencies",
    allOwners: "All owners",
    family: "Family",
    listTitle: "Accounts",
    colAccount: "Account",
    colOwner: "Owner",
    colNative: "Native balance",
    colIdr: "In {cur}",
    colChecked: "Last checked",
    shared: "Shared",
    never: "Never",
    checkBalance: "Check balance",
    excluded: "Not counted",
    rowMenu: "{name} menu",
    edit: "Edit",
    reconcile: "Check balance",
    remove: "Delete",
    customize: "Card look",
    request: "Request money",
    empty: "No cash or e-wallets yet. Add the first one.",
    noResults: "No accounts match the filters.",
    attentionTitle: "Balances to check",
    attentionOne: "{name} was last checked {days} days ago.",
    attentionNever: "{name} has never been checked.",
    attentionMany: "{n} accounts not checked for over {days} days.",
    reconcileCta: "Check balance",
    activityTitle: "Recent activity",
    viewAll: "View all",
    activityEmpty: "No transactions on cash or e-wallets yet.",
    activityNote:
      "Transfers between accounts don't change net worth. Admin fees are recorded separately.",
    sideTitle: "Add an account in any country",
    sideSub: "Pick the country and account type.",
    pickProvider: "Pick a provider",
    searchProvider: "Search providers…",
    otherProvider: "Other / custom provider",
    providerNote:
      "Providers follow the selected country. Availability may differ.",
    manualNote: "Manual records • Not synced automatically.",
    addCashHere: "Add cash ({cur})",
    cashSideBody:
      "Physical money is recorded in its own currency and converted to Rupiah at today's rate.",
    loading: "Loading…",
    errorLoad: "Couldn't load cash and e-wallets. Try reloading the page.",
    deleted: "Account deleted",
    deleteFailed: "Couldn't delete the account",
    filtersLabel: "Account filters",
    kindLabel: "Account type",
    viewOnlyNote: "Only account managers can add new accounts.",
  },
  form: {
    addCashTitle: "Add Cash",
    addCashSub: "Record the physical money you hold.",
    editCashTitle: "Edit Cash",
    addWalletTitle: "Add E-Wallet",
    addWalletSub: "Record your digital wallet balance.",
    editWalletTitle: "Edit E-Wallet",
    close: "Close",
    secCash: "Cash details",
    secWallet: "E-wallet details",
    secOpening: "Opening balance",
    secAccess: "Access & records",
    cashName: "Cash name",
    cashNamePh: "Daily wallet",
    owner: "Owner",
    familyOwner: "Family (shared)",
    currency: "Currency",
    country: "Country",
    location: "Storage location",
    locationPh: "Personal wallet, home safe…",
    optional: "(optional)",
    provider: "Provider",
    providerCustom: "Provider name",
    providerCustomPh: "Type the provider name",
    walletName: "Wallet name",
    walletNameSuffix: "Personal",
    walletIdPhone: "Registered phone number",
    walletIdEmail: "Registered email",
    walletIdOther: "Account ID / registered number",
    walletIdHint: "Use the phone number or ID the provider uses.",
    balanceNow: "Current balance",
    balanceDate: "Balance as of",
    openingNote: "Recorded as an opening balance, not income.",
    openingCashHint: "Money from another account? Use",
    openingWalletHint: "To top up from a bank account, use",
    transferLink: "Transfer",
    balanceLocked:
      "The balance only moves through transactions. Use “Check balance” if it differs from reality.",
    sharedWith: "Shared with",
    sharedPh: "Pick people",
    sharedHint: "Sharing access doesn't change the owner.",
    noShareable: "No members need shared access.",
    includeNetWorth: "Include in net worth",
    includeCashHint: "This cash balance counts toward your net worth.",
    includeWalletHint: "This e-wallet balance counts toward your net worth.",
    notes: "Notes",
    manualNote: "Manual records • Balance updates through transactions",
    cancel: "Cancel",
    saveCash: "Save cash",
    saveWallet: "Save e-wallet",
    saving: "Saving…",
    required: "Required",
    negativeWallet: "An e-wallet balance can't be negative",
    rateMissing: "Exchange rate not available yet. Try again shortly.",
    savedCash: "Cash added",
    savedWallet: "E-wallet added",
    updated: "Changes saved",
    failed: "Couldn't save",
    removeShare: "Remove {name}",
  },
  reconcile: {
    title: "Check balance",
    sub: "{name} • count the money or open the app, then enter the real balance.",
    recorded: "Recorded balance",
    counted: "Actual balance",
    countedHint: "In {cur}.",
    diff: "Difference",
    match: "Matches — no new transaction.",
    diffUp: "Recorded as a “Balance adjustment” income.",
    diffDown: "Recorded as a “Balance adjustment” expense.",
    cancel: "Cancel",
    confirmMatch: "Mark as matching",
    confirmAdjust: "Record difference & mark",
    done: "Balance marked as matching",
    doneAdjusted: "Difference recorded, balance matches",
    held: "The adjustment is waiting for the head's approval",
    failed: "Couldn't check the balance",
  },
};
