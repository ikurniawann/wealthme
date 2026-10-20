import { dueNeedsConfirmation, parseDateOnly } from "./premium-schedule.util";

describe("dueNeedsConfirmation", () => {
  const today = parseDateOnly("2026-10-20");
  const flag = (due: string | null, period: "monthly" | "yearly" | "single") =>
    dueNeedsConfirmation(
      {
        nextPremiumDueDate: due ? parseDateOnly(due) : null,
        premiumPeriod: period,
      },
      today,
    );

  it("flags a legacy coverage-end date on a monthly policy", () => {
    expect(flag("2036-10-20", "monthly")).toBe(true);
  });

  it("keeps a plausible next due, incl. one stepped forward by an early payment", () => {
    expect(flag("2026-11-05", "monthly")).toBe(false);
    expect(flag("2026-11-27", "monthly")).toBe(false);
    expect(flag("2026-10-01", "monthly")).toBe(false);
    expect(flag("2027-11-19", "yearly")).toBe(false);
  });

  it("uses 13 months for single/custom periods and ignores missing dues", () => {
    expect(flag("2027-11-19", "single")).toBe(false);
    expect(flag("2027-11-21", "single")).toBe(true);
    expect(flag(null, "monthly")).toBe(false);
  });
});
