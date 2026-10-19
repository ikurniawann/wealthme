import { ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import {
  cashKeyParts,
  dbDateToYmd,
  ledgerInstant,
  ymdToDbDate,
} from "./ledger-dates";
import { cashIdr, formatLedgerPoint, INCOME_KINDS } from "./replay";

import type { CashMovement, CashTimeline, HeldCredit } from "./cash-timeline";
import type {
  LedgerHoldingConfig,
  ProposedRow,
  RawLedgerInput,
} from "./ledger-input";
import type {
  LedgerKind,
  LedgerRow,
  LedgerSortKey,
  ReplayInvalidStep,
} from "./replay";
import type { TxClient } from "../../common/utils/serializable-retry.util";
import type {
  Investment,
  InvestmentTransaction,
  Role,
  TransactionType,
} from "@prisma/client";
import type {
  InvestmentLedgerConflictDto,
  InvestmentMarket,
  UpdateInvestmentLedgerInput,
} from "@wealthme/contracts";

/**
 * Investasi ledger engine — module helpers shared by
 * InvestmentLedgerService: row/key mapping, the edit merge, conflict
 * bodies, account locking, the pocket timeline loader and the cash-leg
 * writers. Everything here runs inside the caller's Serializable
 * transaction.
 */

const D = Prisma.Decimal;
const DAY_MS = 24 * 60 * 60 * 1000;
const INCOME_CATEGORY_NAME = "Hasil Investasi";
const INCOME_LABEL: Partial<Record<LedgerKind, string>> = {
  dividend: "Dividen",
  coupon: "Kupon",
  interest: "Bunga",
};

/** Who is writing: the user for audit rows, the member for row scoping. */
export interface LedgerActor {
  userId: string | null;
  member: { userId: string; role: Role; rowScoped?: boolean } | null;
}

export interface CashLeg {
  accountId: string;
  /** Signed IDR effect on the account balance. */
  delta: bigint;
  txType: TransactionType;
  cashTransactionId: string | null;
}

export interface LockedAccount {
  id: string;
  balance: bigint;
  name: string;
  type: string;
  status: string;
  ownerUserId: string | null;
  isPrivate: boolean;
}

export function round2(d: Prisma.Decimal): Prisma.Decimal {
  return d.toDecimalPlaces(2, D.ROUND_HALF_UP);
}

export function legacyType(kind: LedgerKind): "buy" | "sell" | null {
  if (kind === "buy" || kind === "opening") return "buy";
  if (kind === "sell") return "sell";
  return null;
}

export function rowKey(r: {
  id: string;
  effectiveDate: Date | string;
  effectiveTime: string | null;
  createdAt: Date;
}): LedgerSortKey {
  return {
    effectiveDate:
      typeof r.effectiveDate === "string"
        ? r.effectiveDate
        : dbDateToYmd(r.effectiveDate),
    effectiveTime: r.effectiveTime,
    createdAt: r.createdAt,
    id: r.id,
  };
}

export function storedToLedgerRow(r: InvestmentTransaction): LedgerRow {
  return {
    ...rowKey(r),
    kind: r.kind,
    quantity: r.quantity,
    pricePerUnit: r.pricePerUnit,
    grossAmount: r.grossAmount,
    fee: r.fee,
    tax: r.tax,
    currency: r.currency,
    fxRate: r.fxRate,
  };
}

export function proposedToLedgerRow(
  id: string,
  createdAt: Date,
  row: ProposedRow,
): LedgerRow {
  return {
    id,
    createdAt,
    effectiveDate: row.effectiveDate,
    effectiveTime: row.effectiveTime,
    kind: row.kind,
    quantity: row.quantity,
    pricePerUnit: row.pricePerUnit,
    grossAmount: row.grossAmount,
    fee: row.fee,
    tax: row.tax,
    currency: row.currency,
    fxRate: row.fxRate,
  };
}

/** IDR cash leg a proposed row moves, or null (no pocket / nothing moves). */
export function legOf(
  row: ProposedRow,
): Omit<CashLeg, "cashTransactionId"> | null {
  if (!row.cashAccountId) return null;
  if (row.kind === "opening" || row.kind === "corporate_action") return null;
  const amount = cashIdr(row.netAmount, row.currency, row.fxRate);
  if (amount === null || amount === BigInt(0)) return null;
  if (row.kind === "buy") {
    return { accountId: row.cashAccountId, delta: -amount, txType: "transfer" };
  }
  return {
    accountId: row.cashAccountId,
    delta: amount,
    txType: INCOME_KINDS.includes(row.kind) ? "income" : "transfer",
  };
}

export function conflict(
  body: Omit<InvestmentLedgerConflictDto, "statusCode">,
): never {
  throw new ConflictException({ statusCode: 409, ...body });
}

export async function lockAccounts(
  tx: TxClient,
  familyGroupId: string,
  ids: string[],
): Promise<Map<string, LockedAccount>> {
  const out = new Map<string, LockedAccount>();
  if (ids.length === 0) return out;
  const rows = await tx.$queryRaw<LockedAccount[]>`
    SELECT "id", "balance", "name", "type"::text AS "type",
           "status"::text AS "status", "ownerUserId", "isPrivate"
    FROM "accounts"
    WHERE "id" IN (${Prisma.join(ids)}) AND "familyGroupId" = ${familyGroupId}
    ORDER BY "id"
    FOR UPDATE`;
  for (const r of rows) out.set(r.id, { ...r, balance: BigInt(r.balance) });
  for (const id of ids) {
    if (!out.has(id)) throw new NotFoundException(`Account ${id} not found`);
  }
  return out;
}

export async function loadCashTimeline(
  tx: TxClient,
  familyGroupId: string,
  accountId: string,
  from: LedgerSortKey,
): Promise<CashTimeline> {
  // A day of margin: Jakarta dates start 7h before UTC midnight.
  const since = new Date(ymdToDbDate(from.effectiveDate).getTime() - DAY_MS);
  const cash = await tx.transaction.findMany({
    where: {
      familyGroupId,
      occurredAt: { gte: since },
      OR: [{ accountId }, { toAccountId: accountId }],
    },
    select: {
      id: true,
      type: true,
      accountId: true,
      toAccountId: true,
      amount: true,
      occurredAt: true,
      createdAt: true,
    },
  });
  const linked =
    cash.length === 0
      ? []
      : await tx.investmentTransaction.findMany({
          where: { cashTransactionId: { in: cash.map((c) => c.id) } },
          select: {
            id: true,
            cashTransactionId: true,
            effectiveDate: true,
            effectiveTime: true,
            createdAt: true,
          },
        });
  const linkByCash = new Map(linked.map((l) => [l.cashTransactionId, l]));
  const movements: CashMovement[] = cash.map((c) => {
    const link = linkByCash.get(c.id);
    const key: LedgerSortKey = link
      ? rowKey(link)
      : { ...cashKeyParts(c.occurredAt), createdAt: c.createdAt, id: c.id };
    return {
      id: link?.id ?? c.id,
      key,
      delta: cashDelta(c, accountId),
      transactionId: link?.id ?? c.id,
    };
  });

  const sells = await tx.investmentTransaction.findMany({
    where: {
      familyGroupId,
      cashAccountId: accountId,
      cashTransactionId: { not: null },
      kind: "sell",
      status: "active",
      settlementDate: { gt: ymdToDbDate(from.effectiveDate) },
    },
  });
  const held: HeldCredit[] = [];
  for (const s of sells) {
    const proceeds = cashIdr(s.netAmount, s.currency, s.fxRate);
    if (proceeds === null || !s.settlementDate) continue;
    held.push({
      id: s.id,
      key: rowKey(s),
      settlementDate: dbDateToYmd(s.settlementDate),
      proceeds,
    });
  }
  return { movements, held };
}

export function holdingConfig(inv: Investment): LedgerHoldingConfig {
  return {
    market: inv.market as InvestmentMarket | null,
    allowFraction: inv.allowFraction,
    cashAccountId: inv.cashAccountId,
  };
}

export function cashDelta(
  c: {
    type: TransactionType;
    accountId: string | null;
    toAccountId: string | null;
    amount: bigint;
  },
  accountId: string,
): bigint {
  if (c.type === "income")
    return c.accountId === accountId ? c.amount : BigInt(0);
  if (c.type === "expense") {
    return c.accountId === accountId ? -c.amount : BigInt(0);
  }
  if (c.accountId === accountId) return -c.amount;
  if (c.toAccountId === accountId) return c.amount;
  return BigInt(0);
}

export function holdingsConflict(
  invalid: ReplayInvalidStep,
  selfId: string,
): never {
  const own = invalid.id === selfId;
  conflict({
    code:
      own && invalid.reason !== "MISSING_FX_RATE"
        ? "INSUFFICIENT_HOLDINGS"
        : "HISTORY_CONFLICT",
    message: own
      ? `Kepemilikan tidak mencukupi pada ${formatLedgerPoint(invalid)}: ${invalid.description}.`
      : `Perubahan ini membuat transaksi berikutnya tidak valid (${invalid.description}). Lengkapi riwayat (mis. kepemilikan awal) atau ubah transaksi yang terdampak.`,
    at: formatLedgerPoint(invalid),
    needed: invalid.needed.toString(),
    available: invalid.available.toString(),
    unit: "units",
    conflicts: own
      ? []
      : [
          {
            transactionId: invalid.id,
            date: formatLedgerPoint(invalid),
            reason: invalid.description,
          },
        ],
  });
}

/** An edit body merged onto the stored row, as raw ledger input. */
export function mergeEdit(
  existing: InvestmentTransaction,
  input: UpdateInvestmentLedgerInput,
): RawLedgerInput {
  const effectiveDate =
    input.effectiveDate ?? dbDateToYmd(existing.effectiveDate);
  const termsChanged =
    input.quantity !== undefined || input.pricePerUnit !== undefined;
  const dateChanged =
    input.effectiveDate !== undefined &&
    input.effectiveDate !== dbDateToYmd(existing.effectiveDate);
  // A row whose cash Transaction was already removed keeps no cash leg
  // unless the edit names an account explicitly — never debit twice.
  const existingCash = existing.cashTransactionId
    ? existing.cashAccountId
    : null;
  return {
    kind: existing.kind,
    effectiveDate,
    effectiveTime:
      input.effectiveTime !== undefined
        ? input.effectiveTime
        : existing.effectiveTime,
    timeZone: input.timeZone !== undefined ? input.timeZone : existing.timeZone,
    quantity: input.quantity ?? existing.quantity.toString(),
    pricePerUnit: input.pricePerUnit ?? existing.pricePerUnit.toString(),
    grossAmount:
      input.grossAmount ??
      (termsChanged || existing.kind === "opening"
        ? undefined
        : existing.grossAmount.toString()),
    fee: input.fee ?? existing.fee.toString(),
    tax: input.tax ?? existing.tax.toString(),
    currency: input.currency ?? existing.currency,
    feeCurrency:
      input.feeCurrency !== undefined
        ? input.feeCurrency
        : existing.feeCurrency,
    fxRate:
      input.fxRate !== undefined
        ? input.fxRate
        : (existing.fxRate?.toString() ?? null),
    settlementDate:
      input.settlementDate !== undefined
        ? input.settlementDate
        : dateChanged
          ? undefined
          : existing.settlementDate
            ? dbDateToYmd(existing.settlementDate)
            : null,
    cashAccountId:
      input.cashAccountId !== undefined ? input.cashAccountId : existingCash,
    note: input.note !== undefined ? input.note : existing.note,
  };
}

export async function existingCashLeg(
  tx: TxClient,
  row: InvestmentTransaction,
): Promise<CashLeg | null> {
  if (!row.cashAccountId || !row.cashTransactionId) return null;
  const cash = await tx.transaction.findUnique({
    where: { id: row.cashTransactionId },
    select: { id: true, amount: true, type: true },
  });
  if (!cash) return null;
  const out = row.kind === "buy";
  return {
    accountId: row.cashAccountId,
    delta: out ? -cash.amount : cash.amount,
    txType: cash.type,
    cashTransactionId: cash.id,
  };
}

export async function removeCashLeg(
  tx: TxClient,
  familyGroupId: string,
  leg: CashLeg | null,
): Promise<void> {
  if (!leg?.cashTransactionId) return;
  await tx.transaction.delete({ where: { id: leg.cashTransactionId } });
  await tx.account.update({
    where: { id: leg.accountId, familyGroupId },
    data: { balance: { increment: -leg.delta } },
  });
}

/** Creates, updates or replaces the linked cash Transaction; returns its id. */
export async function writeCashLeg(
  tx: TxClient,
  familyGroupId: string,
  investment: Investment,
  row: ProposedRow,
  oldLeg: CashLeg | null,
  newLeg: Omit<CashLeg, "cashTransactionId"> | null,
  actor: LedgerActor,
): Promise<string | null> {
  const occurredAt = ledgerInstant(
    row.effectiveDate,
    row.effectiveTime,
    row.timeZone,
  );
  const description = cashDescription(investment, row);
  if (
    oldLeg?.cashTransactionId &&
    newLeg &&
    oldLeg.accountId === newLeg.accountId &&
    oldLeg.txType === newLeg.txType
  ) {
    const amount = newLeg.delta < 0 ? -newLeg.delta : newLeg.delta;
    await tx.transaction.update({
      where: { id: oldLeg.cashTransactionId },
      data: { amount, description, occurredAt },
    });
    if (newLeg.delta !== oldLeg.delta) {
      await tx.account.update({
        where: { id: newLeg.accountId, familyGroupId },
        data: { balance: { increment: newLeg.delta - oldLeg.delta } },
      });
    }
    return oldLeg.cashTransactionId;
  }
  await removeCashLeg(tx, familyGroupId, oldLeg);
  if (!newLeg) return null;

  const amount = newLeg.delta < 0 ? -newLeg.delta : newLeg.delta;
  const categoryId =
    newLeg.txType === "income"
      ? ((
          await tx.category.findFirst({
            where: {
              familyGroupId,
              kind: "income",
              name: INCOME_CATEGORY_NAME,
            },
            select: { id: true },
          })
        )?.id ?? null)
      : null;
  // Buy: one-sided transfer OUT of the pocket (an allocation to the
  // holding, never an expense). Sell: transfer IN of net proceeds (the
  // realized P/L lives on the ledger row, not in income/expense).
  // Dividend/coupon/interest: income to the pocket.
  const created = await tx.transaction.create({
    data: {
      familyGroupId,
      accountId:
        newLeg.delta < 0 || newLeg.txType === "income"
          ? newLeg.accountId
          : null,
      toAccountId:
        newLeg.delta > 0 && newLeg.txType === "transfer"
          ? newLeg.accountId
          : null,
      categoryId,
      type: newLeg.txType,
      amount,
      description,
      occurredAt,
      createdByUserId: actor.userId,
    },
    select: { id: true },
  });
  await tx.account.update({
    where: { id: newLeg.accountId, familyGroupId },
    data: { balance: { increment: newLeg.delta } },
  });
  return created.id;
}

function cashDescription(investment: Investment, row: ProposedRow): string {
  const label = INCOME_LABEL[row.kind];
  if (label) return `${label} ${investment.ticker}`;
  const verb = row.kind === "buy" ? "Beli" : "Jual";
  return `${verb} ${row.quantity.toString()} ${investment.ticker} @ ${row.pricePerUnit.toString()} ${row.currency}`;
}
