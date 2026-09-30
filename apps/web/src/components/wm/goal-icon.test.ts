import { goalIconKind } from "./goal-icon";

describe("goalIconKind", () => {
  test.each([
    ["🛡️", "Dana Darurat", "safety"],
    ["✈️", "Liburan Jepang", "travel"],
    ["🏠", "DP Rumah", "home"],
    ["🏖️", "Dana Pensiun", "holiday"],
    ["🚗", "", "vehicle"],
    ["🎓", "", "education"],
  ])("maps emoji %s", (icon, name, kind) => {
    expect(goalIconKind(icon, name)).toBe(kind);
  });

  test("falls back to the goal name, then to the default", () => {
    expect(goalIconKind(null, "Dana Pensiun")).toBe("retirement");
    expect(goalIconKind("", "Kuliah Hima")).toBe("education");
    expect(goalIconKind("🦄", "Sesuatu")).toBe("other");
  });
});
