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

/** Simulated feed (dev/demo MockMarketDataAdapter): never a real valuation basis. */
export const MOCK_PRICE_SOURCE = "mock";

/**
 * Whole calendar months between `start` and `end` (never negative). Ignores
 * the day-of-month component — the same whole-month convention as the goal
 * auto-debit math (`monthsUntil` in apps/web crud-config.ts).
 */
function monthsBetween(start: Date, end: Date): number {
  const months =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth());
  return Math.max(0, months);
}

/**
 * EPIC-024 C3 (D10) — deposito current value via SIMPLE interest, pro-rata
 * by whole elapsed months: nominal × (1 + ratePct/100 × months/12).
 * Rp 100.000.000 at 5%/thn from 2026-01-01, viewed 2026-07-01 → 6 months →
 * Rp 102.500.000.
 *
 * - No rate or no `purchasedAt` → `nominal` unchanged (never null).
 * - Past `maturityDate` → interest stops accruing at maturity.
 */
export function computeDepositoCurrentValue(
  nominal: Decimal,
  ratePct: Decimal | null,
  purchasedAt: Date | null,
  asOf: Date,
  maturityDate: Date | null,
): Decimal {
  if (!ratePct || !purchasedAt) return nominal;

  const effectiveEnd =
    maturityDate && asOf > maturityDate ? maturityDate : asOf;
  if (effectiveEnd <= purchasedAt) return nominal;

  const months = monthsBetween(purchasedAt, effectiveEnd);
  const interest = nominal
    .times(ratePct)
    .dividedBy(100)
    .times(months)
    .dividedBy(12);
  return nominal.plus(interest);
}

/**
 * The current position value for one investment holding, on the SAME basis
 * as `InvestmentsService.findAll` so /investasi, /aset, /ringkasan, Beranda
 * and /laporan never diverge:
 *  - deposito → simple-interest accrual on the nominal (no price row);
 *  - emas → family gold price (when set);
 *  - else the latest recorded price — unless it came from the simulated
 *    `mock` feed, which is never a valuation basis — else cost basis;
 *  × quantity.
 * `prices` is expected pre-ordered `recordedAt desc` with `take: 1`.
 */
export function investmentPositionValue(inv: {
  type?: string;
  quantity: Decimal;
  costBasisPerUnit: Decimal;
  prices: { price: Decimal; source?: string | null }[];
  familyGroup?: { goldPricePerGram: bigint | null } | null;
  interestRatePct?: Decimal | null;
  purchasedAt?: Date | null;
  maturityDate?: Date | null;
  asOf?: Date;
}): Decimal {
  if (inv.type === "deposito") {
    // `costBasisPerUnit` doubles as the nominal; quantity is 1 (form-enforced).
    return computeDepositoCurrentValue(
      inv.costBasisPerUnit,
      inv.interestRatePct ?? null,
      inv.purchasedAt ?? null,
      inv.asOf ?? new Date(),
      inv.maturityDate ?? null,
    );
  }
  const latest = inv.prices[0];
  const stored =
    latest && latest.source !== MOCK_PRICE_SOURCE ? latest.price : null;
  const price = familyGoldUnitPrice(inv) ?? stored ?? inv.costBasisPerUnit;
  return price.times(inv.quantity);
}
