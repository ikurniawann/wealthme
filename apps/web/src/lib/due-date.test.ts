import {
  DUE_SOON_DAYS,
  daysUntilDue,
  dueState,
  nextDueWithin,
} from "./due-date";

// Local noon: stays on the same calendar day in every timezone the CI may use.
const NOW = new Date(2026, 9, 6, 12, 0, 0);

describe("daysUntilDue", () => {
  it("counts whole calendar days, treating the due ISO day as the date", () => {
    expect(daysUntilDue("2026-10-06T00:00:00.000Z", NOW)).toBe(0);
    expect(daysUntilDue("2026-10-21T00:00:00.000Z", NOW)).toBe(15);
    expect(daysUntilDue("2026-10-05T00:00:00.000Z", NOW)).toBe(-1);
  });
});

describe("dueState", () => {
  it("is soon on the boundary day and later one day after it", () => {
    expect(dueState("2026-10-13T00:00:00.000Z", { now: NOW }).state).toBe(
      "soon",
    );
    expect(dueState("2026-10-14T00:00:00.000Z", { now: NOW }).state).toBe(
      "later",
    );
    expect(DUE_SOON_DAYS).toBe(7);
  });

  it("is not overdue on the due day itself, overdue the day after", () => {
    expect(dueState("2026-10-06T00:00:00.000Z", { now: NOW }).state).toBe(
      "soon",
    );
    expect(dueState("2026-10-05T00:00:00.000Z", { now: NOW }).state).toBe(
      "overdue",
    );
  });

  it("lets the API late flag override the date heuristic", () => {
    expect(
      dueState("2026-10-20T00:00:00.000Z", { now: NOW, isLate: true }).state,
    ).toBe("overdue");
    expect(
      dueState("2026-10-05T00:00:00.000Z", { now: NOW, isLate: false }).state,
    ).toBe("soon");
  });
});

describe("nextDueWithin", () => {
  const kpr = { name: "KPR", nextDueDate: "2026-10-21T00:00:00.000Z" };
  const card = { name: "Kartu", nextDueDate: "2026-10-09T00:00:00.000Z" };
  const legacy = {
    name: "Lama",
    nextDueDate: null,
    dueDate: "2026-10-07T00:00:00.000Z",
  };

  it("returns undefined when every installment is further out than the window", () => {
    expect(nextDueWithin([kpr], 7, NOW)).toBeUndefined();
  });

  it("returns the earliest installment inside the window", () => {
    expect(nextDueWithin([kpr, card, legacy], 7, NOW)?.name).toBe("Lama");
    expect(nextDueWithin([kpr, card], 7, NOW)?.name).toBe("Kartu");
  });

  it("widens with the requested window", () => {
    expect(nextDueWithin([kpr], 15, NOW)?.name).toBe("KPR");
  });

  it("includes overdue installments and ignores rows without a due date", () => {
    const late = { name: "Telat", nextDueDate: "2026-10-01T00:00:00.000Z" };
    const noDue = { name: "Tanpa", nextDueDate: null };
    expect(nextDueWithin([kpr, noDue, late], 7, NOW)?.name).toBe("Telat");
  });
});
