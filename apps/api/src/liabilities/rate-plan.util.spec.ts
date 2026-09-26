import { effectivePeriodFor } from "./amortisation.util";
import {
  hasFloatingSegment,
  legacyRatePlan,
  rateAt,
  sameRateRegime,
  segmentIndexAt,
  segmentStartPeriods,
  type RatePlan,
} from "./rate-plan.util";

// Berjenjang: 3.50% yr 1-2, 5.50% yr 3, floating 11.00% after.
const BERJENJANG: RatePlan = {
  segments: [
    { kind: "fixed", months: 24, ratePercent: "3.50" },
    { kind: "fixed", months: 12, ratePercent: "5.50" },
    { kind: "floating", months: null, ratePercent: "11.00" },
  ],
  floatingChanges: [],
};

describe("rate plan — revisi K", () => {
  it("segment boundaries: 24 is tier 1, 25 is tier 2, 36 is tier 2, 37 floats", () => {
    expect(segmentStartPeriods(BERJENJANG)).toEqual([1, 25, 37]);
    expect(
      [1, 24, 25, 36, 37, 240].map((p) => segmentIndexAt(BERJENJANG, p)),
    ).toEqual([0, 0, 1, 1, 2, 2]);
    expect(rateAt(BERJENJANG, 24).ratePercent).toBe("3.50");
    expect(rateAt(BERJENJANG, 25).ratePercent).toBe("5.50");
    expect(rateAt(BERJENJANG, 37)).toEqual({
      ratePercent: "11.00",
      kind: "floating",
      segmentIndex: 2,
      changeIndex: -1,
    });
  });

  it("a recorded floating change applies from its effective period, never inside a fixed tier", () => {
    const plan: RatePlan = {
      ...BERJENJANG,
      floatingChanges: [
        { effectivePeriod: 10, ratePercent: "10.25" },
        { effectivePeriod: 61, ratePercent: "9.75" },
      ],
    };
    expect(rateAt(plan, 10).ratePercent).toBe("3.50");
    expect(rateAt(plan, 37)).toEqual({
      ratePercent: "10.25",
      kind: "floating",
      segmentIndex: 2,
      changeIndex: 0,
    });
    expect(rateAt(plan, 60).ratePercent).toBe("10.25");
    expect(rateAt(plan, 61)).toEqual({
      ratePercent: "9.75",
      kind: "floating",
      segmentIndex: 2,
      changeIndex: 1,
    });
    expect(sameRateRegime(rateAt(plan, 60), rateAt(plan, 61))).toBe(false);
    expect(sameRateRegime(rateAt(plan, 61), rateAt(plan, 62))).toBe(true);
  });

  it("legacy G pair reads as fixed-then-floating; missing half means one fixed segment", () => {
    expect(legacyRatePlan("8.00", 36, "11.00").segments).toEqual([
      { kind: "fixed", months: 36, ratePercent: "8.00" },
      { kind: "floating", months: null, ratePercent: "11.00" },
    ]);
    expect(legacyRatePlan("8.00", 36, null).segments).toEqual([
      { kind: "fixed", months: null, ratePercent: "8.00" },
    ]);
    expect(hasFloatingSegment(legacyRatePlan("8.00", null, "11.00"))).toBe(
      false,
    );
  });
});

describe("effectivePeriodFor — revisi K (whole-month rule)", () => {
  const AKAD = new Date("2026-01-15T00:00:00.000Z");
  it.each([
    ["2026-01-15", 1],
    ["2031-01-10", 61],
    ["2031-01-15", 61],
    ["2031-01-16", 62],
    ["2031-01-20", 62],
  ])("rate effective %s -> first period %i", (iso, period) => {
    expect(effectivePeriodFor(AKAD, new Date(`${iso}T00:00:00.000Z`))).toBe(
      period,
    );
  });
});
