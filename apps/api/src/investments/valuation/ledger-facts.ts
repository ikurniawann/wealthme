import { Prisma } from "@prisma/client";

import { INCOME_KINDS, replayLedger, rowNetAmount } from "../ledger/replay";

import type { LedgerFacts } from "./valuation-core";
import type { LedgerKind, LedgerRow } from "../ledger/replay";

const D = Prisma.Decimal;
type Decimal = Prisma.Decimal;
const ZERO = new D(0);

/** The ledger columns the valuation needs (active rows only). */
export interface LedgerFactRow extends LedgerRow {
  investmentId: string;
  realizedPnl: Decimal | null;
}

const POSITION_KINDS: readonly LedgerKind[] = [
  "opening",
  "buy",
  "sell",
  "corporate_action",
];

/**
 * Remaining cost in the trades' own currency (weighted average, R1) when
 * every position row of the holding shares one currency. It reuses the
 * Task 7 replay with that currency treated as the book currency, so the
 * native figure follows exactly the IDR method. Null when currencies mix
 * (e.g. a legacy IDR opening on a USD holding) or the replay is invalid.
 */
function nativeCost(
  rows: readonly LedgerFactRow[],
): { currency: string; amount: Decimal } | null {
  const position = rows.filter((r) => POSITION_KINDS.includes(r.kind));
  const currency = position[0]?.currency;
  if (!currency) return null;
  if (position.some((r) => r.currency !== currency)) return null;
  const replay = replayLedger(
    position.map((r) => ({ ...r, currency: "IDR", fxRate: null })),
  );
  if (replay.invalid) return null;
  return { currency, amount: replay.costBasis };
}

function incomeIdr(row: LedgerFactRow): Decimal {
  const net = rowNetAmount(row);
  if (row.currency === "IDR") return net;
  return row.fxRate && row.fxRate.greaterThan(0) ? net.times(row.fxRate) : ZERO;
}

/** Per-holding ledger facts from its ACTIVE rows. */
export function ledgerFactsByHolding(
  rows: readonly LedgerFactRow[],
): Map<string, LedgerFacts> {
  const grouped = new Map<string, LedgerFactRow[]>();
  for (const r of rows) {
    const list = grouped.get(r.investmentId) ?? [];
    list.push(r);
    grouped.set(r.investmentId, list);
  }
  const out = new Map<string, LedgerFacts>();
  for (const [investmentId, list] of grouped) {
    let realized: Decimal | null = null;
    let income = ZERO;
    const interestPaid = new Map<string, Decimal>();
    for (const r of list) {
      if (r.kind === "sell" && r.realizedPnl) {
        realized = (realized ?? ZERO).plus(r.realizedPnl);
      }
      if (INCOME_KINDS.includes(r.kind)) income = income.plus(incomeIdr(r));
      if (r.kind === "interest") {
        interestPaid.set(
          r.currency,
          (interestPaid.get(r.currency) ?? ZERO).plus(r.grossAmount),
        );
      }
    }
    out.set(investmentId, {
      realizedIdr: realized,
      incomeIdr: income,
      costNative: nativeCost(list),
      interestPaid,
    });
  }
  return out;
}
