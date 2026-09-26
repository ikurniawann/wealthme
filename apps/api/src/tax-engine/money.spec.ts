import { applyBps, divHalfUp, floorTo, parseDigits } from "./money";

describe("tax money helpers", () => {
  it("divHalfUp rounds .5 up and below .5 down", () => {
    expect(divHalfUp(5n, 2n)).toBe(3n);
    expect(divHalfUp(7n, 3n)).toBe(2n);
    expect(divHalfUp(0n, 7n)).toBe(0n);
  });
  it("divHalfUp refuses negatives and zero divisors", () => {
    expect(() => divHalfUp(-1n, 2n)).toThrow(RangeError);
    expect(() => divHalfUp(1n, 0n)).toThrow(RangeError);
  });
  it("applyBps is round-half-up on basis points", () => {
    expect(applyBps(1_234_567n, 2000)).toBe(246_913n);
    expect(applyBps(123_456_789n, 50)).toBe(617_284n);
    expect(applyBps(5_400_001n, 25)).toBe(13_500n);
  });
  it("floorTo floors positives and clamps non-positives to 0", () => {
    expect(floorTo(4_172_838n, 1000n)).toBe(4_172_000n);
    expect(floorTo(-5n, 1000n)).toBe(0n);
  });
  it("parseDigits accepts digit strings only, capped at the 15-digit wire limit (TAX_DIGITS)", () => {
    expect(parseDigits("0012")).toBe(12n);
    expect(parseDigits("999999999999999")).toBe(999_999_999_999_999n); // 15 digits: OK
    expect(() => parseDigits("1000000000000000")).toThrow(RangeError); // 16 digits: over the cap
    expect(() => parseDigits("1e21")).toThrow(RangeError);
    expect(() => parseDigits("")).toThrow(RangeError);
  });
});
