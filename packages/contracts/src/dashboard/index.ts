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

export interface NetWorthDto {
  accountsTotal: string;
  investmentsTotal: string;
  assetsTotal: string;
  liabilitiesTotal: string;
  netWorth: string;
  currency: string;
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

export interface DashboardSummaryDto {
  netWorth: number;
  assetsTotal: number;
  cashflow: CashflowDto;
  sparkline: number[];
  allocation: AllocationItemDto[];
  accountSummary: AccountSummaryItemDto[];
  currentMonth: {
    income: number;
    expense: number;
    net: number;
    savingsRate: number;
  };
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
