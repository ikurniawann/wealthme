import { sptTiming } from "./spt.engine";

describe("sptTiming", () => {
  it("tax year 2025 seen on 2026-09-26: past deadline, grace over", () => {
    expect(sptTiming(2025, "2026-09-26")).toMatchObject({
      deadline: "2026-03-31",
      graceUntil: "2026-04-30",
      daysToDeadline: -179,
      pastDeadline: true,
      withinGrace: false,
    });
  });
  it("tax year 2025 seen on 2026-04-15: within the penalty-waiver grace", () => {
    expect(sptTiming(2025, "2026-04-15")).toMatchObject({
      pastDeadline: true,
      withinGrace: true,
    });
  });
  it("deadline day itself is not late", () => {
    expect(sptTiming(2025, "2026-03-31")).toMatchObject({
      daysToDeadline: 0,
      pastDeadline: false,
      withinGrace: false,
    });
  });
  it("tax year 2026: 186 days left, no grace known", () => {
    expect(sptTiming(2026, "2026-09-26")).toMatchObject({
      deadline: "2027-03-31",
      graceUntil: null,
      daysToDeadline: 186,
    });
  });
});
