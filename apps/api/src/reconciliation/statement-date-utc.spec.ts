import { parseStatementDate } from "./reconciliation-parsers";

/**
 * EPIC-029 — every date-only path must land on the SAME UTC instant,
 * whatever the server's timezone. `parseExplicitSlashDate` and
 * `parseExcelSerialDate` already built UTC midnight; the fallback built
 * LOCAL midnight, so `01 Aug 2026` (what Indonesian bank exports write)
 * imported as 2026-07-31T17:00:00.000Z under TZ=Asia/Jakarta — one day
 * early on a record reconciliation matches by date.
 *
 * Assertions are against fixed instants rather than values recomputed with
 * the same accessors the implementation uses, so they cannot restate the bug.
 */
describe("parseStatementDate — date-only values are UTC midnight", () => {
  it("parses the bank-export shape without shifting the day", () => {
    expect(parseStatementDate("01 Aug 2026").toISOString()).toBe(
      "2026-08-01T00:00:00.000Z",
    );
  });

  it("parses an ISO date-only value without shifting the day", () => {
    expect(parseStatementDate("2026-08-01").toISOString()).toBe(
      "2026-08-01T00:00:00.000Z",
    );
  });

  it("agrees with the explicit-format path for the same calendar date", () => {
    const viaFormat = parseStatementDate("01/08/2026", "DD/MM/YYYY");
    const viaFallback = parseStatementDate("01 Aug 2026");
    expect(viaFallback.toISOString()).toBe(viaFormat.toISOString());
  });

  it("keeps the instant when the value carries its own offset", () => {
    expect(parseStatementDate("2026-08-01T09:30:00+07:00").toISOString()).toBe(
      "2026-08-01T02:30:00.000Z",
    );
  });

  it("keeps the instant when the value carries a clock time", () => {
    // No zone given, so this names a local wall-clock time; the point is
    // only that it is NOT flattened to midnight.
    expect(parseStatementDate("01 Aug 2026 14:46").toISOString()).not.toBe(
      "2026-08-01T00:00:00.000Z",
    );
  });
});
