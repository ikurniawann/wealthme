import type { TransactionDto } from "@wealthme/contracts";

export type RowKind = "income" | "expense" | "transfer" | "investment";

export type ParsedInvestment = {
  side: "buy" | "sell";
  quantity: number;
  symbol: string;
  /** Execution price per unit, when the description carries it. */
  unitPrice: number | null;
};

// The API stores an investment buy/sell as a transfer whose description is
// generated as "Beli 0.0059 ETH @ 42000000 IDR" / "Jual 0.0001 ETH @ ...".
// There is no structured investment field on the transaction DTO, so the
// description is the only source for the side, quantity and symbol.
const INVESTMENT_DESCRIPTION =
  /^(Beli|Jual|Buy|Sell)\s+([\d.,]+)\s+(\S+)\s*@\s*([\d.,]*)/i;

export function parseInvestment(
  description: string | null,
): ParsedInvestment | null {
  const match = description ? INVESTMENT_DESCRIPTION.exec(description) : null;
  if (!match) return null;
  const quantity = Number(match[2].replaceAll(",", ""));
  if (!Number.isFinite(quantity)) return null;
  return {
    side: /^(beli|buy)$/i.test(match[1]) ? "buy" : "sell",
    quantity,
    symbol: match[3],
    unitPrice: match[4] ? Number(match[4].replaceAll(",", "")) || null : null,
  };
}

export function isInvestmentTx(
  tx: Pick<TransactionDto, "type" | "description">,
) {
  return tx.type === "transfer" && parseInvestment(tx.description) !== null;
}

export function rowKind(
  tx: Pick<TransactionDto, "type" | "description">,
): RowKind {
  return isInvestmentTx(tx) ? "investment" : tx.type;
}

export type InvestmentBreakdown = ParsedInvestment & {
  gross: number | null;
  fee: number | null;
  /** What actually moved: proceeds (sell) or total paid (buy). */
  net: number;
};

/**
 * Gross = quantity x execution price; fee = the gap to the amount that really
 * moved. Both come from the stored description and amount, nothing invented;
 * null when the price is missing or the numbers do not reconcile.
 */
export function investmentBreakdown(
  tx: Pick<TransactionDto, "type" | "description" | "amount">,
): InvestmentBreakdown | null {
  const inv = tx.type === "transfer" ? parseInvestment(tx.description) : null;
  if (!inv) return null;
  const net = parseFloat(tx.amount);
  const gross = inv.unitPrice ? Math.round(inv.quantity * inv.unitPrice) : null;
  const fee =
    gross === null ? null : inv.side === "sell" ? gross - net : net - gross;
  return { ...inv, gross, fee: fee !== null && fee >= 0 ? fee : null, net };
}
