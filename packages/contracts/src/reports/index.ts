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
// "Lihat saldo" off → totals null, lists empty, `balancesHidden: true`.
export interface ReportSummaryDto {
  balancesHidden?: boolean;
  period: ReportPeriod;
  points: PeriodPoint[];
  totalIncome: number | null;
  totalExpense: number | null;
  netSavings: number | null;
  savingsRate: number | null;
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
  // EPIC-023 E3 (D12) — null for a credit-card purchase (no account touched).
  accountName: string | null;
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
// 10 jt but my wealth up 15 jt").
//
// EPIC-023 Task B, rewrite (attempt 3) — a snapshot's `totalAssets`/
// `totalInvestments` columns move for TWO independent reasons: the market
// value changing (a real revaluation), and a cash-funded CONTRIBUTION (a
// COA group-3 "Wealth Allocation" TRANSFER moving cash into an Investment/
// Asset that has no automatic ledger link back to the Transaction that
// funded it). Earlier attempts tried to split that contribution AND the
// revaluation into asset-directed vs investment-directed halves; both are
// unsatisfiable because `Transaction` has no FK to the `Asset`/`Investment`
// row it funded — attempt 2's `code === "30002"` discriminator misfiled
// every OTHER group-3 code and ignored transaction direction entirely (a
// withdrawal back to cash was ADDED to contributions instead of
// subtracted). This shape reports ONE combined `contribution` and ONE
// combined `holdingsChange` instead — see reports.service.ts's
// `getReconciliationBridge` doc comment for the exact derivation.
//
// EPIC-023 Task B3 review (HIGH x2) — the derived `revaluation` field
// (`rawDelta - contribution`) is GONE, replaced by `holdingsChange` (the
// RAW delta, nothing subtracted). Deriving `revaluation` looked like it
// isolated "market movement only", but nothing links a `Transaction` to
// the holding it funds: a contribution recorded WITHOUT its matching
// holding update (or vice versa) was silently absorbed into `revaluation`
// as a FABRICATED gain or loss, with `unexplained` staying exactly 0 (the
// case that should have warned the family instead stayed silent). The full
// identity is now:
//
//   opening + profit − contribution + holdingsChange + unexplained = closing
//
// (D24 itself says "opening + (income − expenses) + change in asset &
// investment values = closing" — that formula OMITS the contribution
// outflow; the identity above is D24 with that term restored, not a
// departure from it. Do not "fix" this back to matching D24's shorter
// wording literally — verify against the epic's own clean-month fixture,
// which requires the `− contribution` term to balance.)
export interface ReconciliationBridgeDto {
  startDate: string;
  endDate: string;
  /** Net worth at the start of the period (from the last snapshot on or
   * before `startDate` itself), or 0 when unavailable. */
  opening: number;
  /** Net worth at the end of the period (from the last snapshot on or
   * before `endDate`), or 0 when unavailable. */
  closing: number;
  /** Revenue − expenses over the period, COA-direction classified — TRANSFER
   * (wealth allocation / debt principal) is excluded, matching the P&L. */
  profit: number;
  /** Signed sum of the period's COA group-3 ("Wealth Allocation") TRANSFER
   * transactions — cash moved into a holding (+) or withdrawn back to cash
   * (−). A real two-sided transfer between two of the family's own
   * accounts contributes 0 (both legs are already inside `totalCash`). A
   * real SUBTRAHEND in the identity above now, not a memo line folded into
   * a derived figure — see `holdingsChange` below for why. */
  contribution: number;
  /** RAW combined change in physical assets AND investments: (Δ
   * totalAssets + Δ totalInvestments). Nothing is subtracted — this is the
   * directly-measured snapshot delta, not a market-movement-only figure.
   * Not split by asset/investment — nothing links a contribution to which
   * of the two it funded, so a split would misattribute a real gain the
   * same way an asset-vs-investment contribution split once misattributed
   * a contribution. */
  holdingsChange: number;
  /** `closing − (opening + profit − contribution + holdingsChange)` — an
   * HONESTLY NAMED residual, not forced to zero. Two independent, named
   * reasons it is not always zero: (1) COA group 4 (Receivable) has no
   * counterpart in the net-worth breakdown (no receivable table backs it),
   * so lending money out lowers cash with nothing to offset it; (2) a
   * back-dated entry can move a balance in one snapshot period and its
   * profit in another, since snapshots record CAPTURE time while profit is
   * computed from `occurredAt` — see `getReconciliationBridge`'s doc
   * comment. Naming the gap is more honest than hiding it inside another
   * term. */
  unexplained: number;
  /** False when either endpoint has no snapshot at or before it — an
   * honest "no data" signal, matching `BalanceSheetDto.dataAvailable`. */
  dataAvailable: boolean;
  /** EPIC-023 Task B retry (CRITICAL 2), widened by EPIC-023 Task B3 review
   * (HIGH, FIX 2) — true when this viewer may not see private items AND
   * the family has at least one private `Account` OR at least one private
   * `Category`, so `opening`/`closing` (privacy-unaware snapshot totals)
   * cannot be shown alongside a privacy-filtered `profit`/`contribution`.
   * Wider than `BalanceSheetDto.restrictedForViewer` (accounts only) —
   * see `familyHasPrivateItems`'s doc comment in reports.service.ts for
   * why this endpoint needs the category check and the balance sheet does
   * not. */
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

// EPIC-024 Task M (D16, US-RPT-14) — yearly matrix per COA account: rows
// tanggal 1-31, columns Jan-Dec, each cell lists the individual
// transactions that landed on that day (stacked when more than one), plus
// a yearly total. `cells` is sparse — a month/day key is only present when
// at least one transaction occurred on it, so a day that cannot exist in a
// given month (e.g. day 31 in April) never appears, and an empty year
// produces `cells: {}` rather than a synthetic 12x31 grid of empties.
export interface CoaMatrixCell {
  txId: string;
  amount: number;
  description: string | null;
}

export interface CoaMatrixDto {
  coaAccountId: string;
  year: number;
  total: number;
  /** Keyed by calendar month (1-12), then day-of-month (1-31). */
  cells: Record<number, Record<number, CoaMatrixCell[]>>;
}
