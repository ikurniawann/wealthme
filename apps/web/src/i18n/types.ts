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
};
