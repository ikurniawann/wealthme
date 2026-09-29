import { REPORT_TABS } from "@/lib/nav";
import {
  REPORT_GROUPS,
  getReportGroupForTab,
  getReportGroupTabs,
} from "./report-groups";

describe("report navigation groups", () => {
  it("places every existing report tab in exactly one of five groups", () => {
    const groupedIds = REPORT_GROUPS.flatMap((group) => group.tabs);

    expect(REPORT_GROUPS).toHaveLength(5);
    expect(groupedIds).toHaveLength(REPORT_TABS.length);
    expect(new Set(groupedIds).size).toBe(REPORT_TABS.length);
    expect(new Set(groupedIds)).toEqual(
      new Set(REPORT_TABS.map(({ id }) => id)),
    );
  });

  it("keeps the legacy report id mapped to its group and report list", () => {
    expect(getReportGroupForTab("rasl").id).toBe("liabilities");
    expect(getReportGroupTabs("rasl")).toEqual(["rbalance", "rasl"]);
  });
});
