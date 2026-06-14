// Centralized query key factory — use these in all useQuery/useMutation calls.
export const queryKeys = {
  auth: {
    me: () => ["auth", "me"] as const,
  },
  familyGroups: {
    all: () => ["familyGroups"] as const,
    mine: () => ["familyGroups", "mine"] as const,
    detail: (id: string) => ["familyGroups", id] as const,
    members: (id: string) => ["familyGroups", id, "members"] as const,
  },
  transactions: {
    all: (familyGroupId: string) => ["transactions", familyGroupId] as const,
    detail: (familyGroupId: string, id: string) =>
      ["transactions", familyGroupId, id] as const,
  },
  categories: {
    all: (familyGroupId: string) => ["categories", familyGroupId] as const,
  },
  accounts: {
    all: (familyGroupId: string) => ["accounts", familyGroupId] as const,
  },
  search: {
    results: (familyGroupId: string, q: string) =>
      ["search", familyGroupId, q] as const,
  },
  dashboard: {
    summary: (familyGroupId: string) =>
      ["dashboard", familyGroupId, "summary"] as const,
  },
  budgets: {
    all: (familyGroupId: string) => ["budgets", familyGroupId] as const,
  },
  goals: {
    all: (familyGroupId: string) => ["goals", familyGroupId] as const,
  },
  notifications: {
    all: (familyGroupId: string) => ["notifications", familyGroupId] as const,
    unreadCount: (familyGroupId: string) =>
      ["notifications", familyGroupId, "unread-count"] as const,
  },
  assets: {
    all: (familyGroupId: string) => ["assets", familyGroupId] as const,
    history: (familyGroupId: string, assetId: string) =>
      ["assets", familyGroupId, assetId, "history"] as const,
  },
  netWorth: {
    summary: (familyGroupId: string) => ["netWorth", familyGroupId] as const,
  },
  investments: {
    all: (familyGroupId: string) => ["investments", familyGroupId] as const,
    summary: (familyGroupId: string) =>
      ["investments", familyGroupId, "summary"] as const,
  },
  liabilities: {
    all: (familyGroupId: string) => ["liabilities", familyGroupId] as const,
    summary: (familyGroupId: string) =>
      ["liabilities", familyGroupId, "summary"] as const,
  },
  insurances: {
    all: (familyGroupId: string) => ["insurances", familyGroupId] as const,
    summary: (familyGroupId: string) =>
      ["insurances", familyGroupId, "summary"] as const,
  },
  inheritance: {
    list: (fgId: string) => ["inheritance", fgId] as const,
  },
  splitBills: {
    list: (fgId: string) => ["split-bills", fgId] as const,
  },
  donations: {
    list: (fgId: string) => ["donations", fgId] as const,
  },
  exports: {
    status: (familyGroupId: string, jobId: string) =>
      ["exports", familyGroupId, jobId] as const,
  },
  tax: {
    list: (fgId: string) => ["tax", fgId] as const,
  },
  reports: {
    summary: (familyGroupId: string, months: number) =>
      ["reports", familyGroupId, "summary", months] as const,
    bank: (familyGroupId: string, start: string, end: string) =>
      ["reports", familyGroupId, "bank", start, end] as const,
    detail: (familyGroupId: string, start: string, end: string) =>
      ["reports", familyGroupId, "detail", start, end] as const,
    pnl: (familyGroupId: string, start: string, end: string) =>
      ["reports", familyGroupId, "pnl", start, end] as const,
    balanceSheet: (familyGroupId: string, date: string) =>
      ["reports", familyGroupId, "balanceSheet", date] as const,
    cashflow: (familyGroupId: string, start: string, end: string) =>
      ["reports", familyGroupId, "cashflow", start, end] as const,
    sankey: (familyGroupId: string, start: string, end: string) =>
      ["reports", familyGroupId, "sankey", start, end] as const,
  },
} as const;
