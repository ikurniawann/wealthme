import type {
  MobileNavId,
  NavItemId,
  NavSectionHeaderKey,
  PageTitleId,
  ReportTabId,
} from "@/lib/nav";

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

type AkunCurrencyCode = "IDR" | "USD" | "SGD" | "EUR" | "JPY";

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
  | "ai";

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
  | "lainnya";

/** EPIC-018 Task A5 — `/aset` physical-asset type ids. */
type AsetTypeId =
  | "properti"
  | "kendaraan"
  | "elektronik"
  | "perhiasan"
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

/**
 * EPIC-018 Task A5 — `/masterdata` system reference-group ids (mirrors the
 * `CrudEntity` `md*` variants). Each group's `title`/`label` translate; the
 * groups' local `items` reference lists (bank names, e-wallet brands, etc.)
 * stay untranslated in the page — same value-locked-copy caveat Task A4
 * documented for the shared, untranslated `crud-config.ts` select options.
 */
type MasterDataGroupId =
  | "mdbank"
  | "mdtxntype"
  | "mdinvtype"
  | "mdewallet"
  | "mdlembaga"
  | "mdasettype"
  | "mdinstype";

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

/** EPIC-018 Task A6 — `/tax` PPh21 PTKP status-option ids (local to the
 * calculator; the numeric threshold `value` stays fixed, only the label
 * translates). */
type TaxPtkpId = "tk0" | "k0" | "k1" | "k2" | "k3";

/** EPIC-018 Task A6 — `/tax` progressive-bracket row ids (local display
 * rows for the breakdown table; `idx` maps into the fixed bracket math). */
type TaxBracketId = "b0" | "b1" | "b2" | "b4";

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

