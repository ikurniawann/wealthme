/**
 * EPIC-020 Task B — shared /laporan year/month(/day) period filter.
 *
 * Verifies the pure date-bounds helpers that map a
 * `{ year, month, day? }` selection to ISO `startDate`/`endDate` bounds used
 * to drive every report section's query. A real, Jest-executed spec (see
 * `format.test.ts` for the same "avoid a dead `.test.mjs`" precedent in this
 * file's neighbourhood — `laporan-utils.test.mjs` under `__tests__/` is run
 * via `node --test` only and is not picked up by Jest's default testMatch).
 */

import {
  clampDayToMonth,
  daysInMonth,
  getPeriodDateRange,
  getYearDateRange,
} from "./laporan-period";

describe("daysInMonth", () => {
  it("returns 31 for January", () => {
    expect(daysInMonth(2026, 1)).toBe(31);
  });

  it("returns 30 for April (30-day month)", () => {
    expect(daysInMonth(2026, 4)).toBe(30);
  });

  it("returns 28 for February in a non-leap year", () => {
    expect(daysInMonth(2026, 2)).toBe(28);
  });

  it("returns 29 for February in a leap year", () => {
    expect(daysInMonth(2024, 2)).toBe(29);
  });

  it("returns 31 for December", () => {
    expect(daysInMonth(2025, 12)).toBe(31);
  });
});

describe("clampDayToMonth", () => {
  it("keeps an in-range day unchanged", () => {
    expect(clampDayToMonth(2026, 1, 15)).toBe(15);
  });

  it("clamps a day beyond the month's length down to the last day", () => {
    expect(clampDayToMonth(2026, 4, 31)).toBe(30);
  });

  it("clamps day=31 in February (non-leap) down to 28", () => {
    expect(clampDayToMonth(2026, 2, 31)).toBe(28);
  });

  it("clamps day=29 in February (leap year) — stays 29", () => {
    expect(clampDayToMonth(2024, 2, 29)).toBe(29);
  });

  it("clamps a day below 1 up to 1", () => {
    expect(clampDayToMonth(2026, 3, 0)).toBe(1);
    expect(clampDayToMonth(2026, 3, -5)).toBe(1);
  });
});

describe("getPeriodDateRange — whole month (no day pinned)", () => {
  it("returns first-of-month 00:00:00.000 through last-of-month 23:59:59.999", () => {
    const { startDate, endDate } = getPeriodDateRange({
      year: 2026,
      month: 3,
      day: null,
    });
    const start = new Date(startDate);
    const end = new Date(endDate);
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(2); // 0-indexed March
    expect(start.getDate()).toBe(1);
    expect(start.getHours()).toBe(0);
    expect(end.getDate()).toBe(31);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
    expect(start.getTime()).toBeLessThan(end.getTime());
  });

  it("December → January rollover: December bounds stay within December, not spilling into next year", () => {
    const { startDate, endDate } = getPeriodDateRange({
      year: 2025,
      month: 12,
      day: null,
    });
    const start = new Date(startDate);
    const end = new Date(endDate);
    expect(start.getFullYear()).toBe(2025);
    expect(start.getMonth()).toBe(11); // December
    expect(start.getDate()).toBe(1);
    expect(end.getFullYear()).toBe(2025);
    expect(end.getMonth()).toBe(11);
    expect(end.getDate()).toBe(31);
  });

  it("January bounds start on Jan 1 of the requested year (no bleed from December)", () => {
    const { startDate } = getPeriodDateRange({
      year: 2026,
      month: 1,
      day: null,
    });
    const start = new Date(startDate);
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(0);
    expect(start.getDate()).toBe(1);
  });

  it("leap Feb: month bounds cover all 29 days", () => {
    const { startDate, endDate } = getPeriodDateRange({
      year: 2024,
      month: 2,
      day: null,
    });
    const start = new Date(startDate);
    const end = new Date(endDate);
    expect(start.getDate()).toBe(1);
    expect(end.getDate()).toBe(29);
  });

  it("non-leap Feb: month bounds cover only 28 days", () => {
    const { endDate } = getPeriodDateRange({ year: 2026, month: 2, day: null });
    const end = new Date(endDate);
    expect(end.getDate()).toBe(28);
  });
});

describe("getPeriodDateRange — single day pinned", () => {
  it("returns the exact day's 00:00:00.000 through 23:59:59.999 bounds", () => {
    const { startDate, endDate } = getPeriodDateRange({
      year: 2026,
      month: 5,
      day: 17,
    });
    const start = new Date(startDate);
    const end = new Date(endDate);
    expect(start.getDate()).toBe(17);
    expect(start.getHours()).toBe(0);
    expect(end.getDate()).toBe(17);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
    expect(end.getSeconds()).toBe(59);
  });

  it("clamps an out-of-range day (e.g. day=31 in April) to the last valid day", () => {
    const { startDate, endDate } = getPeriodDateRange({
      year: 2026,
      month: 4,
      day: 31,
    });
    expect(new Date(startDate).getDate()).toBe(30);
    expect(new Date(endDate).getDate()).toBe(30);
  });
});

describe("getYearDateRange", () => {
  it("returns Jan 1 00:00:00.000 through Dec 31 23:59:59.999 of the given year", () => {
    const { startDate, endDate } = getYearDateRange(2025);
    const start = new Date(startDate);
    const end = new Date(endDate);
    expect(start.getFullYear()).toBe(2025);
    expect(start.getMonth()).toBe(0);
    expect(start.getDate()).toBe(1);
    expect(end.getFullYear()).toBe(2025);
    expect(end.getMonth()).toBe(11);
    expect(end.getDate()).toBe(31);
    expect(start.getTime()).toBeLessThan(end.getTime());
  });

  it("year rollover: two consecutive years never overlap", () => {
    const y2025 = getYearDateRange(2025);
    const y2026 = getYearDateRange(2026);
    expect(new Date(y2025.endDate).getTime()).toBeLessThan(
      new Date(y2026.startDate).getTime(),
    );
  });
});
