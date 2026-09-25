import { Decimal } from "@prisma/client/runtime/library";

export const FAMILY_GOLD_PRICE_SOURCE = "family-gold-price";

/** Revisi D item 11 — emas follows FamilyGroup.goldPricePerGram when the owner has set a positive one. */
export function familyGoldUnitPrice(inv: {
  type?: string;
  familyGroup?: { goldPricePerGram: bigint | null } | null;
}): Decimal | null {
  const perGram = inv.familyGroup?.goldPricePerGram ?? null;
  if (inv.type !== "emas" || perGram === null || perGram <= 0n) return null;
  return new Decimal(perGram.toString());
}

/**
 * The current position value for one investment holding: family gold price
 * (emas only, when set), else the latest recorded price, else cost basis —
 * × quantity. Shared by `InvestmentsService`, `DashboardService` and
 * `ReportsService` so /investasi, /ringkasan and /laporan never diverge.
 * `prices` is expected pre-ordered `recordedAt desc` with `take: 1`.
 */
export function investmentPositionValue(inv: {
  type?: string;
  quantity: Decimal;
  costBasisPerUnit: Decimal;
  prices: { price: Decimal }[];
  familyGroup?: { goldPricePerGram: bigint | null } | null;
}): Decimal {
  const price =
    familyGoldUnitPrice(inv) ?? inv.prices[0]?.price ?? inv.costBasisPerUnit;
  return price.times(inv.quantity);
}
