import { roundedShares } from "./shares";

describe("roundedShares", () => {
  it("rounds whole-percent shares so they always add up to 100", () => {
    // 62.6 / 37.4 rounded one by one gives 63 + 37; 62.5 / 37.5 gives 63 + 38.
    expect(roundedShares([625, 375])).toEqual([63, 37]);
    expect(roundedShares([1, 1, 1])).toEqual([34, 33, 33]);
    const shares = roundedShares([3, 3, 3, 3, 3, 3, 3]);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("returns zeros when there is nothing to share", () => {
    expect(roundedShares([0, 0])).toEqual([0, 0]);
    expect(roundedShares([])).toEqual([]);
  });
});
