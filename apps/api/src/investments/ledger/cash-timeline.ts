import { compareLedgerKey, formatLedgerPoint } from "./replay";

import type { LedgerSortKey } from "./replay";

/**
 * Investasi §4/§8 — point-in-time funds check for one cash account (kantong
 * dana), pure.
 *
 * Only the account's CURRENT balance is stored, so the balance after any
 * movement e is reconstructed backwards:
 *
 *   balance(e)   = balanceNow − Σ delta of movements ordered after e
 *   held(e)      = Σ proceeds of active sells ordered ≤ e whose
 *                  settlementDate > date(e)                       (R9)
 *   available(e) = balance(e) − held(e)
 *
 * Movements are ordered by the R6 key: ledger-linked cash legs use their
 * ledger row's key; every other Transaction on the account uses its
 * occurredAt (Asia/Jakarta date + HH:MM) and createdAt.
 *
 * A write is checked by comparing the timeline before and after it, from
 * the earliest changed point on. A point fails when available(e) < 0 after
 * the write AND the write made it worse (a point that was already negative
 * in legacy data, untouched by this write, is not blamed on it).
 */

export interface CashMovement {
  /** Ledger row id for ledger-linked legs, else the cash Transaction id. */
  id: string;
  key: LedgerSortKey;
  /** Signed IDR effect on the account balance. */
  delta: bigint;
  /** Id shown to the user in a conflict (ledger row or Transaction). */
  transactionId: string;
}

export interface HeldCredit {
  id: string;
  key: LedgerSortKey;
  /** yyyy-mm-dd */
  settlementDate: string;
  proceeds: bigint;
}

export interface CashTimeline {
  movements: CashMovement[];
  held: HeldCredit[];
}

export interface CashPoint {
  movement: CashMovement;
  balance: bigint;
  held: bigint;
  available: bigint;
}

export function cashPoints(
  balanceNow: bigint,
  timeline: CashTimeline,
): CashPoint[] {
  const ordered = [...timeline.movements].sort((a, b) =>
    compareLedgerKey(a.key, b.key),
  );
  const out: CashPoint[] = new Array(ordered.length);
  let balance = balanceNow;
  for (let i = ordered.length - 1; i >= 0; i--) {
    const m = ordered[i] as CashMovement;
    let held = BigInt(0);
    for (const h of timeline.held) {
      if (
        compareLedgerKey(h.key, m.key) <= 0 &&
        h.settlementDate > m.key.effectiveDate
      ) {
        held += h.proceeds;
      }
    }
    out[i] = { movement: m, balance, held, available: balance - held };
    balance -= m.delta;
  }
  return out;
}

export interface CashViolation {
  movement: CashMovement;
  /** Available just before this movement (after the write). */
  availableBefore: bigint;
  availableAfter: bigint;
  description: string;
}

/**
 * Points at or after `from` that the write drives below zero. `balanceNow`
 * is the stored balance BEFORE the write; the after-timeline's end balance
 * is derived from the change in Σ delta.
 */
export function findCashViolations(params: {
  balanceNow: bigint;
  before: CashTimeline;
  after: CashTimeline;
  from: LedgerSortKey;
}): CashViolation[] {
  const sum = (t: CashTimeline): bigint =>
    t.movements.reduce((acc, m) => acc + m.delta, BigInt(0));
  const balanceAfter =
    params.balanceNow + sum(params.after) - sum(params.before);
  const beforeById = new Map(
    cashPoints(params.balanceNow, params.before).map((p) => [p.movement.id, p]),
  );
  const violations: CashViolation[] = [];
  for (const p of cashPoints(balanceAfter, params.after)) {
    if (compareLedgerKey(p.movement.key, params.from) < 0) continue;
    if (p.available >= BigInt(0)) continue;
    const prev = beforeById.get(p.movement.id);
    if (prev && p.available >= prev.available) continue;
    violations.push({
      movement: p.movement,
      availableBefore: p.available - p.movement.delta,
      availableAfter: p.available,
      description: `Dana tersedia menjadi negatif (Rp ${p.available.toString()}) pada ${formatLedgerPoint(p.movement.key)}`,
    });
  }
  return violations;
}
