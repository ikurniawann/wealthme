import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { GoalStatus as PrismaGoalStatus } from "@prisma/client";

import { ownerNotifPrefs } from "../notifications/notification-prefs";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import type { CreateGoalDto } from "./dto/create-goal.dto";
import type { UpdateGoalDto } from "./dto/update-goal.dto";

export type GoalStatus = "on_track" | "needs_boost" | "achieved" | "at_risk";

export interface GoalDto {
  id: string;
  name: string;
  icon: string | null;
  targetAmount: number;
  currentAmount: number;
  targetDate: string | null;
  autoDebitAmount: number | null;
  status: GoalStatus;
  progressPercent: number;
  remainingAmount: number;
}

const MS_PER_DAY = 86_400_000;

function computeStatus(
  currentAmount: bigint,
  targetAmount: bigint,
  targetDate: Date | null,
): PrismaGoalStatus {
  if (currentAmount >= targetAmount) return PrismaGoalStatus.achieved;
  if (!targetDate) return PrismaGoalStatus.on_track;

  const now = Date.now();
  const targetMs = targetDate.getTime();
  const totalMs = targetMs - now;

  if (totalMs <= 0) return PrismaGoalStatus.at_risk;

  const daysRemaining = totalMs / MS_PER_DAY;
  const progressPct =
    targetAmount > 0n
      ? (Number(currentAmount) / Number(targetAmount)) * 100
      : 0;

  const urgencyFactor =
    daysRemaining < 30 ? 0.9 : daysRemaining < 90 ? 0.7 : 0.5;

  if (progressPct < urgencyFactor * 50) return PrismaGoalStatus.at_risk;
  if (progressPct < urgencyFactor * 80) return PrismaGoalStatus.needs_boost;
  return PrismaGoalStatus.on_track;
}

function toDto(goal: {
  id: string;
  name: string;
  icon: string | null;
  targetAmount: bigint;
  currentAmount: bigint;
  targetDate: Date | null;
  autoDebitAmount: bigint | null;
  status: PrismaGoalStatus;
}): GoalDto {
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

  return {
    id: goal.id,
    name: goal.name,
    icon: goal.icon,
    targetAmount,
    currentAmount,
    targetDate: goal.targetDate ? goal.targetDate.toISOString() : null,
    autoDebitAmount:
      goal.autoDebitAmount !== null ? Number(goal.autoDebitAmount) : null,
    status: statusMap[goal.status],
    progressPercent,
    remainingAmount,
  };
}

@Injectable()
export class GoalsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(familyGroupId: string): Promise<GoalDto[]> {
    const goals = await this.prisma.goal.findMany({
      where: { familyGroupId },
      orderBy: { createdAt: "asc" },
    });
    return goals.map(toDto);
  }

  async create(familyGroupId: string, dto: CreateGoalDto): Promise<GoalDto> {
    const targetAmount = BigInt(dto.targetAmount);
    const autoDebitAmount =
      dto.autoDebitAmount != null ? BigInt(dto.autoDebitAmount) : null;

    const goal = await this.prisma.goal.create({
      data: {
        familyGroupId,
        name: dto.name,
        icon: dto.icon ?? null,
        targetAmount,
        currentAmount: 0n,
        targetDate: dto.targetDate ? new Date(dto.targetDate) : null,
        autoDebitAmount,
        status: PrismaGoalStatus.on_track,
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

    const status = computeStatus(currentAmount, targetAmount, targetDate);

    const updated = await this.prisma.goal.update({
      where: { id, familyGroupId },
      data: {
        name: dto.name ?? existing.name,
        icon: dto.icon !== undefined ? (dto.icon ?? null) : existing.icon,
        targetAmount,
        currentAmount,
        targetDate,
        autoDebitAmount,
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
