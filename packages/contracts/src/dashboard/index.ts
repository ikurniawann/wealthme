export interface CashflowDto {
  months: string[];
  income: number[];
  expense: number[];
  max: number;
}

export interface AllocationItemDto {
  label: string;
  value: number; // percentage 0-100
  amount: number; // in rupiah
  color: string;
}

export interface AccountSummaryItemDto {
  type: string; // 'bank' | 'ewallet' | 'cash' | 'investment' | 'property'
  label: string;
  total: number;
}

export interface DashboardSummaryDto {
  netWorth: number;
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
    accountName: string;
    occurredAt: string;
  }[];
}
