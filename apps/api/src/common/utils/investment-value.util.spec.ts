/**
 * EPIC-022 (adversarial review round 3) — the shared server-side investment
 * valuation basis: latest recorded price × quantity, falling back to cost
 * basis × quantity when no price has been recorded yet. Used identically by
 * `DashboardService.computeNetWorthBreakdown` and
 * `ReportsService.getBalanceSheet` so the two can never silently diverge.
 */

import { Decimal } from "@prisma/client/runtime/library";

import { investmentPositionValue } from "./investment-value.util";

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
