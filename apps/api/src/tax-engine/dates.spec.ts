import {
  daysBetween,
  maxDate,
  minDate,
  wibDateToUtc,
  wibYearStartUtc,
} from "./dates";

it("daysBetween counts calendar days", () => {
  expect(daysBetween("2026-03-01", "2027-01-01")).toBe(306);
  expect(daysBetween("2026-09-26", "2026-03-31")).toBe(-179);
  expect(maxDate("2026-01-01", "2025-06-01")).toBe("2026-01-01");
  expect(minDate("2027-01-01", "2026-12-31")).toBe("2026-12-31");
});

it("wibDateToUtc converts a WIB calendar date to its UTC instant", () => {
  expect(wibDateToUtc("2026-01-01").toISOString()).toBe(
    "2025-12-31T17:00:00.000Z",
  );
});

it("wibYearStartUtc is WIB midnight on 1 Jan of that year", () => {
  expect(wibYearStartUtc(2026).toISOString()).toBe("2025-12-31T17:00:00.000Z");
});
