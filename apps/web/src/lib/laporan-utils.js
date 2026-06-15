"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.categoryBreakdownToDonut = categoryBreakdownToDonut;
exports.txTypeToBadgeVariant = txTypeToBadgeVariant;
exports.formatJuta = formatJuta;
exports.sankeyToFlowBars = sankeyToFlowBars;
exports.buildInvChartData = buildInvChartData;
exports.balanceSheetToWealthAlloc = balanceSheetToWealthAlloc;
exports.getMonthDateRange = getMonthDateRange;
exports.getTodayDateRange = getTodayDateRange;

const FALLBACK_COLORS = [
  "#4F46E5",
  "#10B981",
  "#F59E0B",
  "#8B5CF6",
  "#06B6D4",
  "#EC4899",
  "#E2E8F0",
];

function categoryBreakdownToDonut(items) {
  return items
    .filter((item) => item.percentage > 0)
    .map((item, i) => ({
      label: item.categoryName,
      value: item.percentage,
      color:
        item.color ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length] ?? "#E2E8F0",
    }));
}

function txTypeToBadgeVariant(type) {
  if (type === "income") return "success";
  if (type === "expense") return "danger";
  return "info";
}

function formatJuta(amount) {
  const juta = amount / 1_000_000;
  if (juta === 0) return "0 jt";
  const rounded = Math.round(juta * 100) / 100;
  const str = rounded
    .toLocaleString("id-ID", { maximumFractionDigits: 2 })
    .replace(/\./, ",");
  return `${str} jt`;
}

function sankeyToFlowBars(data, type) {
  const { nodes, links } = data;

  const incomeIds = new Set(links.map((l) => l.source));
  const expenseIds = new Set(links.map((l) => l.target));
  const relevantIds = type === "income" ? incomeIds : expenseIds;

  const amountById = new Map();
  for (const link of links) {
    const id = type === "income" ? link.source : link.target;
    amountById.set(id, (amountById.get(id) ?? 0) + link.value);
  }

  const bars = nodes
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

function balanceSheetToWealthAlloc(assets, totalAssets) {
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

function buildInvChartData(summary) {
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

function getMonthDateRange() {
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

function getTodayDateRange() {
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
