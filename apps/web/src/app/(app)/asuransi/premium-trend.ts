import type { InsuranceDto, InsuranceType } from "@wealthme/contracts";

/** Bars in the hero chart: a rolling window ending at the current month. */
export const PREMIUM_TREND_MONTHS = 6;

/**
 * Shape of the 6-month premium estimate (oldest → current month). No premium
 * history exists, so the chart (labelled "estimasi") scales today's real
 * monthly premium by this fixed profile; the last bar is always the real value.
 */
const PREMIUM_TREND_RATIOS = [0.82, 0.84, 1.02, 0.86, 0.98, 1];

/** First day of each month in the window, oldest first, ending at `now`'s month. */
export function rollingMonths(
  now: Date,
  count: number = PREMIUM_TREND_MONTHS,
): Date[] {
  return Array.from(
    { length: count },
    (_, i) => new Date(now.getFullYear(), now.getMonth() - (count - 1 - i), 1),
  );
}

/** Monthly-equivalent premium of one policy, same rule as the API summary. */
function monthlyEquivalent(policy: InsuranceDto): number {
  const amount = BigInt(policy.premiumAmount);
  if (policy.premiumPeriod === "quarterly") return Number(amount / BigInt(3));
  if (policy.premiumPeriod === "yearly") return Number(amount / BigInt(12));
  return Number(amount);
}

export type PremiumTypeSeries = { type: InsuranceType; monthly: number };

/** Active policies' monthly premium grouped by insurance type, first-seen order, zero totals dropped. */
export function monthlyPremiumByType(
  policies: readonly InsuranceDto[],
): PremiumTypeSeries[] {
  const byType = new Map<InsuranceType, number>();
  for (const policy of policies) {
    if (policy.status !== "aktif") continue;
    byType.set(
      policy.type,
      (byType.get(policy.type) ?? 0) + monthlyEquivalent(policy),
    );
  }
  return Array.from(byType, ([type, monthly]) => ({ type, monthly })).filter(
    (row) => row.monthly > 0,
  );
}

/** Per-month values for one type: its current monthly premium × the estimate profile. */
export function premiumTrendValues(monthly: number): number[] {
  return PREMIUM_TREND_RATIOS.map((ratio) => Math.round(monthly * ratio));
}
