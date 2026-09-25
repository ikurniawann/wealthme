import { filterByOccurredAt, localDateKey } from "./history-filter";

const rows = [
  { id: "a", occurredAt: "2026-03-01T03:00:00.000Z" },
  { id: "b", occurredAt: "2026-03-01T18:30:00.000Z" },
  { id: "c", occurredAt: "2026-03-15T03:00:00.000Z" },
  { id: "d", occurredAt: "2026-03-31T16:59:00.000Z" },
];

describe("localDateKey", () => {
  it("uses the WIB calendar day, not the UTC one", () => {
    const year = jest
      .spyOn(Date.prototype, "getFullYear")
      .mockReturnValue(2026);
    const month = jest.spyOn(Date.prototype, "getMonth").mockReturnValue(1);
    const day = jest.spyOn(Date.prototype, "getDate").mockReturnValue(1);
    try {
      expect(localDateKey("2026-03-01T18:30:00.000Z")).toBe("2026-03-02");
    } finally {
      year.mockRestore();
      month.mockRestore();
      day.mockRestore();
    }
  });
});

describe("filterByOccurredAt (Revisi D item 8b)", () => {
  it("returns everything when both bounds are empty", () => {
    expect(filterByOccurredAt(rows, "", "").map((r) => r.id)).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
  });

  it("includes both the from day and the to day", () => {
    expect(
      filterByOccurredAt(rows, "2026-03-02", "2026-03-15").map((r) => r.id),
    ).toEqual(["b", "c"]);
  });

  it("puts a 23:59 WIB instant on its own WIB day", () => {
    expect(
      filterByOccurredAt(rows, "2026-03-31", "2026-03-31").map((r) => r.id),
    ).toEqual(["d"]);
  });

  it("supports an open-ended range", () => {
    expect(filterByOccurredAt(rows, "2026-03-15", "").map((r) => r.id)).toEqual(
      ["c", "d"],
    );
    expect(filterByOccurredAt(rows, "", "2026-03-01").map((r) => r.id)).toEqual(
      ["a"],
    );
  });
});
