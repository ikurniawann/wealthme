import { randomUUID } from "node:crypto";

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { isRowScoped } from "../../common/utils/privacy.util";
import { runSerializableWithRetry } from "../../common/utils/serializable-retry.util";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../../prisma/prisma.service";
import { toTransactionDto } from "../investment-transaction.mapper";

import { findCashViolations } from "./cash-timeline";
import {
  cashKeyParts,
  dbDateToYmd,
  jakartaTodayYmd,
  ledgerInstant,
  ymdToDbDate,
} from "./ledger-dates";
import { normalizeLedgerInput } from "./ledger-input";
import {
  cashIdr,
  compareLedgerKey,
  formatLedgerPoint,
  INCOME_KINDS,
  replayLedger,
} from "./replay";

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
  ReplayResult,
} from "./replay";
import type { TxClient } from "../../common/utils/serializable-retry.util";
import type {
  Investment,
  InvestmentTransaction,
  Role,
  TransactionType,
} from "@prisma/client";
import type {
  CreateInvestmentLedgerInput,
  InvestmentLedgerConflictCode,
  InvestmentLedgerConflictDto,
  InvestmentLedgerConflictItem,
  InvestmentLedgerResultDto,
  InvestmentMarket,
  UpdateInvestmentLedgerInput,
  VoidInvestmentLedgerInput,
} from "@wealthme/contracts";

const D = Prisma.Decimal;
const DAY_MS = 24 * 60 * 60 * 1000;
const AUDIT_ENTITY = "investment_transaction";
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

type Change =
  | {
      type: "create";
      id: string;
      createdAt: Date;
      row: ProposedRow;
      idempotencyKey: string | null;
    }
  | { type: "edit"; existing: InvestmentTransaction; row: ProposedRow }
  | { type: "void"; existing: InvestmentTransaction; reason: string | null };

interface CashLeg {
  accountId: string;
  /** Signed IDR effect on the account balance. */
  delta: bigint;
  txType: TransactionType;
  cashTransactionId: string | null;
}

interface LockedAccount {
  id: string;
  balance: bigint;
  name: string;
  type: string;
  status: string;
  ownerUserId: string | null;
  isPrivate: boolean;
}

function round2(d: Prisma.Decimal): Prisma.Decimal {
  return d.toDecimalPlaces(2, D.ROUND_HALF_UP);
}

function legacyType(kind: LedgerKind): "buy" | "sell" | null {
  if (kind === "buy" || kind === "opening") return "buy";
  if (kind === "sell") return "sell";
  return null;
}

