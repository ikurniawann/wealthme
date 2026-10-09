import type {
  MobileNavId,
  NavItemId,
  NavSectionHeaderKey,
  PageTitleId,
  ReportTabId,
} from "@/lib/nav";
import type { AssetClassKey, Role } from "@wealthme/contracts";

/**
 * EPIC-018 Task A2 — `/akun` sub-page ids. Kept local to the dictionary
 * (rather than imported from the page) since these ids are only meaningful
 * to this one page, unlike the shell's cross-file nav ids.
 */
type AkunSubpageId =
  | "profil"
  | "keamanan"
  | "koneksi"
  | "pengaturan"
  | "notif-setting"
  | "privasi"
  | "bantuan"
  | "hubungi"
  | "tentang"
  | "family";

// EPIC-021 Group F (#1) — AUD + CNY added to the supported currency list.
type AkunCurrencyCode = "IDR" | "USD" | "SGD" | "EUR" | "JPY" | "AUD" | "CNY";

/** A FAQ / help-copy answer with at most one bolded mid-sentence phrase. */
type AkunRichAnswer = {
  q: string;
  before: string;
  bold: string;
  after: string;
};

/**
 * EPIC-018 Task A2 — `/panduan` journey/feature ids, mirroring most of
 * `NavItemId` (the feature usually links to that nav page) plus two
 * features with no dedicated page (`addTransactionButton`, `search`).
 */
type PanduanFeatureId =
  | "beranda"
  | "ringkasan"
  | "rekening"
  | "dana"
  | "masterdata"
  | "addTransactionButton"
  | "transaksi"
  | "quickinput"
  | "search"
  | "anggaran"
  | "tujuan"
  | "investasi"
  | "aset"
  | "liabilitas"
  | "asuransi"
  | "laporan"
  | "kalkulator"
  | "tax"
  | "rekonsiliasi"
  | "donation"
  | "splitbill"
  | "warisan"
  | "mastercoa"
  | "ai"
  // EPIC-025 N3 prototype structural port (panduan) — the 5 topics the
  // prototype documents that had no `features` entry yet: two "Keluarga &
  // Peran" topics (akun, persetujuan) and the 3 "Keamanan" topics the old
  // 9-journey structure dropped entirely.
  | "akun"
  | "persetujuan"
  | "passwordLogin"
  | "privateCategories"
  | "apiKeyAi";

type PanduanJourneyId =
  | "start"
  | "setupMoney"
  | "trackActivity"
  | "plan"
  | "growProtect"
  | "reportsTools"
  | "familySharing"
  | "advancedConfig"
  | "aiAssistant";

/**
 * EPIC-025 N3 prototype structural port — the prototype's own 6-group
 * layout (`docs/prototype/pages/panduan.html`), added alongside the
 * pre-existing 9-journey structure above rather than replacing it (the
 * `journeys`/`features` keys already shipped must not be removed/renamed).
 * The page now renders from `groups`/`areaLabels` instead of `journeys`.
 */
type PanduanGroupId =
  | "memulai"
  | "transaksi"
  | "anggaran"
  | "laporan"
  | "keluarga"
  | "keamanan";

type PanduanFaqLinkItem = {
  q: string;
  before: string;
  linkLabel: string;
  after: string;
};

type PanduanFaqStrongItem = {
  q: string;
  before: string;
  strong: string;
  after: string;
};

/** EPIC-018 Task A4 — `/asuransi` insurance type/period/status enum ids
 * (mirror the `InsuranceType` / `PremiumPeriod` / `InsuranceStatus` contracts
 * — persisted values stay unchanged, only their display labels translate).
 * EPIC-021 Group D (#13) added "pendidikan" alongside the rest. */
type AsuransiInsuranceTypeId =
  | "jiwa"
  | "kesehatan"
  | "kendaraan"
  | "properti"
  | "pendidikan"
  | "lainnya";

type AsuransiPremiumPeriodId = "monthly" | "quarterly" | "yearly";

type AsuransiStatusId = "aktif" | "tidak_aktif" | "kadaluarsa";

/** EPIC-018 Task A4 — `/kalkulator` sub-tool tab ids. */
type KalkulatorTabId =
  | "zakat"
  | "pph21"
  | "investasi"
  | "kredit"
  | "pensiun"
  | "tabungan"
  | "splitgroup";

/**
 * EPIC-018 Task A4 — `/quickinput` quick-action card ids. Structural and
 * page-local — independent of the `CrudEntity` values consumed by the
 * shared `CrudModal` (which stay untranslated, see `types.ts` comment at
 * `quickinput` below).
 */
type QuickInputCardId =
  | "transaksi"
  | "investasi"
  | "rekening"
  | "ewallet"
  | "aset"
  | "liabilitas"
  | "asuransi"
  | "tujuan"
  | "anggaran"
  | "warisan"
  | "donasi"
  | "splitbill";

/** EPIC-018 Task A5 — `/investasi` instrument type ids (mirrors `InvestmentType`
 * — persisted values stay unchanged, only display labels translate). */
type InvestasiTypeId =
  | "saham"
  | "reksa_dana"
  | "obligasi"
  | "emas"
  | "kripto"
  | "lainnya"
  // EPIC-024 C2/C3 (D10) — new investment type: nominal, bunga %/thn, jatuh
  // tempo, valued by simple interest.
  | "deposito";

/** EPIC-018 Task A5 — `/aset` physical-asset type ids. */
type AsetTypeId =
  | "properti"
  | "kendaraan"
  | "elektronik"
  | "perhiasan"
  | "emas"
  | "lainnya";

/** EPIC-018 Task A5 — `/aset` account-type ids used on the combined "Dana &
 * Rekening" cards (mirrors `Account.type`). */
type AsetAccountTypeId =
  | "bank"
  | "ewallet"
  | "cash"
  | "investment"
  | "property";

/** EPIC-018 Task A5 — `/aset` filter-tab ids. */
type AsetTabId = "semua" | "dana" | "rekening" | "investasi" | "fisik";

/** EPIC-018 Task A5 — `/liabilitas` liability type ids (mirrors `LiabilityType`
 * — persisted values stay unchanged, only display labels translate). */
type LiabilitasTypeId =
  | "kartu_kredit"
  | "pinjaman_pribadi"
  | "kpr"
  | "kendaraan"
  | "lainnya";

/** Revisi G — `/liabilitas` interest method ids (mirrors Prisma `InterestMethod`). */
type LiabilitasInterestMethodId = "efektif" | "flat" | "anuitas";

/** Revisi K — `/liabilitas` KPR scheme preset ids. */
type LiabilitasKprPresetId =
  | "manual"
  | "flpp_tapak"
  | "flpp_rusun"
  | "konvensional"
  | "berjenjang"
  | "syariah_murabahah"
  | "syariah_mmq";

/** Revisi K — `/liabilitas` early-repayment mode ids (mirrors `PrepaymentMode`). */
type LiabilitasPrepaymentModeId =
  | "full"
  | "reduce_tenor"
  | "reduce_installment";

/**
 * EPIC-018 Task A5 — `/masterdata` system reference-group ids (mirrors the
 * `CrudEntity` `md*` variants). Each group's `title`/`label` translate; the
 * groups' local `items` reference lists (bank names, e-wallet brands, etc.)
 * stay untranslated in the page — same value-locked-copy caveat Task A4
 * documented for the shared, untranslated `crud-config.ts` select options.
 */
type MasterDataGroupId = "mdbank" | "mdewallet" | "mdlembaga";

/** EPIC-018 Task A5 — `/mastercoa` chart-of-accounts group numbers (1-6). */
type MasterCoaGroupNum = 1 | 2 | 3 | 4 | 5 | 6;

type MasterCoaDirectionId = "INCOME" | "EXPENSE" | "TRANSFER";

type MasterCoaBudgetTypeId = "FIXED" | "VARIABLE" | "REIMBURSEMENT";

/** EPIC-018 Task A6 — `/tujuan` goal-status ids (mirrors `GoalStatus` —
 * persisted values stay unchanged, only display labels translate). */
type TujuanStatusId = "achieved" | "on_track" | "needs_boost" | "at_risk";

/** EPIC-021 #3 — `/dana` cash/e-wallet entity ids (mirrors `Account.type`
 * subset used on this page — persisted values stay unchanged, only the
 * entity display label and toast copy translate). */
type DanaEntityId = "cash" | "ewallet";

/** EPIC-018 Task A6 — `/tax` SPT-status ids (mirrors `SptStatus`). */
type TaxSptStatusId = "belum_lapor" | "sudah_lapor" | "terlambat";

/** Task 9 (sub-plan L) — `/tax` PTKP status ids for the detailed PPh OP
 * calculator's marital-status select (mirrors `TaxMaritalStatus`). */
type TaxMaritalStatusId = "TK" | "K" | "KI";

/** Task 9 (sub-plan L) — DTP incentive sector/employment/reason ids
 * (mirror the contracts' `DtpSector` and `DtpReason` unions; `none` is a
 * local addition for "not a covered sector" in the select). */
type TaxDtpSectorId =
  | "none"
  | "alas_kaki"
  | "tekstil_pakaian"
  | "furnitur"
  | "kulit"
  | "pariwisata";
type TaxDtpReasonId =
  | "no_program"
  | "sector_not_covered"
  | "gross_above_cap"
  | "daily_wage_above_cap"
  | "nik_not_validated";

/** Task 10 (sub-plan L) — final-tax instrument ids (mirrors contracts'
 * `TaxFinalInstrument`). */
type TaxFinalInstrumentId =
  | "bunga_deposito"
  | "bunga_tabungan"
  | "dividen"
  | "saham_idx"
  | "kupon_sbn"
  | "reksa_dana"
  | "p2p"
  | "kripto_domestik"
  | "kripto_luar"
  | "emas"
  | "sewa";

/** Task 10 — machine-readable final-tax line caveats (mirrors contracts'
 * `FinalTaxLineDto["caveat"]`, excluding `null`). */
type TaxFinalCaveatId =
  | "assumed_domestic"
  | "assumed_sbn"
  | "no_purchase_date"
  | "no_interest_rate";

/** Task 11 (sub-plan L) — crypto exchange ids for the per-line exchange
 * select on the investment tax card (mirrors contracts' `CryptoExchangeKind`). */
type TaxCryptoExchangeId = "domestik" | "luar_negeri";

/** EPIC-018 Task A6 — `/rekening` account-type ids (local wording distinct
 * from `aset.accountTypeLabels` — same keys as `Account.type`, different
 * copy for this page's context). */
type RekeningAccountTypeId =
  | "bank"
  | "ewallet"
  | "cash"
  | "investment"
  | "property";

/** EPIC-018 Task A6 — `/donation` donation-type ids (mirrors `DonationType`
 * — persisted values stay unchanged, only display labels translate). */
type DonationTypeId =
  | "zakat_maal"
  | "zakat_fitrah"
  | "infaq"
  | "sedekah"
  | "wakaf"
  // EPIC-023 F2 (D20, US-DON-6/7) — the obligatory Christian contribution.
  | "persepuluhan"
  | "lainnya";

/** EPIC-018 Task A6 — `/anggaran` COA budget-type ids (mirrors `BudgetType`
 * plus the local "OTHER" fallback bucket). */
type AnggaranBudgetTypeId = "FIXED" | "VARIABLE" | "REIMBURSEMENT" | "OTHER";

/** EPIC-018 Task A6 — `/anggaran` budget-period ids (mirrors `BudgetPeriod`). */
type AnggaranPeriodId = "monthly" | "weekly" | "yearly";

/** EPIC-018 Task A6 — `/transaksi` transaction-type ids (mirrors
 * `TransactionDto.type` — persisted values stay unchanged). */
type TransaksiTypeId = "income" | "expense" | "transfer";

/** EPIC-018 Task A6 — `/transaksi` filter-pill ids (structural + one
 * accountName-heuristic filter, see the page's `FilterValue` comment). */
type TransaksiFilterId =
  | "all"
  | "income"
  | "expense"
  | "transfer"
  | "kartu_kredit";

/** EPIC-018 Task A6 — `/transaksi` sort-order ids. */
type TransaksiSortId = "newest" | "oldest";

/** EPIC-018 Task A6 — `/rekonsiliasi` wizard step numbers (1-4). */
type RekonsiliasiStepNum = 1 | 2 | 3 | 4;

/**
 * EPIC-023 Task C retry (six-reviewer finding) — mirrors the API's `Role`
 * enum in full (all six values). Shared across every page that displays a
 * member's role (`/laporan`'s family roster, `/akun`'s member list, ...) via
 * `common.roleLabels` so a role localizes identically everywhere instead of
 * each page inventing its own partial map — the previous `/laporan`-only
 * map covered just 3 of 6 roles and its "admin" key didn't even match the
 * real enum value `admin_staff`. Persisted values stay unchanged — only
 * display labels translate.
 *
 * EPIC-023 Task C retry (MEDIUM six-reviewer finding) — derived from
 * `@wealthme/contracts`'s `RoleSchema`-backed `Role` type instead of
 * restating the six literals by hand: this was the fourth place the role
 * list was hand-typed (Prisma's `Role` enum, `packages/contracts`'s
 * `RoleSchema`, this file, and `dictionary.test.ts`'s coverage test), with no
 * barrier stopping the two from drifting apart — `apps/web` already depends
 * on `@wealthme/contracts` in dozens of other files.
 */
type MemberRoleId = Role;

/** EPIC-018 Task A3 — `/laporan` export-panel report-type ids (mirrors
 * `ExportReportType` from `@wealthme/contracts`, kept local to the
 * dictionary rather than imported — matching this file's convention of not
 * depending on API contract types here). */
type LaporanExportTypeId =
  | "summary"
  | "bank"
  | "detail"
  | "pnl"
  | "balance-sheet"
  | "cashflow";

