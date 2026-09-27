import { accruedInterest, finalTaxFor } from "./final-tax.engine";

const J = 1_000_000n;

describe("finalTaxFor", () => {
  it("kripto domestik switches 10 → 21 bps on 2025-08-01; luar negeri 100 bps", () => {
    expect(
      finalTaxFor({
        instrument: "kripto_domestik",
        grossAmount: 50n * J,
        date: "2025-07-31",
      }),
    ).toMatchObject({ rateBps: 10, tax: 50_000n, rateSource: "rule" });
    expect(
      finalTaxFor({
        instrument: "kripto_domestik",
        grossAmount: 50n * J,
        date: "2025-08-01",
      }),
    ).toMatchObject({ rateBps: 21, tax: 105_000n });
    expect(
      finalTaxFor({
        instrument: "kripto_luar",
        grossAmount: 50n * J,
        date: "2025-08-01",
      }),
    ).toMatchObject({ rateBps: 100, tax: 500_000n });
  });
  it("saham IDX 0,1% of sell value", () => {
    expect(
      finalTaxFor({
        instrument: "saham_idx",
        grossAmount: 9_250_000n,
        date: "2026-05-04",
      }).tax,
    ).toBe(9_250n);
  });
  it("dividen 10% unless reinvested (0%)", () => {
    expect(
      finalTaxFor({
        instrument: "dividen",
        grossAmount: 2n * J,
        date: "2026-05-04",
      }).tax,
    ).toBe(200_000n);
    expect(
      finalTaxFor({
        instrument: "dividen",
        grossAmount: 2n * J,
        date: "2026-05-04",
        reinvested: true,
      }),
    ).toMatchObject({ rateBps: 0, tax: 0n });
  });
  it("sewa 10%, tabungan 20% half-up", () => {
    expect(
      finalTaxFor({
        instrument: "sewa",
        grossAmount: 60n * J,
        date: "2026-01-10",
      }).tax,
    ).toBe(6n * J);
    expect(
      finalTaxFor({
        instrument: "bunga_tabungan",
        grossAmount: 1_234_567n,
        date: "2026-01-10",
      }).tax,
    ).toBe(246_913n);
  });
  it("deposito principal ≤ Rp7,5jt is below threshold → 0", () => {
    expect(
      finalTaxFor({
        instrument: "bunga_deposito",
        grossAmount: 300_000n,
        principal: 7_500_000n,
        date: "2026-01-10",
      }),
    ).toMatchObject({ tax: 0n, belowThreshold: true });
    expect(
      finalTaxFor({
        instrument: "bunga_deposito",
        grossAmount: 300_000n,
        principal: 7_500_001n,
        date: "2026-01-10",
      }),
    ).toMatchObject({ tax: 60_000n, belowThreshold: false });
  });
  it("emas and P2P have no rule rate → missing unless overridden", () => {
    expect(
      finalTaxFor({
        instrument: "emas",
        grossAmount: 10n * J,
        date: "2026-01-10",
      }),
    ).toMatchObject({ rateBps: null, tax: null, rateSource: "missing" });
    expect(
      finalTaxFor({
        instrument: "p2p",
        grossAmount: 1n * J,
        date: "2026-01-10",
        rateBpsOverride: 1500,
      }),
    ).toMatchObject({ rateBps: 1500, tax: 150_000n, rateSource: "override" });
  });
  it("reksa dana is 0 at investor level (unverified)", () => {
    const r = finalTaxFor({
      instrument: "reksa_dana",
      grossAmount: 10n * J,
      date: "2026-01-10",
    });
    expect(r).toMatchObject({ rateBps: 0, tax: 0n });
    expect(r.ref.verified).toBe(false);
  });
  it("rejects an override outside 0..10000", () => {
    expect(() =>
      finalTaxFor({
        instrument: "p2p",
        grossAmount: 1n,
        date: "2026-01-10",
        rateBpsOverride: 10_001,
      }),
    ).toThrow(RangeError);
  });
});

describe("accruedInterest", () => {
  it("deposito 100jt @4,25% from 2026-03-01 → 306 days → 3.563.014", () => {
    expect(
      accruedInterest({
        principal: 100n * J,
        rateHundredths: 425n,
        from: "2026-03-01",
        to: "2027-03-01",
        taxYear: 2026,
      }),
    ).toEqual({ interest: 3_563_014n, days: 306 });
  });
  it("SBN 50jt @6,40% held all 2026 → 365 days → 3.200.000", () => {
    expect(
      accruedInterest({
        principal: 50n * J,
        rateHundredths: 640n,
        from: "2025-06-01",
        to: null,
        taxYear: 2026,
      }),
    ).toEqual({ interest: 3_200_000n, days: 365 });
  });
  it("matured before the tax year → 0", () => {
    expect(
      accruedInterest({
        principal: 50n * J,
        rateHundredths: 640n,
        from: "2024-01-01",
        to: "2025-06-01",
        taxYear: 2026,
      }),
    ).toEqual({ interest: 0n, days: 0 });
  });
});
