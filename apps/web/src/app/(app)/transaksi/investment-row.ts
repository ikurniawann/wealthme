import type { TransactionDto } from "@wealthme/contracts";

export type RowKind = "income" | "expense" | "transfer" | "investment";

export type ParsedInvestment = {
  side: "buy" | "sell";
  quantity: number;
  symbol: string;
};

// The API stores an investment buy/sell as a transfer whose description is
// generated as "Beli 0.0059 ETH @ 42000000 IDR" / "Jual 0.0001 ETH @ ...".
// There is no structured investment field on the transaction DTO, so the
// description is the only source for the side, quantity and symbol.
const INVESTMENT_DESCRIPTION = /^(Beli|Jual|Buy|Sell)\s+([\d.,]+)\s+(\S+)\s*@/i;

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
