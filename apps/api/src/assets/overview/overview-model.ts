import { Prisma } from "@prisma/client";

import type {
  AssetOverviewRowDto,
  AssetValueChangeDto,
} from "@wealthme/contracts";

/**
 * Aset Task 17 — shared shapes for the overview builders. Every builder is
 * pure: the service loads rows, the builders map them, overview-query.ts
 * filters / sorts / sums. No float math: money is Prisma.Decimal.
 */

export const D = Prisma.Decimal;
export type Decimal = Prisma.Decimal;
export const ZERO = new D(0);

/** A row plus what the summary needs to know about it. */
export interface BuiltRow {
  dto: AssetOverviewRowDto;
  /**
   * True when the row is summed into the totals and net worth: accounts
   * under the net-worth rule, every investment holding, and active
   * unlinked physical assets (COUNTED_ASSET_WHERE).
   */
  counted: boolean;
  /** Lower-cased text the `q` filter matches against. */
  search: string;
}

/** Converts rupiah to the display currency; null when FX is unavailable. */
export type DisplayFn = (idr: string | null) => string | null;

export interface RowContext {
  display: DisplayFn;
  displayCurrency: string;
  ownerNames: Map<string, string>;
}

export const NO_CHANGE: AssetValueChangeDto = {
  amountIdr: null,
  percent: null,
  comparisonDate: null,
  period: "none",
};

export function money(d: Decimal): string {
  return d.toDecimalPlaces(2, D.ROUND_HALF_UP).toString();
}

/** Percentage rounded to 2 dp; null when the base is ≤ 0 or unknown (A6). */
export function pctOf(part: Decimal, base: Decimal | null): number | null {
  if (!base || base.lessThanOrEqualTo(0)) return null;
  return part.dividedBy(base).times(100).toDecimalPlaces(2).toNumber();
}

export function displayFn(rate: Decimal | null): DisplayFn {
  return (idr) => {
    if (idr === null || rate === null) return null;
    return money(new D(idr).dividedBy(rate));
  };
}

export function searchText(...parts: (string | null | undefined)[]): string {
  return parts
    .filter((p): p is string => !!p)
    .join(" ")
    .toLowerCase();
}

export function ownerName(
  ctx: RowContext,
  userId: string | null,
): string | null {
  return userId ? (ctx.ownerNames.get(userId) ?? null) : null;
}
