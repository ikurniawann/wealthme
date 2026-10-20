import { Prisma } from "@prisma/client";

import { addDaysYmd, dbDateToYmd } from "../../investments/ledger/ledger-dates";

import type { AssetHistoryKind } from "@prisma/client";
import type { AssetValueChangeDto } from "@wealthme/contracts";

/**
 * Aset A4/A6 — the asset's value timeline, pure (no Prisma client, no I/O).
 *
 * Order (refined A4): effectiveDate (calendar date in the row's zone, Asia/
 * Jakarta by default), date-only rows before timed rows, effectiveAt,
 * createdAt, id. Recording time never decides which valuation is newest.
 *
 * Walk: quantity comes from the transaction replay (`steps`, one per
 * transaction-linked row) or, for an asset without any ledger, from the
 * stored quantity (legacy rows: null, values left as entered).
 *  - per-unit valuation (pricePerUnit set): value = quantity × price (IDR);
 *    it becomes the reference price for later quantity changes.
 *  - total valuation: value as entered; later quantity changes scale it
 *    pro rata to the quantity it was valued at.
 *  - transaction rows (opening/buy/sell): quantity moves; value = new
 *    quantity at the reference price. An opening's own price is a
 *    valuation; a buy/sell price is a trade price and only serves as the
 *    reference when nothing was valued yet. A trade is never a price change.
 * The asset's current value is the value after the last row.
 */

const D = Prisma.Decimal;
type Decimal = Prisma.Decimal;

export const VALUATION_KINDS: ReadonlySet<AssetHistoryKind> = new Set([
  "opening",
  "valuation",
  "correction",
]);

export interface TimelineRow {
  id: string;
  kind: AssetHistoryKind;
  value: bigint;
  effectiveAt: Date;
  effectiveDate: Date;
  hasTime: boolean;
  createdAt: Date;
  pricePerUnit: Decimal | null;
  currency: string;
  fxRate: Decimal | null;
  assetTransactionId: string | null;
}

/** Replay result for one transaction-linked history row. */
export interface TxStep {
  quantityAfter: Decimal;
  /** The trade's unit price in IDR, or null when unknown. */
  priceIdr: Decimal | null;
}

export interface RowState {
  value: bigint;
  valueBefore: bigint | null;
  quantityBefore: Decimal | null;
  quantityAfter: Decimal | null;
}

export interface Timeline {
  /** Oldest first. */
  ordered: TimelineRow[];
  states: Map<string, RowState>;
  /** Value after the last row; null when there is no row. */
  current: bigint | null;
}

