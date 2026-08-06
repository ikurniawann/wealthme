import { nextRenewalDate } from "./next-renewal-date.util";

// EPIC-023 E1 — same golden values as
// apps/web/src/app/(app)/asuransi/next-renewal-date.test.ts's `nextRenewalDate`
// (which this util mirrors exactly, operating on `Date` instead of an
// ISO-date string — see this file's own doc comment for why the algorithm is
// not re-derived a third time). Reusing the same hand-verified cases here
// proves the API-side port did not silently drift from the already-tested
// web behavior.
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

describe("nextRenewalDate (API util)", () => {
  it("advances a mid-month date by one month", () => {
    expect(
      isoDate(nextRenewalDate(new Date("2026-03-15T00:00:00.000Z"), "monthly")),
    ).toBe("2026-04-15");
  });

  it("clamps Jan 31 monthly to the last day of February", () => {
    expect(
      isoDate(nextRenewalDate(new Date("2024-01-31T00:00:00.000Z"), "monthly")),
    ).toBe("2024-02-29");
    expect(
      isoDate(nextRenewalDate(new Date("2025-01-31T00:00:00.000Z"), "monthly")),
    ).toBe("2025-02-28");
  });

  it("clamps Nov 30 quarterly to the last day of February", () => {
    expect(
      isoDate(
        nextRenewalDate(new Date("2023-11-30T00:00:00.000Z"), "quarterly"),
      ),
    ).toBe("2024-02-29");
  });

  it("clamps Feb 29 yearly to Feb 28 of the next year", () => {
    expect(
      isoDate(nextRenewalDate(new Date("2024-02-29T00:00:00.000Z"), "yearly")),
    ).toBe("2025-02-28");
  });

  it("crosses a year boundary on monthly advance", () => {
    expect(
      isoDate(nextRenewalDate(new Date("2026-12-31T00:00:00.000Z"), "monthly")),
    ).toBe("2027-01-31");
  });
});
