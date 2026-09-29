export type TransactionFilterFlags = {
  hasDateRange: boolean;
  hasAccount: boolean;
  hasCategory: boolean;
  hasType: boolean;
  hasSort: boolean;
};

export function getActiveTransactionFilterCount(
  filters: TransactionFilterFlags,
): number {
  return Object.values(filters).filter(Boolean).length;
}
