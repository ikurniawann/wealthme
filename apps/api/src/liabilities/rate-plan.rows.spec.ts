import {
  EMPTY_RATE_PLAN_ROWS,
  loadRatePlanRows,
  ratePlanFromRows,
} from "./rate-plan.rows";
import { rateAt } from "./rate-plan.util";

const TERMS = {
  interestRate: { toString: () => "8.00" },
  fixedRateMonths: 36,
  floatingRate: { toString: () => "11.00" },
  startDate: new Date("2026-01-15T00:00:00.000Z"),
};
function floating(id: string, iso: string, rate: string) {
  return {
    id,
    liabilityId: "lid-1",
    effectiveDate: new Date(`${iso}T00:00:00.000Z`),
    ratePercent: { toString: () => rate },
    note: null,
    createdAt: new Date("2026-09-26T00:00:00.000Z"),
  };
}

describe("ratePlanFromRows — revisi K", () => {
  it("no K rows: undefined, so G's legacy columns drive the schedule untouched", () => {
    expect(ratePlanFromRows(EMPTY_RATE_PLAN_ROWS, TERMS)).toBeUndefined();
  });

  it("stored periods win over the legacy columns, ordered by sequence", () => {
    const plan = ratePlanFromRows(
      {
        ratePeriods: [
          {
            liabilityId: "lid-1",
            sequence: 1,
            kind: "floating",
            months: null,
            ratePercent: { toString: () => "11" },
          },
          {
            liabilityId: "lid-1",
            sequence: 0,
            kind: "fixed",
            months: 24,
            ratePercent: { toString: () => "3.5" },
          },
        ],
        floatingRates: [],
      },
      TERMS,
    );
    expect(plan?.segments).toEqual([
      { kind: "fixed", months: 24, ratePercent: "3.5" },
      { kind: "floating", months: null, ratePercent: "11" },
    ]);
  });

  it("history on a legacy G row rides on the legacy segments; same-period dates -> later date wins", () => {
    const plan = ratePlanFromRows(
      {
        ratePeriods: [],
        floatingRates: [
          floating("r2", "2031-01-20", "9.50"),
          floating("r1", "2031-01-16", "9.75"),
        ],
      },
      TERMS,
    );
    expect(plan?.segments[0]).toEqual({
      kind: "fixed",
      months: 36,
      ratePercent: "8.00",
    });
    expect(plan?.floatingChanges).toEqual([
      { effectivePeriod: 62, ratePercent: "9.75" },
      { effectivePeriod: 62, ratePercent: "9.50" },
    ]);
    expect(plan && rateAt(plan, 62).ratePercent).toBe("9.50");
    expect(plan && rateAt(plan, 61).ratePercent).toBe("11.00");
  });

  it("history without a start date cannot be placed and is ignored", () => {
    const plan = ratePlanFromRows(
      {
        ratePeriods: [],
        floatingRates: [floating("r1", "2031-01-15", "9.75")],
      },
      { ...TERMS, startDate: null },
    );
    expect(plan?.floatingChanges).toEqual([]);
  });
});

describe("loadRatePlanRows — revisi K", () => {
  it("one tenant-scoped query per table, grouped per liability", async () => {
    const period = (liabilityId: string) => ({
      liabilityId,
      sequence: 0,
      kind: "fixed",
      months: null,
      ratePercent: { toString: () => "5.00" },
    });
    const client = {
      liabilityRatePeriod: {
        findMany: jest.fn().mockResolvedValue([period("a"), period("b")]),
      },
      liabilityFloatingRate: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const rows = await loadRatePlanRows(client as never, "fg-1", [
      "a",
      "b",
      "c",
    ]);

    expect(client.liabilityRatePeriod.findMany).toHaveBeenCalledWith({
      where: { familyGroupId: "fg-1", liabilityId: { in: ["a", "b", "c"] } },
      orderBy: [{ liabilityId: "asc" }, { sequence: "asc" }],
    });
    expect(client.liabilityFloatingRate.findMany).toHaveBeenCalledWith({
      where: { familyGroupId: "fg-1", liabilityId: { in: ["a", "b", "c"] } },
      orderBy: [{ liabilityId: "asc" }, { effectiveDate: "asc" }],
    });
    expect(rows.get("a")?.ratePeriods).toHaveLength(1);
    expect(rows.get("b")?.ratePeriods).toHaveLength(1);
    expect(rows.get("c")).toEqual({ ratePeriods: [], floatingRates: [] });
  });

  it("no ids: no queries", async () => {
    const client = {
      liabilityRatePeriod: { findMany: jest.fn() },
      liabilityFloatingRate: { findMany: jest.fn() },
    };
    expect((await loadRatePlanRows(client as never, "fg-1", [])).size).toBe(0);
    expect(client.liabilityRatePeriod.findMany).not.toHaveBeenCalled();
  });
});
