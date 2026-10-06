import {
  currentMonthWindow,
  monthCompareCaption,
  selectMonthComparison,
  type MonthCaptionLabels,
  type MonthCompareBase,
} from "./month-compare";

// 2026-10-06 12:00 WIB — Oct is running (6 of 31 days elapsed).
const now = new Date("2026-10-06T05:00:00.000Z");

const labels: MonthCaptionLabels = {
  window: "{current} vs {previous}",
  fullMonth: "{month} penuh",
  lastMonth: "dari bulan lalu",
};

describe("currentMonthWindow", () => {
  it("aligns the prior month to today's day-of-month while the month runs", () => {
    expect(currentMonthWindow(now)).toEqual({
      cutoffDay: 6,
      priorCutoffDay: 6,
      priorStartDate: "2026-08-31T17:00:00.000Z",
      priorEndDate: "2026-09-06T16:59:59.999Z",
    });
  });

  it("is null on the last day of the month (nothing left to align)", () => {
    expect(currentMonthWindow(new Date("2026-10-31T05:00:00.000Z"))).toBeNull();
  });

  it("uses the WIB calendar day, not the UTC one (Oct 31 20:00 UTC is Nov 1 WIB)", () => {
    expect(currentMonthWindow(new Date("2026-10-31T20:00:00.000Z"))).toEqual(
      expect.objectContaining({ cutoffDay: 1, priorCutoffDay: 1 }),
    );
  });
});

describe("selectMonthComparison", () => {
  // Seeded data: Oct 1–6 Rp 1.450.000, Sep 1–6 Rp 230.000, full Sep Rp 4.525.000.
  const expense = [3_000_000, 4_525_000, 1_450_000];
  const window = currentMonthWindow(now);
  const prior = { income: 900_000, expense: 230_000, net: 670_000 };

  it("compares month-to-date with the prior day-aligned window once it is loaded", () => {
    const base: MonthCompareBase = { window, prior };
    expect(selectMonthComparison(expense, "expense", base)).toEqual({
      current: 1_450_000,
      previous: 230_000,
      basis: "window",
      window,
    });
    expect(selectMonthComparison([0, 0, 2_000_000], "net", base)).toEqual(
      expect.objectContaining({ previous: 670_000, basis: "window" }),
    );
  });

  it("falls back to the full prior month, flagged pending, while the window is loading or failed", () => {
    expect(
      selectMonthComparison(expense, "expense", { window, prior: undefined }),
    ).toEqual({
      current: 1_450_000,
      previous: 4_525_000,
      basis: "window-pending",
      window,
    });
  });

  it("uses full-vs-full when the month is complete (no window)", () => {
    expect(
      selectMonthComparison(expense, "expense", { window: null, prior }),
    ).toEqual({
      current: 1_450_000,
      previous: 4_525_000,
      basis: "full",
      window: null,
    });
    expect(selectMonthComparison(expense, "expense")).toEqual(
      expect.objectContaining({ basis: "full" }),
    );
  });

  it("has nothing to compare without a base", () => {
    expect(selectMonthComparison(undefined, "expense")).toBeNull();
    expect(selectMonthComparison([], "expense")).toBeNull();
    expect(selectMonthComparison([100], "expense")).toBeNull();
    expect(
      selectMonthComparison([100], "expense", { window: null, prior }),
    ).toBeNull();
  });

  it("still compares with the window when only the running month is in the series", () => {
    expect(
      selectMonthComparison([1_450_000], "expense", { window, prior }),
    ).toEqual(expect.objectContaining({ previous: 230_000, basis: "window" }));
  });
});

describe("monthCompareCaption", () => {
  const window = currentMonthWindow(now)!;

  it("names both windows: 1–6 Okt vs 1–6 Sep", () => {
    expect(
      monthCompareCaption({ basis: "window", window }, labels, "id-ID"),
    ).toBe("1–6 Okt vs 1–6 Sep");
  });

  it("says the prior month is whole when its window is unavailable", () => {
    expect(
      monthCompareCaption({ basis: "window-pending", window }, labels, "id-ID"),
    ).toBe("1–6 Okt vs Sep penuh");
  });

  it("keeps the plain caption when both months are complete", () => {
    expect(
      monthCompareCaption({ basis: "full", window: null }, labels, "id-ID"),
    ).toBe("dari bulan lalu");
  });

  it("rolls the year over for a January window (Dec prior)", () => {
    const jan = currentMonthWindow(new Date("2027-01-10T05:00:00.000Z"))!;
    expect(
      monthCompareCaption({ basis: "window", window: jan }, labels, "en-US"),
    ).toBe("1–10 Jan vs 1–10 Dec");
  });
});
