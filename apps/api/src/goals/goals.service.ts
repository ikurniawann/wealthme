import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  GoalContributionSource as PrismaGoalContributionSource,
  GoalStatus as PrismaGoalStatus,
  type Goal,
} from "@prisma/client";

import { assertBankNotOverdrawn } from "../common/utils/bank-overdraft.util";
import { ownCategoryName } from "../common/utils/own-category-name.util";
import {
  runSerializableWithRetry,
  type TxClient,
} from "../common/utils/serializable-retry.util";
import { ownerNotifPrefs } from "../notifications/notification-prefs";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import type { CreateGoalContributionDto } from "./dto/create-goal-contribution.dto";
import type { CreateGoalDto } from "./dto/create-goal.dto";
import type { UpdateGoalDto } from "./dto/update-goal.dto";
import type {
  GoalContributionDto,
  GoalContributionResult,
} from "@wealthme/contracts";

// Order is preference: the dedicated "Tabungan" savings line first, the generic allocation bucket second.
const GOAL_SAVINGS_COA_PRIORITY = ["30001", "30099"];

interface ContributionInput {
  amount: bigint;
  accountId: string | null;
  occurredAt: Date;
  source: PrismaGoalContributionSource;
  now: Date;
}

export type GoalStatus = "on_track" | "needs_boost" | "achieved" | "at_risk";

export interface GoalDto {
  id: string;
  name: string;
  icon: string | null;
  targetAmount: number;
  currentAmount: number;
  targetDate: string | null;
  autoDebitAmount: number | null;
  autoDebitDay: number | null;
  sourceAccountId: string | null;
  status: GoalStatus;
  progressPercent: number;
  remainingAmount: number;
}

/**
 * EPIC-022 C7 — judges progress against how much is EXPECTED by now given a
 * straight-line pace from `createdAt` to `targetDate`, not against a fixed
 * "days remaining" tier alone. The old tiers flagged ANY brand-new goal with
 * 0 saved as `at_risk` the instant a long horizon (>=90 days remaining) put
 * it in the most lenient tier, because even that tier's floor (25% of
 * target) exceeds a fresh goal's 0% progress — a 10-year education fund
 * one day old was immediately "at risk". Comparing against elapsed-time
 * pace fixes this: a brand-new goal has elapsed ≈ 0, so its expected
 * progress is also ≈ 0, and 0 vs 0 is on pace.
 */
function computeStatus(
  currentAmount: bigint,
  targetAmount: bigint,
  targetDate: Date | null,
  createdAt: Date,
  now: Date = new Date(),
): PrismaGoalStatus {
  if (currentAmount >= targetAmount) return PrismaGoalStatus.achieved;
  if (!targetDate) return PrismaGoalStatus.on_track;

  const nowMs = now.getTime();
  const targetMs = targetDate.getTime();
  if (targetMs <= nowMs) return PrismaGoalStatus.at_risk;

  const progressPct =
    targetAmount > 0n
      ? (Number(currentAmount) / Number(targetAmount)) * 100
      : 0;

  const totalMs = targetMs - createdAt.getTime();
  const elapsedMs = nowMs - createdAt.getTime();
  const elapsedFraction =
    totalMs > 0 ? Math.min(1, Math.max(0, elapsedMs / totalMs)) : 1;
  const expectedPct = elapsedFraction * 100;
  const deficit = expectedPct - progressPct;

  if (deficit > 25) return PrismaGoalStatus.at_risk;
  if (deficit > 10) return PrismaGoalStatus.needs_boost;
  return PrismaGoalStatus.on_track;
}

function toDto(
  goal: {
    id: string;
    name: string;
    icon: string | null;
    targetAmount: bigint;
    currentAmount: bigint;
    targetDate: Date | null;
    autoDebitAmount: bigint | null;
    autoDebitDay?: number | null;
    sourceAccountId?: string | null;
    createdAt: Date;
  },
  now: Date = new Date(),
): GoalDto {
  const targetAmount = Number(goal.targetAmount);
  const currentAmount = Number(goal.currentAmount);
  const progressPercent =
    targetAmount > 0 ? Math.round((currentAmount / targetAmount) * 100) : 0;
  const remainingAmount = Math.max(0, targetAmount - currentAmount);

  const statusMap: Record<PrismaGoalStatus, GoalStatus> = {
    [PrismaGoalStatus.on_track]: "on_track",
    [PrismaGoalStatus.needs_boost]: "needs_boost",
    [PrismaGoalStatus.achieved]: "achieved",
    [PrismaGoalStatus.at_risk]: "at_risk",
  };

  // EPIC-022 C7 — recomputed on EVERY read, not trusted from the row's
  // stored `status` column: that column is only ever refreshed by a WRITE
  // (create/update/runAutoDebit), so an overdue goal nobody has touched
  // since keeps whatever status it had the day it was last saved — a
  // months-overdue goal could keep a green "Sesuai Rencana" badge
  // indefinitely. The stored column is left in place (informational only,
  // still refreshed on write) but is never read here.
  const status = computeStatus(
    goal.currentAmount,
    goal.targetAmount,
    goal.targetDate,
    goal.createdAt,
    now,
  );

  return {
    id: goal.id,
    name: goal.name,
    icon: goal.icon,
    targetAmount,
    currentAmount,
    targetDate: goal.targetDate ? goal.targetDate.toISOString() : null,
    autoDebitAmount:
      goal.autoDebitAmount !== null ? Number(goal.autoDebitAmount) : null,
    autoDebitDay: goal.autoDebitDay ?? null,
    sourceAccountId: goal.sourceAccountId ?? null,
    status: statusMap[status],
    progressPercent,
    remainingAmount,
  };
}

