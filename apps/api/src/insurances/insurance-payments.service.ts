import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { assertBankNotOverdrawn } from "../common/utils/bank-overdraft.util";
import {
  runSerializableWithRetry,
  type TxClient,
} from "../common/utils/serializable-retry.util";
import {
  NOTIFICATION_SENDER_PORT,
  type NotificationSenderPort,
} from "../notifications/notification-sender.port";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";
import { checkBudgetAlert } from "../transactions/transaction-alerts.util";

import {
  INSURANCE_INCLUDE,
  toInsuranceDto,
  toPaymentDto,
} from "./insurance-mapper";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { InsurancePremiumBudgetService } from "./insurance-premium-budget.service";
import {
  MONTHS_PER_PERIOD,
  addMonthsClamped,
  monthlyBudgetContribution,
  currentPremiumWindow,
  isRecurringPeriod,
  jakartaDayStartInstant,
  nextPremiumDue,
  parseDateOnly,
  sameDay,
  scheduleOptionsFor,
  todayInTimeZone,
  ymd,
} from "./premium-schedule.util";

import type { InsurancePayResponseDto } from "./dto/insurance-response.dto";
import type { PayInsuranceDto } from "./dto/pay-insurance.dto";
import type { InsurancePaymentDto } from "@wealthme/contracts";

type Insurance = Prisma.InsuranceGetPayload<object>;

/**
 * Asuransi S7 — premium payments. `pay()` creates exactly ONE expense
 * transaction (EPIC-023 E1 behaviour) + ONE `InsurancePayment` row, debits
 * the source account and advances `nextPremiumDueDate` by one period — all
 * in one Serializable transaction (runSerializableWithRetry; see the
 * pre-Task-22 docblock history in git for the overdraft-race reasoning).
 *
 * Idempotency: a request carrying an idempotency key that already paid
 * returns the ORIGINAL payment (`replayed: true`) and changes nothing. Two
 * concurrent requests with the same key race on the
 * (insuranceId, idempotencyKey) unique index; the loser's P2002 is retried
 * by runSerializableWithRetry and then finds the winner's row.
 */
