import type {
  MobileNavId,
  NavItemId,
  NavSectionHeaderKey,
  PageTitleId,
  ReportTabId,
} from "@/lib/nav";

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
      pagesHeader: string;
      quickAccessHeader: string;
      noResultsFor: string;
    };
  };
};
