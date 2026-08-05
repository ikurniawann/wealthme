import { currentPaymentPeriodBounds } from "./payment-period.util";

// EPIC-023 group E retry round 4 (C2) — the bug this util fixes: a
// hardcoded calendar-month window read a `yearly` (or `quarterly`) policy
// paid in January as unpaid again starting in February, because the window
// was always "this calendar month" regardless of the obligation's own
// `premiumPeriod`. These tests pin the correct per-period window and, most
// importantly, that a payment near the START of a yearly/quarterly period
// still falls inside the SAME window near its END — the exact scenario the
// old hardcoded-month window got wrong.
describe("currentPaymentPeriodBounds", () => {
  it("monthly: bounds span the first to the last day of the current calendar month", () => {
    const now = new Date(2026, 5, 15); // June 15, 2026
    const { periodStart, periodEnd } = currentPaymentPeriodBounds(
      "monthly",
      now,
    );
    expect(periodStart).toEqual(new Date(2026, 5, 1));
    expect(periodEnd).toEqual(new Date(2026, 5, 30, 23, 59, 59, 999));
  });

  it("quarterly: bounds span the current calendar quarter (Q2 = Apr-Jun)", () => {
    const now = new Date(2026, 4, 20); // May 20, 2026 -> Q2
    const { periodStart, periodEnd } = currentPaymentPeriodBounds(
      "quarterly",
      now,
    );
    expect(periodStart).toEqual(new Date(2026, 3, 1)); // April 1
    expect(periodEnd).toEqual(new Date(2026, 5, 30, 23, 59, 59, 999)); // June 30
  });

  it("yearly: bounds span the entire calendar year", () => {
    const now = new Date(2026, 5, 15);
    const { periodStart, periodEnd } = currentPaymentPeriodBounds(
      "yearly",
      now,
    );
    expect(periodStart).toEqual(new Date(2026, 0, 1));
    expect(periodEnd).toEqual(new Date(2026, 11, 31, 23, 59, 59, 999));
  });

  // The regression this whole util exists to fix — pinned explicitly.
  it("yearly: a payment made in January still falls inside the SAME window checked from February onward", () => {
    const paidAt = new Date(2026, 0, 10); // January 10
    const checkedFromFebruary = currentPaymentPeriodBounds(
      "yearly",
      new Date(2026, 1, 1),
    );
    expect(paidAt >= checkedFromFebruary.periodStart).toBe(true);
    expect(paidAt <= checkedFromFebruary.periodEnd).toBe(true);
  });

  it("quarterly: a payment made in the first month of a quarter still falls inside the SAME window checked from the quarter's last month", () => {
    const paidAt = new Date(2026, 3, 2); // April 2 (Q2 start)
    const checkedFromJune = currentPaymentPeriodBounds(
      "quarterly",
      new Date(2026, 5, 25),
    );
    expect(paidAt >= checkedFromJune.periodStart).toBe(true);
    expect(paidAt <= checkedFromJune.periodEnd).toBe(true);
  });
});
