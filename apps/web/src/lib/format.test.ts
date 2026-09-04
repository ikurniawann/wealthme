/**
 * EPIC-016 Task B2 — formatRupiah currency overload.
 *
 * Verifies that:
 * 1. `formatRupiah(value)` with ONE argument produces the exact same byte-for-byte output as
 *    before the currency overload was added (regression) — 18 call sites across the app
 *    depend on this staying 100% backward compatible.
 * 2. `formatRupiah(value, target)` with an optional currency target converts and formats
 *    correctly.
 * 3. Currency symbols and decimal precision per currency are correct (IDR/JPY -> 0 decimals,
 *    USD/SGD/EUR -> 2 decimals).
 *
 * A real, Jest-executed spec (imports directly from the protected `../format.ts`) — this
 * replaces a dead `format.test.mjs` that Jest's default testMatch never picked up.
 */

import { formatRupiah, formatRupiahCompact } from "./format";

describe("formatRupiah", () => {
  it("single-arg call: regression — exact byte-for-byte output unchanged", () => {
    // This is CRITICAL: 18 call sites across the app depend on formatRupiah(value)
    // continuing to work identically. The new overload must be 100% backward compatible.
    expect(formatRupiah(0)).toBe("Rp 0");
    expect(formatRupiah(1000)).toBe("Rp 1.000");
    expect(formatRupiah(1256780000)).toBe("Rp 1.256.780.000");
    expect(formatRupiah(25850000)).toBe("Rp 25.850.000");
    expect(formatRupiah(1000000)).toBe("Rp 1.000.000");
  });

  it("with target: USD conversion with 2 decimals", () => {
    // USD rate from /fx/rates is approximately 0.000063 (IDR to USD)
    // 1,000,000 IDR * 0.000063 = ~63 USD
    const target = { code: "USD", rate: 0.000063 };
    const result = formatRupiah(1000000, target);

    expect(result).toMatch(/\$\s*63\.0+|^.*\$.*63.*\d\.\d\d/);
  });

  it("with target: JPY conversion with 0 decimals", () => {
    // JPY rate is approximately 0.0095 (IDR to JPY)
    // 1,000,000 IDR * 0.0095 = ~9,500 JPY
    const target = { code: "JPY", rate: 0.0095 };
    const result = formatRupiah(1000000, target);

    expect(result).toMatch(/¥|JPY/);
    expect(result).not.toMatch(/\.\d{2}$/);
  });

  it("with target: SGD conversion with 2 decimals", () => {
    // SGD rate is approximately 0.000085 (IDR to SGD)
    // 1,000,000 IDR * 0.000085 = ~85 SGD
    const target = { code: "SGD", rate: 0.000085 };
    const result = formatRupiah(1000000, target);

    expect(result).toMatch(/S\$|SGD/);
    expect(result).toMatch(/\d\.\d{2}$/);
  });

  it("with target: EUR conversion with 2 decimals", () => {
    // EUR rate is approximately 0.000058 (IDR to EUR)
    // 1,000,000 IDR * 0.000058 = ~58 EUR
    const target = { code: "EUR", rate: 0.000058 };
    const result = formatRupiah(1000000, target);

    expect(result).toMatch(/€|EUR/);
    expect(result).toMatch(/\d\.\d{2}$/);
  });

  // EPIC-021 Group F (#1) — AUD/CNY added to the supported currency list.
  it("with target: AUD conversion with 2 decimals", () => {
    // AUD rate is approximately 0.000097 (IDR to AUD)
    // 1,000,000 IDR * 0.000097 = ~97 AUD
    const target = { code: "AUD", rate: 0.000097 };
    const result = formatRupiah(1000000, target);

    expect(result).toMatch(/A\$|AUD/);
    expect(result).toMatch(/\d\.\d{2}$/);
  });

  it("with target: CNY conversion with 2 decimals, distinguishable from JPY", () => {
    // CNY rate is approximately 0.000448 (IDR to CNY)
    // 1,000,000 IDR * 0.000448 = ~448 CNY
    const target = { code: "CNY", rate: 0.000448 };
    const result = formatRupiah(1000000, target);

    expect(result).toMatch(/CN¥|CNY/);
    expect(result).toMatch(/\d\.\d{2}$/);
  });

  it("with target: IDR (should still work, 0 decimals)", () => {
    // Passing IDR as target should not break anything
    // (rate = 1 means no conversion, just display as Rp with 0 decimals)
    const target = { code: "IDR", rate: 1 };
    const result = formatRupiah(1000000, target);

    expect(result).toMatch(/Rp/);
    // IDR has 0 decimal places (it's an integer currency)
    expect(result).not.toMatch(/\.\d{2}$/);
  });

  it("with target: zero value formats correctly", () => {
    const target = { code: "USD", rate: 0.000063 };
    const result = formatRupiah(0, target);

    expect(result).toMatch(/\$|USD/);
  });

  it("with target: large value maintains decimal precision", () => {
    // 1 billion IDR * 0.000063 = ~63,000 USD
    const target = { code: "USD", rate: 0.000063 };
    const result = formatRupiah(1000000000, target);

    expect(result).toMatch(/\$|USD/);
    // Decimal precision should be 2 for USD regardless of magnitude
    expect(result).toMatch(/\d\.\d{2}$/);
  });
});

describe("formatRupiahCompact", () => {
  it("formats the common magnitudes", () => {
    expect(formatRupiahCompact(25_850_000)).toBe("Rp 25,85 jt");
    expect(formatRupiahCompact(1_256_780_000)).toBe("Rp 1,26 M");
    expect(formatRupiahCompact(45_000)).toBe("Rp 45 rb");
    expect(formatRupiahCompact(750)).toBe("Rp 750");
    expect(formatRupiahCompact(0)).toBe("Rp 0");
  });

  it("promotes a value whose smaller unit would round to four digits", () => {
    // 999.999.999 / 1e6 is 1000,00 — that belongs in "M", not "jt".
    expect(formatRupiahCompact(999_999_999)).toBe("Rp 1,00 M");
    // 999.999 / 1e3 is 1000 — that belongs in "jt", not "rb".
    expect(formatRupiahCompact(999_999)).toBe("Rp 1,00 jt");
    // Just below each boundary the smaller unit still fits.
    expect(formatRupiahCompact(994_999_999)).toBe("Rp 995,00 jt");
    expect(formatRupiahCompact(999_499)).toBe("Rp 999 rb");
  });

  it("keeps the sign and the unit for negatives", () => {
    expect(formatRupiahCompact(-1_256_780_000)).toBe("-Rp 1,26 M");
    expect(formatRupiahCompact(-25_850_000)).toBe("-Rp 25,85 jt");
    expect(formatRupiahCompact(-45_000)).toBe("-Rp 45 rb");
    expect(formatRupiahCompact(-750)).toBe("-Rp 750");
  });
});
