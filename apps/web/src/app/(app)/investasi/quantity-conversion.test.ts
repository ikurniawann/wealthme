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
  gramsToKg,
  kgToGrams,
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

// B9 follow-up (client revision round 2) — gold holdings are stored in
// grams (unchanged) but the user explicitly chose "Per kilogram"
// display/entry. Same exact BigInt-scaled math as multiplyBy100/divideBy100
// above (÷1000/×1000 only ever shifts the decimal point), so it must be
// just as drift-free and idempotent.
describe("gramsToKg / kgToGrams (B9 follow-up)", () => {
  it("25 g displays as exactly 0.025 kg", () => {
    expect(gramsToKg("25")).toBe("0.025");
  });

  it("entering 0.025 kg stores exactly 25 g", () => {
    expect(kgToGrams("0.025")).toBe("25");
  });

  it("an edit round-trip (g -> kg -> g) is idempotent", () => {
    const asKg = gramsToKg("25");
    expect(asKg).toBe("0.025");
    const backToGrams = kgToGrams(asKg);
    expect(backToGrams).toBe("25");
  });

  it("a kg round-trip (kg -> g -> kg) is idempotent for an odd value", () => {
    const asGrams = kgToGrams("0.0105");
    expect(asGrams).toBe("10.5");
    const backToKg = gramsToKg(asGrams);
    expect(backToKg).toBe("0.0105");
  });

  it("does not produce a floating-point artifact (0.025 * 1000 !== 25 in raw JS float math)", () => {
    const result = kgToGrams(gramsToKg("25"));
    expect(result).toBe("25");
    expect(result).not.toContain("000000000000");
  });

  it("passes through a non-numeric value unchanged", () => {
    expect(gramsToKg("")).toBe("");
    expect(kgToGrams("abc")).toBe("abc");
  });
});

// B9 follow-up — the report's exactness requirement: "current value = kg ×
// price per kg" must equal "grams × (price per kg / 1000)" to the rupiah.
// The web UI never recomputes this itself (the API's Decimal-based
// grams × price-per-gram stays the system of record, unchanged by this
// follow-up) — this test proves the kg/gram conversion this UI DOES do
// can't introduce a mismatch, for a real Antam-shaped price.
describe("gold value math stays consistent between kg and gram (B9 follow-up)", () => {
  it("25 g at a real Antam per-kg price equals 0.025 kg at that same price, exact to the rupiah", () => {
    const pricePerKgIdr = "2537600000"; // 2026-09-28 Antam 1kg bar (see revisi-2-report.md B9).
    const quantityGrams = "25";
    const quantityKg = gramsToKg(quantityGrams); // "0.025"
    expect(quantityKg).toBe("0.025");

    const pricePerGramIdr = Number(pricePerKgIdr) / 1000; // the API's actual per-gram price
    const valueViaGrams = Number(quantityGrams) * pricePerGramIdr;
    const valueViaKg = Number(quantityKg) * Number(pricePerKgIdr);

    expect(valueViaKg).toBe(valueViaGrams);
    expect(valueViaKg).toBe(63440000);
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
