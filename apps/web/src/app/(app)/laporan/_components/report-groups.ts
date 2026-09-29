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
    tabs: ["rbank", "rdetail", "raliran", "rpnl", "rcashflow", "rkas"],
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
