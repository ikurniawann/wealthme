/**
 * EPIC-024 Task C review fix — regression coverage for the lot<->lembar
 * (1 lot = 100 lembar) conversion the review gate flagged as HIGH: plain
 * `parseFloat`/`String()` round-tripping drifts for odd-lot values (e.g.
 * `7 / 100 * 100 === 7.000000000000001` in JS). These tests pin the exact,
 * float-free behavior of the extracted pure helpers.
 */

import {
  canonicalizeSahamQuantity,
  convertQuantityDisplay,
  divideBy100,
  multiplyBy100,
} from "./quantity-conversion";

describe("multiplyBy100 / divideBy100", () => {
  it("10 lot -> 1000 lembar exactly (no float drift)", () => {
    expect(multiplyBy100("10")).toBe("1000");
  });

  it("7 lembar -> lot -> lembar round-trips to exactly 7 (odd-lot case)", () => {
    const asLot = divideBy100("7");
    expect(asLot).toBe("0.07");
    const backToLembar = multiplyBy100(asLot);
    expect(backToLembar).toBe("7");
  });

  it("does not produce a floating-point artifact like 7.000000000000001", () => {
    const result = multiplyBy100(divideBy100("7"));
    expect(result).toBe("7");
    expect(result).not.toContain("000000000000");
  });

  it("passes through a non-numeric value unchanged", () => {
    expect(multiplyBy100("")).toBe("");
    expect(divideBy100("abc")).toBe("abc");
  });
});

describe("convertQuantityDisplay", () => {
  it("lot -> lembar: 10 lot displays as 1000 lembar", () => {
    expect(convertQuantityDisplay("10", "lot", "lembar")).toBe("1000");
  });

  it("lembar -> lot -> lembar: odd-lot 7 lembar returns to exactly 7", () => {
    const asLot = convertQuantityDisplay("7", "lembar", "lot");
    const backToLembar = convertQuantityDisplay(asLot, "lot", "lembar");
    expect(backToLembar).toBe("7");
  });

  it("same unit is a no-op", () => {
    expect(convertQuantityDisplay("1000", "lembar", "lembar")).toBe("1000");
  });
});

describe("canonicalizeSahamQuantity (submit-time)", () => {
  it("10 lot canonicalizes to exactly 1000 lembar", () => {
    expect(canonicalizeSahamQuantity("10", "lot")).toBe("1000");
  });

  it("editing an existing 1000-lembar holding WITHOUT touching the unit toggle re-submits exactly 1000 (idempotency)", () => {
    // Simulates AddInvestmentModal's edit-mode default: quantity is already
    // canonical lembar, quantityUnit defaults to "lembar" — no multiply
    // should ever be applied.
    expect(canonicalizeSahamQuantity("1000", "lembar")).toBe("1000");
  });

  it("odd-lot 7 lembar, toggled lembar -> lot -> lembar, canonicalizes back to exactly 7", () => {
    const displayedAsLot = convertQuantityDisplay("7", "lembar", "lot");
    expect(displayedAsLot).toBe("0.07");
    expect(canonicalizeSahamQuantity(displayedAsLot, "lot")).toBe("7");
  });

  it("1000 lembar entered directly (lembar path) matches the 10-lot canonical path exactly", () => {
    const viaLot = canonicalizeSahamQuantity("10", "lot");
    const viaLembar = canonicalizeSahamQuantity("1000", "lembar");
    expect(viaLot).toBe(viaLembar);
    expect(viaLot).toBe("1000");
  });
});
