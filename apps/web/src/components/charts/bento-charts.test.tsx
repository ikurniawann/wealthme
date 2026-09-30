import { niceCeil } from "./bento-charts";

describe("niceCeil (chart axis top, prototype `nice`)", () => {
  test.each([
    [0, 1],
    [-5, 1],
    [0.8, 1],
    [1, 1],
    [1.4, 2],
    [2.2, 2.5],
    [3, 5],
    [7, 10],
    [84_320_500, 100_000_000],
    [21_000_000, 25_000_000],
  ])("%p rounds up to %p", (value, expected) => {
    expect(niceCeil(value)).toBe(expected);
  });
});
