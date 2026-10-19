import type { InvestmentTransaction as InvestmentTransactionRow } from "@prisma/client";
import type { Decimal } from "@prisma/client/runtime/library";
import type { InvestmentTransactionDto } from "@wealthme/contracts";

export function decimalToString(d: Decimal | null): string {
  return d?.toString() ?? "0";
}

/** Unlike decimalToString, never fabricates "0" — null stays null (e.g. "no
 * sell has ever been recorded" must read differently from "sold at exactly
 * break-even"). */
export function decimalToStringOrNull(d: Decimal | null): string | null {
  return d ? d.toString() : null;
}

function dbDateToString(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

export function toTransactionDto(
  r: InvestmentTransactionRow,
): InvestmentTransactionDto {
  return {
    id: r.id,
    investmentId: r.investmentId,
    type: r.type,
    quantity: decimalToString(r.quantity),
    pricePerUnit: decimalToString(r.pricePerUnit),
    occurredAt: r.occurredAt.toISOString(),
    realizedPnl: decimalToStringOrNull(r.realizedPnl),
    createdAt: r.createdAt.toISOString(),
    kind: r.kind,
    effectiveDate: r.effectiveDate.toISOString().slice(0, 10),
    effectiveTime: r.effectiveTime,
    timeZone: r.timeZone,
    grossAmount: decimalToString(r.grossAmount),
    fee: decimalToString(r.fee),
    tax: decimalToString(r.tax),
    netAmount: decimalToString(r.netAmount),
    currency: r.currency,
    feeCurrency: r.feeCurrency,
    fxRate: decimalToStringOrNull(r.fxRate),
    settlementDate: dbDateToString(r.settlementDate),
    cashAccountId: r.cashAccountId,
    cashTransactionId: r.cashTransactionId,
    idempotencyKey: r.idempotencyKey,
    status: r.status,
    voidedAt: r.voidedAt?.toISOString() ?? null,
    voidReason: r.voidReason,
    note: r.note,
    updatedAt: r.updatedAt.toISOString(),
  };
}