export function compareHistory(a: TimelineRow, b: TimelineRow): number {
  const da = a.effectiveDate.getTime();
  const db = b.effectiveDate.getTime();
  if (da !== db) return da < db ? -1 : 1;
  if (a.hasTime !== b.hasTime) return a.hasTime ? 1 : -1;
  const ea = a.effectiveAt.getTime();
  const eb = b.effectiveAt.getTime();
  if (ea !== eb) return ea < eb ? -1 : 1;
  const ca = a.createdAt.getTime();
  const cb = b.createdAt.getTime();
  if (ca !== cb) return ca < cb ? -1 : 1;
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

export function toRupiah(d: Decimal): bigint {
  return BigInt(d.toDecimalPlaces(0, D.ROUND_HALF_UP).toFixed(0));
}

/** IDR per unit of a valuation row, or null for a total valuation. */
export function priceIdrOf(row: {
  pricePerUnit: Decimal | null;
  currency: string;
  fxRate: Decimal | null;
}): Decimal | null {
  if (row.pricePerUnit === null) return null;
  if (row.currency === "IDR") return row.pricePerUnit;
  if (!row.fxRate || !row.fxRate.greaterThan(0)) return null;
  return row.pricePerUnit.times(row.fxRate);
}

export function walkTimeline(
  rows: readonly TimelineRow[],
  steps: ReadonlyMap<string, TxStep>,
  staticQuantity: Decimal | null,
  hasLedger: boolean,
): Timeline {
  const ordered = [...rows].sort(compareHistory);
  const states = new Map<string, RowState>();
  let qty: Decimal | null = hasLedger ? new D(0) : staticQuantity;
  let refPrice: Decimal | null = null;
  let refTotal: Decimal | null = null;
  let refQty: Decimal | null = null;
  let running: bigint | null = null;

  for (const row of ordered) {
    const before = running;
    const step = row.assetTransactionId
      ? steps.get(row.assetTransactionId)
      : undefined;
    let state: RowState;
    if (step) {
      const qb = qty;
      qty = step.quantityAfter;
      const scalable = refTotal !== null && refQty?.greaterThan(0);
      if (step.priceIdr && (row.kind === "opening" || !refPrice)) {
        if (row.kind === "opening" || !scalable) {
          refPrice = step.priceIdr;
          refTotal = null;
        }
      }
      let value: bigint;
      if (refPrice) value = toRupiah(qty.times(refPrice));
      else if (refTotal !== null && refQty?.greaterThan(0))
        value = toRupiah(refTotal.times(qty).dividedBy(refQty));
      else value = qty.isZero() ? 0n : (before ?? row.value);
      state = {
        value,
        valueBefore: before,
        quantityBefore: qb,
        quantityAfter: qty,
      };
    } else {
      const p = priceIdrOf(row);
      let value = row.value;
      if (p) {
        refPrice = p;
        refTotal = null;
        if (qty) value = toRupiah(qty.times(p));
      } else {
        refPrice = null;
        refTotal = new D(row.value.toString());
        refQty = qty;
      }
      state = {
        value,
        valueBefore: before,
        quantityBefore: qty,
        quantityAfter: qty,
      };
    }
    states.set(row.id, state);
    running = state.value;
  }
  return { ordered, states, current: running };
}

export const NO_CHANGE: AssetValueChangeDto = {
  amountIdr: null,
  percent: null,
  comparisonDate: null,
  period: "none",
};

/** % rounded to 2 dp; null when the base is ≤ 0 (A6: "—", never Infinity). */
export function percentOf(diff: Decimal, base: Decimal): number | null {
  if (!base.greaterThan(0)) return null;
  return diff
    .dividedBy(base)
    .times(100)
    .toDecimalPlaces(2, D.ROUND_HALF_UP)
    .toNumber();
}

/**
 * A6 — change of the valuation at `index` against the previous valuation by
 * effective order. A transaction between them moves quantity, not price:
 * the change is then measured per unit (both rows priced) at this row's
 * quantity, else reported as none.
 */
export function changeAt(
  t: Timeline,
  index: number,
  period: AssetValueChangeDto["period"] = "previous_valuation",
  stopBeforeDate?: string,
): AssetValueChangeDto {
  const row = t.ordered[index];
  // A trade (including an opening transaction) moves quantity; it is never
  // reported as a price change.
  if (!row || !VALUATION_KINDS.has(row.kind) || row.assetTransactionId) {
    return NO_CHANGE;
  }
  let crossed = false;
  for (let k = index - 1; k >= 0; k--) {
    const prev = t.ordered[k]!;
    if (stopBeforeDate && dbDateToYmd(prev.effectiveDate) >= stopBeforeDate) {
      if (prev.assetTransactionId && prev.kind !== "opening") crossed = true;
      continue;
    }
    if (!VALUATION_KINDS.has(prev.kind)) {
      if (prev.assetTransactionId) crossed = true;
      continue;
    }
    return compare(t, row, prev, crossed, period);
  }
  return NO_CHANGE;
}

function compare(
  t: Timeline,
  row: TimelineRow,
  prev: TimelineRow,
  crossed: boolean,
  period: AssetValueChangeDto["period"],
): AssetValueChangeDto {
  const comparisonDate = dbDateToYmd(prev.effectiveDate);
  const a = t.states.get(row.id)!;
  const b = t.states.get(prev.id)!;
  if (!crossed) {
    const base = new D(b.value.toString());
    const diff = new D(a.value.toString()).minus(base);
    return {
      amountIdr: diff.toFixed(0),
      percent: percentOf(diff, base),
      comparisonDate,
      period,
    };
  }
  const pa = priceIdrOf(row);
  const pb = priceIdrOf(prev);
  if (!pa || !pb || !a.quantityAfter) return NO_CHANGE;
  const diff = pa.minus(pb);
  return {
    amountIdr: toRupiah(diff.times(a.quantityAfter)).toString(),
    percent: percentOf(diff, pb),
    comparisonDate,
    period,
  };
}

function lastValuationIndex(t: Timeline): number {
  for (let i = t.ordered.length - 1; i >= 0; i--) {
    if (VALUATION_KINDS.has(t.ordered[i]!.kind)) return i;
  }
  return -1;
}

export function sinceLastValuation(t: Timeline): AssetValueChangeDto {
  const i = lastValuationIndex(t);
  return i < 0 ? NO_CHANGE : changeAt(t, i);
}

/**
 * A6 "Perubahan hari ini" — the latest valuation against the last
 * valuation dated the previous Asia/Jakarta calendar day. Without one the
 * period is none ("Belum ada valuasi pembanding"), never 0%.
 */
export function todayChange(
  t: Timeline,
  todayYmd: string,
): AssetValueChangeDto {
  const yesterday = addDaysYmd(todayYmd, -1, false);
  let prevIdx = -1;
  for (let i = t.ordered.length - 1; i >= 0; i--) {
    const r = t.ordered[i]!;
    if (
      VALUATION_KINDS.has(r.kind) &&
      dbDateToYmd(r.effectiveDate) < todayYmd
    ) {
      prevIdx = i;
      break;
    }
  }
  const prev = t.ordered[prevIdx];
  if (!prev || dbDateToYmd(prev.effectiveDate) !== yesterday) return NO_CHANGE;
  const latestIdx = lastValuationIndex(t);
  if (latestIdx === prevIdx) {
    const base = new D(t.states.get(prev.id)!.value.toString());
    return {
      amountIdr: "0",
      percent: percentOf(new D(0), base),
      comparisonDate: yesterday,
      period: "previous_day",
    };
  }
  return changeAt(t, latestIdx, "previous_day", todayYmd);
}
