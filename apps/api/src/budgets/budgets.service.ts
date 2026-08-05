import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";

import { categoryPrivacyWhere } from "../common/utils/privacy.util";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import type { CreateBudgetDto } from "./dto/create-budget.dto";
import type { UpdateBudgetDto } from "./dto/update-budget.dto";
import type { CoaBudgetType } from "@prisma/client";
import type { BudgetDto, BudgetPeriod } from "@wealthme/contracts";

type BudgetWithCategory = {
  id: string;
  categoryId: string;
  period: string;
  limitAmount: bigint;
  // EPIC-023 group E retry round 3 (MEDIUM 12 / CRITICAL 5) — used to tell
  // apart a liability's own principal category (whose spend is posted as
  // `type: "transfer"`, E1) from every other budget's category (`toDto`
  // falls back to `category.coaAccount.budgetType` when this is null).
  liabilityId: string | null;
  budgetType: CoaBudgetType | null;
  category: {
    name: string;
    icon: string | null;
    coaAccount: { budgetType: CoaBudgetType | null };
  };
};

@Injectable()
export class BudgetsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * `canSeePrivate` defaults to `true` so internal/non-member-facing callers
   * stay unfiltered — the controller passes `false` for a plain `member`
   * (see `canSeePrivateItems`), matching every other shared read
   * (categories, transactions, dashboard).
   */
  async findAll(
    familyGroupId: string,
    canSeePrivate = true,
  ): Promise<BudgetDto[]> {
    const budgets = await this.prisma.budget.findMany({
      where: {
        familyGroupId,
        category: categoryPrivacyWhere(canSeePrivate),
      },
      include: {
        category: {
          select: {
            name: true,
            icon: true,
            coaAccount: { select: { budgetType: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
    );

    // EPIC-023 group E retry round 4 (C5) — a liability's OWN principal
    // budget line (`Budget.liabilityId` set, HIGH 4/E2) posts its spend as
    // `type: "transfer"` (E1 — a principal payment moves cash into paying
    // down debt, not a P&L expense), so grouping on `type: "expense"` alone
    // left `spentAmount` at 0 forever for every such line, however many
    // payments were made. Split into two disjoint queries: ordinary/
    // insurance-premium categories still require `type: "expense"` exactly
    // as before (insurance premiums post as "expense", unaffected); a
    // liability's own category — EXCLUSIVE to that one liability since the
    // HIGH 4 redesign, never shared — is instead summed by `type:
    // "transfer"`, the only type `LiabilitiesService.pay()` ever posts
    // against it. Neither bucket can leak into the other's total.
    const ordinaryCategoryIds = budgets
      .filter((b) => !b.liabilityId)
      .map((b) => b.categoryId);
    const liabilityCategoryIds = budgets
      .filter((b) => b.liabilityId)
      .map((b) => b.categoryId);

    const [expenseSpending, transferSpending] = await Promise.all([
      ordinaryCategoryIds.length > 0
        ? this.prisma.transaction.groupBy({
            by: ["categoryId"],
            where: {
              familyGroupId,
              type: "expense",
              occurredAt: { gte: monthStart, lte: monthEnd },
              categoryId: { in: ordinaryCategoryIds },
              // EPIC-022 A6 — belt-and-suspenders: `budgets` above is
              // already privacy-filtered, so `categoryId: { in: ... }`
              // already excludes private categories' spend; this repeats
              // the same filter directly on the spend query so it stays
              // correct even if the `in` list above is ever computed
              // differently.
              category: categoryPrivacyWhere(canSeePrivate),
            },
            _sum: { amount: true },
          })
        : Promise.resolve([]),
      liabilityCategoryIds.length > 0
        ? this.prisma.transaction.groupBy({
            by: ["categoryId"],
            where: {
              familyGroupId,
              type: "transfer",
              occurredAt: { gte: monthStart, lte: monthEnd },
              categoryId: { in: liabilityCategoryIds },
              category: categoryPrivacyWhere(canSeePrivate),
            },
            _sum: { amount: true },
          })
        : Promise.resolve([]),
    ]);

    const spendingMap = new Map(
      [...expenseSpending, ...transferSpending].map((s) => [
        s.categoryId,
        Number(s._sum.amount ?? 0),
      ]),
    );

    return budgets.map((b) =>
      this.toDto(b, spendingMap.get(b.categoryId) ?? 0),
    );
  }

  async create(
    familyGroupId: string,
    dto: CreateBudgetDto,
    canSeePrivate = true,
  ): Promise<BudgetDto> {
    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
      select: { familyGroupId: true, isPrivate: true },
    });
    // EPIC-022 A6 follow-up — same denial for "wrong family group" and
    // "private category I can't see": a member probing categoryIds must not
    // be able to distinguish "doesn't exist" from "exists but is private"
    // from the error alone.
    if (
      !category ||
      category.familyGroupId !== familyGroupId ||
      (category.isPrivate && !canSeePrivate)
    ) {
      throw new UnprocessableEntityException(
        "Category not found in this family group",
      );
    }

    const budget = await this.prisma.budget.create({
      data: {
        familyGroupId,
        categoryId: dto.categoryId,
        period: dto.period,
        limitAmount: BigInt(dto.limitAmount),
      },
      include: {
        category: {
          select: {
            name: true,
            icon: true,
            coaAccount: { select: { budgetType: true } },
          },
        },
      },
    });
    return this.toDto(budget, 0);
  }

  async update(
    familyGroupId: string,
    id: string,
    dto: UpdateBudgetDto,
    canSeePrivate = true,
  ): Promise<BudgetDto> {
    const existing = await this.prisma.budget.findUnique({
      where: { id, familyGroupId },
      select: {
        id: true,
        familyGroupId: true,
        category: { select: { isPrivate: true } },
      },
    });
    // EPIC-022 A6 follow-up — a member must not be able to PATCH (or read
    // back category.name/icon from) a budget tied to a private category,
    // the same way `findAll` already excludes it. 404, not 403, so a
    // private budget's id can't be distinguished from one that never
    // existed.
    if (!existing || (existing.category.isPrivate && !canSeePrivate)) {
      throw new NotFoundException("Budget not found");
    }

    const updated = await this.prisma.budget.update({
      where: { id, familyGroupId },
      data: {
        ...(dto.limitAmount !== undefined && {
          limitAmount: BigInt(dto.limitAmount),
        }),
        ...(dto.period !== undefined && { period: dto.period }),
      },
      include: {
        category: {
          select: {
            name: true,
            icon: true,
            coaAccount: { select: { budgetType: true } },
          },
        },
      },
    });
    return this.toDto(updated, 0);
  }

  async remove(
    familyGroupId: string,
    id: string,
    canSeePrivate = true,
  ): Promise<void> {
    const existing = await this.prisma.budget.findUnique({
      where: { id, familyGroupId },
      select: {
        id: true,
        familyGroupId: true,
        category: { select: { isPrivate: true } },
      },
    });
    // EPIC-022 A6 follow-up — same 404-not-403 treatment as `update`.
    if (!existing || (existing.category.isPrivate && !canSeePrivate)) {
      throw new NotFoundException("Budget not found");
    }
    await this.prisma.budget.delete({ where: { id, familyGroupId } });
  }

  private toDto(budget: BudgetWithCategory, spent: number): BudgetDto {
    const limit = Number(budget.limitAmount);
    const usagePct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
    return {
      id: budget.id,
      categoryId: budget.categoryId,
      categoryName: budget.category.name,
      categoryIcon: budget.category.icon,
      period: budget.period as BudgetPeriod,
      limitAmount: limit,
      spentAmount: spent,
      remainingAmount: Math.max(0, limit - spent),
      usagePercent: usagePct,
      isOverBudget: spent > limit,
      isNearLimit: usagePct >= 80 && spent <= limit,
      budgetType: budget.category.coaAccount.budgetType,
    };
  }
}
