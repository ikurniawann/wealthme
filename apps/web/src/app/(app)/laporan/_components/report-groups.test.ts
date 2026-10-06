import { REPORT_TABS } from "@/lib/nav";
import {
  REPORT_GROUPS,
  getReportGroupForTab,
  getReportGroupTabs,
} from "./report-groups";

// "rcashflow" is intentionally hidden from sidebar/select navigation
// (2026-10-06) — its route and panel logic still exist, only its group
// membership (the thing that makes it discoverable) was removed.
const HIDDEN_FROM_NAV = ["rcashflow"];

describe("report navigation groups", () => {
  it("places every visible report tab in exactly one of five groups", () => {
    const groupedIds = REPORT_GROUPS.flatMap((group) => group.tabs);
    const visibleIds = REPORT_TABS.map(({ id }) => id).filter(
      (id) => !HIDDEN_FROM_NAV.includes(id),
    );

    expect(REPORT_GROUPS).toHaveLength(5);
    expect(groupedIds).toHaveLength(visibleIds.length);
    expect(new Set(groupedIds).size).toBe(visibleIds.length);
    expect(new Set(groupedIds)).toEqual(new Set(visibleIds));
  });

  it("hides rcashflow from every group without removing its tab id", () => {
    const groupedIds = REPORT_GROUPS.flatMap((group) => group.tabs);

    expect(groupedIds).not.toContain("rcashflow");
    expect(REPORT_TABS.map(({ id }) => id)).toContain("rcashflow");
  });

  it("keeps the legacy report id mapped to its group and report list", () => {
    expect(getReportGroupForTab("rasl").id).toBe("liabilities");
    expect(getReportGroupTabs("rasl")).toEqual(["rbalance", "rasl"]);
  });
});
