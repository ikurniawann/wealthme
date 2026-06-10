// Centralized query key factory — use these in all useQuery/useMutation calls.
export const queryKeys = {
  auth: {
    me: () => ["auth", "me"] as const,
  },
  familyGroups: {
    all: () => ["familyGroups"] as const,
    detail: (id: string) => ["familyGroups", id] as const,
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
  investments: {
    all: (familyGroupId: string) => ["investments", familyGroupId] as const,
    summary: (familyGroupId: string) =>
      ["investments", familyGroupId, "summary"] as const,
  },
} as const;
