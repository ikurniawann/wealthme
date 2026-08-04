/**
 * EPIC-020 Task B — shared /laporan year/month(/day) period filter.
 *
 * Verifies the pure date-bounds helpers that map a
 * `{ year, month, day? }` selection to ISO `startDate`/`endDate` bounds used
 * to drive every report section's query. A real, Jest-executed spec (see
 * `format.test.ts` for the same "avoid a dead `.test.mjs`" precedent this
 * repo has followed before — see `laporan-utils.test.ts` for the EPIC-022
 * B1/B2 case where a stale hand-maintained `.js` mirror was actively hiding
 * new exports from Jest and was removed rather than kept in sync by hand).
 */

import {
  clampDayToMonth,
  daysInMonth,
  getPeriodDateRange,
  getYearDateRange,
  REPORT_TIMEZONE_LABEL,
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

// EPIC-022 B7 — the bounds must be the same UTC instant no matter which
// timezone the process computing them is running in. These assertions read
// UTC components (never local getters, which would themselves depend on the
// test runner's TZ) so they hold under any `process.env.TZ`.
describe("getPeriodDateRange / getYearDateRange — pinned to WIB (Asia/Jakarta, UTC+7)", () => {
  const originalTz = process.env.TZ;

  afterEach(() => {
    process.env.TZ = originalTz;
  });

  it("a whole-month range is midnight WIB regardless of the runner's local TZ", () => {
    for (const tz of ["UTC", "America/New_York", "Pacific/Kiritimati"]) {
      process.env.TZ = tz;
      const { startDate, endDate } = getPeriodDateRange({
        year: 2026,
        month: 3,
        day: null,
      });
      // Midnight WIB (2026-03-01 00:00 +07:00) is 2026-02-28 17:00 UTC.
      expect(startDate).toBe("2026-02-28T17:00:00.000Z");
      // 23:59:59.999 WIB on the last day of March (31st) is 16:59:59.999
      // UTC the same day.
      expect(endDate).toBe("2026-03-31T16:59:59.999Z");
    }
  });

  it("a single pinned day is midnight-to-midnight WIB regardless of the runner's local TZ", () => {
    for (const tz of ["UTC", "America/New_York"]) {
      process.env.TZ = tz;
      const { startDate, endDate } = getPeriodDateRange({
        year: 2026,
        month: 5,
        day: 17,
      });
      expect(startDate).toBe("2026-05-16T17:00:00.000Z");
      expect(endDate).toBe("2026-05-17T16:59:59.999Z");
    }
  });

  it("a year range is Jan 1 – Dec 31 WIB regardless of the runner's local TZ", () => {
    for (const tz of ["UTC", "America/New_York"]) {
      process.env.TZ = tz;
      const { startDate, endDate } = getYearDateRange(2025);
      expect(startDate).toBe("2024-12-31T17:00:00.000Z");
      expect(endDate).toBe("2025-12-31T16:59:59.999Z");
    }
  });

  it("exposes a human-readable timezone label for the period-filter disclosure", () => {
    expect(REPORT_TIMEZONE_LABEL).toBe("WIB (UTC+7)");
  });
});
