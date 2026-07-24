import {
  MONTHS_BY_PERIOD,
  advanceByOnePeriod,
  advanceUntilFuture,
} from "./billing-cycle.util";

describe("billing-cycle.util", () => {
  describe("MONTHS_BY_PERIOD", () => {
    it("maps each premium period to its month count", () => {
      expect(MONTHS_BY_PERIOD.monthly).toBe(1);
      expect(MONTHS_BY_PERIOD.quarterly).toBe(3);
      expect(MONTHS_BY_PERIOD.yearly).toBe(12);
    });
  });

  describe("advanceByOnePeriod()", () => {
    it("advances a monthly date by exactly one month regardless of now", () => {
      const date = new Date("2026-01-15T00:00:00.000Z");
      const result = advanceByOnePeriod(date, 1);
      expect(result).toEqual(new Date("2026-02-15T00:00:00.000Z"));
    });

    it("advances a yearly date by 12 months in a single call", () => {
      const date = new Date("2026-01-15T00:00:00.000Z");
      const result = advanceByOnePeriod(date, 12);
      expect(result).toEqual(new Date("2027-01-15T00:00:00.000Z"));
    });

    it("advances only one period even when the date is far in the past", () => {
      // A real payment always represents a single billing cycle, unlike the
      // auto-renew cron which catches an overdue date all the way up to now.
      const date = new Date("2020-01-15T00:00:00.000Z");
      const result = advanceByOnePeriod(date, 1);
      expect(result).toEqual(new Date("2020-02-15T00:00:00.000Z"));
    });

    it("does not mutate the input date", () => {
      const date = new Date("2026-01-15T00:00:00.000Z");
      const original = date.getTime();
      advanceByOnePeriod(date, 1);
      expect(date.getTime()).toBe(original);
    });
  });

  describe("advanceUntilFuture()", () => {
    it("advances repeatedly until the date is past now", () => {
      const date = new Date("2020-01-15T00:00:00.000Z");
      const now = new Date("2026-07-24T00:00:00.000Z");
      const result = advanceUntilFuture(date, 1, now);
      expect(result.getTime()).toBeGreaterThan(now.getTime());
    });
  });
});
