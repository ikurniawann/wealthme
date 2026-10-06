import type { ReportTabId } from "@/lib/nav";

export type ReportGroupId =
  | "summary"
  | "cashflow"
  | "wealth"
  | "liabilities"
  | "taxOther";

export const REPORT_GROUPS: {
  id: ReportGroupId;
  tabs: ReportTabId[];
}[] = [
  {
    id: "summary",
    tabs: ["rsum", "rharian", "rbulanan", "rtahunan", "rfamily"],
  },
  {
    id: "cashflow",
    // "rcashflow" (Cashflow) is hidden from the sidebar/select nav on
    // request (2026-10-06) — its content duplicated "rkas" (Arus Kas),
    // which is being replaced with the journey-flow chart below. The tab
    // id, its route, and its panel logic are untouched; only the group
    // membership that drives navigation is removed, so a stale deep link
    // to ?tab=rcashflow still renders — it is hidden from discovery, not
    // deleted.
    tabs: ["rbank", "rdetail", "raliran", "rpnl", "rkas"],
  },
  { id: "wealth", tabs: ["rinv", "rperf"] },
  { id: "liabilities", tabs: ["rbalance", "rasl"] },
  { id: "taxOther", tabs: ["rpajak", "rcoa"] },
];

export function getReportGroupForTab(tab: string) {
  return (
    REPORT_GROUPS.find((group) => group.tabs.includes(tab as ReportTabId)) ??
    REPORT_GROUPS[0]
  );
}

export function getReportGroupTabs(tab: string): ReportTabId[] {
  return getReportGroupForTab(tab).tabs;
}