@Injectable()
export class InsurancePaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly budget: InsurancePremiumBudgetService,
    @Inject(NOTIFICATION_SENDER_PORT)
    private readonly notificationSender: NotificationSenderPort,
  ) {}

  /**
   * Task 21 review fix (rollback window) — gives a payment row to every
   * premium expense that has none: the same INSERT … ON CONFLICT
   * ("transactionId") DO NOTHING as the S7 backfill, family-scoped. Catches
   * payments recorded by the PREVIOUS image after a rollback. It also pulls
   * `nextPremiumDueDate` forward to the legacy `renewalDate` when old code
   * advanced only the legacy column. Idempotent and cheap (unique index).
   */
  async reconcileLegacyPayments(familyGroupId: string): Promise<void> {
    await this.prisma.$executeRaw`
      INSERT INTO "insurance_payments"
        ("id", "insuranceId", "familyGroupId", "dueDate", "paidAt", "amount", "currency", "accountId", "transactionId", "createdByUserId", "createdAt")
      SELECT gen_random_uuid()::text, t."insuranceId", t."familyGroupId", NULL, t."occurredAt",
             t."amount"::numeric, 'IDR', t."accountId", t."id", t."createdByUserId", t."createdAt"
      FROM "transactions" t
      JOIN "insurances" i ON i."id" = t."insuranceId" AND i."familyGroupId" = t."familyGroupId"
      WHERE t."familyGroupId" = ${familyGroupId}
        AND t."insuranceId" IS NOT NULL
        AND t."type" = 'expense'
        AND NOT EXISTS (SELECT 1 FROM "insurance_payments" p WHERE p."transactionId" = t."id")
      ON CONFLICT ("transactionId") DO NOTHING`;
    await this.prisma.$executeRaw`
      UPDATE "insurances"
      SET "nextPremiumDueDate" = "renewalDate"::date
      WHERE "familyGroupId" = ${familyGroupId}
        AND "renewalDate" IS NOT NULL
        AND "nextPremiumDueDate" IS NOT NULL
        AND "renewalDate"::date > "nextPremiumDueDate"`;
  }

  async listPayments(
    familyGroupId: string,
    insuranceId: string,
  ): Promise<InsurancePaymentDto[]> {
    const rows = await this.prisma.insurancePayment.findMany({
      where: { familyGroupId, insuranceId },
      orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
    });
    return rows.map(toPaymentDto);
  }

  /** Policy ids whose current due / period is already paid (one query). */
  async paidThisPeriodIds(
    familyGroupId: string,
    policies: Insurance[],
    today: Date,
  ): Promise<Set<string>> {
    if (policies.length === 0) return new Set();
    const payments = await this.prisma.insurancePayment.findMany({
      where: { familyGroupId, insuranceId: { in: policies.map((p) => p.id) } },
      select: { insuranceId: true, dueDate: true, paidAt: true },
    });
    const byPolicy = new Map<string, typeof payments>();
    for (const p of payments) {
      byPolicy.set(p.insuranceId, [...(byPolicy.get(p.insuranceId) ?? []), p]);
    }
    const paid = new Set<string>();
    for (const policy of policies) {
      const rows = byPolicy.get(policy.id) ?? [];
      if (rows.length > 0 && isCurrentDuePaid(policy, rows, today)) {
        paid.add(policy.id);
      }
    }
    return paid;
  }

  async pay(
    familyGroupId: string,
    id: string,
    dto: PayInsuranceDto,
    actorUserId: string | null,
  ): Promise<InsurancePayResponseDto> {
    await this.reconcileLegacyPayments(familyGroupId);
    const result = await runSerializableWithRetry(this.prisma, (tx) =>
      this.runPay(tx, familyGroupId, id, dto, actorUserId),
    );
    if (!result.replayed && result.categoryId) {
      // H5 — budget alert once, after commit.
      void checkBudgetAlert(
        this.prisma,
        this.notificationSender,
        familyGroupId,
        result.categoryId,
      );
    }
    const policy = await this.prisma.insurance.findUniqueOrThrow({
      where: { id, familyGroupId },
      include: INSURANCE_INCLUDE,
    });
    const today = todayInTimeZone();
    const paid = await this.paidThisPeriodIds(familyGroupId, [policy], today);
    return {
      ...toInsuranceDto(policy, { today, paidThisPeriod: paid.has(policy.id) }),
      payment: toPaymentDto(result.payment),
      replayed: result.replayed,
    };
  }

  private async runPay(
    tx: TxClient,
    familyGroupId: string,
    id: string,
    dto: PayInsuranceDto,
    actorUserId: string | null,
  ) {
    const insurance = await tx.insurance.findUnique({
      where: { id, familyGroupId },
    });
    if (!insurance) throw new NotFoundException("Insurance not found");

    if (dto.idempotencyKey) {
      const original = await tx.insurancePayment.findUnique({
        where: {
          insuranceId_idempotencyKey: {
            insuranceId: id,
            idempotencyKey: dto.idempotencyKey,
          },
        },
      });
      if (original) {
        return { payment: original, replayed: true, categoryId: null };
      }
    }

    const today = todayInTimeZone();
    const settledDue = dto.dueDate
      ? parseDateOnly(dto.dueDate)
      : insurance.nextPremiumDueDate;
    await this.assertNotAlreadyPaid(tx, insurance, settledDue, today);

    const sourceAccount = await tx.account.findUnique({
      where: { id: dto.sourceAccountId, familyGroupId },
    });
    if (!sourceAccount) {
      throw new NotFoundException(`Account ${dto.sourceAccountId} not found`);
    }
    const amount = dto.amount ? BigInt(dto.amount) : insurance.premiumAmount;
    if (amount <= 0n) {
      throw new BadRequestException("amount must be greater than zero");
    }

    // EPIC-021 #22 — overdraft floor on the fresh debit.
    await assertBankNotOverdrawn(tx, familyGroupId, sourceAccount.id, amount);
    await tx.account.update({
      where: { id: sourceAccount.id, familyGroupId },
      data: { balance: { decrement: amount } },
    });

    const categoryId = await this.budget.resolveOwnPremiumCategoryId(
      tx,
      familyGroupId,
      insurance,
    );
    const contribution = monthlyBudgetContribution(
      insurance.premiumAmount,
      insurance.premiumPeriod,
    );
    if (contribution > 0n) {
      await this.budget.syncPremiumBudgetLine(
        tx,
        familyGroupId,
        { ...insurance, premiumCategoryId: categoryId },
        contribution,
      );
    }

    const now = new Date();
    const transaction = await tx.transaction.create({
      data: {
        familyGroupId,
        accountId: sourceAccount.id,
        categoryId,
        amount,
        type: "expense",
        insuranceId: id,
        description: `Premi ${insurance.name}`,
        occurredAt: now,
        createdByUserId: actorUserId,
      },
    });
    const payment = await tx.insurancePayment.create({
      data: {
        insuranceId: id,
        familyGroupId,
        dueDate: settledDue,
        paidAt: now,
        amount: new Prisma.Decimal(amount.toString()),
        currency: "IDR",
        accountId: sourceAccount.id,
        transactionId: transaction.id,
        idempotencyKey: dto.idempotencyKey ?? null,
        createdByUserId: actorUserId,
      },
    });

    // Advance only when the CURRENT next due was settled (paying an older,
    // auto-advanced due records it without moving the schedule). The legacy
    // renewalDate is mirrored during the rollback window (Task 21 fix).
    if (
      settledDue &&
      insurance.nextPremiumDueDate &&
      sameDay(settledDue, insurance.nextPremiumDueDate)
    ) {
      const next = nextPremiumDue(
        settledDue,
        insurance.premiumPeriod,
        scheduleOptionsFor(insurance),
      );
      await tx.insurance.update({
        where: { id, familyGroupId },
        data: {
          nextPremiumDueDate: next,
          ...(next && { renewalDate: next }),
        },
      });
    }

    return { payment, replayed: false, categoryId };
  }

  /**
   * One payment per scheduled due. A recurring due may be paid early, but
   * never more than one period ahead of today (a second click with a fresh
   * key cannot silently prepay the following due). A policy with no due
   * date falls back to one payment per current premium window (single:
   * one payment ever).
   */
  private async assertNotAlreadyPaid(
    tx: TxClient,
    insurance: Insurance,
    settledDue: Date | null,
    today: Date,
  ): Promise<void> {
    const conflict = (detail: string) =>
      new ConflictException(
        `"${insurance.name}" ${detail} — koreksi pembayaran yang ada, jangan bayar dua kali`,
      );

    if (settledDue) {
      const existing = await tx.insurancePayment.findFirst({
        where: { insuranceId: insurance.id, dueDate: settledDue },
        select: { id: true },
      });
      if (existing) {
        throw conflict(`sudah dibayar untuk jatuh tempo ${ymd(settledDue)}`);
      }
      if (isRecurringPeriod(insurance.premiumPeriod)) {
        const limit = nextPremiumDue(today, insurance.premiumPeriod);
        if (limit && settledDue > limit) {
          throw conflict(
            `jatuh tempo ${ymd(settledDue)} masih lebih dari satu periode lagi`,
          );
        }
      }
      return;
    }

    if (insurance.premiumPeriod === "single") {
      const any = await tx.insurancePayment.findFirst({
        where: { insuranceId: insurance.id },
        select: { id: true },
      });
      if (any) throw conflict("premi sekali bayar sudah dibayar");
      return;
    }
    const window = currentPremiumWindow(insurance.premiumPeriod, today);
    if (!window) return;
    const existing = await tx.insurancePayment.findFirst({
      where: {
        insuranceId: insurance.id,
        paidAt: {
          gte: jakartaDayStartInstant(window.start),
          lt: jakartaDayStartInstant(window.end),
        },
      },
      select: { id: true },
    });
    if (existing) throw conflict("sudah dibayar periode ini");
  }
}

/**
 * "Paid this period" for the list: the due right before nextPremiumDueDate
 * was settled and the next one is not overdue yet. A payment without a due
 * (legacy/reconciled) counts when it falls in the current premium window;
 * a policy without a schedule uses that window alone (single: any payment).
 */
function isCurrentDuePaid(
  policy: Insurance,
  rows: { dueDate: Date | null; paidAt: Date }[],
  today: Date,
): boolean {
  const window = currentPremiumWindow(policy.premiumPeriod, today);
  const inWindow = (paidAt: Date) =>
    !!window &&
    paidAt >= jakartaDayStartInstant(window.start) &&
    paidAt < jakartaDayStartInstant(window.end);

  const next = policy.nextPremiumDueDate;
  if (next) {
    if (next < today) return false;
    const months = MONTHS_PER_PERIOD[policy.premiumPeriod];
    const prev = months ? addMonthsClamped(next, -months) : null;
    return rows.some((r) =>
      r.dueDate
        ? r.dueDate < next && (!prev || r.dueDate >= prev)
        : inWindow(r.paidAt),
    );
  }
  if (policy.premiumPeriod === "single") return rows.length > 0;
  return rows.some((r) => inWindow(r.paidAt));
}
