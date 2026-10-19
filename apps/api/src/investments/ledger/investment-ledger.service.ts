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
  jakartaTodayYmd,
  ledgerInstant,
  ymdToDbDate,
} from "./ledger-dates";
import { normalizeLedgerInput } from "./ledger-input";
import {
  conflict,
  existingCashLeg,
  holdingConfig,
  holdingsConflict,
  legacyType,
  legOf,
  loadCashTimeline,
  lockAccounts,
  mergeEdit,
  proposedToLedgerRow,
  removeCashLeg,
  round2,
  rowKey,
  storedToLedgerRow,
  writeCashLeg,
} from "./ledger-support";
import { compareLedgerKey, formatLedgerPoint, replayLedger } from "./replay";

import type { CashTimeline } from "./cash-timeline";
import type { ProposedRow } from "./ledger-input";
import type { LedgerActor, LockedAccount } from "./ledger-support";
import type { LedgerSortKey, ReplayResult } from "./replay";
import type { TxClient } from "../../common/utils/serializable-retry.util";
import type { Investment, InvestmentTransaction } from "@prisma/client";
import type {
  CreateInvestmentLedgerInput,
  InvestmentLedgerConflictCode,
  InvestmentLedgerConflictItem,
  InvestmentLedgerResultDto,
  UpdateInvestmentLedgerInput,
  VoidInvestmentLedgerInput,
} from "@wealthme/contracts";

export type { LedgerActor } from "./ledger-support";

const D = Prisma.Decimal;
const AUDIT_ENTITY = "investment_transaction";

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
        : await existingCashLeg(tx, change.existing);
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
    const accounts = await lockAccounts(tx, familyGroupId, accountIds);
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
      await removeCashLeg(tx, familyGroupId, oldLeg);
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
      const cashTransactionId = await writeCashLeg(
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
    const before = await loadCashTimeline(tx, familyGroupId, account.id, from);
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
