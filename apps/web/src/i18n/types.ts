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
};
