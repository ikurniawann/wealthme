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
  /**
   * The date these figures actually represent. When `dataAvailable` is true
   * and the figures come from a `NetWorthSnapshot` (EPIC-023 B2), this is
   * the SNAPSHOT's own date — which may be earlier than the requested
   * as-of date when it is the most recent snapshot on or before it, never a
   * later one. Reporting the requested date instead would silently imply
   * fresher data than what is actually shown.
   */
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
  /**
   * EPIC-023 B2 (closes EPIC-022 B11) — honest "do we actually have a
   * figure for this date" signal. False when the family has snapshot
   * history but none on or before the requested date — the response is
   * zeroed out rather than inventing a real-looking figure. (When the
   * family has captured no snapshot at all yet, this is still true and the
   * response falls back to live current totals — see reports.service.ts.)
   */
  dataAvailable: boolean;
  /**
   * True when the figures above come from a historical `NetWorthSnapshot`
   * (a real point-in-time figure). False when they were computed from
   * live/current balances instead (no snapshot history exists yet for this
   * family) — in that case the figures are NOT a historical statement for
   * `asOfDate`, only the current totals.
   */
  isHistorical: boolean;
  /**
   * EPIC-023 Task B retry (CRITICAL 2) — a `NetWorthSnapshot` is captured
   * with privacy fully open (`computeNetWorthBreakdown(familyGroupId, true)`
   * — see dashboard.service.ts's `captureSnapshot`), so it has no per-viewer
   * breakdown to fall back to. True when this viewer may NOT see private
   * items (`canSeePrivate` false) AND the family has at least one private
   * account: the snapshot exists but cannot be shown to THIS viewer without
   * leaking hidden money, so every figure above is zeroed out and
   * `dataAvailable` is false for that reason alone (distinct from "no
   * snapshot exists for this date at all"). Always false when the family
   * has no private accounts, or when the viewer may see everything.
   */
  restrictedForViewer: boolean;
}

// EPIC-023 Task B (B3) — US-RPT-11: reconciles the gap between P&L profit
// and the actual net-worth change over the same period ("why is my profit
// 10 jt but my wealth up 15 jt"). `assetRevaluation`/`investmentRevaluation`
// are each derived independently from the opening/closing snapshots' own
// `totalAssets`/`totalInvestments` columns — never as a single
// `closing - opening - profit` residual split between the two (that would
// be indistinguishable from a made-up split whenever both revalue in the
// same period).
//
// EPIC-023 Task B retry (CRITICAL 1) — a snapshot's `totalAssets`/
// `totalInvestments` columns move for TWO independent reasons: the market
// value changing (a real revaluation), and a cash-funded CONTRIBUTION (a
// COA group-3 "Wealth Allocation" TRANSFER moving cash into an Investment/
// Asset that has no automatic ledger link back to the Transaction that
// funded it — see reports.service.ts's `getReconciliationBridge` doc
// comment). A contribution is net-worth-neutral (cash down, holding up by
// the same amount) and must NOT be counted as a gain: `assetRevaluation`/
// `investmentRevaluation` below are the snapshot diff MINUS the period's own
// contributions, so they reflect market movement only.
export interface ReconciliationBridgeDto {
  startDate: string;
  endDate: string;
  /** Net worth at the start of the period (from the snapshot on or before
   * the period's first day), or 0 when unavailable. */
  opening: number;
  /** Net worth at the end of the period (from the snapshot on or before
   * the period's last day), or 0 when unavailable. */
  closing: number;
  /** Revenue − expenses over the period, COA-direction classified — TRANSFER
   * (wealth allocation / debt principal) is excluded, matching the P&L. */
  profit: number;
  /** Market-movement-only change in physical assets: (closing.totalAssets −
   * opening.totalAssets) − `assetContribution`. */
  assetRevaluation: number;
  /** Market-movement-only change in investments: (closing.totalInvestments −
   * opening.totalInvestments) − `investmentContribution`. */
  investmentRevaluation: number;
  /** Cash moved into a physical/other asset this period via a COA group-3
   * ("Wealth Allocation") TRANSFER OTHER than the "Investasi" account —
   * net-worth-neutral (cash down, asset up by the same amount), named here
   * so it is never silently folded into `assetRevaluation`. */
  assetContribution: number;
  /** Cash moved into the investment portfolio this period via the COA
   * group-3 "Investasi" TRANSFER account — net-worth-neutral (cash down,
   * investments up by the same amount), named here so it is never silently
   * folded into `investmentRevaluation`. */
  investmentContribution: number;
  /** False when either endpoint has no snapshot at or before it — an
   * honest "no data" signal, matching `BalanceSheetDto.dataAvailable`. */
  dataAvailable: boolean;
  /** EPIC-023 Task B retry (CRITICAL 2) — same restriction as
   * `BalanceSheetDto.restrictedForViewer`: true when this viewer may not
   * see private items and the family has at least one private account, so
   * `opening`/`closing` (privacy-unaware snapshot totals) cannot be shown. */
  restrictedForViewer: boolean;
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
