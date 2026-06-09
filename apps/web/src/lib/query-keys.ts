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
} as const;
