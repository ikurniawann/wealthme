import {
  DUE_GRACE_DAYS,
  dueInstallment,
  dueInstallmentEffectiveAt,
  dueInstallmentPeriod,
} from "./amortisation.util";

describe("dueInstallment — revisi K (5-day grace, WIB calendar)", () => {
  const AKAD = new Date("2026-01-15T00:00:00.000Z");

  it.each([
    ["before the first due date", "2026-01-10T08:00:00.000Z", 1, false],
    ["on the akad day itself", "2026-01-15T08:00:00.000Z", 1, false],
    ["the day before #24 falls due", "2028-01-14T08:00:00.000Z", 24, false],
    ["on #24's due day", "2028-01-15T08:00:00.000Z", 24, false],
    ["#24 one day late", "2028-01-16T08:00:00.000Z", 24, true],
    [
      "#24 five days late (last grace day)",
      "2028-01-20T08:00:00.000Z",
      24,
      true,
    ],
    ["six days after #24: #25 is next", "2028-01-21T08:00:00.000Z", 25, false],
    [
      "the day before #25 (tier boundary)",
      "2028-02-14T08:00:00.000Z",
      25,
      false,
    ],
    ["on #25's due day (tier boundary)", "2028-02-15T08:00:00.000Z", 25, false],
    [
      "past maturity: clamped to the last installment, late",
      "2046-06-01T08:00:00.000Z",
      240,
      true,
    ],
  ])("%s (%s) -> #%s, late %s", (_label, now, period, late) => {
    expect(dueInstallment(AKAD, new Date(now), 240)).toEqual({ period, late });
  });

  it("uses the WIB calendar day: 23:59 WIB on day +5 is still #24, 00:00 WIB on day +6 is #25", () => {
    expect(
      dueInstallmentPeriod(AKAD, new Date("2028-01-20T16:59:59.000Z"), 240),
    ).toBe(24);
    expect(
      dueInstallmentPeriod(AKAD, new Date("2028-01-20T17:00:00.000Z"), 240),
    ).toBe(25);
    // 06:30 WIB on #24's due day is 23:30 UTC the day before — still the due day in WIB.
    expect(
      dueInstallment(AKAD, new Date("2028-01-14T23:30:00.000Z"), 240),
    ).toEqual({ period: 24, late: false });
  });

  it("dueInstallmentEffectiveAt: the WIB instant a period BECOMES due (C1) — day D(period-1)+6, or the akad's own WIB midnight for #1", () => {
    // #25 becomes due exactly when #24 flips (day +6 after #24's due day, WIB) — matches the boundary above.
    expect(dueInstallmentEffectiveAt(AKAD, 25)).toEqual(
      new Date("2028-01-20T17:00:00.000Z"),
    );
    // #1 becomes due at the akad's own WIB midnight, i.e. akad 00:00 WIB = akad-day 17:00 UTC the day before.
    expect(dueInstallmentEffectiveAt(AKAD, 1)).toEqual(
      new Date("2026-01-14T17:00:00.000Z"),
    );
  });

  it("no akad date: installment 1; no tenor: not clamped; grace is 5 days", () => {
    expect(
      dueInstallmentPeriod(null, new Date("2030-01-01T00:00:00.000Z"), 240),
    ).toBe(1);
    expect(
      dueInstallmentPeriod(AKAD, new Date("2046-06-01T08:00:00.000Z"), null),
    ).toBe(245);
    expect(DUE_GRACE_DAYS).toBe(5);
  });
});
