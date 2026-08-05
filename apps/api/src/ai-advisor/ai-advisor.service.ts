import { Injectable } from "@nestjs/common";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import { type AiAdvisorFactory } from "./ai-advisor-factory.service";
import { AiAdvisorNotConfiguredError } from "./ai-advisor-not-configured.error";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AiKeyService } from "./ai-key.service";

import type {
  AdvisorChatResult,
  AdvisorContext,
  AdvisorMessage,
} from "./ai-advisor.port";

@Injectable()
export class AiAdvisorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiKeyService: AiKeyService,
    private readonly advisorFactory: AiAdvisorFactory,
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

  /**
   * EPIC-023 G3 (D16) — resolves the family's OWN key per request and
   * builds the matching provider adapter fresh each call. Throws
   * AiAdvisorNotConfiguredError when no key is set — there is deliberately
   * NO fallback to a shared/server-wide key (ANTHROPIC_API_KEY remains
   * configured for the unrelated OCR/categorization feature, but is never
   * read here): a silent server-key fallback would mean one family paying
   * for another's usage, which D16 rules out. There is also no mock
   * fallback — MockAdvisorService is not wired into this path at all.
   */
  async streamChat(
    familyGroupId: string,
    messages: AdvisorMessage[],
    onToken: (token: string) => void,
  ): Promise<AdvisorChatResult> {
    const resolvedKey =
      await this.aiKeyService.resolveDecryptedKey(familyGroupId);
    if (!resolvedKey) {
      throw new AiAdvisorNotConfiguredError();
    }

    const context = await this.buildContext(familyGroupId);
    const advisor = this.advisorFactory.create(
      resolvedKey.provider,
      resolvedKey.apiKey,
    );
    return advisor.chat(context, messages, onToken);
  }
}