export type I18nDictionary = {
  locale: "id" | "en";
  legal: {
    privacyTitle: string;
    termsTitle: string;
    licenseTitle: string;
    contentNotice: string;
    backToLogin: string;
    privacyLink: string;
    termsLink: string;
    licenseLink: string;
  };
  greeting: {
    morning: string;
    afternoon: string;
    afternoon2: string;
    evening: string;
  };
  common: {
    /** Searchable emoji picker (components/wm/emoji-picker.tsx) — shared by
     *  the CRUD modal's `iconpick` field and the budget dialog, which used to
     *  ship two different fixed emoji grids. */
    emojiSearchPlaceholder: string;
    emojiNoResults: string;
    emojiLoading: string;
    emojiGroupAriaLabel: string;
    /** B7 (client revision round 2) — the ONE shared asset-class taxonomy
     * label set, used everywhere a /aset, /investasi or /warisan category
     * badge renders (see @wealthme/contracts `AssetClassKey` + its mappers).
     * The underlying stored type/category value never changes — only this
     * display label. */
    assetClassLabels: Record<AssetClassKey, string>;
    /** Shared "Opsi lanjutan" disclosure summary (components/crud/advanced-disclosure.tsx). */
    advancedOptions: string;
    /** Single-date picker (components/wm/date-range-field.tsx `DateField`). */
    datePickerPlaceholder: string;
    datePickerYearLabel: string;
    datePickerClear: string;
    balance: string;
    income: string;
    expense: string;
    net: string;
    save: string;
    saving: string;
    apply: string;
    cancel: string;
    loading: string;
    error: string;
    viewAll: string;
    add: string;
    edit: string;
    delete: string;
    confirm: string;
    back: string;
    toggleBalance: string;
    period: string;
    summary: string;
    transactions: string;
    goals: string;
    accounts: string;
    noData: string;
    today: string;
    yesterday: string;
    cashFlow: string;
    surplus: string;
    latest: string;
    viewDetail: string;
    total: string;
    // Bento v2 shared actions.
    undo: string;
    close: string;
    pay: string;
    optional: string;
    savingsRate: string;
    income2: string;
    expense2: string;
    transfer: string;
    sparkLabels: [string, string, string, string, string];
    /** Screen-reader words for the shared delta rule (lib/delta.ts): direction + valence. */
    delta: {
      up: string;
      down: string;
      flat: string;
      good: string;
      bad: string;
    };
    /** EPIC-023 Task C retry — see `MemberRoleId` above. */
    roleLabels: Record<MemberRoleId, string>;
    // A2 (revisi-2) — `useApiError`'s generic fallbacks. Never a status
    // code, request id, or raw server string — see the hook's own comment.
    apiError: {
      sessionExpired: string;
      accessDenied: string;
      generic: string;
      // Hardening audit (errors) — apiFetch's dedicated timeout message,
      // distinct from `generic` so a hung request reads differently from a
      // generic failure.
      timeout: string;
    };
  };
  beranda: {
    // Bento v2 Beranda.
    v2: {
      heroCaption: string;
      heroNegative: string;
      chartMode: string;
      chartCashflow: string;
      chartWealth: string;
      cashflowAria: string;
      income: string;
      expense: string;
      saved: string;
      vsLastMonth: string;
      compareWindow: string;
      compareFullMonth: string;
      expenseMonth: string;
      dueOverdue: string;
      accountsTitle: string;
      accountsCap: string;
      addAccount: string;
      noAccounts: string;
      accountsScroll: string;
      actRecord: string;
      actHistory: string;
      actBudget: string;
      actReport: string;
      membersTitle: string;
      manageMembers: string;
      you: string;
      limitTitle: string;
      limitCap: string;
      limitEdit: string;
      limitSpent: string;
      limitAria: string;
      noBudget: string;
      makeBudget: string;
      calmTitle: string;
      calmBody: string;
      approvalsTitle: string;
      dueTitle: string;
      openApprovals: string;
      openLiabilities: string;
      allocationTitle: string;
      allocationCap: string;
      noAllocation: string;
      healthTitle: string;
      healthCap: string;
      savedShare: string;
      healthNote: string;
      goalsTitle: string;
      addGoal: string;
      goalLeft: string;
      goalDone: string;
      goalPaceOnTrack: string;
      goalPaceLate: string;
      goalPaceDone: string;
      historyTitle: string;
      seeAllHistory: string;
      seeAll: string;
      detail: string;
      mExpense: string;
      mLastTx: string;
      range7: string;
      range30: string;
      rangeAria: string;
      chartBars: string;
      chartLine: string;
      savings: string;
      flowAria: string;
      spendTitle: string;
      spendCap: string;
      noSpend: string;
      days30: string;
      health30Note: string;
      today: string;
      uncategorized: string;
      mStats: string;
      prevAccount: string;
      nextAccount: string;
    };
    setupChecklist: {
      title: string;
      nextStep: string;
      dismissAriaLabel: string;
      progressLabelTemplate: string;
      steps: {
        account: string;
        budget: string;
        transaction: string;
        family: string;
        goal: string;
      };
    };
    title: string;
    totalWealth: string;
    thisMonth: string;
    recentTransactions: string;
    financialGoals: string;
    wealthBreakdown: string;
    subtitle: string;
    loadError: string;
    noTransactions: string;
    noGoals: string;
    addGoalCta: string;
    goalRemainingPrefix: string;
    goalRemainingSuffix: string;
    goalAchieved: string;
    aiInsightTitle: string;
    aiInsightBody: string;
    aiInsightCta: string;
    dateLocale: string;
    // EPIC-025 N3-G1 — bento-hero layout port + ApexCharts swap.
    wealthComposition: string;
    liquidAssets: string;
    nonLiquidAssets: string;
    cashflowThisMonth: string;
    needsAttentionTitle: string;
    pendingApprovalsNotice: string;
    liabilityDueNotice: string;
    liabilityInstallmentProgress: string;
    noNotices: string;
    // EPIC-025 N3 fidelity follow-up — prototype's `.bento-side` budget
    // card + composition-row badges/due-notice + Arus Kas period toggle.
    budgetCardTitlePrefix: string;
    budgetManageLink: string;
    budgetOverBudgetPrefix: string;
    budgetEmptyNote: string;
    liquidBadgeLabel: string;
    nonLiquidBadgeLabel: string;
    cashflowTitle6: string;
    cashflowTitle12: string;
    periodToggle6: string;
    periodToggle12: string;
    periodToggleAriaLabel: string;
    // EPIC-026 Wave 8 — prototype beranda card actions ("Lihat ringkasan"
    // on `.bento-snapshot`, "Detail" on `.bento-allocation`); previously
    // hardcoded at the call site.
    viewSummaryLink: string;
    donutCenterLabel: string;
    allocationDetailLink: string;
    historyChartAriaLabel: string;
    historyEmpty: string;
  };
  /**
   * Shell-owned copy: sidebar/topbar/mobile nav chrome, the global
   * add-transaction dialog, theme controls, and the global search dialog.
   * Keyed by the structural ids exported from `@/lib/nav` so a missing
   * translation for a real nav/report/page id is a compile error.
   */
  shell: {
    loading: string;
    addTransactionTooltip: string;
    openMenu: string;
    closeMenu: string;
    navMenuTitle: string;
    // EPIC-026 shell migration — distinct landmark name for the bottom bar so
    // it isn't ambiguous with the drawer nav when both are exposed on mobile.
    mobileNavTitle: string;
    // EPIC-026 shell migration — desktop sidebar collapse toggle. The label
    // flips with the pressed state so a screen reader announces the action,
    // not just the widget.
    collapseSidebar: string;
    expandSidebar: string;
    search: string;
    notifications: string;
    addTransaction: string;
    searchPlaceholder: string;
    logout: string;
    navSectionHeaders: Record<NavSectionHeaderKey, string>;
    navSections: Record<NavItemId, string>;
    hubs: {
      accounts: string;
      cashflow: string;
      wealth: string;
      taxZakat: string;
      settings: string;
      menu: string;
    };
    // Bento v2 shell: phone greeting + title, launcher, topbar controls.
    v2: {
      greetingMorning: string;
      greetingAfternoon: string;
      greetingEvening: string;
      greetingNight: string;
      homeTitle: string;
      searchShort: string;
      allMenu: string;
      launcherMain: string;
      toggleTheme: string;
      account: string;
      language: string;
      accountMenu: string;
      notificationsUnread: string;
      noResults: string;
      pagesGroup: string;
    };
    reportTabs: Record<ReportTabId, string>;
    pageTitles: Record<PageTitleId, string>;
    mobileNav: Record<MobileNavId, string>;
    transactionDialog: {
      tabIncome: string;
      tabExpense: string;
      tabTransfer: string;
      tabCreditCard: string;
      tabIncomeShort: string;
      tabExpenseShort: string;
      tabTransferShort: string;
      tabCreditCardShort: string;
      saveFailedPrefix: string;
      retryFallback: string;
      invalidAmount: string;
      selectAccountFirst: string;
      // EPIC-023 Task E3 (D12) — the card tab's own account-equivalent
      // validation message.
      selectCardFirst: string;
      noFamilyGroup: string;
      savedAddMoreToast: string;
      savedToast: string;
      // EPIC-023 Task D (D3/D9, US-FAM-14) — held pending approval, not a
      // success.
      heldToast: string;
      title: string;
      manualInput: string;
      scanReceipt: string;
      newBadge: string;
      amountLabel: string;
      quickAddAriaLabel: string;
      categoryLabel: string;
      accountLabel: string;
      /** EPIC-021 Group B (#23/#27) — two-account transfer fields, Transfer tab only. */
      sourceAccountLabel: string;
      sourceAccountPlaceholder: string;
      destAccountLabel: string;
      destAccountPlaceholder: string;
      selectDestAccountFirst: string;
      sameAccountError: string;
      adminFeeLabel: string;
      dateLabel: string;
      /** audit P2-4/AC-7 — inline error when the date field is cleared. */
      dateRequiredError: string;
      descriptionLabel: string;
      optionalSuffix: string;
      descriptionPlaceholder: string;
      categoryPlaceholder: string;
      accountPlaceholder: string;
      // EPIC-023 Task E3 (D12) — the card tab's own picker labels.
      cardLabel: string;
      cardPlaceholder: string;
      saving: string;
      saveTransaction: string;
      saveAndAddMore: string;
      /** Carries `{shown}` and `{total}` placeholders. */
      tilesVisibleCount: string;
      scanTitle: string;
      scanSubtitle: string;
      scanGuidanceReady: string;
      scanGuidanceScanning: string;
      resultTitle: string;
      resultSubtitle: string;
      merchantLabel: string;
      totalLabel: string;
      detectedBadge: string;
      scanAgain: string;
      // EPIC-027 B1-B4 (D8/D9/D10) — real getUserMedia capture, real OCR
      // result, review-then-prefill. The simulated receipt (and the keys
      // that only existed to narrate it) is gone.
      scanCapture: string;
      scanStarting: string;
      scanUse: string;
      scanPrefilledToast: string;
      scanHint: string;
      scanUnavailable: string;
      scanUnavailableLink: string;
      categoryUnmatched: string;
      cameraErrorInsecure: string;
      cameraErrorUnsupported: string;
      cameraErrorPermission: string;
      cameraErrorNotFound: string;
      cameraErrorInUse: string;
      cameraErrorUnknown: string;
      cameraRetry: string;
      captureFailed: string;
      // EPIC-027 B9-B11 — the upload path next to the camera. Each rejection
      // has its own message: a HEIC from an iPhone, a PDF, a 30 MB video and
      // a truncated PNG need four different actions from the user.
      scanUpload: string;
      scanUploadReading: string;
      scanNoCamera: string;
      scanUploadGuidance: string;
      uploadErrorEmpty: string;
      uploadErrorFileTooLarge: string;
      uploadErrorPdf: string;
      uploadErrorNotImage: string;
      uploadErrorHeic: string;
      uploadErrorNoCanvas: string;
      uploadErrorTooSmall: string;
      uploadErrorTooLarge: string;
      uploadErrorDecodeFailed: string;
      uploadErrorDimensions: string;
      /** One message per `code` from apps/api/.../ocr-http-error.util.ts. */
      scanErrorNotConfigured: string;
      scanErrorKeyCorrupted: string;
      scanErrorAuth: string;
      scanErrorRateLimited: string;
      scanErrorRateLimitedRetryIn: string;
      scanErrorRateLimitedDaily: string;
      scanErrorTimeout: string;
      scanErrorParseFailed: string;
      scanErrorUpstream: string;
      /** 413 from the API's body-parser limit (code PAYLOAD_TOO_LARGE) —
       * a size problem the user can act on, not a failed scan. */
      scanErrorPayloadTooLarge: string;
      // EPIC-024 Task L3 (US-TXN-9) — receipt/photo attachment on the
      // manual-entry form (income/expense/transfer tabs only; the card tab
      // posts through liabilities.purchase(), which returns no
      // transactionId to attach to).
      attachmentLabel: string;
      attachmentPlaceholder: string;
      attachmentSelected: string;
      attachmentUploadFailedToast: string;
      // EPIC-024 Task L3 (US-TXN-9) — client-side pre-check rejections (the
      // server is authoritative; these only save a round trip for an
      // obviously-bad file).
      attachmentInvalidTypeToast: string;
      attachmentTooLargeToast: string;
      // polish-j batch 7a item 6 dropped the dialog's own `.dialog__desc`
      // ("Catat pemasukan, pengeluaran, transfer, atau belanja kartu
      // kredit.") — the tab strip itself already says which of those this
      // is. `.dialog__footer` Batal button is unaffected.
      modeSwitchLabel: string;
      typeSwitchLabel: string;
    };
    themeToggle: {
      ariaLabel: string;
      title: string;
    };
    themePicker: {
      ariaLabel: string;
      title: string;
    };
    // A3 (revisi-2) — ID/EN toggle in the topbar, next to the dark-mode
    // toggle. `ariaLabel` is a template: "%s" is replaced with the current
    // locale's code (ID/EN).
    localeSwitcher: {
      ariaLabel: string;
    };
    searchDialog: {
      ariaLabel: string;
      placeholder: string;
      dialogTitle: string;
      financialResultsHeader: string;
      noResultsFor: string;
      typeToSearchHint: string;
      clearAriaLabel: string;
    };
  };
  /**
   * Batch 4 item 3 — `/akses-saya` (row-scoped member landing page) copy
   * that must vary by viewer role. Only the strings that actually differ
   * per role are here; the rest of the page's copy predates i18n and is
   * out of this batch's scope.
   */
  iam: {
    viewBalancesLabel: string;
    viewBalancesHint: string;
    v2: {
      heroCap: string;
      addBtn: string;
      kpiMaster: string;
      kpiManaged: string;
      kpiCustom: string;
      stepsTitle: string;
      stepsCaption: string;
      step1Title: string;
      step1Text: string;
      step2Title: string;
      step2Text: string;
      step3Title: string;
      step3Text: string;
      tabsLabel: string;
      tabMembers: string;
      tabRoles: string;
      tabsNote: string;
      chartAria: string;
      chartUnit: string;
      rolesCardTitle: string;
      rolesCardCap: string;
      rolesCardCreateBtn: string;
      rolesCardEmpty: string;
      stepsToggleShow: string;
      stepsToggleHide: string;
    };
  };
  aksesSaya: {
    v2: {
      heroDesc: string;
      heroCap: string;
      rolePrefix: string;
      kpiBalance: string;
      kpiReports: string;
      kpiRole: string;
      accTitle: string;
      accEmptyTitle: string;
      accEmptyHint: string;
      accNote: string;
      permAccTitle: string;
      permAccLoading: string;
      permAccNone: string;
      permAccCount: string;
      permAccDescYes: string;
      permAccDescNo: string;
      permBalTitle: string;
      permBalValue: string;
      permBalDesc: string;
      permRepTitle: string;
      actTitle: string;
      actCaption: string;
      actBadge: string;
      colActivity: string;
      colStatus: string;
      colNote: string;
      actRecord: string;
      actRecordYes: string;
      actRecordWait: string;
      actFund: string;
      actFundNote: string;
      actAllowed: string;
      actReports: string;
      actRole: string;
      actLocked: string;
      actRoleNote: string;
    };
    eyebrowMaster: string;
    eyebrowDependant: string;
    familyReportsUnlocked: string;
    familyReportsLocked: string;
    familyReportsUnlockedDescription: string;
    familyReportsLockedDescription: string;
    /** Batch 5 (controller-added) — "Aktivitas yang Diizinkan" table's own
     * "Melihat laporan keluarga" row status/note, derived from role like
     * the permission card above it instead of hardcoded to always-locked. */
    familyReportsRowStatusUnlocked: string;
    familyReportsRowNoteUnlocked: string;
    familyReportsRowNoteLocked: string;
  };
  /** EPIC-018 A2 — `/akun` page and sub-page copy. */
  akun: {
    tabs: {
      profil: string;
      keamanan: string;
      preferensi: string;
      bantuan: string;
      ariaLabel: string;
    };
    heroMemberSince: string;
    heroEditProfileLabel: string;
    avatar: {
      change: string;
      remove: string;
      uploading: string;
      invalidType: string;
      tooLarge: string;
      uploadFailed: string;
      removeFailed: string;
      removed: string;
      updated: string;
    };
    usernameLoginHint: string;
    heroKpiFamilyLabel: string;
    heroKpiSessionsLabel: string;
    heroKpiThemeLabel: string;
    heroProgressTitle: string;
    heroProgressSteps: {
      basic: string;
      account: string;
      budget: string;
      member: string;
      goal: string;
    };
    loadProfileError: string;
    familyGroupCardTitle: string;
    noFamilyGroup: string;
    createOrJoinFamilyGroup: string;
    memberCountSuffix: string;
    logoutButton: string;
    sectionAkun: string;
    sectionPengaturan: string;
    sectionBantuan: string;
    menuProfilName: string;
    menuKeamananName: string;
    menuKeamananSub: string;
    menuKoneksiName: string;
    menuKoneksiSub: string;
    menuPengaturanName: string;
    menuPengaturanSub: string;
    menuNotifName: string;
    menuNotifSub: string;
    menuPrivasiName: string;
    menuPrivasiSub: string;
    menuBantuanName: string;
    menuBantuanSub: string;
    menuHubungiName: string;
    menuHubungiSub: string;
    menuTentangName: string;
    menuTentangSub: string;
    subpageTitles: Record<AkunSubpageId, string>;
    profil: {
      noticeTemplate: string;
      nameLabel: string;
      emailLabel: string;
      phoneLabel: string;
      phonePlaceholder: string;
      birthDateLabel: string;
      genderLabel: string;
      genderOptions: { male: string; female: string };
      jobTitleLabel: string;
      jobTitlePlaceholder: string;
      monthlyIncomeLabel: string;
      monthlyIncomePlaceholder: string;
      saveButton: string;
    };
    keamanan: {
      dialogTitle: string;
      currentPwLabel: string;
      currentPwPlaceholder: string;
      newPwLabel: string;
      newPwPlaceholder: string;
      confirmPwLabel: string;
      confirmPwPlaceholder: string;
      savingLabel: string;
      passwordSectionTitle: string;
      changePasswordRowName: string;
      changePasswordRowSub: string;
      pinRowName: string;
      pinRowSub: string;
      authSectionTitle: string;
      bigTxnLabel: string;
      bigTxnSub: string;
      newLoginLabel: string;
      newLoginSub: string;
      authNote: string;
      sessionSectionTitle: string;
      sessionActivePrefix: string;
      deviceFallbackLabel: string;
      thisDeviceBadge: string;
      endSessionLink: string;
      sessionsShowAll: string;
      sessionsShowLess: string;
      sessionsLoading: string;
      sessionsEmpty: string;
      sessionsError: string;
      toastPasswordMinLength: string;
      toastPasswordMismatch: string;
      toastChangeFailed: string;
      toastChangeSuccess: string;
      toastSessionEnded: string;
      toastSessionEndFailed: string;
      toastAuthPrefsSaved: string;
      toastAuthPrefsFailed: string;
    };
    koneksi: {
      bankSectionTitle: string;
      addButton: string;
      ewalletSectionTitle: string;
      manualLabel: string;
      emptyBank: string;
      emptyEwallet: string;
    };
    pengaturan: {
      currencySectionTitle: string;
      currencyHint: string;
      currencies: Record<AkunCurrencyCode, { title: string; name: string }>;
      displaySectionTitle: string;
      languageLabel: string;
      dateFormatLabel: string;
      themeLabel: string;
      themeOptions: { light: string; dark: string; system: string };
      dataSectionTitle: string;
      dataCardTitle: string;
      englishLabel: string;
      dangerZoneTitle: string;
      dangerZoneCaption: string;
      dangerZoneButton: string;
      hideBalanceLabel: string;
      hideBalanceSub: string;
      weeklySummaryLabel: string;
      weeklySummarySub: string;
      saveButton: string;
      toastCurrencyUpdated: string;
      toastCurrencyFailed: string;
      toastSettingsSaved: string;
      /**
       * EPIC-021 Group F (#6) — family-wide manual gold price per gram.
       * No live gold price feed exists or may be fabricated (Open Design
       * Decision #6); every display must carry the manual-entry disclosure.
       */
      goldPriceSectionTitle: string;
      goldPriceHint: string;
      goldPriceLabel: string;
      goldPricePlaceholder: string;
      goldPriceSaveButton: string;
      goldPriceUnsetLabel: string;
      goldPriceManualLabelPrefix: string;
      goldPriceOwnerOnlyNote: string;
      toastGoldPriceUpdated: string;
      toastGoldPriceFailed: string;
      toastGoldPriceInvalid: string;
      /**
       * EPIC-023 F2 (D20, US-DON-6/7) — family religion setting (zakat vs.
       * perpuluhan vs. neither), same owner-writable/member-readable shape
       * as the gold price block above.
       */
      religionSectionTitle: string;
      religionHint: string;
      religionOptions: Record<
        "islam" | "kristen" | "katolik" | "hindu" | "buddha" | "none",
        string
      >;
      religionLabel: string;
      religionSaveButton: string;
      religionOwnerOnlyNote: string;
      toastReligionUpdated: string;
      toastReligionFailed: string;
      /**
       * EPIC-023 Group F fix round (MEDIUM 9) — the fourth, honest state:
       * "not yet chosen". Shown as a disabled placeholder option in the
       * owner's select (never a persisted, selectable value — the write
       * DTO stays the three real choices) and as the display label for a
       * non-owner viewing an unconfirmed family.
       */
      religionUnconfirmedPlaceholder: string;
      religionUnconfirmedLabel: string;
      /**
       * EPIC-023 Group F final fix round (MEDIUM 3) — a pending fetch must
       * render its OWN neutral state, never the "not yet chosen" copy above:
       * both `isLoading` and `religion === null` resolve to a `null`
       * `currentReligion`, so the two states must not look the same.
       */
      religionLoadingLabel: string;
      religionErrorLabel: string;
      /**
       * EPIC-023 G3 (D16) — bring-your-own AI provider key. Owner/spouse
       * manage it; every other role sees a read-only status (see
       * casl-ability.factory.ts's AiKey subject).
       */
      aiKeySectionTitle: string;
      aiKeyHint: string;
      aiKeyConfiguredLabel: string;
      aiKeyProviderLabel: string;
      aiKeyProviderOptions: Record<"claude" | "openai" | "gemini", string>;
      aiKeyInputLabel: string;
      aiKeyInputPlaceholder: string;
      aiKeySaveButton: string;
      aiKeyRemoveButton: string;
      aiModelLabel: string;
      /** Carries a `{model}` placeholder. */
      aiModelDefaultOption: string;
      aiModelDefaultOptionPlain: string;
      aiModelDefaultSuffix: string;
      aiModelLoading: string;
      aiModelHint: string;
      aiModelLoadFailed: string;
      aiKeyOwnerOnlyNote: string;
      aiKeyNotConfiguredLabel: string;
      toastAiKeySaved: string;
      toastAiKeySaveFailed: string;
      toastAiKeyRemoved: string;
      toastAiKeyRemoveFailed: string;
    };
    notifSetting: {
      transactionSectionTitle: string;
      txnInLabel: string;
      txnInSub: string;
      txnOutLabel: string;
      txnOutSub: string;
      txnBigLabel: string;
      txnBigSub: string;
      goalsSectionTitle: string;
      budget80Label: string;
      budget80Sub: string;
      goalMilestoneLabel: string;
      goalMilestoneSub: string;
      billDueLabel: string;
      billDueSub: string;
      investSectionTitle: string;
      stockPriceLabel: string;
      stockPriceSub: string;
      dividendLabel: string;
      dividendSub: string;
      investNote: string;
      toastSaved: string;
      toastFailed: string;
    };
    privasi: {
      visibilitySectionTitle: string;
      hideFromFamilyLabel: string;
      hideFromFamilySub: string;
      privacyScreenshotLabel: string;
      privacyScreenshotSub: string;
      dataAnalyticsSectionTitle: string;
      sendAnalyticsLabel: string;
      sendAnalyticsSub: string;
      aiPersonalizationLabel: string;
      aiPersonalizationSub: string;
      exportSectionTitle: string;
      exportDataName: string;
      exportDataSub: string;
      deleteAccountName: string;
      deleteAccountSub: string;
      toastExportSuccess: string;
      toastExportFailed: string;
      deleteAccountConfirm: string;
      toastDeleteSuccess: string;
      toastDeleteFailed: string;
      toastPrefsSaved: string;
      toastPrefsFailed: string;
    };
    bantuan: {
      faqSectionTitle: string;
      faqs: {
        addBank: AkunRichAnswer;
        dataSafety: AkunRichAnswer;
        changeCurrency: AkunRichAnswer;
        addGoal: AkunRichAnswer;
        businessAccount: AkunRichAnswer;
        inviteMember: AkunRichAnswer;
      };
      guideSectionTitle: string;
      tourName: string;
      tourSub: string;
      fullGuideName: string;
      fullGuideSub: string;
      askAiName: string;
      askAiSub: string;
    };
    hubungi: {
      contactSectionTitle: string;
      emailName: string;
      emailSub: string;
      phoneName: string;
      phoneSub: string;
      whatsappName: string;
      whatsappSub: string;
      feedbackTitle: string;
      feedbackPlaceholder: string;
      feedbackButton: string;
      toastFeedbackOpening: string;
    };
    tentang: {
      tagline: string;
      versionBuild: string;
      infoSectionTitle: string;
      versionRowName: string;
      lastUpdatedRowName: string;
      lastUpdatedValue: string;
      privacyPolicyName: string;
      termsName: string;
      licenseName: string;
      footerMade: string;
      footerCopyright: string;
    };
    family: {
      membersSectionTitle: string;
      youBadge: string;
      // EPIC-024 A2 (D2, item 18) — inviteButton/addAdminButton (email
      // invite-link UI) removed; family members are added directly.
      adminSectionTitle: string;
      adminCanInput: string;
      adminBadge: string;
      adminInfoNote: string;
      groupSettingsSectionTitle: string;
      memberTxnNotifLabel: string;
      memberTxnNotifSub: string;
      categoryLimitButton: string;
      categoryLimitDialogTitle: string;
      categoryLimitDialogDesc: string;
      categoryLimitEmptyCategories: string;
      categoryLimitUnrestrictedHint: string;
      categoryLimitSaveButton: string;
      categoryLimitSaving: string;
      categoryLimitSaved: string;
      categoryLimitSaveFailed: string;
      allowanceRequestsSectionTitle: string;
      allowanceRequestsEmpty: string;
      allowanceRequestPendingBadge: string;
      allowanceRequestApproveButton: string;
      allowanceRequestRejectButton: string;
      allowanceRequestApproveDialogTitle: string;
      allowanceRequestSourceAccountLabel: string;
      allowanceRequestRequestedFromPrefix: string;
      allowanceRequestApproved: string;
      allowanceRequestApproveFailed: string;
      allowanceRequestRejected: string;
      allowanceRequestRejectFailed: string;
      // EPIC-023 Task D (D3/D9, US-FAM-14) — held-expense variant of the
      // same AllowanceRequest primitive.
      allowanceRequestHeldBadge: string;
      allowanceRequestHeldApproved: string;
      // EPIC-023 Task D (D3/D9, US-FAM-14) — per-member large-transaction
      // threshold.
      thresholdButton: string;
      thresholdDialogTitle: string;
      thresholdDialogDesc: string;
      thresholdLabel: string;
      thresholdEmptyHint: string;
      thresholdSaveButton: string;
      thresholdSaving: string;
      thresholdSaved: string;
      thresholdSaveFailed: string;
      // EPIC-023 D1/D6 (US-FAM-12, US-AUTH-9) — head-created dependant/
      // operational member (name + username + initial password, no email).
      manageOnIamLink: string;
    };
    // EPIC-023 D1/D6 (US-FAM-12, US-AUTH-9) — head-created dependant/
    // operational member: no email, username + initial password instead.
    addDependant: {
      dialogTitle: string;
      dialogDesc: string;
      nameLabel: string;
      namePlaceholder: string;
      usernameLabel: string;
      usernamePlaceholder: string;
      passwordLabel: string;
      passwordPlaceholder: string;
      nameRequiredError: string;
      usernameRequiredError: string;
      passwordRequiredError: string;
      showPassword: string;
      hidePassword: string;
      roleLabel: string;
      roleOptions: {
        dependant: string;
        operational: string;
        // EPIC-024 A1 (D1) — istri = co-master: role owner is reachable
        // ONLY through this option, which locks the relationship picker
        // to "istri" below.
        istriCoMaster: string;
        member: string;
      };
      // EPIC-024 A1 — shown when "Istri (Co-Master)" is selected.
      istriCoMasterHint: string;
      relationshipLabel: string;
      relationshipNoneOption: string;
      // polish-j batch 7a item 4 — Email moves under the "Opsi lanjutan"
      // disclosure alongside Hak akses; its hint is now one line.
      emailLabel: string;
      emailPlaceholder: string;
      emailHint: string;
      accessRoleLabel: string;
      accessRoleDefaultOption: string;
      accessRoleEmptyHint: string;
      toastAccessRoleFailed: string;
      creating: string;
      createButton: string;
      toastCreateFailed: string;
      // IAM copy-credentials — the dialog switches to this view on success
      // instead of a toast, since the password can only ever be copied now.
      credentialsTitle: string;
      passwordChangeRequiredHint: string;
      pendingEmailSentPrefix: string;
    };
    memberConcepts: {
      relationship: string;
      systemRole: string;
      accessRole: string;
      relationshipInfo: string;
      systemRoleInfo: string;
      accessRoleInfo: string;
      infoLabelPrefix: string;
    };
    // IAM copy-credentials — shared by members-tab's username copy, the
    // add-member success view, and the reset-password result view.
    copyCredentials: {
      toastCopied: string;
      toastCopyFailed: string;
      usernameAriaLabel: string;
      passwordAriaLabel: string;
      copyAllButton: string;
      usernameRowLabel: string;
      passwordRowLabel: string;
      doneButton: string;
    };
    resetPassword: {
      toastSuccess: string;
    };
    crud: {
      accountAdded: string;
      ewalletAdded: string;
      saveFailed: string;
      profileSaved: string;
      profileSaveFailed: string;
    };
  };
  /**
   * EPIC-024 A5 (D6, US-FAM-19) — `/persetujuan` page copy. Reuses the
   * `akun.family.allowanceRequest*` keys above for the shared
   * approve/reject strings (moved here, not duplicated); this section only
   * adds what's new to the dedicated page (tabs, history, owner gate).
   */
  persetujuan: {
    v2: {
      heroCap: string;
      chip: string;
      chartTitle: string;
      chartEmpty: string;
      kpiPending: string;
      kpiApproved: string;
      kpiRejected: string;
      sideTitle: string;
      sideCaption: string;
      sideEmpty: string;
      seeHistory: string;
      mainTitle: string;
      riwayatTitle: string;
      colRequester: string;
      colAccount: string;
      colStatus: string;
      colDate: string;
      colAmount: string;
      tipsTitle: string;
      tipsBody: string;
    };
    pageDesc: string;
    tabPending: string;
    tabRiwayat: string;
    riwayatEmpty: string;
    riwayatDecidedByLabel: string;
    riwayatStatusApproved: string;
    riwayatStatusRejected: string;
    notOwnerNotice: string;
    statPendingLabel: string;
    statPendingTotalPrefix: string;
    statApprovedLabel: string;
    statApprovedSuffix: string;
    statRejectedLabel: string;
    statRejectedSuffix: string;
    headerBadgeSuffix: string;
    approverRuleNotice: string;
    tabsAriaLabel: string;
    requestedAtPrefix: string;
    kindFundingLabel: string;
    kindHeldLabel: string;
    fieldKeperluanLabel: string;
    heldWarningNotice: string;
    fundingApproveHelperNotice: string;
    // EPIC-026 Wave 8 — prototype `.hint` under #setujui-sumber.
    approveSourceAccountHint: string;
  };
  /**
   * EPIC-018 Task A2 — `/panduan` page copy. `JOURNEYS` in the page keeps
   * only structural data (icon, chip class, href, id); every title/subtitle/
   * desc string resolves from here, keyed by the stable journey/feature ids.
   */
  panduan: {
    v2: {
      heroTitle: string;
      tabsLabel: string;
      contactCaption: string;
      emptyTitle: string;
    };
    pageTitle: string;
    pageSubtitle: string;
    openLink: string;
    searchLabel: string;
    searchPlaceholder: string;
    noResults: string;
    journeys: Record<PanduanJourneyId, { title: string; subtitle: string }>;
    features: Record<PanduanFeatureId, { title: string; desc: string }>;
    // EPIC-025 N3 prototype structural port — see PanduanGroupId above.
    groups: Record<PanduanGroupId, { title: string; tagline: string }>;
    areaLabels: Record<"all" | PanduanGroupId, string>;
    searchResultPrefix: string;
    searchResultMid: string;
    searchResultSuffix: string;
    searchNoResultsFiltered: string;
    contactHeaderButton: string;
    faqSectionTitle: string;
    faq: {
      pdfRejected: PanduanFaqLinkItem;
      addOwnReferences: PanduanFaqLinkItem;
      mortgageNotFullExpense: PanduanFaqLinkItem;
      aiNotAnswering: PanduanFaqLinkItem;
      whoCanSeeTransactions: PanduanFaqStrongItem;
      changeMemberRole: PanduanFaqLinkItem;
      dataExportOnLeave: PanduanFaqLinkItem;
    };
    contact: {
      title: string;
      linkLabel: string;
      emailTitle: string;
      emailValue: string;
      emailDesc: string;
      phoneTitle: string;
      phoneValue: string;
      phoneDesc: string;
      whatsappTitle: string;
      whatsappValue: string;
      whatsappDesc: string;
    };
  };
  /** EPIC-018 Task A4 — `/asuransi` (insurance policies) page copy. */
  asuransi: {
    v2: {
      heroCaption: string;
      kpiActive: string;
      kpiCoverage: string;
      kpiRenew: string;
      chartAria: string;
      allocCaption: string;
      gridTitle: string;
      gridCount: string;
      benCaption: string;
      tipOkTitle: string;
      tipOkBody: string;
      tipEmptyTitle: string;
      tipEmptyBody: string;
      tipSoonSuffix: string;
    };
    activePoliciesSuffix: string;
    totalPremiumPrefix: string;
    errorLoad: string;
    emptyState: string;
    typeLabels: Record<AsuransiInsuranceTypeId, string>;
    periodSuffixLabels: Record<AsuransiPremiumPeriodId, string>;
    periodOptionLabels: Record<AsuransiPremiumPeriodId, string>;
    statusLabels: Record<AsuransiStatusId, string>;
    coverageLabel: string;
    premiumLabel: string;
    renewalLabel: string;
    daysUntilRenewalSuffix: string;
    // Batch 4 item 1 — overdue (negative daysUntilRenewal) prefix, paired
    // with daysUntilRenewalSuffix: "{daysOverduePrefix} {abs(days)} {daysUntilRenewalSuffix}".
    daysOverduePrefix: string;
    policyNumberLabel: string;
    toastAdded: string;
    toastAddFailed: string;
    toastUpdated: string;
    toastUpdateFailed: string;
    toastDeleted: string;
    toastDeleteFailed: string;
    validationNameRequired: string;
    validationPremiumPositive: string;
    modalTitle: string;
    modalEditTitle: string;
    modalCloseAriaLabel: string;
    fieldNameLabel: string;
    fieldNamePlaceholder: string;
    fieldProviderLabel: string;
    fieldProviderPlaceholder: string;
    fieldTypeLabel: string;
    fieldStatusLabel: string;
    fieldPremiumLabel: string;
    fieldPeriodLabel: string;
    fieldCoverageLabel: string;
    fieldRenewalDateLabel: string;
    autoRenewLabel: string;
    fieldPolicyNumberLabel: string;
    fieldPolicyNumberPlaceholder: string;
    fieldNotesLabel: string;
    fieldNotesPlaceholder: string;
    saving: string;
    saveButton: string;
    /** EPIC-016 Task H — "Bayar" confirm dialog that records a real renewal. */
    payDialogTitle: string;
    payConfirmPrefix: string;
    payConfirmSuffix: string;
    payProcessing: string;
    payConfirmButton: string;
    /** EPIC-023 E2 — source-account picker for the real premium payment. */
    paySourceAccountLabel: string;
    paySourceAccountPlaceholder: string;
    /**
     * EPIC-023 group E retry round 4 (C3) — aria-label/title on the
     * `/asuransi` card's Bayar icon button when `paidThisPeriod` is true.
     */
    payAlreadyPaidTooltip: string;
    payNextDueTooltipPrefix: string;
    toastRenewalRecordedPrefix: string;
    toastPaySuccessNoRenewal: string;
    toastRenewalFailed: string;
    /** EPIC-021 Group D (#14) — policy beneficiaries, mirroring warisan's
     * heir editor UX (allocation bar + optional family-member link). */
    beneficiariesSectionTitle: string;
    /** polish-j batch 7a item 9 — summary label for the "Opsi lanjutan"-
     * style disclosure collapsing beneficiaries in the add-policy form. */
    beneficiariesOptionalLabel: string;
    beneficiariesLabel: string;
    beneficiaryNameLabel: string;
    beneficiaryNamePlaceholder: string;
    beneficiaryRelationshipLabel: string;
    beneficiaryRelationshipPlaceholder: string;
    /** Revisi K bug 1 — default relationship text filled in when the picked
     * member is the family owner (Master), whose `Member.relationship` is
     * null (it's not a kinship value). */
    beneficiaryRelationshipSelfDefault: string;
    beneficiarySharePercentLabel: string;
    beneficiaryMemberLabel: string;
    beneficiaryMemberNoneOption: string;
    addBeneficiaryButton: string;
    removeBeneficiaryAriaLabel: string;
    allocationAllocatedSuffix: string;
    allocationUnallocatedSuffix: string;
    allocationFullyAllocated: string;
    validationSharePercentExceeded: string;
    // EPIC-022 D6 — a nonzero-share row needs a real name (was silently
    // dropped from both the sum and the payload); under-allocation now
    // warns (not blocks) at save time instead of saving silently.
    validationBeneficiaryNameRequired: string;
    /** Template with a `{pct}` placeholder. */
    validationShareUnderAllocated: string;
    /** EPIC-023 F1 (D14) — honest-UI note shown instead of a silently empty
     * picker when the member list failed to load (e.g. a dependant/
     * operational role has no "read Member" ability). */
    beneficiaryMemberPickerUnavailable: string;
    // EPIC-025 N3-F3: coverage-by-type donut (FOLD) + real nearest-renewal
    // warning banner, both derived from the already-fetched insurances list.
    coverageAllocationTitle: string;
    renewalWarningPrefix: string;
    renewalWarningSuffix: string;
    // EPIC-025 N3 restructure — page header, card footer actions, and the
    // aggregated "Ahli Waris Asuransi" table + its policy-picker dialogs.
    totalCoveragePrefix: string;
    renewalWarningDaysLeftSuffix: string;
    payButtonLabel: string;
    cardEditButton: string;
    cardDeleteButton: string;
    cardDetailButton: string;
    cardOptionsAriaLabel: string;
    coverageLineLabel: string;
    beneficiaryTableHeaderName: string;
    beneficiaryTableHeaderRelationship: string;
    beneficiaryTableHeaderMember: string;
    beneficiaryTableHeaderPercent: string;
    beneficiaryTableHeaderBenefit: string;
    beneficiaryTablePolicyPrefix: string;
    addBeneficiaryHeaderAriaLabel: string;
    policyPickerPayTitle: string;
    policyPickerBeneficiaryTitle: string;
    policyPickerLabel: string;
    policyPickerPlaceholder: string;
    policyPickerConfirm: string;
    policyPickerPayEmpty: string;
    policyPickerBeneficiaryEmpty: string;
    // EPIC-026 Wave 8 — prototype dialog composition
    // (docs/prototype/pages/asuransi.html): every `.dialog` there carries a
    // `.dialog__desc` supporting line, and the delete dialog has its own
    // copy rather than the generic "Hapus X?" fallback.
    modalDesc: string;
    policyPickerPayDesc: string;
    policyPickerBeneficiaryDesc: string;
    deleteDialogTitle: string;
    deleteDialogBody: string;
    deleteBeneficiaryDialogBody: string;
    toastBeneficiaryDeleted: string;
    autoRenewSwitchAriaLabel: string;
  };
  /**
   * EPIC-018 Task A4 — `/kalkulator` page copy (7 sub-tools). Detail rows
   * that mix a fixed label with a live-computed value keep the label as a
   * `*Prefix` string and the JSX renders the formatted value next to it —
   * mirrors the `akun.keamanan.sessionActivePrefix` template-splitting
   * pattern rather than introducing dict functions.
   */
  kalkulator: {
    tabs: Record<KalkulatorTabId, string>;
    months: [
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
    ];
    sessionExpired: string;
    calculating: string;
    // EPIC-025 N3 fidelity follow-up — page header + shared "Hasil" card
    // title (prototype's `.page-lead` + paired result cards).
    pageTitle: string;
    pageSubtitle: string;
    hasilCardTitle: string;
    zakat: {
      cardTitle: string;
      /** EPIC-022 E2 — replaces the old hardcoded `nisabNotePrefix` +
       * `nisabNoteValue` pair: nisab is now derived server-side (from the
       * family gold price or the indicative fallback), never hardcoded here. */
      nisabAutoNote: string;
      fieldCash: string;
      fieldInvestments: string;
      fieldGold: string;
      fieldLiabilities: string;
      /** EPIC-022 E1 — the haul (1 lunar year holding period) question the
       * form now asks before the result can be presented as an obligation. */
      haulCheckboxLabel: string;
      calculateButton: string;
      errorCalculate: string;
      resultObligated: string;
      /** EPIC-022 E1 — shown when nisab is met but haul is not confirmed:
       * the amount is still computed, but never asserted as a settled
       * obligation. */
      resultEstimated: string;
      resultNotObligated: string;
      detailZakatablePrefix: string;
      detailNisabPrefix: string;
      /** EPIC-022 E1 — note shown alongside `resultEstimated`. */
      estimateNote: string;
      belowNisabPrefix: string;
      belowNisabSuffix: string;
      /** EPIC-022 E2 — nisab-source disclosure (family gold price vs the
       * indicative fallback). `nisabSourceFamilyPrefix` + `formatRupiah(price)`
       * + `nisabSourceFamilyMidfix` + `consolidatedTotal.manualLabelPrefix` +
       * a formatted date + `nisabSourceFamilySuffix`, so the Rp figure is
       * actually printed (not just the "diinput manual" disclosure). */
      nisabSourceFamilyPrefix: string;
      nisabSourceFamilyMidfix: string;
      nisabSourceFamilySuffix: string;
      nisabSourceIndicative: string;
    };
    pph21: {
      cardTitle: string;
      ptkpNote: string;
      fieldGross: string;
      fieldZakatPaid: string;
      calculateButton: string;
      errorCalculate: string;
      resultLabel: string;
      detailPkpPrefix: string;
      detailEffectiveRatePrefix: string;
      deductionHeading: string;
      laborCostLabel: string;
      ptkpLabel: string;
      zakatLabel: string;
      progressiveHeading: string;
      // EPIC-025 N3 fidelity follow-up — dotted-input helper note + the
      // "Rincian lapisan tarif" dialog (real `taxBreakdown` data).
      typingNote: string;
      bracketDialogLinkLabel: string;
      bracketDialogTitle: string;
      bracketDialogDesc: string;
      bracketDialogBracketHeader: string;
      bracketDialogRateHeader: string;
      bracketDialogTaxableHeader: string;
      bracketDialogTaxHeader: string;
      bracketDialogTotalLabel: string;
      bracketDialogCloseButton: string;
      bracketDialogEmptyNote: string;
    };
    investasi: {
      cardTitle: string;
      fieldInitialCapital: string;
      fieldMonthlyDeposit: string;
      fieldAnnualReturn: string;
      fieldDuration: string;
      resultLabel: string;
      detailTotalCapitalPrefix: string;
      detailProfitPrefix: string;
      // EPIC-025 N3-E2 — J3 FOLD: projection chart, pure client-side.
      projectionChartTitle: string;
      projectionSeriesLabel: string;
      projectionYearPrefix: string;
      // EPIC-025 N3 fidelity follow-up — prototype copy/order + result rows.
      fieldReturnRateLabel: string;
      returnRateHint: string;
      rowTotalDepositLabel: string;
      rowGrowthLabel: string;
    };
    kredit: {
      cardTitle: string;
      fieldLoanAmount: string;
      fieldAnnualInterest: string;
      fieldTenor: string;
      fieldDownPayment: string;
      resultLabel: string;
      detailPrincipalPrefix: string;
      detailTotalPaymentPrefix: string;
      // EPIC-025 N3 fidelity follow-up — prototype's Harga Properti + DP
      // (Rp) model, breakdown rows, and the 30%-rule warning.
      cardTitleAlt: string;
      fieldPropertyPrice: string;
      fieldDownPaymentAmount: string;
      dpPercentSuffix: string;
      rowPrincipalLabel: string;
      rowTotalInterestLabel: string;
      rowTotalPaymentLabel: string;
      rowInstallmentCountLabel: string;
      installmentCountSuffix: string;
      ruleWarningNote: string;
      minIncomeNotePrefix: string;
      minIncomeNoteSuffix: string;
    };
    pensiun: {
      cardTitle: string;
      fieldCurrentAge: string;
      fieldRetireAge: string;
      fieldCurrentMonthlyExpense: string;
      fieldInvestmentReturn: string;
      /** EPIC-022 E3 — this tab now calls `POST /calculators/retirement`
       * (the correct sinking-fund formula) instead of a client-side loan
       * amortisation formula that overstated the required saving ~12×. */
      calculateButton: string;
      errorCalculate: string;
      invalidAgeRangeError: string;
      resultLabel: string;
      detailMonthlyInvestmentNeededPrefix: string;
      /** EPIC-022 E3 (LOW) — discloses that the target assumes 20× current
       * annual expenses (≈5% withdrawal rate) — the multiplier itself is
       * unchanged, only its basis is now stated instead of hidden. */
      targetBasisNote: string;
      // EPIC-025 N3 fidelity follow-up — "Hasil" card breakdown rows,
      // sourced only from real `/calculators/retirement` response fields.
      rowMonthlyContributionLabel: string;
      rowTotalContributionsLabel: string;
      rowProjectedValueLabel: string;
    };
    tabungan: {
      cardTitle: string;
      fieldTarget: string;
      fieldCurrentBalance: string;
      fieldAnnualInterest: string;
      fieldMonthlyDeposit: string;
      resultLabel: string;
      resultValueSuffix: string;
      detailTargetReachedPrefix: string;
      unreachableError: string;
    };
    splitgroup: {
      cardTitle: string;
      description: string;
      fieldTotalBill: string;
      fieldPeopleCount: string;
      fieldTaxService: string;
      fieldExtraTip: string;
      resultLabel: string;
      detailTotalWithTaxPrefix: string;
      createSplitBillButton: string;
      invalidPeopleError: string;
    };
  };
  /**
   * EPIC-018 Task A4 — `/quickinput` page copy. `QUICK_CARDS` in the page
   * keeps only structural data (icon, colors, action/entity); every card
   * name/desc resolves from here, keyed by the stable `QuickInputCardId`.
   */
  quickinput: {
    v2: {
      shortcuts: string;
      addTx: string;
      today: string;
      week: string;
      last: string;
      never: string;
      recordTitle: string;
      recordCap: string;
      recentCap: string;
      tipTitle: string;
      tipBody: string;
      chartAria: string;
      countUnit: string;
    };
    pageTitle: string;
    pageSubtitle: string;
    cards: Record<QuickInputCardId, { name: string; desc: string }>;
    toastSaved: string;
    toastSaveFailed: string;
    recentEntriesTitle: string;
    viewAllLink: string;
    emptyRecent: string;
    /** Master/Co-Master-only page guard notice — mirrors persetujuan's. */
    notAllowedNotice: string;
  };
  /** EPIC-018 Task A4 — `/ai` (AI Advisor chat) page copy. */
  ai: {
    v2: {
      heroCap: string;
      chipsLabel: string;
      emptyBody: string;
      inputLabel: string;
      dataReadCap: string;
      summaryCap: string;
      changeKey: string;
      historyCap: string;
    };
    bannerTitle: string;
    bannerSubtitle: string;
    popularQuestionsLabel: string;
    chips: [string, string, string, string, string, string];
    initialMessage: string;
    errorGeneric: string;
    errorConnection: string;
    noGroupTitle: string;
    noGroupBody: string;
    inputPlaceholder: string;
    sendAriaLabel: string;
    disclaimer: string;
    /**
     * EPIC-023 G3 (D16) — a family with no AI provider key sees this
     * disabled panel with instructions, NEVER a mock answer presented as
     * advice. `notConfiguredBodyOwner` is shown to owner/spouse (who can
     * act on it directly from /akun); `notConfiguredBodyOther` to every
     * other role (who must ask the household head).
     */
    notConfiguredTitle: string;
    notConfiguredBodyOwner: string;
    notConfiguredBodyOther: string;
    notConfiguredCta: string;
    notConfiguredMidChat: string;
    truncatedNotice: string;
    errorKeyCorrupted: string;
    errorAuthFailed: string;
    errorRateLimited: string;
    /** Rate-limit variants. The generic `errorRateLimited` says "try again in a
     *  moment", which is wrong for a per-day quota — the user retried in a loop
     *  and learned nothing. `{seconds}` / `{model}` are substituted. */
    errorRateLimitedRetryIn: string;
    errorRateLimitedDaily: string;
    errorTimeout: string;
    /** Restructure (prototype parity) — status/provider/context surfaces on
     * the configured-chat view, built only from real fields already
     * returned by `useAiKeyStatus`/`DashboardSummaryDto` and the advisor's
     * own system-prompt builder (`advisor-prompt.util.ts`). No mocked
     * model name or per-item toggle — those aren't real fields. */
    statusApiKeyLabel: string;
    statusConnectedBadge: string;
    manageApiKeyButton: string;
    changeApiKeyLink: string;
    providerLabels: Record<"claude" | "openai" | "gemini", string>;
    chatCardTitle: string;
    newConversationButton: string;
    /** Saved-session history panel. Sessions are stored server-side per
     * member (see the API's AiConversationService), so these survive a
     * reload and a device change — not a browser-local list. */
    historyTitle: string;
    historyEmpty: string;
    historyLoading: string;
    historyError: string;
    historyMessageCount: string;
    historyDeleteAriaLabel: string;
    historyDeleteConfirm: string;
    historyDeleted: string;
    historyDeleteFailed: string;
    historyLoadFailed: string;
    historyCurrentBadge: string;
    dataReadTitle: string;
    dataReadNetWorth: string;
    dataReadCashflow: string;
    dataReadCategories: string;
    dataReadLiabilities: string;
    dataReadBalances: string;
    dataReadGoals: string;
    dataReadTransactions: string;
    /** Split out of the old "Nomor rekening & saldo per akun" row: per-account
     *  balances ARE sent now, account numbers still are not. One row claiming
     *  both were withheld became false the moment row detail shipped. */
    dataReadAccountNumbers: string;
    yesLabel: string;
    noLabel: string;
    contextSummaryTitle: string;
    contextNetWorthLabel: string;
    contextIncomeLabel: string;
    contextExpenseLabel: string;
    providerKeyTitle: string;
    providerLabel: string;
    apiKeyLabel: string;
    encryptionNote: string;
    notManagedHint: string;
    // A1 (revisi-2) — floating launcher mounted in the app shell
    // (`FloatingAiLauncher`), bottom-right, so the conversation survives a
    // route change.
    floatingLauncher: {
      openAriaLabel: string;
      closeAriaLabel: string;
      panelTitle: string;
      openFullPageLink: string;
      notConfiguredBody: string;
    };
    // G8 (hardening batch) — AIChatCard empty/start state copy.
    chatCard: {
      title: string;
      subtitle: string;
      promptText: string;
      placeholder: string;
      prompts: string[];
      resetAriaLabel: string;
      attachAriaLabel: string;
      sendAriaLabel: string;
    };
  };
  /** EPIC-018 Task A5 — `/investasi` (investment portfolio) page copy. */
  investasi: {
    v2: {
      allocTitle: string;
      listTitle: string;
      allocCaption: string;
      legendCost: string;
      legendValue: string;
      chartEmpty: string;
      filterLabel: string;
      chartAria: string;
      heroCapSuffix: string;
      rowCapital: string;
      noteDividends: string;
      mosaicLabel: string;
    };
    goldPricePerGramTooHigh: string;
    typeLabels: Record<InvestasiTypeId, string>;
    errorLoad: string;
    toastUpdated: string;
    toastAdded: string;
    toastUpdateFailed: string;
    toastAddFailed: string;
    toastPriceSaveFailed: string;
    toastDeleted: string;
    toastDeleteFailed: string;
    modalTitleEdit: string;
    modalTitleAdd: string;
    fieldTickerLabel: string;
    fieldTickerPlaceholder: string;
    fieldNameLabel: string;
    fieldNamePlaceholder: string;
    fieldTypeLabel: string;
    fieldQuantityLabel: string;
    fieldQuantityPlaceholder: string;
    fieldCostBasisLabel: string;
    fieldCostBasisPlaceholder: string;
    // EPIC-021 #20: optional interest rate, shown for interest-bearing types.
    fieldInterestRateLabel: string;
    fieldInterestRatePlaceholder: string;
    // EPIC-024 C3 (D7, D9, D10) — per-type form fields.
    // Saham: Lot/Lembar quantity toggle (canonical storage stays lembar).
    fieldQuantityUnitLabel: string;
    unitLot: string;
    unitLembar: string;
    fieldQuantityLotPlaceholder: string;
    fieldQuantityLembarPlaceholder: string;
    // Kripto: decimal coin count, not lot/unit.
    fieldQuantityKriptoLabel: string;
    fieldQuantityKriptoPlaceholder: string;
    // Deposito: nominal (reuses fieldCostBasisLabel's input, relabelled) +
    // jatuh tempo. Bunga %/thn reuses fieldInterestRateLabel.
    fieldDepositoNominalLabel: string;
    fieldDepositoNominalPlaceholder: string;
    fieldMaturityDateLabel: string;
    // "Tanggal Beli" — every instrument type, not just deposito.
    fieldPurchaseDateLabel: string;
    saving: string;
    saveButton: string;
    totalValueLabel: string;
    totalReturnSuffix: string;
    todayReturnLabel: string;
    todayReturnNoSnapshotCaption: string;
    vsYesterdaySuffix: string;
    portfolioSectionTitle: string;
    addInvestmentLink: string;
    // EPIC-021 #19 (Open Design Decision #3 recommendation): filter tabs by
    // type, matching the /aset tab pattern. "Semua" reuses typeLabels for the
    // rest of the tabs.
    filterAllLabel: string;
    tableName: string;
    tableType: string;
    tableCapital: string;
    tableValue: string;
    tableReturn: string;
    tablePercent: string;
    tableAction: string;
    emptyState: string;
    emptyStateCta: string;
    // EPIC-021 #20: per-row expandable detail (latest price provenance +
    // interest-bearing projected yield).
    detailToggleShow: string;
    detailToggleHide: string;
    detailLatestPriceLabel: string;
    detailRecordedAtLabel: string;
    detailSourceLabel: string;
    detailInterestRateLabel: string;
    detailProjectedYieldLabel: string;
    // Genuinely non-applicable type (e.g. saham/emas — no interest concept).
    detailNoInterestRate: string;
    // Interest-bearing type (obligasi) but interestRatePct hasn't been set yet
    // — distinct from detailNoInterestRate so the message isn't misleading.
    detailNoRateSet: string;
    /**
     * EPIC-023 G1 (D15) — "automate what can be automated, label the
     * rest": every automated price states its source (sourceLabels) and,
     * for Yahoo `.JK`, that it is delayed & unofficial; every manual price
     * states its entry date (same "diinput manual, per <date>" pattern as
     * the family gold price — consolidated-total-card.tsx).
     */
    sourceLabels: Record<
      // EPIC-024 C1/C3 — "computedInterest" labels deposito's live
      // simple-interest value (never a stored/fetched price row).
      | "yahooFinance"
      | "coinGecko"
      | "manual"
      | "mock"
      | "computedInterest"
      | "familyGold",
      string
    >;
    detailDelayedLabel: string;
    detailRefreshFailedLabel: string;
    detailManualLabelPrefix: string;
    detailNoManualPrice: string;
    detailPriceUnavailable: string;
    // EPIC-024 C1 (D8) — permanent "no automated route for this ticker"
    // state (UnmappedTickerError), distinct from a transient refresh
    // failure. Badge shown next to the holding name/ticker in the table.
    automatedUnmappedBadge: string;
    automatedUnmappedNote: string;
    // Batch B6 (client revision round 2) — a "mock"-sourced automated price
    // (dev/demo simulated feed) must never look like a live quote. Shown in
    // place of the price cell/badge, no "Live" styling.
    priceSimulatedLabel: string;
    priceSimulatedNote: string;
    // B6 — shown right after saving a saham/kripto holding whose ticker
    // turned out to have no real automated price (warns at input, not just
    // silently on the next page load).
    tickerNotFoundWarning: string;
    tickerNoLivePriceWarning: string;
    fieldManualPriceLabel: string;
    fieldManualPricePlaceholder: string;
    fieldManualPriceDateLabel: string;
    manualPriceNote: string;
    autoPriceNoteSaham: string;
    autoPriceNoteKripto: string;
    // EPIC-024 C3 (D10) — shown instead of the manual-price fields for
    // deposito: its value is derived from bunga %/thn, never entered.
    depositoValuationNote: string;
    // EPIC-025 N3-F2: manual refresh action + summary/notice/allocation copy
    // added by the prototype port.
    refreshPriceButton: string;
    refreshPriceToast: string;
    capitalInvestedPrefix: string;
    livePositionsSuffix: string;
    pricingSourceNoticeTitle: string;
    pricingSourceNoticeBody: string;
    pricingSourceMoreLabel: string;
    allocationTitle: string;
    // EPIC-025 N3 audit (structural port fidelity) — page-lead header,
    // restored "Jumlah"/"Harga / Sumber" table columns, per-row price-source
    // badges, and the "Terakhir sinkron" timestamp.
    pageSubtitle: string;
    addInvestmentHeaderButton: string;
    positionsCountSuffix: string;
    tableQuantity: string;
    tablePriceSource: string;
    /** Template with `{returnRp}` and `{costBasis}` placeholders. */
    returnFormulaLabel: string;
    livePositionsOnlyPrefix: string;
    /** Template with `{ticker}` and `{date}` placeholders. */
    rowTickerPurchasedTemplate: string;
    /** Template with a `{date}` placeholder — non-market types (no real
     * ticker to show), e.g. deposito/emas/reksa dana/lainnya. */
    rowPurchasedTemplate: string;
    /** Template with `{rate}` and `{date}` placeholders. */
    rowCouponPurchasedTemplate: string;
    /** Template with `{date}` and `{maturityDate}` placeholders. */
    rowDepositoTermTemplate: string;
    /** Template with a `{rate}` placeholder. */
    depositoRateTemplate: string;
    priceLiveBadge: string;
    priceLiveDelayedBadge: string;
    /** Template with a `{date}` placeholder. */
    priceManualBadgeTemplate: string;
    priceComputedBadgeLabel: string;
    unitCoinSuffix: string;
    unitFundUnit: string;
    unitGram: string;
    /** B9 follow-up — gold holdings display/entry in kg (user's "Per kilogram" choice). */
    unitKg: string;
    navPricePrefix: string;
    nominalPrefix: string;
    pricingSourceLastSyncedPrefix: string;
    // polish-j batch 7a item 3 — the per-section headings are gone; this is
    // now the dialog's only subtitle line.
    modalDesc: string;
    hintPurchaseDate: string;
    hintLotConversion: string;
    // EPIC-022 D2 — quantity/cost basis can no longer be silently overwritten
    // via the generic edit form; a Beli/Jual transaction is the only path.
    hintQuantityLocked: string;
    hintCostBasisLocked: string;
    buySellButtonLabel: string;
    buySellModalTitleBuy: string;
    buySellModalTitleSell: string;
    buySellTypeBuyLabel: string;
    buySellTypeSellLabel: string;
    buySellFieldQuantityLabel: string;
    buySellFieldPriceLabel: string;
    buySellFieldDateLabel: string;
    buySellFieldAccountLabel: string;
    buySellAccountNoneOption: string;
    buySellSaveButton: string;
    bsHoldingTitle: string;
    bsHeldLabel: string;
    bsAvgPriceLabel: string;
    bsLastPriceLabel: string;
    bsUseLastPrice: string;
    bsSummaryTitle: string;
    bsTotalBuy: string;
    bsTotalSell: string;
    bsRemainingLabel: string;
    bsNewHoldingLabel: string;
    bsNewAvgLabel: string;
    bsEstPnlLabel: string;
    bsOverSell: string;
    bsSummaryEmpty: string;
    buySellSaving: string;
    toastBuySuccess: string;
    /** Template with a `{pnl}` placeholder. */
    toastSellSuccessTemplate: string;
    toastBuySellFailed: string;
    detailRealizedPnlLabel: string;
    historySectionTitle: string;
    historyEmptyLabel: string;
    priceHistoryTitle: string;
    priceHistoryEmpty: string;
    priceHistoryChartCaption: string;
    priceSourceManual: string;
    historyBuyLabel: string;
    historySellLabel: string;
    /** Template with a `{pnl}` placeholder. */
    historyRealizedPnlTemplate: string;
    fieldQuantityLabelByType: Record<InvestasiTypeId, string>;
    fieldQuantityPlaceholderByType: Record<InvestasiTypeId, string>;
    /** Template with `{unit}` and `{max}` placeholders. */
    quantityDecimalsErrorTemplate: string;
    /** Template with a `{unit}` placeholder. */
    quantityWholeNumberErrorTemplate: string;
    buySellPricePerLembarHint: string;
    /** B9 follow-up — Beli/Jual quantity is in kg but the price stays per gram. */
    buySellPricePerGramHint: string;
    /** B9 follow-up — Template with a `{grams}` placeholder, gram equivalent under the kg input. */
    hintGoldKgEquivalentTemplate: string;
    familyGoldPriceNote: string;
    /** Template with `{price}` and `{date}` placeholders. */
    familyGoldPriceHintTemplate: string;
    familyGoldPriceUnsetHint: string;
    familyGoldPriceLinkLabel: string;
    /** Template with a `{date}` placeholder. */
    priceFamilyGoldBadgeTemplate: string;
    historyFilterLabel: string;
    historyFilterApply: string;
    historyFilterClear: string;
    historyFilterEmpty: string;
  };
  /** EPIC-018 Task A5 — `/aset` (consolidated assets) page copy. */
  aset: {
    v2: {
      kpiAcc: string;
      kpiInv: string;
      kpiFisik: string;
      accTitle: string;
      invSeeAll: string;
      accSeeAllRekening: string;
      accSeeAllDana: string;
      instrumentSuffix: string;
      accountSuffix: string;
      fisikCaption: string;
      fisikNew: string;
      eyeHide: string;
      eyeShow: string;
      tipTitle: string;
      tipBody: string;
      trendAria: string;
      compAria: string;
      trendLegend: string;
      detailKpiNow: string;
      detailKpiFirst: string;
      detailKpiChange: string;
      detailDocCount: string;
      detailHistCaption: string;
    };
    tabs: Record<AsetTabId, string>;
    assetTypeLabels: Record<AsetTypeId, string>;
    accountTypeLabels: Record<AsetAccountTypeId, string>;
    invTypeLabels: Record<InvestasiTypeId, string>;
    totalAssetsLabel: string;
    assetTrendTitle: string;
    addAssetButton: string;
    eyeShowAriaLabel: string;
    eyeHideAriaLabel: string;
    errorLoad: string;
    toastAdded: string;
    toastAddFailed: string;
    // EPIC-022 D5 — edit/delete UI for physical assets (previously
    // create-only; the API's PATCH/DELETE endpoints already existed).
    toastUpdated: string;
    toastUpdateFailed: string;
    toastDeleted: string;
    toastDeleteFailed: string;
    deleteDialogBody: string;
    modalTitle: string;
    modalTitleEdit: string;
    fieldNameLabel: string;
    fieldNamePlaceholder: string;
    fieldCategoryLabel: string;
    fieldValueLabel: string;
    fieldValuePlaceholder: string;
    // EPIC-021 #17/#18: signed annual value-change rate (depreciation < 0,
    // appreciation > 0).
    fieldValueChangeRateLabel: string;
    fieldValueChangeRatePlaceholder: string;
    // EPIC-023 D19/US-ASSET-4: pre-fill helper shown under the rate field —
    // "Perkiraan default untuk tipe ini: {rate}%" — naming the per-type
    // default (DEFAULT_ASSET_VALUE_CHANGE_RATE_PCT) as a suggestion, not a
    // constraint.
    defaultRateHelperPrefix: string;
    // EPIC-024 D2/US-ASSET-6: % vs Rp-tetap depreciation mode toggle.
    fieldValueChangeModeLabel: string;
    fieldValueChangeModePercentOption: string;
    fieldValueChangeModeFixedOption: string;
    fieldValueChangeAmountLabel: string;
    fieldValueChangeAmountPlaceholder: string;
    // EPIC-023 D19/US-ASSET-4: optional acquisition date — the elapsed-time
    // anchor for currentEstimatedValue instead of createdAt.
    fieldAcquisitionDateLabel: string;
    fieldAcquisitionDateHelper: string;
    // EPIC-021 #16: optional physical-asset category from master data
    // (the real Category API — distinct from the hardcoded `fieldCategoryLabel`
    // type selector above).
    fieldMasterDataCategoryLabel: string;
    fieldMasterDataCategoryNone: string;
    fieldNotesLabel: string;
    fieldNotesPlaceholder: string;
    saving: string;
    saveButton: string;
    physicalAssetsTitle: string;
    danaRekeningTitle: string;
    danaTitle: string;
    rekeningTitle: string;
    investmentsTitle: string;
    emptyPhysical: string;
    emptyDanaRekening: string;
    emptyInvestments: string;
    // EPIC-023 D19/US-ASSET-4: recordedValue is the primary bold figure;
    // this labels the secondary, adoptable projection line — "Proyeksi: {x}".
    projectionLabel: string;
    // EPIC-023 D19/US-ASSET-4: adopts currentEstimatedValue as the new
    // recorded currentValue via PATCH.
    useThisValueButton: string;
    toastValueAdopted: string;
    toastValueAdoptFailed: string;
    // EPIC-025 N3-F1: allocation donut (FOLD per J3) — same categories the
    // page already groups accounts/investments/assets into.
    breakdownCashLabel: string;
    breakdownBankLabel: string;
    breakdownInvestasiLabel: string;
    breakdownFisikLabel: string;
    allocationTitle: string;
    recordedValueLabel: string;
    perYearSuffix: string;
    detailBackLink: string;
    detailHistoryTitle: string;
    detailChartTitle: string;
    detailChangesTitle: string;
    addHistoryButton: string;
    addHistoryDialogTitle: string;
    historyModeValue: string;
    historyModePercent: string;
    historyValueLabel: string;
    historyPercentLabel: string;
    historyPercentHint: string;
    historyDateLabel: string;
    historyNoteLabel: string;
    historyNotePlaceholder: string;
    historyEmpty: string;
    historyByPrefix: string;
    historySystemActor: string;
    historySaveButton: string;
    toastHistorySaved: string;
    toastHistoryFailed: string;
    detailNotFound: string;
    documentsTitle: string;
    documentsEmpty: string;
    uploadDocumentButton: string;
    fieldDocumentLabel: string;
    toastDocumentUploaded: string;
    toastDocumentFailed: string;
    toastDocumentDeleted: string;
    deleteDocumentAria: string;
    openDocumentAria: string;
    // EPIC-025 N3 fidelity follow-up (prototype parity): hero sub-line,
    // breakdown stat-card "vs last month" delta suffix, the Aset Fisik
    // card's neutral (non-delta) note, and account-row ownership segment
    // labels ("Bersama"/"Tidak diketahui").
    totalAssetsSubtitlePrefix: string;
    statFromLastMonthSuffix: string;
    statFisikNote: string;
    ownerSharedLabel: string;
    ownerUnknownLabel: string;
  };
  /** EPIC-018 Task A5 — `/liabilitas` (debts & credit) page copy. */
  liabilitas: {
    v2: {
      heroCaption: string;
      kpiLoan: string;
      kpiCard: string;
      kpiMonthly: string;
      legendPaid: string;
      legendTotal: string;
      chartAria: string;
      chartEmpty: string;
      riskTitle: string;
      riskCaption: string;
      riskTooltip: string;
      riskHealthy: string;
      riskWarn: string;
      gridTitle: string;
      gridCount: string;
      detailLabel: string;
      tipOverdueSuffix: string;
      tipSoonSuffix: string;
      tipInstallment: string;
      tipOkTitle: string;
      tipOkBody: string;
      tipEmptyTitle: string;
      tipEmptyBody: string;
    };
    fieldGroups: {
      identity: string;
      amount: string;
      interestTenor: string;
    };
    typeLabels: Record<LiabilitasTypeId, string>;
    riskVerySafe: string;
    riskSafe: string;
    riskCaution: string;
    riskRisky: string;
    statusOngoing: string;
    statusOverdue: string;
    statusDuePrefix: string;
    toastAdded: string;
    toastAddFailed: string;
    errorLoad: string;
    modalTitle: string;
    modalEditTitle: string;
    modalCloseAriaLabel: string;
    fieldNameLabel: string;
    fieldNamePlaceholder: string;
    fieldInstitutionLabel: string;
    fieldInstitutionPlaceholder: string;
    fieldTypeLabel: string;
    fieldTotalDebtLabel: string;
    fieldTotalDebtPlaceholder: string;
    fieldRemainingLabel: string;
    fieldRemainingPlaceholder: string;
    fieldMinPaymentLabel: string;
    fieldMinPaymentPlaceholder: string;
    fieldInterestRateLabel: string;
    fieldInterestRatePlaceholder: string;
    fieldDueDateLabel: string;
    autoAdvanceLabel: string;
    fieldNotesLabel: string;
    fieldNotesPlaceholder: string;
    saving: string;
    saveButton: string;
    ccCurrentBillLabel: string;
    loanRemainingPrincipalLabel: string;
    ccLimitLabel: string;
    loanTotalLabel: string;
    ccMinPaymentLabel: string;
    loanInstallmentLabel: string;
    ccInterestMonthlyLabel: string;
    loanInterestYearlyLabel: string;
    progressUsageLabel: string;
    progressPayoffLabel: string;
    totalLiabilitiesLabel: string;
    remainingActiveSuffix: string;
    remainingActiveCountSuffix: string;
    dtaRatioLabel: string;
    addButton: string;
    emptyState: string;
    /** EPIC-024 group G — per-item Detail/Edit/Hapus/Bayar wiring (US-LIAB-6). */
    toastUpdated: string;
    toastUpdateFailed: string;
    toastDeleted: string;
    toastDeleteFailed: string;
    deleteConfirmBody: string;
    detailDialogTitle: string;
    detailInstitutionLabel: string;
    detailTypeLabel: string;
    detailStatusLabel: string;
    detailPaidThisPeriodLabel: string;
    detailNotPaidThisPeriodLabel: string;
    detailCloseButton: string;
    tileDetailButton: string;
    tileEditButton: string;
    tileDeleteButton: string;
    tilePayButton: string;
    tileMoreOptionsLabel: string;
    amortisationTitle: string;
    amortisationMonthlyInterestLabel: string;
    amortisationMonthlyPrincipalLabel: string;
    amortisationEstimatedPayoffPrefix: string;
    amortisationEstimatedPayoffSuffix: string;
    amortisationNoPayoffNote: string;
    amortisationUnavailableNote: string;
    amortisationDisclaimer: string;
    payDialogTitle: string;
    payAmountLabel: string;
    payPrincipalPreviewLabel: string;
    payInterestPreviewLabel: string;
    paySourceAccountLabel: string;
    paySourceAccountPlaceholder: string;
    payAlreadyPaidTooltip: string;
    payProcessing: string;
    payConfirmButton: string;
    toastPaid: string;
    toastPayFailed: string;
    validationPayAmountPositive: string;
    // EPIC-025 N3-F4: type-filter tabs + 3rd summary stat + payoff
    // projection chart (FOLD — pure client-side amortization, no fetch).
    filterAllLabel: string;
    monthlyInstallmentLabel: string;
    monthlyInstallmentSuffix: string;
    payoffProjectionTitle: string;
    payoffProjectionSeriesLabel: string;
    overdueWarningPrefix: string;
    overdueWarningSuffix: string;
    // EPIC-026 Wave 8 — prototype dialog composition
    // (docs/prototype/pages/liabilitas.html): the Detail dialog's
    // amortisation-schedule table headers, the Bayar dialog's amount
    // presets / source-account hint / split-preview notice. polish-j
    // batch 7a item 8 dropped the add/edit dialog's own `.dialog__desc`
    // ("Perubahan langsung memengaruhi rasio...").
    detailNextDueLabel: string;
    detailPayButton: string;
    amortisationScheduleTitle: string;
    amortisationScheduleCountSuffix: string;
    /** Revisi K — visible cue that the schedule table scrolls horizontally on narrow screens. */
    amortisationScheduleScrollHint: string;
    amortisationScheduleHeaderIndex: string;
    amortisationScheduleHeaderDate: string;
    amortisationScheduleHeaderPrincipal: string;
    amortisationScheduleHeaderInterest: string;
    payPresetLabel: string;
    payPresetInstallment: string;
    payPresetPayoff: string;
    paySourceAccountHint: string;
    payRemainingAfterLabel: string;
    // Revisi G — per-product interest terms in the add/edit form.
    interestMethodLabels: Record<LiabilitasInterestMethodId, string>;
    rateLabels: Record<LiabilitasInterestMethodId, string>;
    fieldRateMonthlyLabel: string;
    fieldRateFixedLabel: string;
    fieldInterestMethodLabel: string;
    fieldTenorLabel: string;
    fieldStartDateLabel: string;
    fieldInstallmentLabel: string;
    fieldInstallmentHint: string;
    toastInstallmentPrefix: string;
    amortisationScheduleHeaderInstallment: string;
    amortisationScheduleLoading: string;
    amortisationScheduleError: string;
    payPreviewLoading: string;
    payPreviewError: string;
    payoffProjectionError: string;
    detailTenorLabel: string;
    tenorMonthsSuffix: string;
    /** Revisi K — Pay dialog "Telat" notice (every liability type). */
    payLateBadge: string;
    payLateNote: string;
    /** Revisi K — KPR rate structure (form); Task 12 adds the detail keys. */
    kpr: {
      /** KPR flat — user decision 2026-09-27: hint under the rate field when Metode Bunga is flat (max 1 line). */
      flatHint: string;
      planLegend: string;
      presetLabel: string;
      presetNames: Record<LiabilitasKprPresetId, string>;
      officialRateNote: string;
      exampleRateNote: string;
      mmqResetNote: string;
      exampleBadge: string;
      officialBadge: string;
      periodLabel: string;
      periodKindLabel: string;
      kindFixed: string;
      kindFloating: string;
      periodMonthsLabel: string;
      periodToMaturity: string;
      periodRateLabel: string;
      periodMarginLabel: string;
      addPeriod: string;
      removePeriod: string;
      planHint: string;
      planInvalid: string;
      tenorRequiredHint: string;
      scheduleRateHeader: string;
      floatingEstimateBadge: string;
      floatingEstimateNote: string;
      historyTitle: string;
      historyHint: string;
      historyEmpty: string;
      historyLoadFailed: string;
      historyDateLabel: string;
      historyRateLabel: string;
      historyAddButton: string;
      historyDeleteButton: string;
      historyFromPeriodPrefix: string;
      historySaved: string;
      historyDeleted: string;
      historySaveFailed: string;
      prepayTitle: string;
      prepaySimulationNote: string;
      prepayModeLabel: string;
      prepayModes: Record<LiabilitasPrepaymentModeId, string>;
      prepayAmountLabel: string;
      prepayPenaltyLabel: string;
      prepayPenaltyHint: string;
      prepaySubmit: string;
      prepayResultPenalty: string;
      prepayResultCashOut: string;
      prepayResultInstallment: string;
      prepayResultTenor: string;
      prepayResultMonthsSuffix: string;
      prepayResultInterestSaved: string;
      prepayResultNetSaving: string;
      prepayEstimateNote: string;
      prepayReduceTenorNextTierNote: string;
      prepayFailed: string;
      recordAccountLabel: string;
      recordAccountPlaceholder: string;
      recordButton: string;
      recordConfirmPrefix: string;
      recordConfirmBreakdown: string;
      recordConfirmButton: string;
      recordCancelButton: string;
      recordSaved: string;
      recordFailed: string;
    };
  };
  /**
   * EPIC-018 Task A5 — `/masterdata` page copy. Every group `title`/`label`
   * (see the `MasterDataGroupId` comment in this file), the real-category-API
   * copy, and every toast resolve from here.
   *
   * EPIC-024 Task J (D14, US-MD-1) — the seven reference-list groups are now
   * backed by the real `ReferenceItem` API (`toastReferenceReadOnly` is gone;
   * replaced by the same add/delete toast set Kategori already had, plus
   * `toastItemProtected` for the seeded-default delete guard).
   */
  masterdata: {
    v2: {
      heroCap: string;
      kpiIn: string;
      kpiOut: string;
      kpiCoa: string;
      coaTitle: string;
      coaCaption: string;
      catCaption: string;
      refTitle: string;
    };
    pageTitle: string;
    pageSubtitle: string;
    masterCoaButton: string;
    categoryFooterHint: string;
    groups: Record<MasterDataGroupId, { title: string; label: string }>;
    categorySectionTitle: string;
    categoryIncomeTitle: string;
    categoryExpenseTitle: string;
    masterCoaLink: string;
    addLink: string;
    categoryLoading: string;
    categoryEmpty: string;
    kindIncome: string;
    kindExpense: string;
    privateLabel: string;
    autoOptionLabel: string;
    groupEmpty: string;
    groupLoading: string;
    systemBadge: string;
    footerBold: string;
    footerRest: string;
    editAriaPrefix: string;
    deleteAriaPrefix: string;
    categoryDeleteLabelPrefix: string;
    categoryDeleteLabelSuffix: string;
    itemDeleteLabelPrefix: string;
    itemDeleteLabelSuffix: string;
    itemRemovedPrefix: string;
    itemRemovedSuffix: string;
    toastInvalidSession: string;
    toastNameRequired: string;
    toastInvalidType: string;
    toastCategoryUpdated: string;
    toastCategoryUpdateFailed: string;
    toastCategoryAdded: string;
    toastCategoryAddFailed: string;
    toastCategoryDeleted: string;
    toastCategoryDeleteFailed: string;
    toastItemAdded: string;
    toastItemAddFailed: string;
    toastItemDeleted: string;
    toastItemDeleteFailed: string;
    toastItemProtected: string;
    topNoticeBold: string;
    topNoticePrefix: string;
    topNoticeSuffix: string;
  };
  /** EPIC-018 Task A5 — `/mastercoa` (chart of accounts) page copy. */
  mastercoa: {
    v2: { heroCap: string };
    // bento v2 prototype port (docs/design/proto/mastercoa.html) — hero
    // "Panduan" button, group mini-list card, tile grid card, and the
    // unlinked-accounts tips card.
    guideButton: string;
    groupsCardTitle: string;
    groupsCardCaption: string;
    catsAllTitle: string;
    catsCardCaption: string;
    tipsTitleUnlinkedSuffix: string;
    tipsTitleAllLinked: string;
    tipsBodyUnlinked: string;
    tipsBodyLinked: string;
    emptyGroupTitle: string;
    emptyGroupDesc: string;
    groupLabels: Record<MasterCoaGroupNum, string>;
    directionLabels: Record<MasterCoaDirectionId, string>;
    budgetTypeLabels: Record<MasterCoaBudgetTypeId, string>;
    // EPIC-025 N3 prototype structural port — page header, numbered filter
    // tabs/badges, grouped table headers, and upper-case ARAH wording added
    // alongside the pre-existing `groupLabels`/`directionLabels` keys.
    pageTitle: string;
    pageSubtitle: string;
    masterDataButton: string;
    groupBadgeLabels: Record<MasterCoaGroupNum, string>;
    groupTabLabels: Record<MasterCoaGroupNum, string>;
    groupHeaderLabels: Record<MasterCoaGroupNum, string>;
    accountsCountSuffix: string;
    directionLabelsUpper: Record<MasterCoaDirectionId, string>;
    tabAll: string;
    totalAccountsTitle: string;
    sixGroupsLabel: string;
    connectedCategoriesTitle: string;
    manageLink: string;
    linkedCategoriesDescPrefix: string;
    linkedCategoriesDescSuffix: string;
    emptyCoaTitle: string;
    emptyCoaDesc: string;
    emptyCoaDescAllLinked: string;
    usedInReportsTitle: string;
    viewLink: string;
    reportsBadgeText: string;
    activeBadge: string;
    usedInReportsDesc: string;
    listTitle: string;
    addAccountButton: string;
    colCode: string;
    colName: string;
    colGroup: string;
    colDirection: string;
    colBudgetType: string;
    colAction: string;
    loadingRow: string;
    emptyRow: string;
    errorRow: string;
    editTitle: string;
    modalTitleEdit: string;
    modalTitleAdd: string;
    fieldCodeLabel: string;
    fieldCodePlaceholder: string;
    /** EPIC-021 #4 — shown when adding (code omitted/blank auto-generates). */
    fieldCodeAutoPlaceholder: string;
    fieldGroupLabel: string;
    fieldNameLabel: string;
    fieldNamePlaceholder: string;
    fieldDirectionLabel: string;
    fieldBudgetTypeLabel: string;
    fieldParentCodeLabel: string;
    fieldParentCodePlaceholder: string;
    budgetTypeNone: string;
    deleteConfirmTitle: string;
    deleteConfirmBody: string;
    /** EPIC-026 Wave 8 — prototype `dlg-coa` supporting line + hint + the
     * warning notice, and `dlg-coa-delete`'s danger notice. */
    modalDesc: string;
    fieldCodeHint: string;
    modalWarning: string;
    deleteConfirmNotice: string;
    toastAdded: string;
    toastAddFailed: string;
    toastUpdated: string;
    toastUpdateFailed: string;
    toastDeleted: string;
    toastDeleteFailed: string;
    toastSessionNotReady: string;
    /**
     * EPIC-023 Task H2 (D18) — plain-language explainer + worked examples,
     * always visible above the account list. `groups` intentionally repeats
     * the group number in `title` (badges/tabs above stay short via
     * `groupLabels`; this is the long-form explanation, not a second label
     * for the same UI slot).
     */
    guide: {
      introTitle: string;
      introBody: string;
      riskTitle: string;
      riskBody: string;
      groupsTitle: string;
      groups: Record<
        MasterCoaGroupNum,
        { title: string; meaning: string; example: string }
      >;
      transferCalloutTitle: string;
      transferCalloutBody: string;
    };
  };
  /** EPIC-018 Task A6 — `/notifikasi` (notifications) page copy. Notification
   * `title`/`body`/`icon` come from the API (real user-facing content set at
   * creation time) and stay untranslated in the page. */
  notifikasi: {
    v2: {
      heroCap: string;
      kpiApproval: string;
      kpiBill: string;
      filterLabel: string;
      filterTransaksi: string;
      filterAnggaran: string;
      filterPersetujuan: string;
      filterTempo: string;
      filterSistem: string;
      emptyFilter: string;
      compAria: string;
    };
    title: string;
    newCountSuffix: string;
    subtitlePrefix: string;
    subtitleSuffix: string;
    processing: string;
    markAllRead: string;
    markAllReadFailed: string;
    errorLoad: string;
    emptyState: string;
    unreadBadge: string;
    markOneRead: string;
    groupUnreadSuffix: string;
    metaCountSuffix: string;
    relativeJustNow: string;
    relativeMinutesSuffix: string;
    relativeHoursSuffix: string;
    relativeYesterday: string;
    relativeDaysSuffix: string;
    filterAll: string;
    filterUnread: string;
    groupToday: string;
    groupThisWeek: string;
    groupOlder: string;
  };
  /** EPIC-018 Task A6 — `/dana` (cash & e-wallet) page copy. */
  dana: {
    v2: {
      connected: string;
      perInstrument: string;
    };
    totalLabel: string;
    loadingLabel: string;
    accountsConnectedSuffix: string;
    errorPrefixLabel: string;
    errorLoadBody: string;
    cashSectionTitle: string;
    ewalletSectionTitle: string;
    addButton: string;
    emptyEwallet: string;
    /** EPIC-021 #3 — cash is now a real, plural CRUD list like e-wallet;
     * entity label + toast copy are shared across both via these
     * entity-aware keys instead of separate `toastEwallet*` strings. */
    emptyCash: string;
    entityLabels: Record<DanaEntityId, string>;
    toastUpdatedSuffix: string;
    toastAddedSuffix: string;
    toastDeletedSuffix: string;
    toastSaveFailedPrefix: string;
    toastSaveFailedSuffix: string;
    toastDeleteFailedPrefix: string;
    toastDeleteFailedSuffix: string;
    cashStatLabel: string;
    ewalletStatLabel: string;
    cashCountSuffix: string;
    ewalletCountSuffix: string;
    /** EPIC-025 N3 prototype structural port. */
    pageSubtitle: string;
    addCashHeaderButton: string;
    addEwalletHeaderButton: string;
    compositionTitle: string;
    compositionTotalLabel: string;
    infoNoticeBold: string;
    infoNoticeBody: string;
    infoNoticeLinkLabel: string;
    infoNoticeSuffix: string;
    bankInfoTitle: string;
    bankInfoBody: string;
    bankInfoLinkLabel: string;
    mutationsSectionTitle: string;
    mutationsViewAllLabel: string;
    mutationsEmptyLabel: string;
    tableDateHeader: string;
    tableDescriptionHeader: string;
    tableAccountHeader: string;
    tableAmountHeader: string;
    updatedPrefix: string;
  };
  /**
   * EPIC-021 Group F (#6) — shared copy for the consolidated-total display
   * (IDR + USD + gram-emas simultaneously), used on `/ringkasan` and
   * `/beranda`'s net-worth hero card.
   */
  consolidatedTotal: {
    title: string;
    idrLabel: string;
    usdLabel: string;
    goldLabel: string;
    goldUnitSuffix: string;
    goldPromptText: string;
    goldPromptLinkLabel: string;
    manualLabelPrefix: string;
    // B9 (client revision round 2) — "Harga Antam 1 kg, sumber
    // emasantam.id, diperbarui {date}" one-liner shown instead of
    // manualLabelPrefix when the live Antam feed (not the manual entry) is
    // the active gold-price source.
    antamLabelTemplate: string;
    indicativeFxNote: string;
    loadingLabel: string;
  };
  /** EPIC-018 Task A6 — `/ringkasan` (financial summary dashboard) page copy. */
  ringkasan: {
    errorLoad: string;
    totalNetWorthLabel: string;
    monthDeltaSuffix: string;
    totalAssetsLabel: string;
    accountTypesSuffix: string;
    noDataDash: string;
    totalLiabilitiesLabel: string;
    liabilitiesSublabel: string;
    savingsRateLabel: string;
    expenseValuePrefix: string;
    indicativeFxNotePrefix: string;
    indicativeFxNoteSuffix: string;
    netWorthTrendTitle: string;
    netWorthTrendRangeStart: string;
    netWorthTrendRangeEnd: string;
    emptyNetWorthTrend: string;
    compositionTitle: string;
    emptyComposition: string;
    cashFlowTitlePrefix: string;
    incomeLabel: string;
    expenseLabel: string;
    surplusLabel: string;
    avgNetPerMonthLabel: string;
    loadingLabel: string;
    topExpensesTitle: string;
    emptyTopExpenses: string;
    healthScoreTitle: string;
    /** Center label inside the prototype's `#c-health` radial gauge. */
    healthScoreCenterLabel: string;
    financialHealthScoreLabel: string;
    healthStatusGood: string;
    healthStatusFair: string;
    healthStatusNeedsAttention: string;
    liabilityBreakdownTitle: string;
    emptyLiabilityBreakdown: string;
    // Structural port fidelity follow-up — page header (H1 + subtitle).
    pageHeaderTitle: string;
    pageHeaderSubtitleConnector: string;
    pageHeaderFamilyFallback: string;
    // Trend range segmented control ("6 Bln / 12 Bln / Semua").
    trendRangeGroupAriaLabel: string;
    trendRangeLabel6m: string;
    trendRangeLabel12m: string;
    trendRangeLabelAll: string;
    trendRangeLabel1m: string;
    trendRangeLabel3m: string;
    trendRangeLabelYtd: string;
    trendRangeLabelCustom: string;
    trendCustomFromLabel: string;
    trendCustomToLabel: string;
    netWorthTrendTitle1m: string;
    netWorthTrendTitle3m: string;
    netWorthTrendTitleYtd: string;
    netWorthTrendTitleCustom: string;
    currencyGroupAriaLabel: string;
    currencyIdr: string;
    currencyForeignAriaLabel: string;
    currencyForeignPlaceholder: string;
    currencyGold: string;
    netWorthTrendTitle12m: string;
    netWorthTrendTitleAll: string;
    yoySuffix: string;
    // "Sembunyikan nominal" privacy toggle (page-local, mirrors aset/page.tsx).
    hideAmountsButton: string;
    showAmountsButton: string;
    hideAmountsAriaLabel: string;
    showAmountsAriaLabel: string;
    heroSettingsButton: string;
    heroSettingsAriaLabel: string;
    // "Rincian Aset vs Liabilitas" table.
    breakdownTableTitle: string;
    breakdownColPos: string;
    breakdownColJenis: string;
    breakdownColPorsi: string;
    breakdownColNilai: string;
    breakdownAssetPhysicalLabel: string;
    breakdownAssetInvestmentLabel: string;
    breakdownAssetBankLabel: string;
    breakdownAssetCashLabel: string;
    breakdownBadgeAssetFisik: string;
    breakdownBadgeInvestasi: string;
    breakdownBadgeBank: string;
    breakdownBadgeKas: string;
    breakdownBadgeLiabilitas: string;
    breakdownTotalAssetsRow: string;
    breakdownTotalLiabilitiesRow: string;
    breakdownNetWorthRow: string;
    breakdownNetWorthFormula: string;
    breakdownEmpty: string;
    // Health Score debt-ratio insight note.
    healthDebtRatioNotePrefix: string;
    healthDebtRatioNoteSuffixSafe: string;
    healthDebtRatioNoteSuffixAttention: string;
  };
  /** EPIC-018 Task A6 — `/tujuan` (financial goals) page copy. */
  tujuan: {
    v2: {
      heroCapPrefix: string;
      heroCapSuffix: string;
      legendSaved: string;
      legendTarget: string;
      chartEmpty: string;
      kpiOnTrack: string;
      kpiBoost: string;
      kpiRisk: string;
      attTitle: string;
      attCaption: string;
      attAllGood: string;
      tilesTitle: string;
      tilesCaption: string;
      addTile: string;
      tipsOkTitle: string;
      tipsWorstSuffix: string;
      tipsOkBody: string;
      tipsOverallPrefix: string;
      tipsSeeTransactions: string;
    };
    statusLabels: Record<TujuanStatusId, string>;
    noTargetDate: string;
    targetDatePrefix: string;
    editButton: string;
    deleteButton: string;
    collectedSuffix: string;
    targetPrefix: string;
    remainingPrefix: string;
    remainingAmountSuffix: string;
    autoDebitPrefix: string;
    autoDebitSuffix: string;
    noAutoDebit: string;
    autoDebitDayPrefix: string;
    toastSessionNotReady: string;
    toastUpdated: string;
    toastAdded: string;
    toastSaveFailed: string;
    toastDeleted: string;
    toastDeleteFailed: string;
    activeGoalsSuffix: string;
    totalAllocatedPrefix: string;
    addGoalButton: string;
    onTrackLabel: string;
    onTrackDesc: string;
    needsBoostLabel: string;
    needsBoostDesc: string;
    atRiskLabel: string;
    atRiskDesc: string;
    errorLoad: string;
    emptyState: string;
    overallSectionTitle: string;
    overallTotalLabel: string;
    overallActiveGoalsSuffix: string;
    overallMonthlyPrefix: string;
    overallMonthlySuffix: string;
    addGoalCardTitle: string;
    addGoalCardDesc: string;
    noticeSavingsPrefix: string;
    noticeSavingsPerMonthMiddle: string;
    noticeSavingsMonthsSuffix: string;
    noticeSavingsNoAutoDebitSuffix: string;
    contributeButton: string;
    contributeButtonAriaPrefix: string;
    contributeDialogTitlePrefix: string;
    contributeDialogDesc: string;
    contributeAmountLabel: string;
    contributeAccountLabel: string;
    contributeNoAccountOption: string;
    contributeDateLabel: string;
    contributeSubmit: string;
    contributeSubmitting: string;
    contributeToastSuccess: string;
    // Revisi F final-review Finding 4 — honest scope notices: a goal
    // contribution has no destination account, so it never enters net
    // worth; deleting a goal doesn't return its contributions to net worth
    // either (the underlying account transactions are unaffected).
    contributeNetWorthNotice: string;
    deleteConfirmNetWorthNote: string;
    historyToggleShow: string;
    historyToggleHide: string;
    historyLoading: string;
    historyError: string;
    historyEmpty: string;
    historySourceManual: string;
    historySourceAuto: string;
    sourceAccountFieldLabel: string;
    sourceAccountPlaceholder: string;
    sourceAccountRequired: string;
  };
  /**
   * EPIC-018 Task A6 — `/tax` (tax center) page copy. `LEMBAGA_OPTIONS`-style
   * value-locked lists don't apply here (no persisted free-text recipient
   * field on this page).
   */
  tax: {
    sptStatusLabels: Record<TaxSptStatusId, string>;
    heroLabelPrefix: string;
    heroSubtitle: string;
    prevYearStatusLabelPrefix: string;
    markReportedButton: string;
    noDataLabel: string;
    sptYearLabelPrefix: string;
    deadlinePrefix: string;
    zakatDeductionTitle: string;
    zakatDeductionDash: string;
    zakatDeductionDesc: string;
    calculatorTitle: string;
    calculatorOtherLink: string;
    jumpToCalculator: string;
    calculatorSubtitle: string;
    fieldGrossLabel: string;
    fieldStatusLabel: string;
    fieldJabatanLabel: string;
    fieldZakatLabel: string;
    estimateLabel: string;
    calculatingLabel: string;
    calcErrorLabel: string;
    heroNoPkpTitle: string;
    heroNoPkpHint: string;
    pkpPrefix: string;
    effectiveRatePrefix: string;
    savingLabel: string;
    saveToTaxRecordButton: string;
    progressiveBreakdownTitle: string;
    colBracket: string;
    colRate: string;
    colTax: string;
    historyTitle: string;
    taxYearPrefix: string;
    grossPrefix: string;
    zakatPrefix: string;
    markReportedShortButton: string;
    documentsTitle: string;
    uploadButton: string;
    openDocumentAria: string;
    deleteDocumentAria: string;
    toastDocumentUploaded: string;
    toastDocumentFailed: string;
    toastDocumentDeleted: string;
    reportSptButton: string;
    downloadSummaryButton: string;
    toastDownloadFailed: string;
    toastSaved: string;
    toastSaveFailed: string;
    toastStatusUpdated: string;
    toastStatusUpdateFailed: string;
    /**
     * EPIC-023 Task I (I1) — shown in place of an enabled Save button when
     * the caller's role has no `manage TaxRecord` grant, or when the session
     * has no family group yet. Both cases used to fail server-side and
     * surface only as `toastSaveFailed`.
     */
    noWriteAccessNote: string;
    noFamilyGroupNote: string;
    checkingAccessLabel: string;
    /**
     * EPIC-023 Task I retry (HIGH — review) — shown when the `/auth/me`
     * lookup itself fails. Distinct from `noWriteAccessNote` because an
     * outage is not the same fact as "your role cannot do this" — telling an
     * owner the wrong thing sends them down a false trail mid-incident.
     */
    accessCheckFailedNote: string;
    // Prototype structural port follow-up — Tahun Pajak select (drives which
    // year a saved TaxRecord is tagged with; the calculator math itself is
    // year-independent per the shared BE brackets).
    fieldTaxYearLabel: string;
    // Renamed calculator field for the "perpuluhan/donasi" deduction — kept
    // separate from `fieldZakatLabel` (unremoved, per i18n convention) since
    // the prototype's approved copy is "Perpuluhan (pengurang)".
    fieldPerpuluhanLabel: string;
    grossInputHint: string;
    ptkpSelectedPrefix: string;
    jabatanHint: string;
    perpuluhanAutoFilledHint: string;
    resetButton: string;
    toastReset: string;
    colTaxableBase: string;
    perpuluhanDeductionTitle: string;
    perpuluhanDeductionDesc: string;
    emptyDocumentsTitle: string;
    emptyDocumentsSub: string;
    // EPIC-026 Wave 2 — prototype structural port: the prototype's
    // "Simpan ke Catatan Pajak" confirmation dialog (review the exact
    // numbers being persisted before Save actually fires) had no real-app
    // counterpart; Save wrote straight through with no review step.
    saveDialogTitle: string;
    saveDialogDescPrefix: string;
    saveDialogGrossRow: string;
    saveDialogPtkpRow: string;
    saveDialogPerpuluhanRow: string;
    saveDialogTaxRow: string;
    saveDialogNote: string;
    saveDialogConfirmButton: string;
    // Task 9 (sub-plan L) — shared `<TaxRuleBadge>` copy for any
    // unverified/out-of-range `TaxRuleRefDto` surfaced anywhere on /tax.
    rules: {
      unverifiedBadge: string;
      unverifiedIntro: string;
      outOfRange: string;
    };
    // Task 9 — the detailed PPh OP calculator (replaces the old flat
    // PTKP/gross-only form): marital status + dependents drive the
    // server-computed PTKP, plus pension/withheld/freelance NPPN/other-net
    // inputs the legacy calculator never had.
    op: {
      statusLabel: string;
      maritalLabels: Record<TaxMaritalStatusId, string>;
      dependentsLabel: string;
      ptkpDerivedPrefix: string;
      pensionLabel: string;
      withheldLabel: string;
      freelanceLabel: string;
      nppnLabel: string;
      nppnHint: string;
      otherNetLabel: string;
      netoLabel: string;
      balanceLabel: string;
      overpaidLabel: string;
      noTaxRow: string;
      previewNeedsFamily: string;
    };
    // Task 9 — monthly PPh 21 TER (tarif efektif rata-rata) withholding +
    // the December Pasal 17 true-up, plus the PPh 21 DTP (ditanggung
    // pemerintah) incentive fieldset.
    ter: {
      title: string;
      subtitle: string;
      monthlyGrossLabel: string;
      editMonthsToggle: string;
      // Fix round 1 (DTP fixed-gross cap, PMK 10/2025) — an explicit
      // per-month THR/bonus amount so the DTP salary cap can exclude it
      // without under-capping a genuine mid-year raise.
      thrBonusLabel: string;
      thrBonusHint: string;
      thrExceedsGrossError: string;
      categoryPrefix: string;
      kiNote: string;
      colMonth: string;
      colGross: string;
      colRate: string;
      colWithheld: string;
      colDtp: string;
      decemberLabel: string;
      refundNote: string;
      notApplicable: string;
      dtpTitle: string;
      dtpSectorLabel: string;
      dtpSectors: Record<TaxDtpSectorId, string>;
      dtpEmploymentLabel: string;
      dtpEmployment: { permanent: string; non_permanent: string };
      dtpDailyWageLabel: string;
      dtpNikLabel: string;
      dtpReasons: Record<TaxDtpReasonId, string>;
      dtpEligible: string;
      dtpTotalPrefix: string;
      // Task 10 carry (Task 9 review) — the panel used to render 12 rows
      // of "Rp 0" before any gross was entered, with no loading state and
      // no explanation when the caller has no family group.
      emptyStateNote: string;
      loadingLabel: string;
      noFamilyNote: string;
    };
    // Task 10 (sub-plan L) — the UMKM 0.5% final-tax monthly-omzet
    // calculator (contracts' `UmkmResultDto`/`UmkmPreviewRequestDto`).
    umkm: {
      title: string;
      subtitle: string;
      monthLabels: string[];
      firstYearLabel: string;
      pre2018Note: string;
      noTimeLimitNote: string;
      ineligible: string;
      exceedsCeiling: string;
      colOmzet: string;
      colCumulative: string;
      colTaxable: string;
      colTax: string;
      totalPrefix: string;
      save: string;
      saved: string;
      saveFailed: string;
      disclosureLabel: string;
      loadingLabel: string;
      loadFailedLabel: string;
      emptyStateNote: string;
    };
    // Task 10 — final tax on investments/other income (contracts'
    // `FinalTaxEstimateDto`/`TaxFinalIncomeEntryDto`).
    final: {
      title: string;
      subtitle: string;
      instruments: Record<TaxFinalInstrumentId, string>;
      sourceHolding: string;
      sourceEntry: string;
      caveats: Record<TaxFinalCaveatId, string>;
      belowThreshold: string;
      missingRate: string;
      missingRateNotice: string;
      skippedForeign: string;
      addEntry: string;
      editEntry: string;
      deleteEntry: string;
      fieldInstrument: string;
      fieldGross: string;
      fieldDate: string;
      fieldReinvested: string;
      fieldRateOverride: string;
      fieldNotes: string;
      totalPrefix: string;
      toastSaved: string;
      toastDeleted: string;
      toastFailed: string;
      loadingLabel: string;
      loadFailedLabel: string;
      emptyStateNote: string;
    };
    // Task 10 — the page's single "answer" block: total estimated tax +
    // SPT timing (contracts' `TaxAnnualSummaryDto`).
    summary: {
      title: string;
      totalLabel: string;
      pphOpLabel: string;
      finalLabel: string;
      umkmLabel: string;
      noRecord: string;
      balanceDue: string;
      balanceOver: string;
      deadlineLabel: string;
      daysLeft: string;
      daysLate: string;
      graceNote: string;
      coretaxNote: string;
      filedAtPrefix: string;
    };
    // Task 11 — /investasi's final-tax card (contracts'
    // `FinalTaxEstimateDto` via `useInvestmentTaxEstimate`).
    invest: {
      title: string;
      empty: string;
      exchangeLabel: string;
      exchangeOptions: Record<TaxCryptoExchangeId, string>;
      viewInTax: string;
    };
    // Task 11 — /rekening's compact savings/deposit interest-tax notice.
    account: {
      title: string;
      body: string;
    };
    // Task 11 — /transaksi's collapsed "Info PPN" hint (contracts'
    // `PpnPreviewResultDto`).
    ppn: {
      summary: string;
      infoOnly: string;
      luxuryToggle: string;
      dppLabel: string;
      ppnLabel: string;
      effectiveLabel: string;
      mechanismNote: string;
    };
  };
  /** EPIC-018 Task A6 — `/rekening` (bank accounts) page copy. */
  rekening: {
    v2: {
      quickTitle: string;
      record: string;
      reconcile: string;
      mutations: string;
      customize: string;
      resetLook: string;
      done: string;
      colour: string;
      pattern: string;
      deviceNote: string;
      skins: Record<
        | "lime"
        | "forest"
        | "midnight"
        | "graphite"
        | "sand"
        | "sky"
        | "lilac"
        | "coral",
        string
      >;
      patterns: Record<"hatch" | "dots" | "waves" | "plain", string>;
      allTitle: string;
    };
    typeLabels: Record<RekeningAccountTypeId, string>;
    balanceLabel: string;
    activeBadge: string;
    privateBadge: string;
    privateBadgeTooltip: string;
    optionsAriaLabel: string;
    viewMutationMenuItem: string;
    editMenuItem: string;
    deleteMenuItem: string;
    viewMutationAriaLabel: string;
    viewMutationButton: string;
    loadingLabel: string;
    accountsConnectedSuffix: string;
    totalPrefix: string;
    approxUsdPrefix: string;
    addButton: string;
    errorPrefixLabel: string;
    errorLoadBody: string;
    emptyStatePrefix: string;
    addNowButton: string;
    toastUpdated: string;
    toastAdded: string;
    toastSaveFailed: string;
    toastDeleted: string;
    toastDeleteFailed: string;
    ownerSelectFamilyLabel: string;
    ownerMineBadge: string;
    ownerBadgePrefix: string;
    ownerUnknownLabel: string;
    filterGroupLabel: string;
    filterAllLabel: string;
    filterMineLabel: string;
    filterSharedLabel: string;
    emptyMineState: string;
    statBankBalanceLabel: string;
    statSharedLabel: string;
    statSharedDeltaSuffix: string;
    statOwnedLabel: string;
    statOwnedDeltaSuffix: string;
    mintaDanaButtonLabel: string;
    mintaDanaDialogTitle: string;
    mintaDanaAmountLabel: string;
    mintaDanaAmountInvalidToast: string;
    mintaDanaNoteLabel: string;
    mintaDanaNotePlaceholder: string;
    mintaDanaSubmitButton: string;
    mintaDanaSubmitting: string;
    mintaDanaSuccessToast: string;
    mintaDanaFailToast: string;
    mintaDanaTargetLabel: string;
    mintaDanaNoOwnAccountHint: string;
    // EPIC-026 Wave 3 — prototype `dlg-minta-dana` / `dlg-rekening-hapus`
    // (docs/prototype/pages/rekening.html) supporting copy.
    mintaDanaDialogDesc: string;
    deleteDialogTitle: string;
    deleteDialogBody: string;
    deleteDialogConfirm: string;
    /** EPIC-025 N3 prototype structural port. */
    filterNoteText: string;
    addCardTitle: string;
    addCardSubtitle: string;
    addCardButton: string;
    mutasiFooterButton: string;
  };
  /**
   * EPIC-018 Task A6 — `/donation` (donation & zakat) page copy.
   * `LEMBAGA_OPTIONS` (recipient institution names persisted as free-text
   * `recipient`) stay untranslated in the page — same value-locked-copy
   * caveat as the shared, untranslated `crud-config.ts` select options.
   */
  donation: {
    typeLabels: Record<DonationTypeId, string>;
    jenisOptionLabels: Record<DonationTypeId, string>;
    heroTitle: string;
    /** Compact hero caption ("Total donasi tahun ini"), matching the
     * prototype's `#heroVal` caption — replaces the longer
     * heroTitle+count+year combo as the hero's caption line. */
    heroCaptionThisYear: string;
    transactionsSuffix: string;
    yearRunningPrefix: string;
    subheaderDesc: string;
    recordDonationButton: string;
    /** Hero KPI pair (prototype donation.html `#kCount`/`#kDed`) — a
     * transaction count and a compact tax-deductible total, replacing the
     * old deductible/voluntary KPI pair. */
    statTransactionsLabel: string;
    statDeductibleCompactLabel: string;
    zakatCalculatorTitle: string;
    zakatCalculatorSubtitle: string;
    fieldCashLabel: string;
    fieldGoldLabel: string;
    fieldInvestLabel: string;
    fieldDebtLabel: string;
    zakatDueLabel: string;
    zakatCalculatingMsg: string;
    zakatCalcErrorMsg: string;
    /** EPIC-022 E1 — the haul (1 lunar year) confirmation question. */
    haulCheckboxLabel: string;
    /** EPIC-022 E1/E2 — replaces the old `nisabReachedMsg`/`nisabNotReachedMsg`
     * (which hardcoded the nisab rupiah figure); these are prefix/suffix
     * pairs wrapped around the server-computed `formatRupiah(nisab)`, and
     * the "reached" case now splits on whether haul is also confirmed. */
    nisabNotReachedPrefix: string;
    nisabNotReachedSuffix: string;
    nisabReachedObligatedPrefix: string;
    nisabReachedObligatedSuffix: string;
    nisabReachedEstimatePrefix: string;
    nisabReachedEstimateSuffix: string;
    /** EPIC-022 E2 — shown when nisab derives from the family's own gold
     * price rather than the indicative fallback. */
    nisabFamilyPricePrefix: string;
    nisabFamilyPriceSuffix: string;
    nisabIndicativeNote: string;
    payZakatNowButton: string;
    /** EPIC-022 E1 — CTA label used instead of `payZakatNowButton` while
     * nisab is met but haul is not yet confirmed (an estimate, not a
     * settled obligation). */
    recordZakatEstimateButton: string;
    historyTitle: string;
    loadingLabel: string;
    emptyHistory: string;
    taxDeductibleBadge: string;
    taxNonDeductibleBadge: string;
    receiptLabel: string;
    historyLaporanLink: string;
    statDeductibleLabelPrefix: string;
    statDeductibleDeltaMid: string;
    statDeductibleDeltaSuffix: string;
    statVoluntaryLabel: string;
    statVoluntaryDelta: string;
    statReceiptsLabel: string;
    statReceiptsComplete: string;
    statReceiptsIncomplete: string;
    insightTitle: string;
    insightDesc: string;
    modalTitle: string;
    fieldJenisLabel: string;
    fieldJumlahLabel: string;
    fieldLembagaLabel: string;
    fieldTanggalLabel: string;
    fieldAccountLabel: string;
    accountNoneOption: string;
    savingLabel: string;
    saveRecordButton: string;
    toastSaved: string;
    toastSaveFailed: string;
    toastInvalidAmount: string;
    /**
     * EPIC-023 F2 (D20, US-DON-6/7) — the donation page shows the
     * calculator matching the family's religion setting (zakat when
     * `islam`, perpuluhan when `kristen`, neither when `none`). Perpuluhan
     * has its OWN arithmetic (10% of income) — not zakat relabelled.
     */
    perpuluhanCalculatorTitle: string;
    perpuluhanCalculatorBadge: string;
    perpuluhanCalculatorSubtitle: string;
    fieldIncomeLabel: string;
    fieldOtherIncomeLabel: string;
    fieldRateLabel: string;
    fieldRateHint: string;
    perpuluhanDueLabel: string;
    perpuluhanResultLabel: string;
    perpuluhanResultSummaryMid: string;
    perpuluhanCalculatingMsg: string;
    perpuluhanCalcErrorMsg: string;
    payPerpuluhanNowButton: string;
    recordPerpuluhanButton: string;
    /** Shown instead of any calculator when the family's religion setting
     * is `none` — honest UI: no calculator is fabricated for a faith the
     * family hasn't set. */
    religionCalculatorNoneTitle: string;
    religionCalculatorNoneDesc: string;
    religionGeneralOnlyTitle: string;
    religionGeneralOnlyDesc: string;
    /**
     * EPIC-023 Group F fix round (HIGH 4 / MEDIUM 9) — loading/error states
     * for the religion setting itself (previously silently fell through to
     * the zakat calculator on both), and the prompt shown when a family has
     * never chosen (`religion === null`), distinct from `none` (an actual
     * choice to show neither calculator).
     */
    religionLoadingMsg: string;
    religionErrorMsg: string;
    religionCalculatorUnconfirmedTitle: string;
    religionCalculatorUnconfirmedDesc: string;
    /**
     * EPIC-026 — prototype `dlg-donasi` composition
     * (`docs/prototype/pages/donation.html`): the tax-deduction switch row
     * (the prototype uses a `.switch`, not a checkbox). polish-j batch 7a
     * item 5 — `taxDeductibleSwitchDesc` is now the ONE line covering what
     * qualifies (zakat/persepuluhan to a registered body) and the legal
     * reference; the separate account hint, dialog subtitle, and
     * ineligibility note it used to duplicate are gone.
     */
    taxDeductibleSwitchTitle: string;
    taxDeductibleSwitchDesc: string;
  };
  /**
   * EPIC-018 Task A6 — `/warisan` (inheritance assets) page copy.
   * `ASSET_TYPE_OPTIONS` (persisted free-text `assetType` categories) stay
   * untranslated in the page — same value-locked-copy caveat as `donation`'s
   * `LEMBAGA_OPTIONS`.
   */
  warisan: {
    v2: {
      legendValue: string;
      chartAria: string;
      kpiAssets: string;
      kpiHeirs: string;
      kpiAlloc: string;
      benCaption: string;
      benEmpty: string;
      /** Point 1 — small "total" sub-label under the compact total figure
       * inside the hero's composition stack (proto: "Rp 1,08 M total"). */
      compTotalLabel: string;
    };
    heroTitle: string;
    assetsRegisteredSuffix: string;
    heirsMidDot: string;
    heirsSuffix: string;
    headerDesc: string;
    addAssetButton: string;
    emptyState: string;
    insightTitle: string;
    insightDesc: string;
    /** Dynamic tip-card copy (hero mirrors warisan.html's `WM.chart.donut`
     * caption logic): no assets yet, fully allocated, or a running
     * unallocated percentage. */
    insightEmptyTitle: string;
    insightEmptyDesc: string;
    insightFullTitle: string;
    insightFullDesc: string;
    insightUnallocatedSuffix: string;
    insightUnallocatedDesc: string;
    modalTitleEdit: string;
    fieldCategoryLabel: string;
    fieldNameLabel: string;
    fieldNamePlaceholder: string;
    fieldValueLabel: string;
    fieldNotesLabel: string;
    fieldNotesPlaceholder: string;
    fieldAccessLabel: string;
    visibleToHeirsLabel: string;
    visibleToHeirsOnDesc: string;
    visibleToHeirsOffDesc: string;
    savingLabel: string;
    saveAssetButton: string;
    toastAdded: string;
    toastAddFailed: string;
    toastUpdated: string;
    toastUpdateFailed: string;
    toastVisibilityUpdateFailed: string;
    toastDeleted: string;
    toastDeleteFailed: string;
    toastSessionNotReady: string;
    toastNameRequired: string;
    toastInvalidValue: string;
    /** EPIC-024 Group H (item 15) — block submit synchronously when an
     * included heir row is missing its relationship, instead of relying on
     * the server's 400 to surface a generic toast. */
    toastHeirRelationshipRequired: string;
    /** EPIC-023 F1 (D14, US-INS-5) — heir editor copy (previously entirely
     * hardcoded Indonesian, mirroring asuransi's beneficiary editor keys). */
    heirsSectionTitle: string;
    heirNamePlaceholder: string;
    removeHeirAriaLabel: string;
    heirRelationshipPlaceholder: string;
    /** Revisi K bug 1 — default relationship text filled in when the picked
     * member is the family owner (Master), whose `Member.relationship` is
     * null (it's not a kinship value). */
    heirRelationshipSelfDefault: string;
    heirSharePercentPlaceholder: string;
    heirMemberAriaLabel: string;
    heirMemberNoneOption: string;
    addHeirButton: string;
    heirAllocationAllocatedSuffix: string;
    heirAllocationUnallocatedSuffix: string;
    heirAllocationFullyAllocated: string;
    /** Honest-UI note shown instead of a silently empty picker when the
     * member list failed to load (e.g. a dependant/operational role has no
     * "read Member" ability). */
    heirMemberPickerUnavailable: string;
    // EPIC-025 N3-E3 — J3 FOLD: beneficiary-allocation donut, derived from
    // the already-fetched inheritance-assets list.
    heirAllocationChartTitle: string;
    heirAllocationUnallocatedLabel: string;
    /** Point 3 — asset-list row allocation bar label line (proto
     * warisan.html:108 `.wr-alloc .lbl`: "Alokasi ahli waris" · "Penuh"/"x%
     * belum dialokasikan"). */
    listRowAllocationLabel: string;
    listRowAllocationFull: string;
    // EPIC-025 N3 restructure — 2-col layout: aggregated asset list card
    // title/caption and per-row "estimated value" sub-label / linked-asset
    // meta line prefix.
    assetListCardTitle: string;
    visibleToAllHeirsCaption: string;
    estimatedValueLabel: string;
    linkedToAssetPrefix: string;
    // EPIC-026 Wave 8 — prototype dialog composition
    // (docs/prototype/pages/warisan.html): the linked-asset picker + its
    // hint and the two previously-hardcoded Indonesian strings in the save
    // path. polish-j batch 7a item 10 dropped the dialog's own
    // `.dialog__desc` and the visibility switch's hint (both stated
    // consequences already obvious from the field/switch itself).
    fieldSourceLabel: string;
    sourceManualOption: string;
    sourceAssetOption: string;
    fieldAssetLabel: string;
    assetPickerPlaceholder: string;
    assetPickerHint: string;
    deleteConfirmBody: string;
    toastSharePercentExceeded: string;
    heirTableHeaderName: string;
    heirTableHeaderRelationship: string;
    heirTableHeaderShare: string;
    heirTableHeaderAction: string;
    heirTableEmpty: string;
  };
  /** EPIC-018 Task A6 — `/anggaran` (budgets) page copy. */
  anggaran: {
    v2: {
      leftCap: string;
      overCap: string;
      legendSpent: string;
      legendLimit: string;
      kpiLimit: string;
      kpiSpent: string;
      kpiSafe: string;
      ofLimit: string;
      sortLabel: string;
      sortUsed: string;
      sortLeft: string;
      tilesCaption: string;
      addTile: string;
      obCaptionUnpaid: string;
      obCaptionAllPaid: string;
      seeAllObligations: string;
      alertOkTitle: string;
      alertOkBody: string;
      alertSeeTx: string;
      chartEmpty: string;
    };
    budgetTypeLabels: Record<AnggaranBudgetTypeId, string>;
    periodLabels: Record<AnggaranPeriodId, string>;
    amountsMidDari: string;
    pageTitlePrefix: string;
    totalBudgetPrefix: string;
    addCategoryButton: string;
    remainingBudgetLabel: string;
    pctOfBudgetSuffix: string;
    noBudgetYet: string;
    totalSpentLabel: string;
    daysLeftLabel: string;
    daysSuffix: string;
    daysOfPrefix: string;
    daysOfSuffix: string;
    categoryBreakdownTitle: string;
    errorLoad: string;
    emptyState: string;
    // EPIC-025 N3-E1 — J3 FOLD: budget-vs-actual bars, derived from
    // already-fetched budget data (see `docs/prototype/pages/anggaran.html`).
    categoryBarChartTitle: string;
    emptyCategoryBarChart: string;
    typeBreakdownTitle: string;
    categoriesSuffix: string;
    overBudgetMidText: string;
    overBudgetSuffix: string;
    overBudgetDesc: string;
    nearLimitMidText: string;
    nearLimitSuffix: string;
    nearLimitDesc: string;
    tipsSavingLink: string;
    modalAddTitle: string;
    fieldCategoryNameLabel: string;
    fieldKindLabel: string;
    fieldCoaLabel: string;
    coaAutoOptionLabel: string;
    fieldPrivateLabel: string;
    fieldPrivateHint: string;
    fieldCategoryNamePlaceholder: string;
    iconGroupAriaLabel: string;
    iconLabel: string;
    iconAriaLabelPrefix: string;
    fieldAmountLabel: string;
    fieldPeriodLabel: string;
    savingLabel: string;
    saveCategoryButton: string;
    toastCategoryAddedPrefix: string;
    toastCategoryAddedSuffix: string;
    toastSaveFailedDefault: string;
    toastNameRequired: string;
    toastAmountInvalid: string;
    toastNoFamilyGroup: string;
    errorCategoryNotFoundAfterConflict: string;
    /** EPIC-022 F3 — a member picking from existing categories left the
     * picker on its placeholder option. */
    errorCategoryRequired: string;
    fieldExistingCategoryLabel: string;
    existingCategoryPlaceholder: string;
    existingCategoryEmptyOption: string;
    /** EPIC-023 E2 — "this period's obligations" Pay list (D11, US-LIAB-3). */
    obligationsSectionTitle: string;
    obligationsDueBadge: string;
    obligationsPayButton: string;
    /** EPIC-023 Task E retry (CRITICAL 1) — shown + disabled instead of
     * `obligationsPayButton` once `paidThisPeriod` is true. */
    obligationsAlreadyPaidButton: string;
    obligationsPayDialogTitle: string;
    obligationsSourceAccountLabel: string;
    obligationsSourceAccountPlaceholder: string;
    obligationsPayProcessing: string;
    obligationsPayConfirmButton: string;
    obligationsToastPaySuccess: string;
    obligationsToastPayFailed: string;
    /** EPIC-025 N3 rework — hero card (`docs/prototype/pages/anggaran.html`). */
    heroDaysLeftMid: string;
    heroDaysLeftSuffix: string;
    heroTerpakaiPrefix: string;
    heroRencanaPrefix: string;
    statAvgSafePrefix: string;
    statAvgSafeSuffix: string;
    categoryAddAction: string;
    categoryFooterRemainingPrefix: string;
    categoryFooterOverBudgetPrefix: string;
    obligationsSummaryMidPrefix: string;
    obligationsSummaryMidSuffix: string;
    obligationsDueDatePrefix: string;
    /**
     * EPIC-026 — prototype `dlg-budget` / `dlg-pay` composition
     * (`docs/prototype/pages/anggaran.html`): each dialog's `.dialog__desc`
     * supporting line, plus the due-date line inside the pay dialog's
     * `.notice` (previously hardcoded Indonesian).
     */
    modalAddDesc: string;
    obligationsPayDialogDesc: string;
    obligationsDueDateNoticePrefix: string;
    /** EPIC-022 C2 — budget edit/delete UI (the API already had both). */
    editAriaLabelPrefix: string;
    deleteAriaLabelPrefix: string;
    modalEditTitle: string;
    modalEditDesc: string;
    saveChangesButton: string;
    toastUpdated: string;
    toastUpdateFailedDefault: string;
    deleteDialogTitle: string;
    deleteDialogBody: string;
    deleteDialogConfirm: string;
    toastDeleted: string;
    toastDeleteFailedDefault: string;
  };
  /** EPIC-018 Task A6 — `/transaksi` (transactions list) page copy. */
  transaksi: {
    // Bento v2 Transaksi.
    v2: {
      surplus: string;
      deficit: string;
      allTime: string;
      exportCsv: string;
      record: string;
      txCount: string;
      filterTitle: string;
      reset: string;
      searchPlaceholder: string;
      history: string;
      today: string;
      yesterday: string;
      chartAria: string;
      typeAria: string;
      exportEmpty: string;
      exported: string;
      filtersToggle: string;
      heroMore: string;
      heroLess: string;
    };
    typeLabels: Record<TransaksiTypeId, string>;
    filterLabels: Record<TransaksiFilterId, string>;
    sortLabels: Record<TransaksiSortId, string>;
    headerDesc: string;
    removeAccountFilterAriaLabelPrefix: string;
    accountFilterPrefix: string;
    accountFilterSuffix: string;
    addTransactionButton: string;
    totalIncomeLabel: string;
    totalExpenseLabel: string;
    /** Carries `{shown}` and `{total}` placeholders. */
    listTruncatedNote: string;
    differenceLabel: string;
    summaryGroupLabel: string;
    sortByLabel: string;
    sortAriaLabel: string;
    errorLoad: string;
    loadingLabel: string;
    emptyFiltered: string;
    deleteLabel: string;
    editDialogTitle: string;
    fieldAmountLabel: string;
    fieldDescLabel: string;
    fieldDescPlaceholder: string;
    fieldDateLabel: string;
    cancelButton: string;
    savingLabel: string;
    saveButton: string;
    toastUpdated: string;
    toastUpdateFailed: string;
    toastInvalidAmount: string;
    toastDeleted: string;
    toastDeleteFailed: string;
    /** EPIC-021 Group B (#23) — read-only transaction detail dialog copy. */
    detailAriaLabelPrefix: string;
    detailDialogTitle: string;
    detailCategoryLabel: string;
    detailAccountLabel: string;
    detailDateTimeLabel: string;
    detailCreatedAtLabel: string;
    detailEditButton: string;
    detailDeleteButton: string;
    /**
     * EPIC-023 group E retry round 4 (C4) — an obligation-linked
     * transaction (liability payment/purchase or insurance premium)
     * cannot be edited/deleted here; the server refuses it because doing
     * so would desync the debt/coverage it recorded.
     */
    obligationLockedTooltip: string;
    /**
     * EPIC-036 (edit-rights, "Pembuat + pemilik rekening") — the viewer may
     * see this transaction but is neither its creator nor the owner of a
     * private account on either leg, so Edit/Hapus (and adding/removing an
     * attachment) are locked, including for Master/Co-Master.
     */
    editRightsLockedTooltip: string;
    /**
     * EPIC-024 Task L3 (D15, US-TXN-9) — attachment list rendered inside the
     * read-only transaction detail dialog.
     */
    attachmentsSectionLabel: string;
    attachmentsLoadingLabel: string;
    attachmentsLoadFailedLabel: string;
    attachmentsEmptyLabel: string;
    attachmentImageLabel: string;
    attachmentPdfLabel: string;
    attachmentViewButton: string;
    attachmentViewFailedToast: string;
    attachmentDeleteButton: string;
    attachmentDeleteConfirmTitle: string;
    attachmentDeleteConfirmBody: string;
    attachmentDeletedToast: string;
    attachmentDeleteFailedToast: string;
    attachmentUploadingLabel: string;
    attachmentUploadedToast: string;
    attachmentUploadFailedToast: string;
    attachmentInvalidTypeToast: string;
    attachmentTooLargeToast: string;
    /**
     * EPIC-025 N3-E4 — filter card + per-stat summary cards ported from
     * `docs/prototype/pages/transaksi.html`'s `.card.transaction-filter-section`
     * and `.auto-grid--metrics` stat cards.
     */
    filterCardTitle: string;
    mobileFilterToggleTemplate: string;
    listSectionTitle: string;
    listSectionHint: string;
    transactionsCountSuffix: string;
    surplusLabel: string;
    deficitLabel: string;
    ofIncomeSuffix: string;
    /**
     * EPIC-025 N3 restructure (screenshot-vs-prototype gap fix) — filter
     * card date-range/account/category selects, table column headers,
     * pagination footer, and the honest "% terkategori" insight pill. Every
     * value here is wired to real fetched data (transactions/accounts/
     * categories) or a real query param the API already accepts — see the
     * page's own comments for what was deliberately omitted instead of
     * fabricated (per-member "who recorded it", large-transaction
     * verification counts).
     */
    dateRangeLabel: string;
    dateFromAriaLabel: string;
    dateToAriaLabel: string;
    accountFilterFieldLabel: string;
    allAccountsOption: string;
    categoryFilterFieldLabel: string;
    allCategoriesOption: string;
    resetFilterButton: string;
    tableColDate: string;
    tableColDesc: string;
    tableColCategory: string;
    tableColAccount: string;
    tableColAmount: string;
    tableColOptions: string;
    lockedBadgeLabel: string;
    paginationShowingLabel: string;
    paginationOfMid: string;
    paginationPrevButton: string;
    paginationNextButton: string;
    insightCategorizedLabel: string;
    insightCategorizedValueSuffix: string;
    // EPIC-026 Wave 8 — prototype `.dialog__desc` lines on #dlg-tx-detail /
    // #dlg-tx-edit, and #dlg-tx-delete's title + supporting line.
    detailDialogDesc: string;
    editDialogDesc: string;
    deleteDialogTitle: string;
    deleteDialogBody: string;
  };
  /**
   * EPIC-018 Task A6 — `/splitbill` (split bill) page copy. The seed
   * participant example names ("Andi"/"Budi"/"Citra") stay untranslated in
   * the page — example data the user overwrites, not UI chrome.
   */
  splitbill: {
    pageTitle: string;
    headerDesc: string;
    createButton: string;
    totalDitalanginLabel: string;
    activeSplitsSuffix: string;
    sudahDibayarLabel: string;
    pctCollectedSuffix: string;
    belumDibayarLabel: string;
    peopleUnpaidSuffix: string;
    errorLoad: string;
    activeSplitsTitle: string;
    emptyActiveSplits: string;
    peopleCountSuffix: string;
    perOrgSuffix: string;
    paidOfMidText: string;
    paidStatusSuffix: string;
    collectedSuffix: string;
    detailButton: string;
    insightTitle: string;
    insightDesc: string;
    tipTitleSuffix: string;
    tipAllOnTrack: string;
    tipNoActiveSplits: string;
    tipRemainingPrefix: string;
    tipRemainingMid: string;
    tipRemainingPeopleSuffix: string;
    tipInviteHint: string;
    badgeUnpaid: string;
    badgeNoPayoutAccount: string;
    badgeSettled: string;
    createdOnPrefix: string;
    fieldTitleLabel: string;
    fieldTitlePlaceholder: string;
    fieldTotalLabel: string;
    fieldMethodLabel: string;
    methodEqualLabel: string;
    methodCustomLabel: string;
    fieldParticipantsLabel: string;
    removeParticipantAriaPrefix: string;
    addParticipantButton: string;
    perPersonPrefix: string;
    savingCreateLabel: string;
    createAndShareButton: string;
    detailPerOrangSuffix: string;
    detailParticipantsSuffix: string;
    statusPaymentTitle: string;
    paidBadge: string;
    markPaidButton: string;
    copyButton: string;
    defaultParticipantName: string;
    toastCreated: string;
    toastCreateFailedDefault: string;
    toastSettled: string;
    toastSettleFailedDefault: string;
    toastTitleRequired: string;
    toastTotalRequired: string;
    toastMinParticipants: string;
    toastLinkCopied: string;
    /**
     * EPIC-023 F3 (D21, US-SPLIT-5/6) — the owner-side additions: nominate
     * a payout account/instructions on create, see each participant's own
     * claimed/paid state + copy THEIR link (not one bill-wide link), and
     * revoke every link for a bill at once.
     */
    fieldPayoutAccountLabel: string;
    fieldPayoutAccountPlaceholder: string;
    fieldPayoutInstructionsLabel: string;
    fieldPayoutInstructionsPlaceholder: string;
    toastPayoutAccountRequired: string;
    /**
     * Group F (task F3) — repair UI for a bill whose payoutAccountId is
     * null or points at a deleted account.
     */
    payoutAccountMissingNotice: string;
    editPayoutAccountButton: string;
    editPayoutAccountTitle: string;
    savePayoutAccountButton: string;
    savingPayoutAccountLabel: string;
    toastPayoutAccountUpdated: string;
    toastPayoutAccountUpdateFailedDefault: string;
    claimedBadge: string;
    revokeButton: string;
    deleteSplitButton: string;
    deleteSplitConfirmTitle: string;
    deleteSplitConfirmMessage: string;
    deleteSplitConfirmButton: string;
    toastSplitDeleted: string;
    revokeConfirmMessage: string;
    toastRevoked: string;
    toastRevokeFailedDefault: string;
    revokedNotice: string;
    participantLinkLabel: string;
    /**
     * EPIC-023 Group F fix round (HIGH 1) — revoking a link (cosmetic) and
     * confirming a payment (irreversible, posts real income) now share the
     * same real confirmation dialog (`ConfirmDeleteDialog`) instead of one
     * being a native `window.confirm` and the other firing on a single
     * click. `confirmPaymentTitlePrefix` is concatenated with the
     * participant's name in the page (dynamic, not template-interpolated).
     */
    revokeConfirmTitle: string;
    revokeConfirmButton: string;
    confirmPaymentTitlePrefix: string;
    confirmPaymentBody: string;
    confirmPaymentButton: string;
    /** EPIC-023 Group F fix round (MEDIUM 10) — the per-row copy-link
     * button's disabled/`title` hint once the bill's links are revoked. */
    copyDisabledRevokedTitle: string;
    /**
     * EPIC-023 F3 (D21) — `/split/[shareToken]` public page copy (that page
     * previously had NO i18n at all — every string was hardcoded
     * Indonesian). Each recipient's own link now identifies a single
     * `SplitParticipant`, not the whole bill.
     */
    /**
     * EPIC-025 N3-H5 — ported from split-public.html's "no login wall"
     * notice: this route has no account/auth requirement at all.
     */
    publicNoAccountNotice: string;
    publicEyebrow: string;
    publicLoading: string;
    publicNotFoundTitle: string;
    publicNotFoundDesc: string;
    publicRevokedTitle: string;
    publicRevokedDesc: string;
    publicYourShareLabel: string;
    publicStatusPendingLabel: string;
    publicStatusClaimedLabel: string;
    publicStatusPaidLabel: string;
    publicPayoutTitle: string;
    publicPayoutMissing: string;
    /**
     * EPIC-023 Group F fix round (HIGH 5) — a deleted payout account must
     * not read to the recipient as "the owner never set this up"
     * (`publicPayoutMissing`). Shown when `payout.configured` is true but
     * `accountName`/`instructions` still can't display anything.
     */
    publicPayoutUnavailable: string;
    publicPayoutInstructionsLabel: string;
    publicClaimButton: string;
    publicClaimDisclaimer: string;
    publicClaimedNotice: string;
    publicPaidNotice: string;
    publicToastClaimed: string;
    publicToastClaimFailedDefault: string;
    publicFooterPrefix: string;
    publicFooterSuffix: string;
    /**
     * EPIC-023 Group F fix round (LOW 11) — a network/DNS failure must not
     * read as "link not found" (`isGoneError` only recognizes a real 410;
     * everything else previously fell into the 404 branch).
     */
    publicNetworkErrorTitle: string;
    publicNetworkErrorDesc: string;
    /**
     * EPIC-026 — prototype `dlg-buat-split` / `dlg-detail-split`
     * composition (`docs/prototype/pages/splitbill.html`): dialog
     * descriptions, field hints, the detail dialog's footer close action,
     * and the custom-split remainder notice (previously hardcoded
     * Indonesian inside the page).
     */
    createDialogDesc: string;
    fieldPayoutAccountHint: string;
    editPayoutAccountDesc: string;
    detailCloseButton: string;
    remainderNeedTotalNote: string;
    remainderExactLabel: string;
    remainderLeftPrefix: string;
    remainderOverPrefix: string;
    remainderOverSuffix: string;
    splitRemainderButton: string;
    /**
     * Prototype structural port (docs/design/proto/splitbill.html) — the
     * hero's bar-chart legend, the "Riwayat" (history) side panel for
     * settled/revoked splits, and the "Split aktif" card-grid caption +
     * trailing add-tile, replacing the old row-list + static tips-only
     * layout.
     */
    legendCollected: string;
    legendTotal: string;
    historyTitle: string;
    historyCountSuffix: string;
    historyTotalCaption: string;
    emptyHistory: string;
    activeSplitsCaption: string;
    addSplitTileLabel: string;
    badgeRevoked: string;
  };
  /**
   * EPIC-018 Task A6 — `/rekonsiliasi` (bank reconciliation wizard) page
   * copy. `SUPPORTED_BANKS` (real bank names/codes) stay untranslated in the
   * page — proper nouns, same convention as `donation`'s `LEMBAGA_OPTIONS`.
   */
  rekonsiliasi: {
    v2: {
      matchRate: string;
      docsCaption: string;
      ok: string;
      review: string;
      err: string;
      stepOf: string;
      matchedSum: string;
      compAria: string;
    };
    headerTitle: string;
    headerSubtitle: string;
    uploadMutasiButton: string;
    steps: Record<RekonsiliasiStepNum, { label: string; sub: string }>;
    stepStatusDone: string;
    stepStatusActive: string;
    stepStatusPending: string;
    formatCalloutTitle: string;
    formatCalloutBody: string;
    pdfCalloutTitle: string;
    pdfCalloutBody: string;
    /**
     * EPIC-029 groups 1-3 — statement PDF read on the family's own AI key.
     * `pdfCallout*` replaces the old "PDF is rejected — on purpose" copy;
     * `pdfError*` is the closed client-side failure taxonomy in
     * `hooks/statement-pdf.ts` (one message per reason, enforced by a
     * `never` exhaustiveness check); `pdfPreview*` is the mandatory
     * review screen (E3c); `uploadErrorStatement*` are the API's stable
     * error codes.
     */
    pdfCalloutScanNote: string;
    pdfReadingLabel: string;
    pdfAnalyzingLabel: string;
    /** Carries `{page}` and `{total}` placeholders. */
    pdfAnalyzingPageLabel: string;
    protectedDialogDescPdf: string;
    pdfErrorPasswordRequired: string;
    pdfErrorWrongPassword: string;
    pdfErrorTooManyPages: string;
    pdfErrorTextTooLarge: string;
    pdfErrorNoTextLayer: string;
    pdfErrorCorrupt: string;
    pdfErrorNotAFileUpload: string;
    pdfPreviewTitle: string;
    pdfPreviewSubtitle: string;
    pdfPreviewRowsSuffix: string;
    pdfPreviewDateCol: string;
    pdfPreviewDescCol: string;
    pdfPreviewAmountCol: string;
    pdfPreviewSkippedTitle: string;
    pdfPreviewSkippedMorePrefix: string;
    pdfPreviewSkippedMoreSuffix: string;
    pdfPreviewLinePrefix: string;
    pdfPreviewTotalsTitleVerified: string;
    pdfPreviewTotalsTitleMismatch: string;
    pdfPreviewTotalsTitleUnverified: string;
    pdfPreviewTotalsMatched: string;
    pdfPreviewTotalsMismatch: string;
    pdfPreviewTotalsUnavailable: string;
    pdfPreviewUnverifiedConfirmNote: string;
    pdfPreviewConfirmButtonUnverified: string;
    pdfPreviewTotalsOpeningToClosing: string;
    pdfPreviewTotalsCredit: string;
    pdfPreviewTotalsDebit: string;
    pdfPreviewExpectedLabel: string;
    pdfPreviewActualLabel: string;
    pdfPreviewDifferenceLabel: string;
    pdfPreviewConfirmButton: string;
    pdfPreviewCancelButton: string;
    pdfPreviewImportingLabel: string;
    uploadErrorStatementAiNotConfigured: string;
    uploadErrorStatementAiKeyCorrupted: string;
    uploadErrorStatementAiAuth: string;
    uploadErrorStatementAiRateLimited: string;
    uploadErrorStatementAiTimeout: string;
    uploadErrorStatementAiParseFailed: string;
    uploadErrorStatementAiUpstreamFailed: string;
    uploadErrorStatementTextTooLarge: string;
    uploadErrorStatementNoTextLayer: string;
    uploadErrorStatementNoRows: string;
    uploadErrorStatementZeroValidRows: string;
    uploadErrorStatementColumnMappingMismatch: string;
    uploadErrorStatementTotalsMismatch: string;
    mappingSectionTitle: string;
    mappingSectionHint: string;
    matchFilterAll: string;
    matchFilterNeedsReview: string;
    matchFilterNotMatched: string;
    matchResultsFooterPrefix: string;
    matchResultsFooterMid: string;
    matchResultsFooterSuffix: string;
    uploadTitle: string;
    uploadSubtitle: string;
    uploadingLabel: string;
    dragDropLabel: string;
    orLabel: string;
    chooseFileButton: string;
    maxFileSizeLabel: string;
    supportedBanksTitle: string;
    viewAllLink: string;
    othersLabel: string;
    /**
     * EPIC-023 G2 (D17) — bank picker (applies a saved column-mapping
     * template) + the template manager dialog it opens for
     * owner/admin_staff/spouse (casl-ability.factory.ts's
     * ReconciliationTemplate subject).
     */
    bankPickerHint: string;
    templateSavedIndicator: string;
    bankSelectedWithTemplate: string;
    bankSelectedNoTemplate: string;
    manageTemplatesLink: string;
    templateManagerTitle: string;
    templateManagerHint: string;
    templateDeleteButton: string;
    templateBankLabel: string;
    templateNameLabel: string;
    templateNamePlaceholder: string;
    templateDateColumnLabel: string;
    templateDateColumnPlaceholder: string;
    templateDescriptionColumnLabel: string;
    templateDescriptionColumnPlaceholder: string;
    templateAmountColumnLabel: string;
    templateAmountColumnPlaceholder: string;
    templateDateFormatLabel: string;
    templateDateFormatIso: string;
    templateSaveButton: string;
    /** EPIC-026 Wave 8 — prototype `dlg-template` saved-template table. */
    templateColumnsHeader: string;
    templateActionHeader: string;
    toastTemplateSaved: string;
    toastTemplateSaveFailed: string;
    toastTemplateDeleted: string;
    toastTemplateDeleteFailed: string;
    recentDocsTitle: string;
    viewHistoryLink: string;
    loadingLabel: string;
    emptyDocs: string;
    uploadedAtPrefix: string;
    uploadedBadge: string;
    transactionsCountSuffix: string;
    closeTipsAriaLabel: string;
    tipsTitle: string;
    tip1: string;
    tip2: string;
    tip3: string;
    continueToMatchButton: string;
    aiReadingTitle: string;
    aiReadingSubtitle: string;
    matchingWithDataLabel: string;
    suggestedEntriesMidText: string;
    totalSuffix: string;
    continueButton: string;
    startingScanLabel: string;
    matchedStatLabel: string;
    needsReviewStatLabel: string;
    notMatchedStatLabel: string;
    // EPIC-025 N3-F5: composition donut (FOLD) — same matched/suggested/
    // unmatched counts the stat row above already computes.
    compositionTitle: string;
    matchResultsTitle: string;
    transactionsCountBadgeSuffix: string;
    colBankStatement: string;
    colStatus: string;
    loadingEntries: string;
    errorLoadEntries: string;
    emptyEntries: string;
    matchedLabel: string;
    suggestedLabel: string;
    confirmButton: string;
    notFoundLabel: string;
    /** Carries a `{count}` placeholder. */
    bulkConfirmBannerText: string;
    bulkConfirmButton: string;
    bulkConfirmPendingLabel: string;
    toastBulkConfirmed: string;
    importAccountLabel: string;
    importEntryButton: string;
    importEntryAriaLabelPrefix: string;
    /** Carries a `{count}` placeholder. */
    importAllButton: string;
    importAllPendingLabel: string;
    importHelpText: string;
    toastEntryImported: string;
    /** Carries an `{imported}` placeholder. */
    toastEntriesImported: string;
    /** Carries `{imported}` and `{skipped}` placeholders. */
    toastEntriesImportedPartial: string;
    toastImportFailedDefault: string;
    backButton: string;
    saveReconciliationButton: string;
    doneTitle: string;
    doneSubtitle: string;
    totalTransactionsLabel: string;
    matchedSummaryLabel: string;
    needsReviewSummaryLabel: string;
    notMatchedSummaryLabel: string;
    newReconciliationButton: string;
    toastUploaded: string;
    toastUploadedUnverified: string;
    toastUploadedPartialPrefix: string;
    toastUploadedPartialSuffix: string;
    skippedRowsTitleSuffix: string;
    skippedRowLinePrefix: string;
    skippedRowsMorePrefix: string;
    skippedRowsMoreSuffix: string;
    toastUploadFailedDefault: string;
    uploadErrorPdfUnsupported: string;
    uploadErrorXlsUnsupported: string;
    uploadErrorUnsupportedFormat: string;
    uploadErrorEmptyFile: string;
    uploadErrorXlsxUnreadable: string;
    uploadErrorXlsxLimitExceeded: string;
    uploadErrorColumnMappingMismatch: string;
    uploadErrorZeroValidRows: string;
    uploadErrorNoAutoDetectMapping: string;
    uploadErrorNoSavedTemplate: string;
    /* EPIC-029 group 4 — client-side decryption of a password-protected
       statement (E4b/E4c). Every failure reason gets its own actionable
       sentence; `protectedErrorWrongPassword` in particular must never
       collapse into the corrupt-file message. */
    protectedDialogTitle: string;
    protectedDialogDescXlsx: string;
    protectedDialogDescZip: string;
    protectedPasswordLabel: string;
    protectedPasswordPlaceholder: string;
    protectedPasswordHint: string;
    protectedShowPassword: string;
    protectedHidePassword: string;
    protectedSubmitButton: string;
    protectedCancelButton: string;
    protectedUnlockingLabel: string;
    protectedCalloutTitle: string;
    protectedCalloutBody: string;
    protectedErrorEmptyFile: string;
    protectedErrorFileTooLarge: string;
    protectedErrorPasswordRequired: string;
    protectedErrorWrongPassword: string;
    protectedErrorUnsupportedEncryption: string;
    protectedErrorCryptoUnavailable: string;
    protectedErrorCorruptFile: string;
    protectedErrorIntegrityFailure: string;
    protectedErrorIntegrityMissing: string;
    protectedErrorZipNoStatement: string;
    protectedErrorZipMultipleStatements: string;
    protectedErrorZipEntryTooLarge: string;
    protectedErrorDecryptedTooLarge: string;
    protectedErrorXlsxRepackageFailed: string;
    protectedErrorXlsxExpansionTooLarge: string;
    toastScanFailedDefault: string;
    toastConfirmed: string;
    toastConfirmFailedDefault: string;
    errorSessionInactive: string;
    // EPIC-021 Group C (#9) — entry detail dialog (read-only, opened by
    // clicking/tapping an entry row, mirrors the `/transaksi` TxRow pattern).
    entryDetailAriaLabelPrefix: string;
    detailDialogTitle: string;
    detailDateLabel: string;
    detailDescriptionLabel: string;
    detailAmountLabel: string;
    detailStatusLabel: string;
    detailMatchedTxTitle: string;
    detailTxTypeLabel: string;
    detailTxAccountLabel: string;
    detailTxToAccountLabel: string;
    detailTxCategoryLabel: string;
    detailTxAmountLabel: string;
    detailTxDateLabel: string;
    detailNoMatchedTx: string;
    closeButton: string;
    txTypeLabels: { income: string; expense: string; transfer: string };
    // EPIC-021 Group C (#29) — fee-split dialog (Decision #10: produces real
    // Transactions, not a side-table).
    splitButton: string;
    splitButtonAriaLabelPrefix: string;
    splitDialogTitle: string;
    splitDialogDescription: string;
    splitSourceAccountLabel: string;
    splitSourceAccountPlaceholder: string;
    splitDestAccountLabel: string;
    splitDestAccountPlaceholder: string;
    splitPrincipalLabel: string;
    splitAdminFeeLabel: string;
    splitDescriptionLabel: string;
    splitDescriptionPlaceholder: string;
    splitTotalLabel: string;
    splitEntryAmountLabel: string;
    splitSubmitButton: string;
    splitCancelButton: string;
    /** EPIC-026 Wave 8 — prototype `dlg-split` balance notice
     * (display-only; the submit-time validation is unchanged). */
    splitBalancedNotice: string;
    splitUnbalancedNotice: string;
    splitValidationSelectSourceAccount: string;
    splitValidationSelectDestAccount: string;
    splitValidationSameAccount: string;
    splitValidationPrincipalPositive: string;
    splitValidationSumMismatch: string;
    toastSplitSuccess: string;
    toastSplitFailedDefault: string;
  };
  /**
   * EPIC-018 Task A3 — `/laporan` (reports) page copy, the last untranslated
   * page: 16 tab sections + the shared year/month(/day) period filter + the
   * export panel. A handful of exact-repeat phrases (e.g. "Total Pemasukan",
   * "Surplus", "Net Worth") are hoisted to this top level and reused by
   * several tab sections, mirroring `kalkulator.months` being shared above
   * its per-tool nested objects. Reuses `InvestasiTypeId` (declared above for
   * Task A5) for this page's own emoji-prefixed portfolio-breakdown labels —
   * same convention as `aset`'s separate `invTypeLabels`.
   */
  laporan: {
    v2: {
      rangeLabel: string;
      exportLabel: string;
      resetPeriod: string;
      filterTitle: string;
      filterCap: string;
      reportsTitle: string;
      findReport: string;
      noReport: string;
      csv: string;
      printPdf: string;
      income: string;
      expense: string;
      net: string;
      saved: string;
      assets: string;
      liabilities: string;
      txCount: string;
      accounts: string;
      closing: string;
      cost: string;
      value: string;
      gain: string;
      pkp: string;
      tax: string;
      hSaved: string;
      hDeficit: string;
      hSpend: string;
      hBank: string;
      hDetail: string;
      hProfit: string;
      hNetWorth: string;
      hCash: string;
      hInv: string;
      hTax: string;
      hDefault: string;
      hBulanSaved: string;
      hBulanDeficit: string;
      hHarianSpend: string;
      hHarianEmpty: string;
      hPerfAchieved: string;
      hPerfBelow: string;
      savingsRateTarget: string;
    };
    subtitle: string;
    months: [
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
    ];
    periodFilter: {
      yearAriaLabel: string;
      monthAriaLabel: string;
      dayAriaLabel: string;
      allDatesOption: string;
      timezoneNotePrefix: string;
      timezoneNoteSuffix: string;
      // EPIC-023 Task B (B1, US-RPT-12) — date-range presets, applied across
      // every /laporan sub-view (see `resolvePreset` in laporan-period.ts).
      presetAriaLabel: string;
      presetThisMonth: string;
      presetLastMonth: string;
      presetLast3Months: string;
      presetLast6Months: string;
      presetLast12Months: string;
      presetThisYear: string;
      presetLastYear: string;
      presetCustom: string;
      // EPIC-023 Task B retry (HIGH) — shown on sub-views the active date
      // range genuinely cannot filter (see laporan/page.tsx).
      periodNotApplicableNote: string;
    };
    // Shared exact-repeat phrases (used across 2+ tab sections below).
    totalIncomeLabel: string;
    totalExpenseLabel: string;
    surplusLabel: string;
    deficitLabel: string;
    savingsRateLabel: string;
    /** "{n} bulan" — the window a ratio/total spans, appended to its label. */
    windowMonthsTemplate: string;
    totalAssetsLabel: string;
    totalLiabilitiesLabel: string;
    netWorthLabel: string;
    emptyMonthTransactions: string;
    // EPIC-025 N3-J1 — prototype-parity page header (docs/prototype/pages/
    // laporan.html's `.page-lead`): big H1 + subtitle + Excel/PDF export
    // buttons that reuse `ExportSection`'s real job, not new dead controls.
    header: {
      title: string;
      subtitle: string;
      exportExcelButton: string;
      exportPdfButton: string;
    };
    // EPIC-025 N3-J1 — the prototype's "Filter Laporan" card wrapping the
    // existing preset/period selectors (logic unchanged, presentation only).
    filterCard: {
      title: string;
      appliesAllTabsCaption: string;
      periodeLabel: string;
      dateRangeLabel: string;
    };
    // EPIC-025 N3-J1 — cash-basis disclosure callout under the filter card.
    cashBasisNotice: {
      title: string;
      body: string;
      activePeriodPrefix: string;
    };
    // EPIC-025 N3-J1 — pill tab strip with scroll arrows.
    tabStrip: {
      ariaLabel: string;
      groupAriaLabel: string;
      groups: {
        summary: string;
        cashflow: string;
        wealth: string;
        liabilities: string;
        taxOther: string;
      };
      scrollLeftAriaLabel: string;
      scrollRightAriaLabel: string;
    };
    ringkasan: {
      financeTitle: string;
      expenseAllocTitle: string;
      emptyExpenseAlloc: string;
      wealthAllocTitle: string;
      emptyWealthAlloc: string;
      invPerformanceTitle: string;
      totalValueLabel: string;
      todayReturnPrefix: string;
      donutNilaiLabel: string;
      donutModalLabel: string;
      portfolioUpLabel: string;
      portfolioDownLabel: string;
      emptyInvestment: string;
      aiInsightTitle: string;
      aiInsightBody: string;
      aiInsightCta: string;
      // EPIC-025 N3-J1 — headline stat cards (gap 5) + cashflow chart
      // range toggle + category breakdown table (gap 6/7). Deltas are only
      // rendered when genuinely computable from `summary.points` (trailing
      // months already fetched) — no fabricated figures.
      cashflowCardTitle: string;
      cashflowRange6: string;
      cashflowRange12: string;
      statNetCashflowLabel: string;
      statSavingsRatioLabel: string;
      statVsPrefix: string;
      statSurplusStreakTemplate: string;
      statSavingsAboveTargetTemplate: string;
      statSavingsBelowTargetTemplate: string;
      categoryTable: {
        title: string;
        colKategori: string;
        colPersentase: string;
        colBulanIni: string;
        emptyState: string;
      };
      // Prototype parity (rsum body) — "Ke mana uangnya" bar-rows card and
      // "Dibanding bulan lalu" comparison card, replacing the removed
      // KPI-tile row / category table / wealth & investment donut cards.
      whereMoneyGoesTitle: string;
      comparedLastMonthTitle: string;
      // No prior month with data to compare against yet — shown instead of
      // a fabricated 0-vs-0 comparison.
      comparedLastMonthEmptyHint: string;
      // Suffix for the prior month when only it is complete ("Sep penuh").
      comparedFullMonthSuffix: string;
    };
    harian: {
      titlePrefix: string;
      dateLabel: string;
      incomeTodayLabel: string;
      expenseTodayLabel: string;
      netDailyLabel: string;
      txnCountLabel: string;
      txnTodayTitle: string;
      emptyToday: string;
      emptyTodayHint: string;
    };
    bulanan: {
      title: string;
      trendTitle: string;
      recapTitle: string;
      colBulan: string;
      colMasuk: string;
      colKeluar: string;
      colNet: string;
    };
    tahunan: {
      title: string;
      netYearLabel: string;
      emptyYear: string;
      trendTitle: string;
    };
    family: {
      title: string;
      consolidationTitle: string;
      totalNetWorthLabel: string;
      wealthCompositionTitle: string;
      rowAccountsCash: string;
      rowInvestments: string;
      rowOtherAssets: string;
      rowLiabilities: string;
      membersTitlePrefix: string;
      emptyMembers: string;
      noteConsolidation: string;
    };
    bank: {
      title: string;
      balancePerAccountTitle: string;
      emptyAccounts: string;
      inOutTitle: string;
    };
    detail: {
      title: string;
      colDate: string;
      colDesc: string;
      colCategory: string;
      colAccount: string;
      colAmount: string;
    };
    aliran: {
      title: string;
      cardTitlePrefix: string;
      incomeSourceLabel: string;
      expenseAllocLabel: string;
      emptyFlow: string;
    };
    pnl: {
      titlePrefix: string;
      // EPIC-023 A4 — an honest, plain-language statement of the accounting
      // basis this report uses (cash, not accrual), shown in the report header.
      cashBasisNote: string;
      revenueLabel: string;
      totalRevenueLabel: string;
      expensesLabel: string;
      totalExpensesLabel: string;
      netProfitLabel: string;
      netMarginLabel: string;
      directionNotePrefix: string;
      masterCoaLink: string;
    };
    balance: {
      titlePrefix: string;
      assetLabel: string;
      liabilityEquityLabel: string;
      liabilitiesLabel: string;
      equityLabel: string;
      totalLPlusELabel: string;
      balancedTitle: string;
      balancedDescPrefix: string;
      imbalancedTitle: string;
      imbalancedDescPrefix: string;
      checkingLabel: string;
      currentBalanceDisclosure: string;
      // EPIC-023 Task B (B2, closes EPIC-022 B11) — honest "no historical
      // data for this date yet" state, shown when the API's
      // `dataAvailable` is false instead of a zeroed-out balance sheet.
      noDataTitle: string;
      noDataDescription: string;
      // EPIC-023 Task B retry (CRITICAL 2) — distinct from `noDataTitle`/
      // `noDataDescription`: a snapshot DOES exist, it just cannot be shown
      // to this viewer (privacy-open snapshot + a private account exists +
      // this viewer may not see private items).
      restrictedForViewerTitle: string;
      restrictedForViewerDescription: string;
      // EPIC-023 Task B (B3, D24, US-RPT-11) — the reconciliation bridge
      // card, surfaced on this tab so "why is my profit X but my wealth up
      // Y" is answered on screen, not just in a ✅/⚠️ banner.
      bridgeTitle: string;
      bridgeDescription: string;
      bridgeOpeningLabel: string;
      bridgeProfitLabel: string;
      // EPIC-023 B3 (rewrite, attempt 3) — a contribution (cash moved into
      // or out of a holding via a COA group-3 TRANSFER) is net-worth-
      // neutral overall but IS a real subtrahend in the identity (see
      // `bridgeHoldingsChangeLabel` below); it is named on its own instead,
      // as a single combined figure (no asset-vs-investment split — see
      // reports.service.ts's `getReconciliationBridge` doc comment for why
      // that split was unsatisfiable).
      bridgeContributionLabel: string;
      // EPIC-023 Task B3 review (HIGH x2) — renamed from
      // `bridgeRevaluationLabel`. The value behind it is the RAW combined
      // (Δ totalAssets + Δ totalInvestments) snapshot delta, not a
      // market-movement-only "revaluation" — see
      // `ReconciliationBridgeDto.holdingsChange`'s doc comment. Together
      // with `bridgeContributionLabel` above (now displayed as the actual
      // amount subtracted, not a memo), the rows on this card sum to
      // `bridgeClosingLabel` when read top to bottom.
      bridgeHoldingsChangeLabel: string;
      bridgeClosingLabel: string;
      bridgeNetWorthChangeLabel: string;
      bridgeNoDataDescription: string;
      // EPIC-023 Task B retry (CRITICAL 2) — the bridge's own restricted-
      // for-viewer state (see `restrictedForViewerDescription` above).
      bridgeRestrictedDescription: string;
      // EPIC-023 B3 (rewrite, attempt 3) — an honestly-named residual,
      // shown only when non-zero (see `ReconciliationBridgeDto.unexplained`
      // doc comment for why the identity does not always hold).
      bridgeUnexplainedLabel: string;
      // EPIC-023 Task B3 review (MEDIUM, FIX 5) — visually hidden text read
      // before `bridgeUnexplainedLabel` so the warning is not carried by
      // colour and small text alone (screen readers get an explicit cue;
      // sighted users get the ⚠️ icon rendered alongside it in page.tsx).
      bridgeUnexplainedWarningPrefix: string;
    };
    cashflow: {
      titlePrefix: string;
      operatingLabel: string;
      totalInflowLabel: string;
      totalOutflowLabel: string;
      netOperatingLabel: string;
      investingLabel: string;
      netInvestingLabel: string;
      investingUntrackedLabel: string;
      investingDisclosure: string;
      openingBalanceLabel: string;
      closingBalanceLabel: string;
      netCashflowLabel: string;
      balanceSectionTitle: string;
      balanceDisclosure: string;
    };
    kas: {
      title: string;
      incomeSourcesTitle: string;
      emptyIncome: string;
    };
    investasi: {
      sectionTitle: string;
      totalPortfolioLabel: string;
      totalReturnLabel: string;
      instrumentCountSuffix: string;
      portfolioByTypeTitle: string;
      typeLabels: Record<InvestasiTypeId, string>;
      emptyInvestment: string;
      addNowLink: string;
      instrumentListTitle: string;
      colName: string;
      colType: string;
      colValue: string;
      colReturn: string;
      editLink: string;
      toastUpdated: string;
      toastDeleted: string;
      toastDeleteFailed: string;
      deleteDialogTitle: string;
      deleteConfirmPrefix: string;
      deleteConfirmSuffix: string;
      deletingLabel: string;
    };
    asetLiabilitas: {
      ratioTitle: string;
      debtRatioLabel: string;
      netWorthDesc: string;
      safeLabel: string;
      warningLabel: string;
    };
    performa: {
      title: string;
      savingsRateTargetLabel: string;
      achievedSuffix: string;
      needsImprovementSuffix: string;
      investReturnTargetLabel: string;
      exceededSuffix: string;
      emptyPerf: string;
      noteText: string;
    };
    pajak: {
      title: string;
      grossYearLabel: string;
      pkpLabel: string;
      estimatedTaxLabel: string;
      effectiveRateLabel: string;
      calcTitle: string;
      grossIncomeLabel: string;
      laborCostLabel: string;
      ptkpLabel: string;
      zakatDeductionLabel: string;
      pkpFullLabel: string;
      bracketBreakdownTitle: string;
      colBracket: string;
      colTaxBase: string;
      colRate: string;
      colTax: string;
      totalTaxYearLabel: string;
      emptyIncomeNote: string;
      estimateNoteBefore: string;
      estimateNoteBold: string;
      estimateNoteAfter: string;
      calculatorLinkLabel: string;
    };
    // EPIC-024 Task M (M2, D16, US-RPT-14) — Laporan COA yearly matrix tab.
    coa: {
      cardTitle: string;
      newBadge: string;
      totalYearLabel: string;
      txCountSuffix: string;
      matrixHint: string;
      scrollHint: string;
      expandButton: string;
      expandAriaLabel: string;
      title: string;
      accountLabel: string;
      accountPlaceholder: string;
      yearLabel: string;
      totalLabel: string;
      colTanggal: string;
      emptyAccount: string;
      emptyMatrix: string;
      dialogTitlePrefix: string;
      dialogDescriptionPrefix: string;
      dialogNoDesc: string;
    };
    export: {
      title: string;
      downloadButton: string;
      reportTypeLabel: string;
      reportTypeLabels: Record<LaporanExportTypeId, string>;
      pdfButton: string;
      csvButton: string;
      statusLabel: string;
      statusPending: string;
      statusProcessing: string;
      statusDone: string;
      statusFailedPrefix: string;
      toastExportDone: string;
      toastExportFailedPrefix: string;
      unknownErrorFallback: string;
      toastFetchStatusFailed: string;
      toastInvalidSession: string;
      creatingExportPrefix: string;
      creatingExportSuffix: string;
      toastExportCreateFailed: string;
    };
  };
  // EPIC-023 D1/D6 (US-FAM-12, US-AUTH-9) — forced first-login password
  // change for a head-created dependant/operational member.
  login: {
    v2: {
      coverPre: string;
      coverEm: string;
      coverPost: string;
      features: string[];
    };
  };
  register: {
    v2: {
      coverPre: string;
      coverEm: string;
      coverPost: string;
      features: string[];
    };
  };
  lupaPassword: {
    v2: {
      coverPre: string;
      coverEm: string;
      coverPost: string;
      features: string[];
    };
  };
  resetPassword: {
    v2: {
      coverPre: string;
      coverEm: string;
      coverPost: string;
      features: string[];
    };
  };
  forcePasswordChange: {
    title: string;
    subtitle: string;
    currentPasswordLabel: string;
    newPasswordLabel: string;
    confirmPasswordLabel: string;
    submitButton: string;
    submitting: string;
    toastSuccess: string;
    toastMismatch: string;
    toastMinLength: string;
    toastFailed: string;
    logoutButton: string;
  };
  // EPIC-023 D2 (US-FAM-13, D7) — device-bound PIN unlock. A PIN alone is
  // NEVER a standalone credential; it only unlocks a device already bound at
  // a real password login. See apps/api/src/devices for the two-factor model.
  deviceUnlock: {
    // "Set up quick unlock" prompt, offered (not forced) right after a
    // successful password login.
    promptTitle: string;
    promptSubtitle: string;
    promptSetPinLabel: string;
    promptPinPlaceholder: string;
    promptConfirmPinPlaceholder: string;
    promptSkipButton: string;
    promptSubmitButton: string;
    promptSubmitting: string;
    toastPinLength: string;
    toastPinMismatch: string;
    toastSetupSuccess: string;
    toastSetupFailed: string;
    // EPIC-024 B2 — setup failures distinguished by cause: an expired/invalid
    // session (401/403) vs. the request never reaching the server at all
    // (routing/404/5xx, e.g. the nginx allowlist bug) vs. no connectivity.
    // `toastSetupFailed` remains the catch-all for anything else.
    toastSetupSessionExpired: string;
    toastSetupServiceUnavailable: string;
    toastSetupNetworkError: string;
    // Pre-login PIN pad, shown instead of the password form when this
    // device has a stored deviceSecret + a PIN already set.
    padTitle: string;
    padSubtitle: string;
    padSubmitButton: string;
    padSubmitting: string;
    padUsePasswordInstead: string;
    toastUnlockFailed: string;
    toastUnlockLockedPrefix: string;
    toastUnlockLockedSuffix: string;
    // EPIC-024 B2 — same split as above: a real 401 IS "PIN salah"
    // (toastUnlockFailed), but a routing/server failure (404/5xx — e.g. the
    // nginx bug where /api/device-unlock 404'd against apps/api) must never
    // be shown to the user as "wrong PIN", and neither should the device
    // simply being offline.
    toastUnlockServiceUnavailable: string;
    toastUnlockNetworkError: string;
    // Device-management view (akun -> keamanan).
    manageSectionTitle: string;
    manageSetupButton: string;
    manageEmptyState: string;
    manageLoading: string;
    manageError: string;
    manageHasPinBadge: string;
    manageNoPinBadge: string;
    manageRevokeLink: string;
    manageRevokeConfirmTitle: string;
    manageRevokeConfirmBody: string;
    manageRevokeConfirmButton: string;
    manageDeviceFallbackLabel: string;
    toastRevokeSuccess: string;
    toastRevokeFailed: string;
    toastRegisterFailed: string;
  };
  /**
   * EPIC-023 Task H3 (D22, US-DASH-7) — the guided first-setup that replaces
   * the old button tour (`components/onboarding/tour-steps.ts`, removed):
   * it creates a REAL account, budget, and transaction through the same
   * endpoints the real pages use, and shows the consequence (net worth
   * appearing/moving, budget usage rising) after each real write.
   */
  onboarding: {
    welcomeTitle: string;
    welcomeBody: string;
    startSetupButton: string;
    exploreAllButton: string;
    skipButton: string;
    resumeTitle: string;
    resumeBody: string;
    resumeContinueButton: string;
    resumeRestartButton: string;
    resumeSkipButton: string;
    dialogTitle: string;
    stepIndicatorPrefix: string;
    stepIndicatorMiddle: string;
    skipSetupButton: string;
    backButton: string;
    continueButton: string;
    netWorthLabel: string;
    /** MEDIUM 8 — shown before closing via "Lewati Setup" when at least one
     * real row (account/budget) already exists, so the user knows what's
     * kept even though the resumable "continue setup?" prompt won't fire
     * again after this. */
    skipAllKeptPrefix: string;
    stepLabels: {
      account: string;
      budget: string;
      transaction: string;
      done: string;
    };
    account: {
      title: string;
      body: string;
      nameLabel: string;
      namePlaceholder: string;
      /** MEDIUM 12 — associated via aria-describedby on the name input,
       * since the submit button it explains is unreachable once disabled. */
      nameRequiredHint: string;
      balanceLabel: string;
      submitButton: string;
      submitting: string;
      alreadyHaveNotice: string;
      skipStepButton: string;
      consequenceTitle: string;
      consequenceBefore: string;
      consequenceAfter: string;
      toastCreated: string;
      toastFailed: string;
    };
    budget: {
      title: string;
      body: string;
      nameLabel: string;
      namePlaceholder: string;
      limitLabel: string;
      /** MEDIUM 12 — associated via aria-describedby on both fields. */
      requiredHint: string;
      submitButton: string;
      submitting: string;
      alreadyHaveNotice: string;
      skipStepButton: string;
      consequenceTitle: string;
      consequenceBody: string;
      toastCreated: string;
      toastFailed: string;
    };
    transaction: {
      title: string;
      body: string;
      amountLabel: string;
      /** MEDIUM 12 — associated via aria-describedby on the amount input. */
      amountRequiredHint: string;
      descriptionLabel: string;
      descriptionPlaceholder: string;
      submitButton: string;
      submitting: string;
      consequenceTitle: string;
      consequenceNetWorthPrefix: string;
      consequenceBudgetPrefix: string;
      consequenceBudgetSuffix: string;
      toastCreated: string;
      toastHeld: string;
      toastFailed: string;
      noAccountError: string;
    };
    done: {
      title: string;
      body: string;
      /** Shown instead of `body` when the transaction step's expense was
       * held for approval (D3/D9) instead of posted — the done screen must
       * not claim a transaction was created when it honestly wasn't. */
      bodyHeld: string;
      viewAccountsButton: string;
      viewBudgetsButton: string;
      viewTransactionsButton: string;
      finishButton: string;
    };
  };
  /**
   * EPIC-026 Wave 8 — supporting line for the shared `CrudModal`
   * (`components/crud/crud-modal.tsx`). The prototype's `dlg-md-add`
   * always carries a `.dialog__desc`; the generic modal has no
   * entity-specific copy, so these two stay deliberately entity-neutral.
   */
  crud: {
    addToMasterData: string;
    /** "{field}" is replaced with the field's label — see CrudField.required. */
    fieldRequired: string;
  };
  money: {
    currencyLabel: string;
    convertedIdr: string;
    convertedDisplay: string;
    rateLine: string;
    rateStale: string;
    rateIndicative: string;
    rateLoading: string;
    rateUnavailable: string;
    serverNote: string;
    rateNotReady: string;
    storedAsIdr: string;
    fxIndicativeRefused: string;
  };
  /**
   * Hardening audit (errors, HIGH) — copy for `app/error.tsx`,
   * `(app)/error.tsx`, `app/global-error.tsx` and `app/not-found.tsx`. None
   * of these existed before, so an uncaught render/query throw showed
   * Next.js's default blank/dev-overlay screen instead of friendly copy with
   * a retry.
   */
  errors: {
    boundaryTitle: string;
    boundaryBody: string;
    retryButton: string;
    homeButton: string;
    notFoundTitle: string;
    notFoundBody: string;
    notFoundButton: string;
    globalErrorTitle: string;
    globalErrorBody: string;
  };
};
