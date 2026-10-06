import {
  calendarDaysUntil,
  isInstallmentDueSoon,
  isInsuranceRenewalSoon,
} from "./due-window.util";

const NOW = new Date("2026-10-07T15:00:00.000Z");

describe("due-window.util", () => {
  it("counts UTC calendar days regardless of the time of day", () => {
    expect(calendarDaysUntil(new Date("2026-10-07T00:00:00.000Z"), NOW)).toBe(
      0,
    );
    expect(calendarDaysUntil(new Date("2026-10-14T00:00:00.000Z"), NOW)).toBe(
      7,
    );
    expect(calendarDaysUntil(new Date("2026-10-06T00:00:00.000Z"), NOW)).toBe(
      -1,
    );
  });

  it("flags installments overdue or due within 7 days, not day 8", () => {
    expect(
      isInstallmentDueSoon(new Date("2026-10-14T00:00:00.000Z"), NOW),
    ).toBe(true);
    expect(
      isInstallmentDueSoon(new Date("2026-10-15T00:00:00.000Z"), NOW),
    ).toBe(false);
    expect(
      isInstallmentDueSoon(new Date("2026-09-01T00:00:00.000Z"), NOW),
    ).toBe(true);
  });

  it("flags insurance renewals within 30 days, never lapsed or day 31", () => {
    expect(
      isInsuranceRenewalSoon(new Date("2026-11-06T00:00:00.000Z"), NOW),
    ).toBe(true);
    expect(
      isInsuranceRenewalSoon(new Date("2026-11-07T00:00:00.000Z"), NOW),
    ).toBe(false);
    expect(
      isInsuranceRenewalSoon(new Date("2026-10-06T00:00:00.000Z"), NOW),
    ).toBe(false);
  });
});
