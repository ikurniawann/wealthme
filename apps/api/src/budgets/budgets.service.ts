import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";

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
  category: {
    name: string;
    icon: string | null;
    coaAccount: { budgetType: CoaBudgetType | null };
  };
};

@Injectable()
export class BudgetsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(familyGroupId: string): Promise<BudgetDto[]> {
    const budgets = await this.prisma.budget.findMany({
      where: { familyGroupId },
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

    const spending = await this.prisma.transaction.groupBy({
      by: ["categoryId"],
      where: {
        familyGroupId,
        type: "expense",
        occurredAt: { gte: monthStart, lte: monthEnd },
        categoryId: { in: budgets.map((b) => b.categoryId) },
      },
      _sum: { amount: true },
    });

    const spendingMap = new Map(
      spending.map((s) => [s.categoryId, Number(s._sum.amount ?? 0)]),
    );

    return budgets.map((b) =>
      this.toDto(b, spendingMap.get(b.categoryId) ?? 0),
    );
  }

  async create(
    familyGroupId: string,
    dto: CreateBudgetDto,
  ): Promise<BudgetDto> {
    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
      select: { familyGroupId: true },
    });
    if (!category || category.familyGroupId !== familyGroupId) {
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
  ): Promise<BudgetDto> {
    const existing = await this.prisma.budget.findUnique({
      where: { id, familyGroupId },
      select: { id: true, familyGroupId: true },
    });
    if (!existing) {
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

  async remove(familyGroupId: string, id: string): Promise<void> {
    const existing = await this.prisma.budget.findUnique({
      where: { id, familyGroupId },
      select: { id: true, familyGroupId: true },
    });
    if (!existing) {
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
