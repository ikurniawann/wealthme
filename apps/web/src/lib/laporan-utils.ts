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
export function formatSignedRupiah(
  amount: number,
  format: (idr: number) => string = formatRupiah,
): string {
  return amount >= 0 ? `+${format(amount)}` : `-${format(Math.abs(amount))}`;
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
   * the "Total L+E" row, never a re-display of totalAssets. Always shown;
   * unrelated to the cross-source check below (see isBalanced doc). */
  totalLiabilitiesPlusEquity: number;
  /** The dashboard's independently computed net worth
   * (`DashboardService.computeNetWorthBreakdown`), or `null` when that
   * figure has not been fetched/loaded yet. */
  dashboardNetWorth: number | null;
  /** balanceSheet.netWorth − dashboardNetWorth. Only meaningful when
   * `dashboardNetWorth` is not null. */
  diff: number;
  /** True/false only once `dashboardNetWorth` is available; `null` while
   * there is nothing to compare against yet (still loading) — no claim is
   * made until both independently-computed figures are in hand. */
  isBalanced: boolean | null;
}

/**
 * Computes a genuinely falsifiable balance-sheet check (EPIC-022 B1,
 * hardened twice per adversarial review).
 *
 * Round 1 compared `totalAssets` against `totalLiabilities + netWorth` —
 * unfalsifiable because the API defines `netWorth` as their difference in
 * the same payload. Round 2 compared the reported `totalAssets`/
 * `totalLiabilities` scalars against a client-side sum of their own
 * `assets[]`/`liabilities[]` breakdown arrays — STILL unfalsifiable,
 * because `reports.service.ts` builds those very scalars *by* summing the
 * exact same arrays (`totalAssets = assets.reduce(...)`); re-summing them
 * on the client is the same computation twice, differing only in float
 * addition order, and cannot disagree on any input the API can actually
 * produce.
 *
 * This compares the balance sheet's `netWorth` against a DIFFERENT
 * endpoint's independently computed net worth
 * (`DashboardService.computeNetWorthBreakdown`, served at
 * `/dashboard/net-worth` — a different service, a different query path,
 * used by /ringkasan and /beranda). A real bug that under/over-counts an
 * asset class in one path but not the other (exactly the missing-
 * investments defect this hardening round also fixed) makes the two
 * figures disagree, and `isBalanced` reports false. The "Total L+E" row
 * above is unaffected — it still always shows the correct
 * `totalLiabilities + netWorth` value from the balance sheet itself.
 */
export function computeBalanceSheetIdentity(
  balanceSheet: { totalLiabilities: number; netWorth: number },
  dashboardNetWorth: { netWorth: string } | null | undefined,
): BalanceSheetIdentity {
  const totalLiabilitiesPlusEquity =
    balanceSheet.totalLiabilities + balanceSheet.netWorth;
  if (dashboardNetWorth == null) {
    return {
      totalLiabilitiesPlusEquity,
      dashboardNetWorth: null,
      diff: 0,
      isBalanced: null,
    };
  }
  const dashboardValue = Number(dashboardNetWorth.netWorth);
  const diff = balanceSheet.netWorth - dashboardValue;
  return {
    totalLiabilitiesPlusEquity,
    dashboardNetWorth: dashboardValue,
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

/**
 * The current position value of one investment holding — EPIC-022 B9
 * (CRITICAL fix). `inv.currentValue` (when present) is already the TOTAL
 * position value: `apps/api/src/investments/investments.service.ts`
 * computes it as `currentPrice.times(quantity)`, and `getSummary()` there
 * adds `h.currentValue` to the portfolio total AS-IS (never re-multiplying
 * by quantity) — it only multiplies `costBasisPerUnit` by `quantity` in the
 * fallback branch, because that field genuinely is per-unit. Multiplying
 * `currentValue` by `quantity` again (the previous bug here) computes
 * `price × quantity²`, inflating every priced holding by a factor of its
 * own share count.
 */
export function investmentCurrentValue(inv: {
  currentValue: string | null;
  costBasisPerUnit: string;
  quantity: string;
}): number {
  if (inv.currentValue !== null) {
    return parseFloat(inv.currentValue);
  }
  return parseFloat(inv.costBasisPerUnit) * parseFloat(inv.quantity);
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
