import { Prisma } from "@prisma/client";

/**
 * Investasi ledger replay — pure, no Prisma client, no I/O.
 *
 * Cost-basis method (R1): WEIGHTED AVERAGE, the method the app already used.
 * State per holding is (quantity, total cost basis) in IDR, the book
 * currency of every stored cost and realized P/L:
 *
 *   to IDR(x)  = x                 when currency = IDR
 *              = x × fxRate        otherwise (fxRate = IDR per 1 unit)
 *   opening    qty += q;  cost += IDR(q × price + fee + tax)
 *   buy        qty += q;  cost += IDR(gross + fee + tax)   (fees capitalized)
 *   sell       q ≤ qty, else INVALID (never clamped)
 *              soldCost  = cost × q / qty   (= cost when q = qty)
 *              realized  = IDR(gross − fee − tax) − soldCost
 *              qty −= q;  cost −= soldCost
 *   corporate  qty += q (signed); cost unchanged; qty < 0 or (qty = 0 while
 *   _action    cost > 0) is INVALID
 *   dividend / coupon / interest   no change to qty or cost (cash income)
 *
 *   avgCost = cost / qty; when qty reaches 0 the last average is kept (as
 *   the pre-ledger code did) — qty × avg is 0 either way.
 *
 * Ordering (R6): effectiveDate, then effectiveTime with date-only (null)
 * rows first, then createdAt, then id. Times compare as "HH:MM" strings.
 */

const D = Prisma.Decimal;
type Decimal = Prisma.Decimal;
const ZERO = new D(0);

export type LedgerKind =
  | "buy"
  | "sell"
  | "opening"
  | "dividend"
  | "coupon"
  | "interest"
  | "corporate_action";

export const INCOME_KINDS: readonly LedgerKind[] = [
  "dividend",
  "coupon",
  "interest",
];

/** R6 sort key shared by ledger rows and pocket cash movements. */
export interface LedgerSortKey {
  /** yyyy-mm-dd */
  effectiveDate: string;
  /** "HH:MM" or null (date-only → start of day, before timed rows). */
  effectiveTime: string | null;
  createdAt: Date;
  id: string;
}

