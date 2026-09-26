import { daysBetween, maxDate, minDate } from "./dates";

it("daysBetween counts calendar days", () => {
  expect(daysBetween("2026-03-01", "2027-01-01")).toBe(306);
  expect(daysBetween("2026-09-26", "2026-03-31")).toBe(-179);
  expect(maxDate("2026-01-01", "2025-06-01")).toBe("2026-01-01");
  expect(minDate("2027-01-01", "2026-12-31")).toBe("2026-12-31");
});
