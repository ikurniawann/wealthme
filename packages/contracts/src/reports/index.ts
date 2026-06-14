// Shared period type
export type ReportPeriod = "daily" | "monthly" | "yearly";

export interface PeriodPoint {
  label: string;
  income: number;
  expense: number;
  net: number;
}

export interface SankeyNode {
  id: string;
  label: string;
}

export interface SankeyLink {
  source: string;
  target: string;
  value: number;
}

export interface SankeyDto {
  nodes: SankeyNode[];
  links: SankeyLink[];
}

export interface CategoryBreakdownItem {
  categoryName: string;
  amount: number;
  percentage: number;
  color: string | null;
}

// T-401 — Ringkasan/Harian/Bulanan/Tahunan
export interface ReportSummaryDto {
  period: ReportPeriod;
  points: PeriodPoint[];
  totalIncome: number;
  totalExpense: number;
  netSavings: number;
  savingsRate: number;
  topIncomeCategories: CategoryBreakdownItem[];
  topExpenseCategories: CategoryBreakdownItem[];
}

// T-402 — Bank/Detail
export interface BankBreakdownItem {
  accountName: string;
  institution: string | null;
  income: number;
  expense: number;
  balance: number;
}

export interface BankReportDto {
  period: ReportPeriod;
  startDate: string;
  endDate: string;
  banks: BankBreakdownItem[];
  totalIncome: number;
  totalExpense: number;
}

export interface DetailTransactionItem {
  id: string;
  occurredAt: string;
  description: string | null;
  categoryName: string | null;
  accountName: string;
  type: "income" | "expense" | "transfer";
  amount: number;
}

export interface DetailReportDto {
  period: ReportPeriod;
  startDate: string;
  endDate: string;
  transactions: DetailTransactionItem[];
  totalIncome: number;
  totalExpense: number;
  count: number;
}

// T-403 — PNL / Balance Sheet / Cashflow / Sankey
export interface PnlDto {
  startDate: string;
  endDate: string;
  revenue: number;
  expenses: number;
  netProfit: number;
  previousRevenue: number;
  previousExpenses: number;
  previousNetProfit: number;
  revenueGrowth: number;
  expenseGrowth: number;
  profitGrowth: number;
  revenueBreakdown: CategoryBreakdownItem[];
  expenseBreakdown: CategoryBreakdownItem[];
}

export interface BalanceSheetDto {
  asOfDate: string;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  assets: {
    category: string;
    amount: number;
    items: { name: string; amount: number }[];
  }[];
  liabilities: {
    category: string;
    amount: number;
    items: { name: string; amount: number }[];
  }[];
}

export interface CashflowStatementDto {
  startDate: string;
  endDate: string;
  operatingInflows: number;
  operatingOutflows: number;
  netOperating: number;
  investingInflows: number;
  investingOutflows: number;
  netInvesting: number;
  openingBalance: number;
  closingBalance: number;
  netChange: number;
}
