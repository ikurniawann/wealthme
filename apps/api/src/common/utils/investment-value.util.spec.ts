/**
 * EPIC-022 (adversarial review round 3) — the shared server-side investment
 * valuation basis: latest recorded price × quantity, falling back to cost
 * basis × quantity when no price has been recorded yet. Used identically by
 * `DashboardService.computeNetWorthBreakdown` and
 * `ReportsService.getBalanceSheet` so the two can never silently diverge.
 */

import { Decimal } from "@prisma/client/runtime/library";

import {
  familyGoldUnitPrice,
  investmentPositionValue,
} from "./investment-value.util";

describe("investmentPositionValue", () => {
  it("values a holding at its latest recorded price × quantity", () => {
    const result = investmentPositionValue({
      quantity: new Decimal(10),
      costBasisPerUnit: new Decimal(9_500),
      prices: [{ price: new Decimal(10_000) }],
    });
    expect(result.toNumber()).toBe(100_000);
  });

  it("falls back to cost basis × quantity when no price row exists yet", () => {
    const result = investmentPositionValue({
      quantity: new Decimal(5),
      costBasisPerUnit: new Decimal(2_000),
      prices: [],
    });
    expect(result.toNumber()).toBe(10_000);
  });

  it("uses only the first (latest) price when multiple are present", () => {
    // Callers are expected to pass `prices` pre-ordered `recordedAt desc`
    // with `take: 1`, but this proves the function itself only ever reads
    // index 0 — it does not average or otherwise combine multiple prices.
    const result = investmentPositionValue({
      quantity: new Decimal(1),
      costBasisPerUnit: new Decimal(100),
      prices: [{ price: new Decimal(500) }, { price: new Decimal(9_999) }],
    });
    expect(result.toNumber()).toBe(500);
  });

  it("scales correctly for quantity > 1 (the exact regression class B9 also fixed client-side)", () => {
    const result = investmentPositionValue({
      quantity: new Decimal(500),
      costBasisPerUnit: new Decimal(9_000),
      prices: [{ price: new Decimal(10_000) }],
    });
    expect(result.toNumber()).toBe(5_000_000);
  });
});

describe("emas follows the family gold price (Revisi D item 11)", () => {
  const gold = { goldPricePerGram: BigInt(1_500_000) };

  it("values emas at quantity × family gold price, ignoring the stored price", () => {
    const result = investmentPositionValue({
      type: "emas",
      quantity: new Decimal("2.5"),
      costBasisPerUnit: new Decimal(1_000_000),
      prices: [{ price: new Decimal(1_200_000) }],
      familyGroup: gold,
    });
    expect(result.toString()).toBe("3750000");
  });

  it("falls back to the latest stored price when the family gold price is unset", () => {
    const result = investmentPositionValue({
      type: "emas",
      quantity: new Decimal("2.5"),
      costBasisPerUnit: new Decimal(1_000_000),
      prices: [{ price: new Decimal(1_200_000) }],
      familyGroup: { goldPricePerGram: null },
    });
    expect(result.toString()).toBe("3000000");
  });

  it("never applies the gold price to a non-emas holding", () => {
    const result = investmentPositionValue({
      type: "lainnya",
      quantity: new Decimal("2.5"),
      costBasisPerUnit: new Decimal(1_000_000),
      prices: [{ price: new Decimal(1_200_000) }],
      familyGroup: gold,
    });
    expect(result.toString()).toBe("3000000");
  });

  it("treats a zero gold price as unset", () => {
    expect(
      familyGoldUnitPrice({
        type: "emas",
        familyGroup: { goldPricePerGram: BigInt(0) },
      }),
    ).toBeNull();
  });
});

describe("valuation parity with InvestmentsService.findAll", () => {
  it("never values a holding off a simulated `mock` price — cost basis instead", () => {
    const result = investmentPositionValue({
      type: "saham",
      quantity: new Decimal(10),
      costBasisPerUnit: new Decimal(1_000),
      prices: [{ price: new Decimal(99_999), source: "mock" }],
    });
    expect(result.toString()).toBe("10000");
  });

  it("keeps a real stored price", () => {
    const result = investmentPositionValue({
      type: "saham",
      quantity: new Decimal(10),
      costBasisPerUnit: new Decimal(1_000),
      prices: [{ price: new Decimal(1_200), source: "seed" }],
    });
    expect(result.toString()).toBe("12000");
  });

  it("accrues deposito simple interest instead of reading a price row", () => {
    const result = investmentPositionValue({
      type: "deposito",
      quantity: new Decimal(1),
      costBasisPerUnit: new Decimal(100_000_000),
      prices: [],
      interestRatePct: new Decimal(5),
      purchasedAt: new Date("2026-01-01T00:00:00Z"),
      maturityDate: null,
      asOf: new Date("2026-07-01T00:00:00Z"),
    });
    expect(result.toString()).toBe("102500000");
  });
});
