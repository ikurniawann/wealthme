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
  resolvePreset,
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

// EPIC-023 Task B (B1) — RED phase. `resolvePreset` does not exist yet;
// this pins the date-range-preset contract Task B must land: This Month ·
// Last Month · Last 3/6/12 Months · This Year · Last Year · Custom.
//
// Every boundary below is computed BY HAND against a fixed anchor `now`
// (2026-08-05T10:00 WIB), the same convention the rest of this file already
// follows for `getPeriodDateRange`/`getYearDateRange` — never recomputed
// from `resolvePreset`'s own arithmetic, so a wrong implementation actually
// fails these assertions instead of trivially matching them.
//
// Preset semantics assumed here (no contract existed before this test) —
// documented so whoever lands B1 knows exactly what is pinned:
//   - thisMonth         : [month-start 00:00 WIB, TODAY 23:59:59.999 WIB] (to-date)
//   - lastMonth         : the full previous calendar month
//   - last3/6/12Months  : trailing N-month window ENDING TODAY (to-date),
//     starting on the anchor's day-of-month N months back, clamped into the
//     target month exactly like `clampDayToMonth` above (leap-year aware,
//     since it is built on the same `daysInMonth`)
//   - thisYear          : [Jan 1 this year 00:00 WIB, TODAY 23:59:59.999 WIB]
//   - lastYear          : the full previous calendar year
//   - custom            : an explicit { start: {year,month,day}, end: {...} }
//     range, WIB-pinned the same way `getPeriodDateRange`'s single-day
//     branch already is; throws without one — there is no default "custom" window
describe("resolvePreset — date-range presets (EPIC-023 B1)", () => {
  // Anchor: 2026-08-05 10:00:00 WIB (+07:00) = 2026-08-05T03:00:00.000Z.
  const NOW = new Date("2026-08-05T03:00:00.000Z");

  it("thisMonth: month-start through TODAY's last WIB instant", () => {
    const { startDate, endDate } = resolvePreset("thisMonth", NOW);
    // Aug 1 2026 00:00:00.000 WIB = Jul 31 2026 17:00:00.000 UTC.
    expect(startDate).toBe("2026-07-31T17:00:00.000Z");
    // Aug 5 2026 23:59:59.999 WIB = Aug 5 2026 16:59:59.999 UTC.
    expect(endDate).toBe("2026-08-05T16:59:59.999Z");
  });

  it("lastMonth: the full previous calendar month (Jul 2026)", () => {
    const { startDate, endDate } = resolvePreset("lastMonth", NOW);
    expect(startDate).toBe("2026-06-30T17:00:00.000Z"); // Jul 1 00:00 WIB
    expect(endDate).toBe("2026-07-31T16:59:59.999Z"); // Jul 31 23:59:59.999 WIB
  });

  it("last3Months: trailing 3 months (May 5 – Aug 5) ending TODAY", () => {
    const { startDate, endDate } = resolvePreset("last3Months", NOW);
    expect(startDate).toBe("2026-05-04T17:00:00.000Z"); // May 5 00:00 WIB
    expect(endDate).toBe("2026-08-05T16:59:59.999Z");
  });

  it("last6Months: trailing 6 months (Feb 5 – Aug 5) ending TODAY", () => {
    const { startDate, endDate } = resolvePreset("last6Months", NOW);
    expect(startDate).toBe("2026-02-04T17:00:00.000Z"); // Feb 5 00:00 WIB
    expect(endDate).toBe("2026-08-05T16:59:59.999Z");
  });

  it("last12Months: trailing 12 months (Aug 5 2025 – Aug 5 2026) ending TODAY", () => {
    const { startDate, endDate } = resolvePreset("last12Months", NOW);
    expect(startDate).toBe("2025-08-04T17:00:00.000Z"); // Aug 5 2025 00:00 WIB
    expect(endDate).toBe("2026-08-05T16:59:59.999Z");
  });

  it("thisYear: Jan 1 this year through TODAY's last WIB instant", () => {
    const { startDate, endDate } = resolvePreset("thisYear", NOW);
    expect(startDate).toBe("2025-12-31T17:00:00.000Z"); // Jan 1 2026 00:00 WIB
    expect(endDate).toBe("2026-08-05T16:59:59.999Z");
  });

  it("lastYear: the full previous calendar year (2025) — independently cross-checked against the already-verified getYearDateRange(2025)", () => {
    const { startDate, endDate } = resolvePreset("lastYear", NOW);
    expect(startDate).toBe("2024-12-31T17:00:00.000Z");
    expect(endDate).toBe("2025-12-31T16:59:59.999Z");
    // Bonus cross-check against a DIFFERENT, already-implemented function —
    // not a re-run of resolvePreset's own arithmetic.
    const independentlyComputed = getYearDateRange(2025);
    expect(startDate).toBe(independentlyComputed.startDate);
    expect(endDate).toBe(independentlyComputed.endDate);
  });

  it("custom: an explicit start/end range, WIB-pinned like getPeriodDateRange's single-day branch", () => {
    const { startDate, endDate } = resolvePreset("custom", NOW, {
      start: { year: 2026, month: 6, day: 10 },
      end: { year: 2026, month: 7, day: 20 },
    });
    expect(startDate).toBe("2026-06-09T17:00:00.000Z"); // Jun 10 00:00 WIB
    expect(endDate).toBe("2026-07-20T16:59:59.999Z"); // Jul 20 23:59:59.999 WIB
  });

  it("custom: throws a specific 'range required' error without an explicit range — there is no default 'custom' window", () => {
    // A bare `.toThrow()` (no message match) would pass today for the WRONG
    // reason — `resolvePreset` doesn't exist yet, so ANY call throws
    // "... is not a function", which is not the contract being pinned.
    // Matching the message keeps this genuinely RED until the real
    // validation exists, and genuinely GREEN only once it does.
    expect(() => resolvePreset("custom", NOW)).toThrow(/custom.*range/i);
  });

  // EPIC-023 Task B retry (MEDIUM) — an inverted range used to silently
  // produce `startDate > endDate` (every downstream `gte`/`lte` query then
  // matches nothing, with no signal why). Guard it explicitly.
  it("custom: throws when end is before start — an inverted range must not silently yield startDate > endDate", () => {
    expect(() =>
      resolvePreset("custom", NOW, {
        start: { year: 2026, month: 7, day: 20 },
        end: { year: 2026, month: 6, day: 10 },
      }),
    ).toThrow(/end.*(on or after|before).*start/i);
  });

  it("custom: a single-day range (start === end) is valid, not an inversion", () => {
    const { startDate, endDate } = resolvePreset("custom", NOW, {
      start: { year: 2026, month: 6, day: 10 },
      end: { year: 2026, month: 6, day: 10 },
    });
    expect(startDate).toBe("2026-06-09T17:00:00.000Z");
    expect(endDate).toBe("2026-06-10T16:59:59.999Z");
  });

  // Month-length edges (leap years, 31-day months, year rollovers) — built
  // on the same `daysInMonth`/`clampDayToMonth` already proven above.
  describe("month-length edges", () => {
    it("last3Months from May 31 clamps the start day into February (28 days, non-leap 2026)", () => {
      const anchor = new Date("2026-05-31T08:00:00.000Z"); // 2026-05-31T15:00 WIB
      const { startDate, endDate } = resolvePreset("last3Months", anchor);
      expect(startDate).toBe("2026-02-27T17:00:00.000Z"); // Feb 28 2026 00:00 WIB (31 clamped to 28)
      expect(endDate).toBe("2026-05-31T16:59:59.999Z"); // May 31 2026 23:59:59.999 WIB
    });

    it("last3Months from Feb 29 (leap year 2024) rolls back into November of the PREVIOUS year — no clamp needed", () => {
      const anchor = new Date("2024-02-29T05:00:00.000Z"); // 2024-02-29T12:00 WIB
      const { startDate, endDate } = resolvePreset("last3Months", anchor);
      expect(startDate).toBe("2023-11-28T17:00:00.000Z"); // Nov 29 2023 00:00 WIB
      expect(endDate).toBe("2024-02-29T16:59:59.999Z"); // Feb 29 2024 23:59:59.999 WIB — the leap day itself, not rolled to Mar 1
    });

    it("lastMonth from a January anchor rolls back into December of the PREVIOUS year", () => {
      const anchor = new Date("2026-01-15T02:00:00.000Z"); // 2026-01-15T09:00 WIB
      const { startDate, endDate } = resolvePreset("lastMonth", anchor);
      expect(startDate).toBe("2025-11-30T17:00:00.000Z"); // Dec 1 2025 00:00 WIB
      expect(endDate).toBe("2025-12-31T16:59:59.999Z"); // Dec 31 2025 23:59:59.999 WIB
    });
  });

  // EPIC-023 B1 explicit requirement — "date-range presets under a non-WIB
  // TZ". If a wrong implementation reads local `Date` getters
  // (`.getMonth()`, `.getDate()`, `.getFullYear()` without the `UTC` prefix)
  // instead of computing the WIB wall-clock date from the UTC instant, these
  // fail under a non-WIB `process.env.TZ` even though they pass by
  // coincidence under WIB/UTC.
  describe("a non-WIB TZ must not change any preset boundary", () => {
    const originalTz = process.env.TZ;

    afterEach(() => {
      process.env.TZ = originalTz;
    });

    it("thisMonth is identical under America/New_York as under UTC", () => {
      for (const tz of ["UTC", "America/New_York"]) {
        process.env.TZ = tz;
        const { startDate, endDate } = resolvePreset("thisMonth", NOW);
        expect(startDate).toBe("2026-07-31T17:00:00.000Z");
        expect(endDate).toBe("2026-08-05T16:59:59.999Z");
      }
    });

    it("last3Months is identical under America/New_York as under UTC", () => {
      for (const tz of ["UTC", "America/New_York"]) {
        process.env.TZ = tz;
        const { startDate, endDate } = resolvePreset("last3Months", NOW);
        expect(startDate).toBe("2026-05-04T17:00:00.000Z");
        expect(endDate).toBe("2026-08-05T16:59:59.999Z");
      }
    });
  });
});
