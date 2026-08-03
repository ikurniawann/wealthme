import {
  amountsMatchTotal,
  computeRemainder,
  splitRemainderEvenly,
  sumCustomAmounts,
} from "./split-math";

describe("sumCustomAmounts", () => {
  it("sums parsed amounts across the listed participants", () => {
    const sum = sumCustomAmounts([1, 2, 3], {
      1: "50.000",
      2: "25.000",
      3: "25.000",
    });

    expect(sum).toBe(100_000);
  });

  it("treats blank/missing entries as zero", () => {
    const sum = sumCustomAmounts([1, 2], { 1: "50.000" });

    expect(sum).toBe(50_000);
  });
});

describe("computeRemainder", () => {
  it("returns the unallocated amount when the sum is under total", () => {
    const remainder = computeRemainder(100_000, [1, 2], { 1: "40.000" });

    expect(remainder).toBe(60_000);
  });

  it("returns zero when the sum exactly matches total", () => {
    const remainder = computeRemainder(100_000, [1, 2], {
      1: "50.000",
      2: "50.000",
    });

    expect(remainder).toBe(0);
  });

  it("returns a negative number when over-allocated", () => {
    const remainder = computeRemainder(100_000, [1, 2], {
      1: "70.000",
      2: "50.000",
    });

    expect(remainder).toBe(-20_000);
  });
});

describe("amountsMatchTotal", () => {
  it("is true only when the sum equals total exactly", () => {
    expect(
      amountsMatchTotal(100_000, [1, 2], { 1: "50.000", 2: "50.000" }),
    ).toBe(true);
    expect(
      amountsMatchTotal(100_000, [1, 2], { 1: "50.000", 2: "40.000" }),
    ).toBe(false);
  });
});

describe("splitRemainderEvenly", () => {
  it("divides the remainder evenly among unfilled participants", () => {
    const next = splitRemainderEvenly(90_000, [1, 2, 3], { 1: "30.000" });

    // Remainder is 60.000 split across participants 2 and 3 -> 30.000 each.
    expect(next[1]).toBe("30.000");
    expect(next[2]).toBe("30.000");
    expect(next[3]).toBe("30.000");
  });

  it("puts integer-division leftover on the last unfilled participant", () => {
    const next = splitRemainderEvenly(100_000, [1, 2, 3], {});

    // 100.000 / 3 = 33.333 remainder 1 -> last participant gets the extra rupiah.
    expect(next[1]).toBe("33.333");
    expect(next[2]).toBe("33.333");
    expect(next[3]).toBe("33.334");
    expect(sumCustomAmounts([1, 2, 3], next as Record<number, string>)).toBe(
      100_000,
    );
  });

  it("leaves already-filled participants untouched", () => {
    const next = splitRemainderEvenly(100_000, [1, 2], { 1: "70.000" });

    expect(next[1]).toBe("70.000");
    expect(next[2]).toBe("30.000");
  });

  it("no-ops when every participant already has a value", () => {
    const amounts = { 1: "50.000", 2: "50.000" };
    const next = splitRemainderEvenly(100_000, [1, 2], amounts);

    expect(next).toEqual(amounts);
  });

  it("no-ops instead of assigning a negative share when over-allocated", () => {
    const next = splitRemainderEvenly(100_000, [1, 2, 3], {
      1: "120.000",
    });

    expect(next[2]).toBeUndefined();
    expect(next[3]).toBeUndefined();
  });
});

describe("zero-total behavior", () => {
  it("computeRemainder returns 0 for an unset total with no amounts (UI must not treat this as balanced)", () => {
    expect(computeRemainder(0, [1, 2], {})).toBe(0);
  });
});