export function compareLedgerKey(a: LedgerSortKey, b: LedgerSortKey): number {
  if (a.effectiveDate !== b.effectiveDate) {
    return a.effectiveDate < b.effectiveDate ? -1 : 1;
  }
  if (a.effectiveTime !== b.effectiveTime) {
    if (a.effectiveTime === null) return -1;
    if (b.effectiveTime === null) return 1;
    return a.effectiveTime < b.effectiveTime ? -1 : 1;
  }
  const ta = a.createdAt.getTime();
  const tb = b.createdAt.getTime();
  if (ta !== tb) return ta < tb ? -1 : 1;
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

/** "yyyy-mm-dd" or "yyyy-mm-dd HH:MM" — how a point is named to the user. */
export function formatLedgerPoint(k: {
  effectiveDate: string;
  effectiveTime: string | null;
}): string {
  return k.effectiveTime
    ? `${k.effectiveDate} ${k.effectiveTime}`
    : k.effectiveDate;
}

export interface LedgerRow extends LedgerSortKey {
  kind: LedgerKind;
  quantity: Decimal;
  pricePerUnit: Decimal;
  grossAmount: Decimal;
  fee: Decimal;
  tax: Decimal;
  currency: string;
  fxRate: Decimal | null;
}

export interface ReplayStep {
  id: string;
  kind: LedgerKind;
  quantityAfter: Decimal;
  /** Total remaining cost basis, IDR. */
  costBasisAfter: Decimal;
  avgCostAfter: Decimal;
  /** Sell only; IDR. */
  realizedPnl: Decimal | null;
}

export type ReplayInvalidReason =
  | "INSUFFICIENT_HOLDINGS"
  | "NEGATIVE_QUANTITY"
  | "MISSING_FX_RATE";

export interface ReplayInvalidStep {
  id: string;
  index: number;
  kind: LedgerKind;
  effectiveDate: string;
  effectiveTime: string | null;
  reason: ReplayInvalidReason;
  /** Units the step needed (sell quantity / units removed). */
  needed: Decimal;
  /** Units held just before the step. */
  available: Decimal;
  description: string;
}

export interface ReplayResult {
  /** Rows in R6 order; only the valid prefix has a step. */
  ordered: LedgerRow[];
  steps: ReplayStep[];
  quantity: Decimal;
  costBasis: Decimal;
  avgCost: Decimal;
  /** Σ realized of the replayed sells, IDR. */
  realizedTotal: Decimal;
  hasSell: boolean;
  /** First step that cannot be applied; replay stops there. */
  invalid: ReplayInvalidStep | null;
}

function toIdr(row: LedgerRow, amount: Decimal): Decimal | null {
  if (row.currency === "IDR") return amount;
  if (!row.fxRate || !row.fxRate.greaterThan(0)) return null;
  return amount.times(row.fxRate);
}

/** Cash a row moves, in its own currency: buy out, sell/income in. */
export function rowNetAmount(row: {
  kind: LedgerKind;
  grossAmount: Decimal;
  fee: Decimal;
  tax: Decimal;
}): Decimal {
  if (row.kind === "buy") return row.grossAmount.plus(row.fee).plus(row.tax);
  if (row.kind === "sell" || INCOME_KINDS.includes(row.kind)) {
    return row.grossAmount.minus(row.fee).minus(row.tax);
  }
  return row.grossAmount;
}

/** Whole-rupiah IDR value of a cash amount (half-up), or null without fx. */
export function cashIdr(
  amount: Decimal,
  currency: string,
  fxRate: Decimal | null,
): bigint | null {
  let idr: Decimal;
  if (currency === "IDR") idr = amount;
  else if (fxRate && fxRate.greaterThan(0)) idr = amount.times(fxRate);
  else return null;
  return BigInt(idr.toDecimalPlaces(0, D.ROUND_HALF_UP).toFixed(0));
}

function invalidStep(
  row: LedgerRow,
  index: number,
  reason: ReplayInvalidReason,
  needed: Decimal,
  available: Decimal,
  description: string,
): ReplayInvalidStep {
  return {
    id: row.id,
    index,
    kind: row.kind,
    effectiveDate: row.effectiveDate,
    effectiveTime: row.effectiveTime,
    reason,
    needed,
    available,
    description,
  };
}

export function replayLedger(rows: readonly LedgerRow[]): ReplayResult {
  const ordered = [...rows].sort(compareLedgerKey);
  const steps: ReplayStep[] = [];
  let qty = ZERO;
  let cost = ZERO;
  let avg = ZERO;
  let realizedTotal = ZERO;
  let hasSell = false;

  const done = (invalid: ReplayInvalidStep | null): ReplayResult => ({
    ordered,
    steps,
    quantity: qty,
    costBasis: cost,
    avgCost: avg,
    realizedTotal,
    hasSell,
    invalid,
  });

  for (const [i, row] of ordered.entries()) {
    let realized: Decimal | null = null;

    switch (row.kind) {
      case "opening":
      case "buy": {
        const raw =
          row.kind === "opening"
            ? row.quantity.times(row.pricePerUnit).plus(row.fee).plus(row.tax)
            : row.grossAmount.plus(row.fee).plus(row.tax);
        const added = toIdr(row, raw);
        if (added === null) {
          return done(
            invalidStep(
              row,
              i,
              "MISSING_FX_RATE",
              row.quantity,
              qty,
              `Kurs ${row.currency} tidak tercatat`,
            ),
          );
        }
        qty = qty.plus(row.quantity);
        cost = cost.plus(added);
        break;
      }
      case "sell": {
        if (row.quantity.greaterThan(qty)) {
          return done(
            invalidStep(
              row,
              i,
              "INSUFFICIENT_HOLDINGS",
              row.quantity,
              qty,
              `Jual ${row.quantity.toString()} unit, padahal hanya ${qty.toString()} unit dimiliki pada ${formatLedgerPoint(row)}`,
            ),
          );
        }
        const proceeds = toIdr(row, rowNetAmount(row));
        if (proceeds === null) {
          return done(
            invalidStep(
              row,
              i,
              "MISSING_FX_RATE",
              row.quantity,
              qty,
              `Kurs ${row.currency} tidak tercatat`,
            ),
          );
        }
        const soldCost = row.quantity.equals(qty)
          ? cost
          : cost.times(row.quantity).dividedBy(qty);
        realized = proceeds.minus(soldCost);
        realizedTotal = realizedTotal.plus(realized);
        hasSell = true;
        qty = qty.minus(row.quantity);
        cost = cost.minus(soldCost);
        break;
      }
      case "corporate_action": {
        const next = qty.plus(row.quantity);
        if (next.lessThan(0) || (next.isZero() && cost.greaterThan(0))) {
          return done(
            invalidStep(
              row,
              i,
              "NEGATIVE_QUANTITY",
              row.quantity.abs(),
              qty,
              `Aksi korporasi mengurangi ${row.quantity.abs().toString()} unit, padahal hanya ${qty.toString()} unit dimiliki pada ${formatLedgerPoint(row)}`,
            ),
          );
        }
        qty = next;
        break;
      }
      case "dividend":
      case "coupon":
      case "interest":
        break;
    }

    if (qty.greaterThan(0)) avg = cost.dividedBy(qty);
    steps.push({
      id: row.id,
      kind: row.kind,
      quantityAfter: qty,
      costBasisAfter: cost,
      avgCostAfter: avg,
      realizedPnl: realized,
    });
  }

  return done(null);
}