function rowKey(r: {
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

function storedToLedgerRow(r: InvestmentTransaction): LedgerRow {
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

function proposedToLedgerRow(
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
function legOf(row: ProposedRow): Omit<CashLeg, "cashTransactionId"> | null {
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

function conflict(
  body: Omit<InvestmentLedgerConflictDto, "statusCode">,
): never {
  throw new ConflictException({ statusCode: 409, ...body });
}

/**
 * Investasi ledger engine (Task 7) — every write to a holding's ledger
 * (create, edit, void) runs in ONE Serializable transaction that:
 *  1. locks the holding row and each affected cash account (FOR UPDATE);
 *  2. replays the holding's full active ledger with the change applied
 *     (replay.ts, R1 weighted average, R6 order) and refuses a sell beyond
 *     holdings at its effective point or at any later point (409);
 *  3. rebuilds each affected account's balance timeline and refuses a
 *     change that makes available cash (recorded − held, R9) negative at the
 *     effective point or later (409) — no auto top-up, no clamping;
 *  4. writes the row, its linked cash Transaction (buy = one-sided transfer
 *     out, sell = transfer in, dividend/coupon/interest = income), the
 *     recomputed quantity / costBasisPerUnit and every realizedPnl, and an
 *     AuditLog row.
 * Creates are idempotent per family (R7).
 */
@Injectable()
export class InvestmentLedgerService {
  private readonly logger = new Logger(InvestmentLedgerService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(
    familyGroupId: string,
    investmentId: string,
    input: CreateInvestmentLedgerInput,
    actor: LedgerActor,
  ): Promise<InvestmentLedgerResultDto> {
    return runSerializableWithRetry(this.prisma, async (tx) => {
      const existing = await tx.investmentTransaction.findUnique({
        where: {
          familyGroupId_idempotencyKey: {
            familyGroupId,
            idempotencyKey: input.idempotencyKey,
          },
        },
      });
      if (existing) {
        if (
          existing.investmentId !== investmentId ||
          existing.kind !== input.kind
        ) {
          throw new ConflictException({
            statusCode: 409,
            code: "IDEMPOTENCY_KEY_REUSED",
            message:
              "idempotencyKey ini sudah dipakai untuk transaksi lain. Buka ulang formulir untuk membuat kunci baru.",
          });
        }
        return {
          replayed: true,
          transaction: toTransactionDto(existing),
          holding: await this.holdingState(tx, investmentId),
        };
      }

      const investment = await this.lockInvestment(
        tx,
        familyGroupId,
        investmentId,
      );
      const row = normalizeLedgerInput(
        input,
        holdingConfig(investment),
        jakartaTodayYmd(),
      );
      const written = await this.applyChange(
        tx,
        familyGroupId,
        investment,
        {
          type: "create",
          id: randomUUID(),
          createdAt: new Date(),
          row,
          idempotencyKey: input.idempotencyKey,
        },
        actor,
        null,
      );
      return {
        replayed: false,
        transaction: toTransactionDto(written),
        holding: await this.holdingState(tx, investmentId),
      };
    });
  }

  async update(
    familyGroupId: string,
    investmentId: string,
    transactionId: string,
    input: UpdateInvestmentLedgerInput,
    actor: LedgerActor,
  ): Promise<InvestmentLedgerResultDto> {
    return runSerializableWithRetry(this.prisma, async (tx) => {
      const investment = await this.lockInvestment(
        tx,
        familyGroupId,
        investmentId,
      );
      const existing = await this.findRow(tx, investmentId, transactionId);
      if (existing.status === "void") {
        throw new ConflictException(
          "Transaksi yang sudah dibatalkan tidak dapat diubah",
        );
      }
      const row = normalizeLedgerInput(
        mergeEdit(existing, input),
        holdingConfig(investment),
        jakartaTodayYmd(),
      );
      const written = await this.applyChange(
        tx,
        familyGroupId,
        investment,
        { type: "edit", existing, row },
        actor,
        input.reason ?? null,
      );
      return {
        replayed: false,
        transaction: toTransactionDto(written),
        holding: await this.holdingState(tx, investmentId),
      };
    });
  }

  async void(
    familyGroupId: string,
    investmentId: string,
    transactionId: string,
    input: VoidInvestmentLedgerInput,
    actor: LedgerActor,
  ): Promise<InvestmentLedgerResultDto> {
    return runSerializableWithRetry(this.prisma, async (tx) => {
      const investment = await this.lockInvestment(
        tx,
        familyGroupId,
        investmentId,
      );
      const existing = await this.findRow(tx, investmentId, transactionId);
      if (existing.status === "void") {
        // Voiding twice is a no-op (a retried click), not an error.
        return {
          replayed: true,
          transaction: toTransactionDto(existing),
          holding: await this.holdingState(tx, investmentId),
        };
      }
      const written = await this.applyChange(
        tx,
        familyGroupId,
        investment,
        { type: "void", existing, reason: input.reason ?? null },
        actor,
        input.reason ?? null,
      );
      return {
        replayed: false,
        transaction: toTransactionDto(written),
        holding: await this.holdingState(tx, investmentId),
      };
    });
  }

  /**
   * `PATCH /investments/:id` with quantity/costBasisPerUnit, inside the
   * caller's transaction. The position is owned by the ledger, so the edit
   * is routed through it for every type (deposito included):
   *  - no active ledger rows → an `opening` is created;
   *  - exactly one active row and it is the `opening` → that opening is
   *    edited (replayed, audited);
   *  - anything else → 409: correct it through the transaction history.
   */
  async reviseOpeningPosition(
    tx: TxClient,
    familyGroupId: string,
    investmentId: string,
    patch: { quantity?: string; costBasisPerUnit?: string },
    actor: LedgerActor,
  ): Promise<void> {
    const investment = await this.lockInvestment(
      tx,
      familyGroupId,
      investmentId,
    );
    const active = await tx.investmentTransaction.findMany({
      where: { investmentId, status: "active" },
    });
    const today = jakartaTodayYmd();
    if (active.length === 0) {
      if (patch.quantity === undefined) {
        throw new BadRequestException(
          "Isi kuantitas untuk mencatat kepemilikan awal",
        );
      }
      const row = normalizeLedgerInput(
        {
          kind: "opening",
          effectiveDate: investment.purchasedAt
            ? cashKeyParts(investment.purchasedAt).effectiveDate
            : today,
          quantity: patch.quantity,
          pricePerUnit:
            patch.costBasisPerUnit ?? investment.costBasisPerUnit.toString(),
          currency: "IDR",
          cashAccountId: null,
        },
        holdingConfig(investment),
        today,
      );
      await this.applyChange(
        tx,
        familyGroupId,
        investment,
        {
          type: "create",
          id: randomUUID(),
          createdAt: new Date(),
          row,
          idempotencyKey: null,
        },
        actor,
        "Ubah kepemilikan dari formulir investasi",
      );
      return;
    }
    const [only] = active;
    if (active.length !== 1 || !only || only.kind !== "opening") {
      throw new ConflictException(
        "Kuantitas dan harga rata-rata dihitung dari riwayat transaksi. Koreksi lewat riwayat (ubah atau batalkan transaksinya), bukan dengan menimpa angka kepemilikan.",
      );
    }
    const row = normalizeLedgerInput(
      mergeEdit(only, {
        quantity: patch.quantity,
        pricePerUnit: patch.costBasisPerUnit,
      }),
      holdingConfig(investment),
      today,
    );
    await this.applyChange(
      tx,
      familyGroupId,
      investment,
      { type: "edit", existing: only, row },
      actor,
      "Ubah kepemilikan dari formulir investasi",
    );
  }

  // ── core ──────────────────────────────────────────────────────────────────

  private async applyChange(
    tx: TxClient,
    familyGroupId: string,
    investment: Investment,
    change: Change,
    actor: LedgerActor,
    reason: string | null,
  ): Promise<InvestmentTransaction> {
    const selfId = change.type === "create" ? change.id : change.existing.id;
    const selfCreatedAt =
      change.type === "create" ? change.createdAt : change.existing.createdAt;

    // 1. Holdings: replay the whole active ledger with the change applied.
    const active = await tx.investmentTransaction.findMany({
      where: { investmentId: investment.id, status: "active" },
    });
    const afterRows = active
      .filter((r) => r.id !== selfId)
      .map(storedToLedgerRow);
    if (change.type !== "void") {
      afterRows.push(proposedToLedgerRow(selfId, selfCreatedAt, change.row));
    }
    const replay = replayLedger(afterRows);
    if (replay.invalid) holdingsConflict(replay.invalid, selfId);

    // 2. Cash: the old and new legs and every account they touch.
    const oldLeg =
      change.type === "create"
        ? null
        : await this.existingLeg(tx, change.existing);
    const newLegBase = change.type === "void" ? null : legOf(change.row);
    const nextCashAccountId =
      change.type === "void" ? null : change.row.cashAccountId;
    const accountIds = [
      ...new Set(
        [oldLeg?.accountId, nextCashAccountId].filter(
          (id): id is string => !!id,
        ),
      ),
    ].sort();
    const accounts = await this.lockAccounts(tx, familyGroupId, accountIds);
    const previousCashAccountId =
      change.type === "create" ? null : change.existing.cashAccountId;
    if (nextCashAccountId && nextCashAccountId !== previousCashAccountId) {
      await this.assertUsableCashAccount(
        tx,
        accounts.get(nextCashAccountId),
        actor,
      );
    }
    const selfKeyAfter =
      change.type === "void"
        ? null
        : rowKey({
            id: selfId,
            effectiveDate: change.row.effectiveDate,
            effectiveTime: change.row.effectiveTime,
            createdAt: selfCreatedAt,
          });
    const selfKeyBefore =
      change.type === "create" ? null : rowKey(change.existing);
    for (const accountId of accountIds) {
      const account = accounts.get(accountId) as LockedAccount;
      await this.assertCashTimeline(tx, familyGroupId, account, {
        selfId,
        oldKey: oldLeg?.accountId === accountId ? selfKeyBefore : null,
        newKey: newLegBase?.accountId === accountId ? selfKeyAfter : null,
        newDelta: newLegBase?.accountId === accountId ? newLegBase.delta : null,
        newHeld:
          newLegBase?.accountId === accountId &&
          change.type !== "void" &&
          change.row.kind === "sell" &&
          change.row.settlementDate
            ? {
                settlementDate: change.row.settlementDate,
                proceeds: newLegBase.delta,
              }
            : null,
      });
    }

    // 3. Write: cash leg, the row, recomputed state, audit.
    const realizedById = new Map(
      replay.steps.map((s) => [
        s.id,
        s.realizedPnl === null ? null : round2(s.realizedPnl),
      ]),
    );
    const before = change.type === "create" ? null : change.existing;
    let written: InvestmentTransaction;
    if (change.type === "void") {
      await this.removeLeg(tx, familyGroupId, oldLeg);
      written = await tx.investmentTransaction.update({
        where: { id: selfId },
        data: {
          status: "void",
          voidedAt: new Date(),
          voidReason: change.reason,
          realizedPnl: null,
          cashTransactionId: null,
        },
      });
    } else {
      const cashTransactionId = await this.writeLeg(
        tx,
        familyGroupId,
        investment,
        change.row,
        oldLeg,
        newLegBase,
        actor,
      );
      const data = {
        kind: change.row.kind,
        type: legacyType(change.row.kind),
        quantity: change.row.quantity,
        pricePerUnit: change.row.pricePerUnit,
        occurredAt: ledgerInstant(
          change.row.effectiveDate,
          change.row.effectiveTime,
          change.row.timeZone,
        ),
        effectiveDate: ymdToDbDate(change.row.effectiveDate),
        effectiveTime: change.row.effectiveTime,
        timeZone: change.row.timeZone,
        grossAmount: change.row.grossAmount,
        fee: change.row.fee,
        tax: change.row.tax,
        netAmount: change.row.netAmount,
        currency: change.row.currency,
        feeCurrency: change.row.feeCurrency,
        fxRate: change.row.fxRate,
        settlementDate: change.row.settlementDate
          ? ymdToDbDate(change.row.settlementDate)
          : null,
        cashAccountId: change.row.cashAccountId,
        cashTransactionId,
        note: change.row.note,
        realizedPnl: realizedById.get(selfId) ?? null,
      };
      written =
        change.type === "create"
          ? await tx.investmentTransaction.create({
              data: {
                ...data,
                id: selfId,
                createdAt: selfCreatedAt,
                investmentId: investment.id,
                // Always the loaded holding's family, never the caller's.
                familyGroupId: investment.familyGroupId,
                idempotencyKey: change.idempotencyKey,
              },
            })
          : await tx.investmentTransaction.update({
              where: { id: selfId },
              data,
            });
    }

    await this.persistReplay(tx, investment, replay, active, selfId);

    if (actor.userId) {
      await tx.auditLog.create({
        data: {
          userId: actor.userId,
          familyGroupId: investment.familyGroupId,
          action: change.type,
          entity: AUDIT_ENTITY,
          entityId: selfId,
          before: before
            ? (toTransactionDto(before) as unknown as Prisma.InputJsonValue)
            : undefined,
          after: {
            ...(toTransactionDto(written) as unknown as Record<
              string,
              unknown
            >),
            ...(reason ? { reason } : {}),
          } as Prisma.InputJsonValue,
        },
      });
    }
    return written;
  }

  /** Stored quantity/costBasisPerUnit and every realizedPnl from the replay. */
  private async persistReplay(
    tx: TxClient,
    investment: Investment,
    replay: ReplayResult,
    active: InvestmentTransaction[],
    selfId: string,
  ): Promise<void> {
    const storedById = new Map(active.map((r) => [r.id, r.realizedPnl]));
    for (const step of replay.steps) {
      if (step.id === selfId) continue;
      const next = step.realizedPnl === null ? null : round2(step.realizedPnl);
      const prev = storedById.get(step.id) ?? null;
      const same =
        next === null ? prev === null : prev !== null && prev.equals(next);
      if (!same) {
        await tx.investmentTransaction.update({
          where: { id: step.id },
          data: { realizedPnl: next },
        });
      }
    }
    const quantity = replay.quantity.toDecimalPlaces(8, D.ROUND_HALF_UP);
    const avg = replay.avgCost.toDecimalPlaces(8, D.ROUND_HALF_UP);
    await tx.investment.update({
      where: { id: investment.id },
      data: {
        quantity,
        // Weighted average (R1). With nothing held the last average is kept.
        costBasisPerUnit:
          quantity.greaterThan(0) || avg.greaterThan(0)
            ? avg
            : investment.costBasisPerUnit,
      },
    });
  }

  // ── cash ──────────────────────────────────────────────────────────────────

  private async existingLeg(
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

  private async removeLeg(
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
  private async writeLeg(
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
    const description = this.cashDescription(investment, row);
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
    await this.removeLeg(tx, familyGroupId, oldLeg);
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

  private cashDescription(investment: Investment, row: ProposedRow): string {
    const label = INCOME_LABEL[row.kind];
    if (label) return `${label} ${investment.ticker}`;
    const verb = row.kind === "buy" ? "Beli" : "Jual";
    return `${verb} ${row.quantity.toString()} ${investment.ticker} @ ${row.pricePerUnit.toString()} ${row.currency}`;
  }

  private async lockAccounts(
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

  private async assertUsableCashAccount(
    tx: TxClient,
    account: LockedAccount | undefined,
    actor: LedgerActor,
  ): Promise<void> {
    if (!account) throw new NotFoundException("Kantong dana tidak ditemukan");
    if (account.status === "closed") {
      throw new BadRequestException(
        "Rekening ini sudah ditutup. Ubah statusnya dulu untuk mencatat transaksi baru.",
      );
    }
    if (account.type === "property") {
      throw new BadRequestException(
        "Akun properti tidak dapat dipakai sebagai sumber dana investasi",
      );
    }
    const member = actor.member;
    if (!member || !isRowScoped(member)) return;
    if (account.ownerUserId === member.userId) return;
    if (!account.isPrivate) {
      const share = await tx.accountShare.findUnique({
        where: {
          accountId_userId: { accountId: account.id, userId: member.userId },
        },
        select: { canPost: true },
      });
      if (share?.canPost) return;
    }
    throw new ForbiddenException(
      "This role may only record transactions on an account they own",
    );
  }

  /**
   * Rebuilds `account`'s timeline from the earliest changed point and
   * refuses the write when available cash goes negative there or later.
   */
  private async assertCashTimeline(
    tx: TxClient,
    familyGroupId: string,
    account: LockedAccount,
    p: {
      selfId: string;
      oldKey: LedgerSortKey | null;
      newKey: LedgerSortKey | null;
      newDelta: bigint | null;
      newHeld: { settlementDate: string; proceeds: bigint } | null;
    },
  ): Promise<void> {
    const keys = [p.oldKey, p.newKey].filter(
      (k): k is LedgerSortKey => k !== null,
    );
    const [from] = keys.sort(compareLedgerKey);
    if (!from) return;
    const before = await this.loadTimeline(tx, familyGroupId, account.id, from);
    const after: CashTimeline = {
      movements: before.movements.filter((m) => m.id !== p.selfId),
      held: before.held.filter((h) => h.id !== p.selfId),
    };
    if (p.newKey && p.newDelta !== null) {
      after.movements.push({
        id: p.selfId,
        key: p.newKey,
        delta: p.newDelta,
        transactionId: p.selfId,
      });
      if (p.newHeld) {
        after.held.push({ id: p.selfId, key: p.newKey, ...p.newHeld });
      }
    }
    const violations = findCashViolations({
      balanceNow: account.balance,
      before,
      after,
      from,
    });
    const own = violations.find((v) => v.movement.id === p.selfId);
    const others = violations.filter((v) => v.movement.id !== p.selfId);
    const items: InvestmentLedgerConflictItem[] = others.map((v) => ({
      transactionId: v.movement.transactionId,
      date: formatLedgerPoint(v.movement.key),
      reason: v.description,
    }));
    const first = own ?? violations[0];
    if (!first) return;
    const debit = first.movement.delta < 0 ? -first.movement.delta : BigInt(0);
    const code: InvestmentLedgerConflictCode = own
      ? "INSUFFICIENT_FUNDS"
      : "HISTORY_CONFLICT";
    conflict({
      code,
      message: own
        ? `Dana tersedia di "${account.name}" tidak mencukupi pada ${formatLedgerPoint(first.movement.key)} (tersedia Rp ${first.availableBefore.toString()}, dibutuhkan Rp ${debit.toString()}). Tambahkan top up atau ubah tanggal/nominal.`
        : `Perubahan ini membuat dana tersedia di "${account.name}" negatif pada transaksi berikutnya. Lengkapi riwayat (mis. top up) atau ubah transaksi yang terdampak.`,
      at: formatLedgerPoint(first.movement.key),
      needed: debit.toString(),
      available: first.availableBefore.toString(),
      unit: "IDR",
      conflicts: items,
    });
  }

  private async loadTimeline(
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

  // ── reads / helpers ───────────────────────────────────────────────────────

  private async lockInvestment(
    tx: TxClient,
    familyGroupId: string,
    investmentId: string,
  ): Promise<Investment> {
    await tx.$queryRaw`
      SELECT "id" FROM "investments"
      WHERE "id" = ${investmentId} AND "familyGroupId" = ${familyGroupId}
      FOR UPDATE`;
    const investment = await tx.investment.findUnique({
      where: { id: investmentId, familyGroupId },
    });
    if (!investment) throw new NotFoundException("Investment not found");
    return investment;
  }

  private async findRow(
    tx: TxClient,
    investmentId: string,
    transactionId: string,
  ): Promise<InvestmentTransaction> {
    const row = await tx.investmentTransaction.findFirst({
      where: { id: transactionId, investmentId },
    });
    if (!row)
      throw new NotFoundException("Transaksi investasi tidak ditemukan");
    return row;
  }

  private async holdingState(
    tx: TxClient,
    investmentId: string,
  ): Promise<InvestmentLedgerResultDto["holding"]> {
    const inv = await tx.investment.findUniqueOrThrow({
      where: { id: investmentId },
      select: { id: true, quantity: true, costBasisPerUnit: true },
    });
    const sells = await tx.investmentTransaction.aggregate({
      where: { investmentId, kind: "sell", status: "active" },
      _sum: { realizedPnl: true },
      _count: { _all: true },
    });
    return {
      id: inv.id,
      quantity: inv.quantity.toString(),
      costBasisPerUnit: inv.costBasisPerUnit.toString(),
      realizedPnlRp:
        sells._count._all > 0
          ? (sells._sum.realizedPnl ?? new D(0)).toString()
          : null,
    };
  }
}

function holdingConfig(inv: Investment): LedgerHoldingConfig {
  return {
    market: inv.market as InvestmentMarket | null,
    allowFraction: inv.allowFraction,
    cashAccountId: inv.cashAccountId,
  };
}

function cashDelta(
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

function holdingsConflict(invalid: ReplayInvalidStep, selfId: string): never {
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
function mergeEdit(
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
