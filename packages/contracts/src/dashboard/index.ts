export interface CashflowDto {
  months: string[];
  income: number[];
  expense: number[];
  max: number;
}

export interface AllocationItemDto {
  label: string;
  value: number;
  amount: number;
  color: string;
}

export interface AccountSummaryItemDto {
  type: string;
  label: string;
  total: number;
}

// Every amount is null when the viewer's "Lihat saldo" is off
// (`balancesHidden: true`).
export interface NetWorthDto {
  accountsTotal: string | null;
  investmentsTotal: string | null;
  assetsTotal: string | null;
  liabilitiesTotal: string | null;
  // Asuransi S6 — confirmed policy value of policies included in net worth
  // (already inside netWorth; never sum assured or premiums paid).
  insurancesTotal?: string | null;
  netWorth: string | null;
  currency: string;
  balancesHidden?: boolean;
}

export interface NetWorthHistoryPointDto {
  capturedAt: string;
  totalCash: string;
  totalInvestments: string;
  totalAssets: string;
  totalLiabilities: string;
  netWorth: string;
}

export interface NetWorthHistoryDto {
  range: string;
  currency: string;
  points: NetWorthHistoryPointDto[];
}

// When the viewer's "Lihat saldo" is off: netWorth/assetsTotal/currentMonth/
// cashflow are null, sparkline/allocation/accountSummary are empty and
// `balancesHidden` is true. Recent transactions are unchanged.
export interface DashboardSummaryDto {
  balancesHidden?: boolean;
  netWorth: number | null;
  assetsTotal: number | null;
  cashflow: CashflowDto | null;
  sparkline: number[];
  allocation: AllocationItemDto[];
  accountSummary: AccountSummaryItemDto[];
  currentMonth: {
    income: number;
    expense: number;
    net: number;
    savingsRate: number;
    // Month-to-date `expense` split by category name, largest first. Built
    // in the same pass as `expense`, so the amounts always sum to it.
    // `categoryName` is null for a category-less expense row.
    expenseByCategory: { categoryName: string | null; amount: number }[];
  } | null;
  recentTransactions: {
    id: string;
    description: string | null;
    amount: number;
    type: "income" | "expense" | "transfer";
    categoryName: string | null;
    // EPIC-023 Task E retry (MEDIUM 5) — null for a card purchase (no
    // account touched); was laundered to "" before, see transactions'
    // TransactionDto.accountName for the matching fix.
    accountName: string | null;
    occurredAt: string;
  }[];
}
