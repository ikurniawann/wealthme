import type { Decimal } from "@prisma/client/runtime/library";

/**
 * The current position value for one investment holding: latest recorded
 * market price × quantity, falling back to cost basis × quantity when no
 * price has been recorded yet. This is the same basis
 * `investments.service.ts` (`InvestmentDto.currentValue`) and the web
 * client's `investmentCurrentValue` (`apps/web/src/lib/laporan-utils.ts`)
 * use — shared here (EPIC-022, adversarial review round 3) so
 * `DashboardService`'s net-worth rollup and `ReportsService`'s balance
 * sheet can never silently diverge from each other, or from what
 * `/investasi` shows, by hand-duplicating this formula per call site.
 *
 * Reads only the already-recorded latest price (no live market-data
 * refresh) — safe to call from read-only report/dashboard aggregation
 * without side effects or a dependency on the market-data adapter.
 * `prices` is expected pre-ordered `recordedAt desc` with `take: 1`, so
 * `prices[0]` (if present) is the latest recorded price.
 */
export function investmentPositionValue(inv: {
  quantity: Decimal;
  costBasisPerUnit: Decimal;
  prices: { price: Decimal }[];
}): Decimal {
  const price = inv.prices[0]?.price ?? inv.costBasisPerUnit;
  return price.times(inv.quantity);
}
