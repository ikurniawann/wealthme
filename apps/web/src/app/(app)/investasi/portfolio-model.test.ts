import { historyLabels } from "./portfolio-model";

describe("historyLabels", () => {
  it("keeps the plain date when each day has one point", () => {
    expect(
      historyLabels([
        { date: "2026-10-20", valueIdr: "1" },
        { date: "2026-10-21", valueIdr: "2" },
      ]),
    ).toEqual(["2026-10-20", "2026-10-21"]);
  });

  it("adds Jakarta clock time when a day has several points", () => {
    expect(
      historyLabels([
        { date: "2026-10-21", at: "2026-10-20T17:00:00.000Z", valueIdr: "1" },
        { date: "2026-10-21", at: "2026-10-21T05:30:00.000Z", valueIdr: "2" },
      ]),
    ).toEqual(["2026-10-21 00:00", "2026-10-21 12:30"]);
  });
});