function toContributionDto(
  row: {
    id: string;
    goalId: string;
    amount: bigint;
    accountId: string | null;
    transactionId: string | null;
    occurredAt: Date;
    source: PrismaGoalContributionSource;
    createdAt: Date;
  },
  accountName: string | null,
): GoalContributionDto {
  return {
    id: row.id,
    goalId: row.goalId,
    amount: row.amount.toString(),
    accountId: row.accountId,
    accountName,
    transactionId: row.transactionId,
    occurredAt: row.occurredAt.toISOString(),
    source: row.source,
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class GoalsService {
  private readonly logger = new Logger(GoalsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(familyGroupId: string): Promise<GoalDto[]> {
    const goals = await this.prisma.goal.findMany({
      where: { familyGroupId },
      orderBy: { createdAt: "asc" },
    });
    // C7 — one shared `now` for the whole list, so two goals in the SAME
    // response can't straddle a status-relevant instant against each other.
    const now = new Date();
    return goals.map((g) => toDto(g, now));
  }

  async create(familyGroupId: string, dto: CreateGoalDto): Promise<GoalDto> {
    const targetAmount = BigInt(dto.targetAmount);
    const autoDebitAmount =
      dto.autoDebitAmount != null ? BigInt(dto.autoDebitAmount) : null;
    // C8 — the "Sudah Terkumpul" (already collected) amount the create form
    // collects was silently discarded to `0n`; a family starting a goal with
    // existing savings had that progress erased the moment they saved it.
    const currentAmount =
      dto.currentAmount != null ? BigInt(dto.currentAmount) : 0n;
    if (currentAmount > targetAmount) {
      throw new BadRequestException(
        "Sudah Terkumpul tidak boleh melebihi Target Jumlah",
      );
    }
    const targetDate = dto.targetDate ? new Date(dto.targetDate) : null;
    const createdAt = new Date();

    const goal = await this.prisma.goal.create({
      data: {
        familyGroupId,
        name: dto.name,
        icon: dto.icon ?? null,
        targetAmount,
        currentAmount,
        targetDate,
        autoDebitAmount,
        autoDebitDay: dto.autoDebitDay ?? null,
        status: computeStatus(
          currentAmount,
          targetAmount,
          targetDate,
          createdAt,
        ),
        createdAt,
      },
    });
    return toDto(goal);
  }

  async update(
    familyGroupId: string,
    id: string,
    dto: UpdateGoalDto,
  ): Promise<GoalDto> {
    const existing = await this.prisma.goal.findUnique({
      where: { id, familyGroupId },
    });
    if (!existing) {
      throw new NotFoundException("Goal not found");
    }

    const targetAmount =
      dto.targetAmount != null
        ? BigInt(dto.targetAmount)
        : existing.targetAmount;
    const currentAmount =
      dto.currentAmount != null
        ? BigInt(dto.currentAmount)
        : existing.currentAmount;
    const targetDate =
      dto.targetDate !== undefined
        ? dto.targetDate
          ? new Date(dto.targetDate)
          : null
        : existing.targetDate;
    const autoDebitAmount =
      dto.autoDebitAmount != null
        ? BigInt(dto.autoDebitAmount)
        : existing.autoDebitAmount;

    // EPIC-022 A4 follow-up — `currentAmount` was only ever bounded by
    // `@Min(0)`/`@Max(999_999_999_999)` here, never against `targetAmount`,
    // unlike `runAutoDebit` (which clamps). Reject rather than silently
    // clamp: this is a manual PATCH the user typed a specific number into
    // (an "earmark" the family maintains by hand — see the A3 tracker
    // decision), so quietly rewriting their input to a different number
    // would be exactly the kind of silent-lie UI this epic exists to
    // remove. Checked against the EFFECTIVE (post-patch) target, so a
    // request that raises both fields together is judged consistently.
    if (currentAmount > targetAmount) {
      throw new BadRequestException(
        "Sudah Terkumpul tidak boleh melebihi Target Jumlah",
      );
    }

    const status = computeStatus(
      currentAmount,
      targetAmount,
      targetDate,
      existing.createdAt,
    );

    const updated = await this.prisma.goal.update({
      where: { id, familyGroupId },
      data: {
        name: dto.name ?? existing.name,
        icon: dto.icon !== undefined ? (dto.icon ?? null) : existing.icon,
        targetAmount,
        currentAmount,
        targetDate,
        autoDebitAmount,
        autoDebitDay:
          dto.autoDebitDay !== undefined
            ? dto.autoDebitDay
            : existing.autoDebitDay,
        status,
      },
    });
    return toDto(updated);
  }

  async remove(familyGroupId: string, id: string): Promise<void> {
    const existing = await this.prisma.goal.findUnique({
      where: { id, familyGroupId },
    });
    if (!existing) {
      throw new NotFoundException("Goal not found");
    }
    await this.prisma.goal.delete({ where: { id, familyGroupId } });
  }

  async contribute(
    familyGroupId: string,
    goalId: string,
    dto: CreateGoalContributionDto,
    now: Date = new Date(),
  ): Promise<GoalContributionResult> {
    const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : now;
    if (occurredAt.getTime() > now.getTime()) {
      throw new BadRequestException(
        "Tanggal setoran tidak boleh di masa depan",
      );
    }
    return runSerializableWithRetry(this.prisma, async (tx) => {
      const goal = await tx.goal.findUnique({
        where: { id: goalId, familyGroupId },
      });
      if (!goal) {
        throw new NotFoundException("Goal not found");
      }
      return this.contributeInTx(tx, goal, {
        amount: BigInt(dto.amount),
        accountId: dto.accountId ?? null,
        occurredAt,
        source: PrismaGoalContributionSource.manual,
        now,
      });
    });
  }

  async listContributions(
    familyGroupId: string,
    goalId: string,
  ): Promise<GoalContributionDto[]> {
    const goal = await this.prisma.goal.findUnique({
      where: { id: goalId, familyGroupId },
      select: { id: true },
    });
    if (!goal) {
      throw new NotFoundException("Goal not found");
    }
    const rows = await this.prisma.goalContribution.findMany({
      where: { familyGroupId, goalId },
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      include: { account: { select: { name: true } } },
    });
    return rows.map((row) => toContributionDto(row, row.account?.name ?? null));
  }

  private async contributeInTx(
    tx: TxClient,
    goal: Goal,
    input: ContributionInput,
  ): Promise<GoalContributionResult> {
    const { familyGroupId } = goal;
    if (input.amount <= 0n) {
      throw new BadRequestException("Jumlah setoran harus lebih dari 0");
    }
    const newCurrent = goal.currentAmount + input.amount;
    if (newCurrent > goal.targetAmount) {
      throw new BadRequestException("Setoran melebihi sisa target tujuan");
    }

    let transactionId: string | null = null;
    let accountName: string | null = null;
    if (input.accountId) {
      const account = await tx.account.findUnique({
        where: { id: input.accountId, familyGroupId },
        select: { id: true, name: true },
      });
      if (!account) {
        throw new NotFoundException(`Account ${input.accountId} not found`);
      }
      await assertBankNotOverdrawn(tx, familyGroupId, account.id, input.amount);
      await tx.account.update({
        where: { id: account.id, familyGroupId },
        data: { balance: { decrement: input.amount } },
      });
      const categoryId = await this.resolveGoalCategoryId(tx, goal);
      const ledgerRow = await tx.transaction.create({
        data: {
          familyGroupId,
          accountId: account.id,
          categoryId,
          amount: input.amount,
          type: "transfer",
          description: `Setor tujuan ${goal.name}`,
          occurredAt: input.occurredAt,
        },
        select: { id: true },
      });
      transactionId = ledgerRow.id;
      accountName = account.name;
    }

    const contribution = await tx.goalContribution.create({
      data: {
        familyGroupId,
        goalId: goal.id,
        amount: input.amount,
        accountId: input.accountId,
        transactionId,
        occurredAt: input.occurredAt,
        source: input.source,
      },
    });

    const updated = await tx.goal.update({
      where: { id: goal.id, familyGroupId },
      data: {
        currentAmount: { increment: input.amount },
        status: computeStatus(
          newCurrent,
          goal.targetAmount,
          goal.targetDate,
          goal.createdAt,
          input.now,
        ),
        ...(input.source === PrismaGoalContributionSource.auto
          ? { lastAutoDebitAt: input.now }
          : {}),
      },
    });

    return {
      contribution: toContributionDto(contribution, accountName),
      goal: toDto(updated, input.now),
    };
  }

  // Keyed by the category's unique (familyGroupId, name, kind), so no Goal column is needed to remember it.
  private async resolveGoalCategoryId(
    tx: TxClient,
    goal: Goal,
  ): Promise<string> {
    let coaAccount: { id: string; name: string } | null = null;
    for (const code of GOAL_SAVINGS_COA_PRIORITY) {
      coaAccount = await tx.coaAccount.findFirst({
        where: { familyGroupId: goal.familyGroupId, code },
        select: { id: true, name: true },
      });
      if (coaAccount) break;
    }
    if (!coaAccount) {
      throw new BadRequestException(
        "This family group has no savings (Tabungan) COA account provisioned",
      );
    }
    const name = ownCategoryName(coaAccount.name, goal.name, goal.id);
    const category = await tx.category.upsert({
      where: {
        familyGroupId_name_kind: {
          familyGroupId: goal.familyGroupId,
          name,
          kind: "expense",
        },
      },
      create: {
        familyGroupId: goal.familyGroupId,
        name,
        kind: "expense",
        coaAccountId: coaAccount.id,
      },
      update: {},
      select: { id: true },
    });
    return category.id;
  }

  /**
   * Execute monthly auto-debit across every goal that has an `autoDebitAmount`.
   * Idempotent per calendar month via `lastAutoDebitAt`, so re-running within the
   * same month is a no-op. Each debit caps `currentAmount` at `targetAmount`,
   * recomputes status, and fires a `Notification`.
   *
   * EPIC-022 A3 / USER DECISION — goals are a manual tracker, not real money.
   * This does NOT move any real money and does NOT write a `Transaction`:
   * `Goal.currentAmount` is an earmark the family maintains by hand (or via
   * this scheduled bump), never backed by an `Account` balance. It previously
   * also inserted a `type: transfer` Transaction row against an arbitrary
   * account, which looked like a real transfer in the ledger but never
   * touched that account's balance — a family reconciling against a real
   * bank statement could never make that row add up. Real funding (backing
   * a goal with an account and moving money through
   * `TransactionsService.create`) is deliberately out of scope here.
   * Returns the number of goals actually debited.
   */
  async runAutoDebit(now: Date = new Date()): Promise<number> {
    const goals = await this.prisma.goal.findMany({
      where: { autoDebitAmount: { not: null } },
    });

    let debited = 0;
    for (const goal of goals) {
      const autoDebit = goal.autoDebitAmount;
      if (autoDebit === null || autoDebit <= 0n) continue;

      // Idempotency: skip if already debited in the current calendar month.
      if (
        goal.lastAutoDebitAt &&
        goal.lastAutoDebitAt.getUTCFullYear() === now.getUTCFullYear() &&
        goal.lastAutoDebitAt.getUTCMonth() === now.getUTCMonth()
      ) {
        continue;
      }

      const projected = goal.currentAmount + autoDebit;
      const newCurrent =
        projected > goal.targetAmount ? goal.targetAmount : projected;
      const actual = newCurrent - goal.currentAmount;

      if (actual <= 0n) {
        // Already at/over target — stamp the run so it isn't re-checked daily.
        await this.prisma.goal.update({
          where: { id: goal.id },
          data: { lastAutoDebitAt: now },
        });
        continue;
      }

      const status = computeStatus(
        newCurrent,
        goal.targetAmount,
        goal.targetDate,
        goal.createdAt,
        now,
      );

      const notifPrefs = await ownerNotifPrefs(this.prisma, goal.familyGroupId);

      // EPIC-022 A3 / USER DECISION — goals are a manual tracker, not real
      // money: `currentAmount` is an earmark the family maintains, it is
      // never backed by a real account or a real transfer. This used to
      // also insert a `type: transfer` Transaction row here, but no
      // `Account.balance` was ever touched — the family saw a transaction
      // that did not happen, and it could never be reconciled against a
      // real bank statement. Real funding (backing a goal with an account
      // and moving money through `TransactionsService.create`) is
      // deliberately out of scope; this only bumps the tracker and notifies.
      await this.prisma.$transaction(async (tx) => {
        await tx.goal.update({
          where: { id: goal.id },
          data: { currentAmount: newCurrent, status, lastAutoDebitAt: now },
        });

        if (notifPrefs.goalMilestone) {
          await tx.notification.create({
            data: {
              familyGroupId: goal.familyGroupId,
              title: "Auto-debit tujuan",
              body: `${goal.name} bertambah Rp${actual.toString()} dari auto-debit bulanan.`,
              icon: goal.icon ?? "🎯",
            },
          });
        }
      });

      debited += 1;
    }

    return debited;
  }
}
