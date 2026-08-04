import { formatRupiah } from "@/lib/format";
import type { CategoryBreakdownItem, SankeyDto } from "@wealthme/contracts";
import type { DonutSegment } from "@/components/charts/donut";

const FALLBACK_COLORS = [
  "#4F46E5",
  "#10B981",
  "#F59E0B",
  "#8B5CF6",
  "#06B6D4",
  "#EC4899",
  "#E2E8F0",
];

export function categoryBreakdownToDonut(
  items: CategoryBreakdownItem[],
): DonutSegment[] {
  return items
    .filter((item) => item.percentage > 0)
    .map((item, i) => ({
      label: item.categoryName,
      value: item.percentage,
      color:
        item.color ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length] ?? "#E2E8F0",
    }));
}

/**
 * Formats a signed rupiah amount with a real sign — EPIC-022 B2. The
 * previous inline `fmt()` on /laporan prepended "+" for non-negatives but
 * then ran `Math.abs()` on negatives before formatting, silently stripping
 * the minus and leaving color as the only (easy to miss) signal that a
 * cashflow figure was negative.
 */
export function formatSignedRupiah(amount: number): string {
  return amount >= 0
    ? `+${formatRupiah(amount)}`
    : `-${formatRupiah(Math.abs(amount))}`;
}

export function txTypeToBadgeVariant(
  type: string,
): "success" | "info" | "danger" | "purple" {
  if (type === "income") return "success";
  if (type === "expense") return "danger";
  return "info";
}

export interface BalanceSheetIdentity {
  /** Total Liabilities + Equity (net worth) — the real right-hand side of
   * the balance-sheet identity, never a re-display of totalAssets. */
  totalLiabilitiesPlusEquity: number;
  /** totalAssets − totalLiabilitiesPlusEquity. Zero when the sheet is
   * genuinely balanced; non-zero discloses a real discrepancy. */
  diff: number;
  /** True only when `diff` is within a whole-rupiah rounding slack (< 1). */
  isBalanced: boolean;
}

/**
 * Computes the real balance-sheet identity (EPIC-022 B1). The UI must never
 * claim "balanced" by re-displaying `totalAssets` on both sides of the
 * table — it must derive the right-hand side from `totalLiabilities` +
 * `netWorth` and only report balanced when the two sides actually match.
 */
export function computeBalanceSheetIdentity(balanceSheet: {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
}): BalanceSheetIdentity {
  const totalLiabilitiesPlusEquity =
    balanceSheet.totalLiabilities + balanceSheet.netWorth;
  const diff = balanceSheet.totalAssets - totalLiabilitiesPlusEquity;
  return {
    totalLiabilitiesPlusEquity,
    diff,
    isBalanced: Math.abs(diff) < 1,
  };
}

export function formatJuta(amount: number): string {
  const juta = amount / 1_000_000;
  if (juta === 0) return "0 jt";
  const rounded = Math.round(juta * 100) / 100;
  const str = rounded
    .toLocaleString("id-ID", { maximumFractionDigits: 2 })
    .replace(/\./, ",");
  return `${str} jt`;
}

export type FlowBar = {
  label: string;
  amount: number;
  widthPct: number;
};

export function sankeyToFlowBars(
  data: SankeyDto,
  type: "income" | "expense",
): FlowBar[] {
  const { nodes, links } = data;

  const incomeIds = new Set(links.map((l) => l.source));
  const expenseIds = new Set(links.map((l) => l.target));
  const relevantIds = type === "income" ? incomeIds : expenseIds;

  const amountById = new Map<string, number>();
  for (const link of links) {
    const id = type === "income" ? link.source : link.target;
    amountById.set(id, (amountById.get(id) ?? 0) + link.value);
  }

  const bars: FlowBar[] = nodes
    .filter((n) => relevantIds.has(n.id))
    .map((n) => ({
      label: n.label,
      amount: amountById.get(n.id) ?? 0,
      widthPct: 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const maxAmount = bars[0]?.amount ?? 0;
  if (maxAmount === 0) return [];

  return bars.map((b) => ({
    ...b,
    widthPct: Math.round((b.amount / maxAmount) * 100),
  }));
}

export function balanceSheetToWealthAlloc(
  assets: {
    category: string;
    amount: number;
    items: { name: string; amount: number }[];
  }[],
  totalAssets: number,
): DonutSegment[] {
  if (totalAssets === 0 || assets.length === 0) return [];
  return assets
    .filter((g) => g.amount > 0)
    .map((g, i) => ({
      label: g.category,
      value: Math.round((g.amount / totalAssets) * 100),
      color: FALLBACK_COLORS[i % FALLBACK_COLORS.length] ?? "#E2E8F0",
    }))
    .sort((a, b) => b.value - a.value);
}

export type InvChartData = {
  nilaiPct: number;
  modalPct: number;
  hasReturn: boolean;
};

export function buildInvChartData(
  summary:
    | Pick<
        import("@wealthme/contracts").InvestmentSummaryDto,
        "totalCurrentValue" | "totalCostBasis"
      >
    | undefined,
): InvChartData | null {
  if (!summary) return null;
  const nilai = parseFloat(summary.totalCurrentValue);
  const modal = parseFloat(summary.totalCostBasis);
  if (nilai === 0 && modal === 0) return null;
  const max = Math.max(nilai, modal);
  return {
    nilaiPct: Math.round((nilai / max) * 100),
    modalPct: Math.round((modal / max) * 100),
    hasReturn: nilai >= modal,
  };
}

export function getMonthDateRange(): { startDate: string; endDate: string } {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  endDate.setHours(23, 59, 59, 999);
  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  };
}

export function getTodayDateRange(): { startDate: string; endDate: string } {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  endDate.setHours(23, 59, 59, 999);
  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  };
}
