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
 *
 * EPIC-022 B7 hardening (adversarial review, HIGH finding) — every
 * assertion below on `getPeriodDateRange`/`getYearDateRange` output reads
 * either the exact UTC ISO string or `getUTC*` accessors, NEVER local
 * `Date` getters (`getDate()`, `getHours()`, `getFullYear()` without the
 * `UTC` prefix). Local getters read the *test runner's* timezone, which
 * only coincidentally matched WIB in the original sandbox — under
 * `TZ=UTC` (e.g. `ubuntu-latest` in CI, which sets no `TZ` at all) 7 of
 * these tests failed. The exact-UTC assertions below are correct under any
 * `process.env.TZ`; verified locally with `TZ=UTC` and
 * `TZ=America/New_York`.
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

// Every WIB (UTC+7) wall-clock instant below was computed by hand as
// `Date.UTC(...) - 7h`, matching `wibWallClockToIso` in laporan-period.ts.
// Asserting the exact resulting ISO string is TZ-runner-independent by
// construction — no local getter is involved anywhere in this file.
describe("getPeriodDateRange — whole month (no day pinned)", () => {
  it("returns first-of-month 00:00:00.000 through last-of-month 23:59:59.999, both WIB", () => {
    const { startDate, endDate } = getPeriodDateRange({
      year: 2026,
      month: 3,
      day: null,
    });
    // 2026-03-01 00:00:00.000 WIB (+07:00) = 2026-02-28 17:00:00.000 UTC.
    expect(startDate).toBe("2026-02-28T17:00:00.000Z");
    // 2026-03-31 23:59:59.999 WIB = 2026-03-31 16:59:59.999 UTC.
    expect(endDate).toBe("2026-03-31T16:59:59.999Z");
    expect(new Date(startDate).getTime()).toBeLessThan(
      new Date(endDate).getTime(),
    );
  });

  it("December → January rollover: December bounds stay within December WIB, not spilling into next year", () => {
    const { startDate, endDate } = getPeriodDateRange({
      year: 2025,
      month: 12,
      day: null,
    });
    // 2025-12-01 00:00:00.000 WIB = 2025-11-30 17:00:00.000 UTC.
    expect(startDate).toBe("2025-11-30T17:00:00.000Z");
    // 2025-12-31 23:59:59.999 WIB = 2025-12-31 16:59:59.999 UTC — still
    // 2025, not spilled into 2026.
    expect(endDate).toBe("2025-12-31T16:59:59.999Z");
  });

  it("January bounds start on Jan 1 WIB of the requested year (no bleed from December)", () => {
    const { startDate } = getPeriodDateRange({
      year: 2026,
      month: 1,
      day: null,
    });
    // 2026-01-01 00:00:00.000 WIB = 2025-12-31 17:00:00.000 UTC. The UTC
    // calendar date (Dec 31) differs from the WIB calendar date (Jan 1) —
    // that's the fixed 7-hour offset, not a bug; the WIB wall-clock value
    // this instant represents is unambiguously Jan 1, per the exact
    // `wibWallClockToIso(year, 0, 1, 0, 0, 0, 0)` construction.
    expect(startDate).toBe("2025-12-31T17:00:00.000Z");
  });

  it("leap Feb: month bounds cover all 29 days WIB", () => {
    const { startDate, endDate } = getPeriodDateRange({
      year: 2024,
      month: 2,
      day: null,
    });
    expect(startDate).toBe("2024-01-31T17:00:00.000Z"); // Feb 1 WIB
    expect(endDate).toBe("2024-02-29T16:59:59.999Z"); // Feb 29 23:59:59.999 WIB
  });

  it("non-leap Feb: month bounds cover only 28 days WIB", () => {
    const { endDate } = getPeriodDateRange({ year: 2026, month: 2, day: null });
    expect(endDate).toBe("2026-02-28T16:59:59.999Z"); // Feb 28 23:59:59.999 WIB
  });
});

describe("getPeriodDateRange — single day pinned", () => {
  it("returns the exact day's 00:00:00.000 through 23:59:59.999 WIB bounds", () => {
    const { startDate, endDate } = getPeriodDateRange({
      year: 2026,
      month: 5,
      day: 17,
    });
    // 2026-05-17 00:00:00.000 WIB = 2026-05-16 17:00:00.000 UTC.
    expect(startDate).toBe("2026-05-16T17:00:00.000Z");
    // 2026-05-17 23:59:59.999 WIB = 2026-05-17 16:59:59.999 UTC.
    expect(endDate).toBe("2026-05-17T16:59:59.999Z");
  });

  it("clamps an out-of-range day (e.g. day=31 in April) to the last valid day", () => {
    const { startDate, endDate } = getPeriodDateRange({
      year: 2026,
      month: 4,
      day: 31, // April has 30 days — clamped to 30
    });
    // 2026-04-30 00:00:00.000 WIB = 2026-04-29 17:00:00.000 UTC.
    expect(startDate).toBe("2026-04-29T17:00:00.000Z");
    // 2026-04-30 23:59:59.999 WIB = 2026-04-30 16:59:59.999 UTC.
    expect(endDate).toBe("2026-04-30T16:59:59.999Z");
  });
});

describe("getYearDateRange", () => {
  it("returns Jan 1 00:00:00.000 through Dec 31 23:59:59.999 WIB of the given year", () => {
    const { startDate, endDate } = getYearDateRange(2025);
    // 2025-01-01 00:00:00.000 WIB = 2024-12-31 17:00:00.000 UTC.
    expect(startDate).toBe("2024-12-31T17:00:00.000Z");
    // 2025-12-31 23:59:59.999 WIB = 2025-12-31 16:59:59.999 UTC.
    expect(endDate).toBe("2025-12-31T16:59:59.999Z");
    expect(new Date(startDate).getTime()).toBeLessThan(
      new Date(endDate).getTime(),
    );
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
