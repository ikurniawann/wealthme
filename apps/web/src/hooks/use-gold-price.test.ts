/**
 * EPIC-021 Group F (#6) — gold-equivalent math.
 *
 * `toGoldGrams` is the pure conversion at the heart of `useGoldPrice`:
 * grams = value (IDR) / price-per-gram (IDR), and it must return `null`
 * (never a fabricated number) when no price has been set — the manual
 * gold price is master data, not a live feed (Open Design Decision #6).
 *
 * Imports directly from `./gold-price-math` (not `./use-gold-price`) so this
 * test doesn't pull in the `useSession`/`better-auth` ESM import chain,
 * which needs a mocked `auth-client` to load under Jest.
 */

import { toGoldGrams } from "./gold-price-math";

describe("toGoldGrams", () => {
  it("converts an IDR value to grams using the given price per gram", () => {
    expect(toGoldGrams(1_150_000, 1_150_000)).toBe(1);
    expect(toGoldGrams(11_500_000, 1_150_000)).toBe(10);
  });

  it("returns a fractional gram amount for values that don't divide evenly", () => {
    const grams = toGoldGrams(1_000_000, 1_150_000);
    expect(grams).toBeCloseTo(0.8695652, 5);
  });

  it("returns null when no price has been set (null path)", () => {
    expect(toGoldGrams(1_000_000, null)).toBeNull();
  });

  it("returns null for a non-positive price (defensive, should never persist)", () => {
    expect(toGoldGrams(1_000_000, 0)).toBeNull();
    expect(toGoldGrams(1_000_000, -1)).toBeNull();
  });

  it("returns 0 grams for a zero net worth with a valid price", () => {
    expect(toGoldGrams(0, 1_150_000)).toBe(0);
  });
});
