import { Inject, Injectable } from "@nestjs/common";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import { AI_ADVISOR_PORT } from "./ai-advisor.port";

import type {
  AiAdvisorPort,
  AdvisorContext,
  AdvisorMessage,
} from "./ai-advisor.port";

@Injectable()
export class AiAdvisorService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_ADVISOR_PORT) private readonly advisor: AiAdvisorPort,
  ) {}

  async buildContext(familyGroupId: string): Promise<AdvisorContext> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [incomeAgg, expenseAgg, assets, liabilities, topCategories] =
      await Promise.all([
        this.prisma.transaction.aggregate({
          where: {
            familyGroupId,
            type: "income",
            occurredAt: { gte: startOfMonth },
          },
          _sum: { amount: true },
        }),
        this.prisma.transaction.aggregate({
          where: {
            familyGroupId,
            type: "expense",
            occurredAt: { gte: startOfMonth },
          },
          _sum: { amount: true },
        }),
        this.prisma.asset.aggregate({
          where: { familyGroupId },
          _sum: { currentValue: true },
        }),
        this.prisma.liability.aggregate({
          where: { familyGroupId },
          _sum: { remainingBalance: true },
        }),
        this.prisma.transaction.groupBy({
          by: ["categoryId"],
          where: {
            familyGroupId,
            type: "expense",
            occurredAt: { gte: startOfMonth },
            categoryId: { not: null },
          },
          _sum: { amount: true },
          orderBy: { _sum: { amount: "desc" } },
          take: 5,
        }),
      ]);

    const categoryIds = topCategories
      .map((c) => c.categoryId)
      .filter(Boolean) as string[];
    const categories = await this.prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true },
    });
    const catMap = new Map(categories.map((c) => [c.id, c.name]));

    const totalAssets = assets._sum.currentValue ?? 0n;
    const totalLiabilities = liabilities._sum.remainingBalance ?? 0n;
    const monthlyIncome = incomeAgg._sum.amount ?? 0n;
    const monthlyExpense = expenseAgg._sum.amount ?? 0n;

    return {
      familyGroupId,
      netWorth: totalAssets - totalLiabilities,
      monthlyIncome,
      monthlyExpense,
      totalAssets,
      totalLiabilities,
      topCategories: topCategories.map((c) => ({
        name: catMap.get(c.categoryId ?? "") ?? "Lainnya",
        amount: c._sum.amount ?? 0n,
      })),
    };
  }

  async streamChat(
    familyGroupId: string,
    messages: AdvisorMessage[],
    onToken: (token: string) => void,
  ): Promise<void> {
    const context = await this.buildContext(familyGroupId);
    await this.advisor.chat(context, messages, onToken);
  }
}