export type I18nDictionary = {
  locale: "id" | "en";
  greeting: {
    morning: string;
    afternoon: string;
    afternoon2: string;
    evening: string;
  };
  common: {
    balance: string;
    income: string;
    expense: string;
    net: string;
    save: string;
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
    savingsRate: string;
    income2: string;
    expense2: string;
    transfer: string;
    sparkLabels: [string, string, string, string, string];
  };
  beranda: {
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
    aiInsightTitle: string;
    aiInsightBody: string;
    aiInsightCta: string;
    dateLocale: string;
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
    navMenuTitle: string;
    search: string;
    notifications: string;
    addTransaction: string;
    searchPlaceholder: string;
    logout: string;
    navSectionHeaders: Record<NavSectionHeaderKey, string>;
    navSections: Record<NavItemId, string>;
    reportTabs: Record<ReportTabId, string>;
    pageTitles: Record<PageTitleId, string>;
    mobileNav: Record<MobileNavId, string>;
    transactionDialog: {
      tabIncome: string;
      tabExpense: string;
      tabTransfer: string;
      tabCreditCard: string;
      saveFailedPrefix: string;
      retryFallback: string;
      invalidAmount: string;
      selectAccountFirst: string;
      noFamilyGroup: string;
      savedAddMoreToast: string;
      savedToast: string;
      ocrSavedToast: string;
      title: string;
      manualInput: string;
      scanReceipt: string;
      newBadge: string;
      amountLabel: string;
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
      descriptionLabel: string;
      optionalSuffix: string;
      descriptionPlaceholder: string;
      categoryPlaceholder: string;
      accountPlaceholder: string;
      saving: string;
      saveTransaction: string;
      saveAndAddMore: string;
      scanTitle: string;
      scanSubtitle: string;
      flashToast: string;
      autoButton: string;
      scanGuidanceReady: string;
      scanGuidanceScanning: string;
      resultTitle: string;
      resultSubtitle: string;
      editManualToast: string;
      editManual: string;
      merchantLabel: string;
      totalLabel: string;
      detectedBadge: string;
      detailItemLabel: string;
      saveToTransaction: string;
      scanAgain: string;
    };
    themeToggle: {
      ariaLabel: string;
      title: string;
    };
    themePicker: {
      ariaLabel: string;
      title: string;
    };
    searchDialog: {
      ariaLabel: string;
      placeholder: string;
      dialogTitle: string;
      financialResultsHeader: string;
      noResultsFor: string;
      typeToSearchHint: string;
    };
  };
  /** EPIC-018 A2 — `/akun` page and sub-page copy. */
  akun: {
    heroMemberSince: string;
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
      biometricLabel: string;
      biometricSub: string;
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
      sessionsLoading: string;
      sessionsEmpty: string;
      sessionsError: string;
      toastPasswordMinLength: string;
      toastPasswordMismatch: string;
      toastChangeFailed: string;
      toastChangeSuccess: string;
      toastSetPin: string;
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
      hideBalanceLabel: string;
      hideBalanceSub: string;
      showDecimalLabel: string;
      showDecimalSub: string;
      weeklySummaryLabel: string;
      weeklySummarySub: string;
      saveButton: string;
      toastCurrencyUpdated: string;
      toastCurrencyFailed: string;
      toastSettingsSaved: string;
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
      liveChatName: string;
      liveChatSub: string;
      liveChatBadge: string;
      emailName: string;
      emailSub: string;
      phoneName: string;
      phoneSub: string;
      whatsappName: string;
      whatsappSub: string;
      toastLiveChat: string;
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
      toastComingSoon: string;
    };
    family: {
      membersSectionTitle: string;
      youBadge: string;
      inviteButton: string;
      adminSectionTitle: string;
      adminCanInput: string;
      adminBadge: string;
      addAdminButton: string;
      adminInfoNote: string;
      groupSettingsSectionTitle: string;
      showBalanceToMembersLabel: string;
      showBalanceToMembersSub: string;
      memberTxnNotifLabel: string;
      memberTxnNotifSub: string;
    };
    addAdmin: {
      dialogTitle: string;
      dialogDesc: string;
      emailPlaceholder: string;
      roleLabel: string;
      roleOptions: {
        member: string;
        adminStaff: string;
      };
      sending: string;
      sendButton: string;
      toastInviteCreated: string;
      toastInviteFailed: string;
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
   * EPIC-018 Task A2 — `/panduan` page copy. `JOURNEYS` in the page keeps
   * only structural data (icon, chip class, href, id); every title/subtitle/
   * desc string resolves from here, keyed by the stable journey/feature ids.
   */
  panduan: {
    pageTitle: string;
    pageSubtitle: string;
    openLink: string;
    journeys: Record<PanduanJourneyId, { title: string; subtitle: string }>;
    features: Record<PanduanFeatureId, { title: string; desc: string }>;
  };
  /** EPIC-018 Task A4 — `/asuransi` (insurance policies) page copy. */
  asuransi: {
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
    toastRenewalRecordedPrefix: string;
    toastRenewalFailed: string;
    /** EPIC-021 Group D (#14) — policy beneficiaries, mirroring warisan's
     * heir editor UX (allocation bar + optional family-member link). */
    beneficiariesSectionTitle: string;
    beneficiariesLabel: string;
    beneficiaryNameLabel: string;
    beneficiaryNamePlaceholder: string;
    beneficiaryRelationshipLabel: string;
    beneficiaryRelationshipPlaceholder: string;
    beneficiarySharePercentLabel: string;
    beneficiaryMemberLabel: string;
    beneficiaryMemberNoneOption: string;
    addBeneficiaryButton: string;
    removeBeneficiaryAriaLabel: string;
    allocationAllocatedSuffix: string;
    allocationUnallocatedSuffix: string;
    allocationFullyAllocated: string;
    validationSharePercentExceeded: string;
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
    zakat: {
      cardTitle: string;
      nisabNotePrefix: string;
      nisabNoteValue: string;
      fieldCash: string;
      fieldInvestments: string;
      fieldGold: string;
      fieldLiabilities: string;
      calculateButton: string;
      errorCalculate: string;
      resultObligated: string;
      resultNotObligated: string;
      detailZakatablePrefix: string;
      detailNisabPrefix: string;
      belowNisabPrefix: string;
      belowNisabSuffix: string;
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
    };
    pensiun: {
      cardTitle: string;
      fieldCurrentAge: string;
      fieldRetireAge: string;
      fieldCurrentMonthlyExpense: string;
      fieldInvestmentReturn: string;
      resultLabel: string;
      detailMonthlyInvestmentNeededPrefix: string;
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
    };
  };
  /**
   * EPIC-018 Task A4 — `/quickinput` page copy. `QUICK_CARDS` in the page
   * keeps only structural data (icon, colors, action/entity); every card
   * name/desc resolves from here, keyed by the stable `QuickInputCardId`.
   */
  quickinput: {
    pageTitle: string;
    pageSubtitle: string;
    cards: Record<QuickInputCardId, { name: string; desc: string }>;
    toastSaved: string;
    toastSaveFailed: string;
  };
  /** EPIC-018 Task A4 — `/ai` (AI Advisor chat) page copy. */
  ai: {
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
  };
  /** EPIC-018 Task A5 — `/investasi` (investment portfolio) page copy. */
  investasi: {
    typeLabels: Record<InvestasiTypeId, string>;
    errorLoad: string;
    toastUpdated: string;
    toastAdded: string;
    toastUpdateFailed: string;
    toastAddFailed: string;
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
    saving: string;
    saveButton: string;
    totalValueLabel: string;
    totalReturnSuffix: string;
    todayReturnLabel: string;
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
  };
  /** EPIC-018 Task A5 — `/aset` (consolidated assets) page copy. */
  aset: {
    tabs: Record<AsetTabId, string>;
    assetTypeLabels: Record<AsetTypeId, string>;
    accountTypeLabels: Record<AsetAccountTypeId, string>;
    invTypeLabels: Record<InvestasiTypeId, string>;
    totalAssetsLabel: string;
    addAssetButton: string;
    lockAriaLabel: string;
    errorLoad: string;
    toastAdded: string;
    toastAddFailed: string;
    modalTitle: string;
    fieldNameLabel: string;
    fieldNamePlaceholder: string;
    fieldCategoryLabel: string;
    fieldValueLabel: string;
    fieldValuePlaceholder: string;
    // EPIC-021 #17/#18: signed annual value-change rate (depreciation < 0,
    // appreciation > 0).
    fieldValueChangeRateLabel: string;
    fieldValueChangeRatePlaceholder: string;
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
    // EPIC-021 #17/#18: honest label appended to a compute-on-read estimate.
    estimatedValueBadge: string;
  };
  /** EPIC-018 Task A5 — `/liabilitas` (debts & credit) page copy. */
  liabilitas: {
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
    dtaRatioLabel: string;
    addButton: string;
    emptyState: string;
  };
  /**
   * EPIC-018 Task A5 — `/masterdata` page copy. `REFERENCE_GROUPS` in the
   * page keeps each group's local `items` untranslated (see the
   * `MasterDataGroupId` comment in this file); every group `title`/`label`,
   * the real-category-API copy, and every toast resolve from here.
   */
  masterdata: {
    pageTitle: string;
    pageSubtitle: string;
    groups: Record<MasterDataGroupId, { title: string; label: string }>;
    categorySectionTitle: string;
    masterCoaLink: string;
    addLink: string;
    categoryLoading: string;
    categoryEmpty: string;
    kindIncome: string;
    kindExpense: string;
    privateLabel: string;
    autoOptionLabel: string;
    groupEmpty: string;
    footerBold: string;
    footerRest: string;
    editAriaPrefix: string;
    deleteAriaPrefix: string;
    categoryDeleteLabelPrefix: string;
    categoryDeleteLabelSuffix: string;
    itemRemovedPrefix: string;
    itemRemovedSuffix: string;
    toastReferenceReadOnly: string;
    toastInvalidSession: string;
    toastNameRequired: string;
    toastInvalidType: string;
    toastCategoryUpdated: string;
    toastCategoryUpdateFailed: string;
    toastCategoryAdded: string;
    toastCategoryAddFailed: string;
    toastCategoryDeleted: string;
    toastCategoryDeleteFailed: string;
  };
  /** EPIC-018 Task A5 — `/mastercoa` (chart of accounts) page copy. */
  mastercoa: {
    groupLabels: Record<MasterCoaGroupNum, string>;
    directionLabels: Record<MasterCoaDirectionId, string>;
    budgetTypeLabels: Record<MasterCoaBudgetTypeId, string>;
    tabAll: string;
    totalAccountsTitle: string;
    sixGroupsLabel: string;
    connectedCategoriesTitle: string;
    manageLink: string;
    linkedCategoriesDescPrefix: string;
    linkedCategoriesDescSuffix: string;
    emptyCoaTitle: string;
    emptyCoaDesc: string;
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
    toastAdded: string;
    toastAddFailed: string;
    toastUpdated: string;
    toastUpdateFailed: string;
    toastDeleted: string;
    toastDeleteFailed: string;
    toastSessionNotReady: string;
  };
  /** EPIC-018 Task A6 — `/notifikasi` (notifications) page copy. Notification
   * `title`/`body`/`icon` come from the API (real user-facing content set at
   * creation time) and stay untranslated in the page. */
  notifikasi: {
    title: string;
    newCountSuffix: string;
    processing: string;
    markAllRead: string;
    errorLoad: string;
    emptyState: string;
    unreadBadge: string;
    relativeJustNow: string;
    relativeMinutesSuffix: string;
    relativeHoursSuffix: string;
    relativeYesterday: string;
    relativeDaysSuffix: string;
  };
  /** EPIC-018 Task A6 — `/dana` (cash & e-wallet) page copy. */
  dana: {
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
  };
  /** EPIC-018 Task A6 — `/ringkasan` (financial summary dashboard) page copy. */
  ringkasan: {
    errorLoad: string;
    totalNetWorthLabel: string;
    monthDeltaUpPrefix: string;
    monthDeltaDownPrefix: string;
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
    emptyCashflow: string;
    compositionTitle: string;
    emptyComposition: string;
    cashFlowTitlePrefix: string;
    incomeLabel: string;
    expenseLabel: string;
    surplusLabel: string;
    loadingLabel: string;
    topExpensesTitle: string;
    emptyTopExpenses: string;
    healthScoreTitle: string;
    financialHealthScoreLabel: string;
    healthStatusGood: string;
    healthStatusFair: string;
    healthStatusNeedsAttention: string;
  };
  /** EPIC-018 Task A6 — `/tujuan` (financial goals) page copy. */
  tujuan: {
    statusLabels: Record<TujuanStatusId, string>;
    noTargetDate: string;
    targetDatePrefix: string;
    editButton: string;
    deleteButton: string;
    collectedSuffix: string;
    targetPrefix: string;
    remainingPrefix: string;
    autoDebitPrefix: string;
    autoDebitSuffix: string;
    noAutoDebit: string;
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
  };
  /**
   * EPIC-018 Task A6 — `/tax` (tax center) page copy. `LEMBAGA_OPTIONS`-style
   * value-locked lists don't apply here (no persisted free-text recipient
   * field on this page).
   */
  tax: {
    sptStatusLabels: Record<TaxSptStatusId, string>;
    ptkpLabels: Record<TaxPtkpId, string>;
    bracketLabels: Record<TaxBracketId, string>;
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
    calculatorSubtitle: string;
    fieldGrossLabel: string;
    fieldStatusLabel: string;
    fieldJabatanLabel: string;
    fieldZakatLabel: string;
    estimateLabel: string;
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
    toastUploadUnavailable: string;
    emptyDocuments: string;
    reportSptButton: string;
    downloadSummaryButton: string;
    toastDownloadUnavailable: string;
    toastSaved: string;
    toastSaveFailed: string;
    toastStatusUpdated: string;
    toastStatusUpdateFailed: string;
  };
  /** EPIC-018 Task A6 — `/rekening` (bank accounts) page copy. */
  rekening: {
    typeLabels: Record<RekeningAccountTypeId, string>;
    balanceLabel: string;
    activeBadge: string;
    privateBadge: string;
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
    groupIslam: string;
    groupUmum: string;
    heroTitle: string;
    transactionsSuffix: string;
    subheaderDesc: string;
    recordDonationButton: string;
    zakatCalculatorTitle: string;
    zakatCalculatorSubtitle: string;
    fieldCashLabel: string;
    fieldGoldLabel: string;
    fieldInvestLabel: string;
    fieldDebtLabel: string;
    zakatDueLabel: string;
    nisabReachedMsg: string;
    nisabNotReachedMsg: string;
    nisabIndicativeNote: string;
    payZakatNowButton: string;
    historyTitle: string;
    loadingLabel: string;
    emptyHistory: string;
    taxDeductibleBadge: string;
    insightTitle: string;
    insightDesc: string;
    modalTitle: string;
    fieldJenisLabel: string;
    fieldJumlahLabel: string;
    fieldLembagaLabel: string;
    fieldTanggalLabel: string;
    fieldAccountLabel: string;
    accountNoneOption: string;
    accountHint: string;
    taxDeductibleCheckboxLabel: string;
    savingLabel: string;
    saveRecordButton: string;
    toastSaved: string;
    toastSaveFailed: string;
    toastInvalidAmount: string;
  };
  /**
   * EPIC-018 Task A6 — `/warisan` (inheritance assets) page copy.
   * `ASSET_TYPE_OPTIONS` (persisted free-text `assetType` categories) stay
   * untranslated in the page — same value-locked-copy caveat as `donation`'s
   * `LEMBAGA_OPTIONS`.
   */
  warisan: {
    heroTitle: string;
    assetsRegisteredSuffix: string;
    heirsMidDot: string;
    heirsSuffix: string;
    headerDesc: string;
    addAssetButton: string;
    emptyState: string;
    insightTitle: string;
    insightDesc: string;
    uploadComingSoonButton: string;
    toastUploadUnavailable: string;
    modalTitleEdit: string;
    fieldCategoryLabel: string;
    fieldNameLabel: string;
    fieldNamePlaceholder: string;
    fieldValueLabel: string;
    fieldNotesLabel: string;
    fieldNotesPlaceholder: string;
    fieldDocumentLabel: string;
    documentUploadHint: string;
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
  };
  /** EPIC-018 Task A6 — `/anggaran` (budgets) page copy. */
  anggaran: {
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
  };
  /** EPIC-018 Task A6 — `/transaksi` (transactions list) page copy. */
  transaksi: {
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
    differenceLabel: string;
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
  };
  /**
   * EPIC-018 Task A6 — `/splitbill` (split bill) page copy. The seed
   * participant example names ("Andi"/"Budi"/"Citra") stay untranslated in
   * the page — example data, not UI chrome, same convention as the `USER`
   * mock profile name.
   */
  splitbill: {
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
  };
  /**
   * EPIC-018 Task A6 — `/rekonsiliasi` (bank reconciliation wizard) page
   * copy. `SUPPORTED_BANKS` (real bank names/codes) stay untranslated in the
   * page — proper nouns, same convention as `donation`'s `LEMBAGA_OPTIONS`.
   */
  rekonsiliasi: {
    steps: Record<RekonsiliasiStepNum, { label: string; sub: string }>;
    uploadTitle: string;
    uploadSubtitle: string;
    uploadingLabel: string;
    dragDropLabel: string;
    orLabel: string;
    chooseFileButton: string;
    supportedFormatsLabel: string;
    maxFileSizeLabel: string;
    supportedBanksTitle: string;
    viewAllLink: string;
    othersLabel: string;
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
    toastUploadFailedDefault: string;
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
    splitValidationSelectSourceAccount: string;
    splitValidationSelectDestAccount: string;
    splitValidationSameAccount: string;
    splitValidationPrincipalPositive: string;
    splitValidationSumMismatch: string;
    toastSplitSuccess: string;
    toastSplitFailedDefault: string;
  };
};
