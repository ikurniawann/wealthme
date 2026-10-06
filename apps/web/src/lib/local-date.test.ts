import { localIsoDate } from "./local-date";

describe("localIsoDate", () => {
  it("uses the local calendar day, not the UTC day", () => {
    // 00:30 local on the 7th: the UTC day is the 6th wherever the zone is ahead
    // of UTC, but the local day must stay the 7th in every zone.
    expect(localIsoDate(new Date(2026, 9, 7, 0, 30))).toBe("2026-10-07");
    expect(localIsoDate(new Date(2026, 9, 7, 23, 59))).toBe("2026-10-07");
  });

  it("zero-pads month and day", () => {
    expect(localIsoDate(new Date(2026, 0, 5, 12))).toBe("2026-01-05");
  });
});
