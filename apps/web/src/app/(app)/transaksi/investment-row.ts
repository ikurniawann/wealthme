import type { TransactionDto } from "@wealthme/contracts";

export type RowKind = "income" | "expense" | "transfer" | "investment";

export type InvestmentBreakdown = {
  /** Investment id, for the /investasi/<id> link. */
  id: string;
  symbol: string;
  name: string;
  side: "buy" | "sell";
  quantity: number;
  unitPrice: number | null;
  gross: number | null;
  /** Fees including tax. */
  fee: number | null;
  /** What actually moved: proceeds (sell) or total paid (buy). */
  net: number;
  /** Money columns are only meaningful (and shown) in rupiah. */
  isIdr: boolean;
};

type WithInvestment = Pick<TransactionDto, "investment">;

/**
 * The investment-ledger row behind an investment cash leg, read from the API's
 * structured `investment` field. Rows without it (including every row from an
 * older API) are plain transactions: no derived numbers, the description is
 * shown as-is.
 */
export function investmentBreakdown(
  tx: WithInvestment,
): InvestmentBreakdown | null {
  const inv = tx.investment;
  if (!inv) return null;
  const num = (value: string): number | null => {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };
  const quantity = num(inv.quantity);
  const net = num(inv.net);
  if (quantity === null || net === null) return null;
  const isIdr = inv.currency === "IDR";
  return {
    id: inv.id,
    symbol: inv.ticker,
    name: inv.name,
    side: inv.side,
    quantity,
    unitPrice: isIdr ? num(inv.unitPrice) : null,
    gross: isIdr ? num(inv.gross) : null,
    fee: isIdr ? num(inv.fee) : null,
    net,
    isIdr,
  };
}

export function isInvestmentTx(tx: WithInvestment): boolean {
  return investmentBreakdown(tx) !== null;
}

export function rowKind(tx: WithInvestment & Pick<TransactionDto, "type">) {
  const kind: RowKind = isInvestmentTx(tx) ? "investment" : tx.type;
  return kind;
}
