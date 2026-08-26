import { Injectable } from "@nestjs/common";

import {
  accountPrivacyWhere,
  canSeePrivateItems,
  categoryPrivacyWhere,
  transactionPrivacyWhere,
} from "../common/utils/privacy.util";
// VALUE import, deliberately — see the AiAdvisorFactory comment below for why
// a `type` import here stops the API from booting. `eslint --fix` rewrote this
// to `import { type PrismaService }` once; do not let it.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

/** Per-list cap on the row detail sent to the model. A family with hundreds
 *  of assets would otherwise grow the system prompt without bound on every
 *  single turn — the prompt is re-sent in full each request, so the cost is
 *  paid per message, not once. Lists are ordered by size so the cap keeps
 *  what matters most to an advice question. */
const MAX_CONTEXT_ROWS = 25;

/**
 * Strips a trailing masked-account-number token from an account name.
 *
 * Excluding `Account.maskedNumber` from the query is not enough on its own:
 * accounts in this app are conventionally NAMED with the suffix baked in
 * ("Mandiri ···5586", "BCA Tahapan ···9010" — the seed does it, and the
 * create-account UI encourages it), so the digits reach the model through
 * the `name` column even though the encrypted column never does. The /ai
 * sidebar tells the user account numbers are not read; that claim has to be
 * true, not true-of-one-column.
 *
 * Deliberately narrow: it removes only a run of mask characters followed by
 * digits at the END of the name. "BCA Tahapan 2" or "Rekening 2024" keep
 * their numbers, because those are names, not masked numbers.
 */
export function stripMaskedNumber(name: string): string {
  return name.replace(/\s*[·•*x×_-]{2,}\s*\d+\s*$/i, "").trim() || name;
}

// NestJS DI needs a VALUE import here — a `type`-only import is erased at
// compile time, so reflect-metadata can't resolve this constructor param
// and the API fails to boot ("Nest can't resolve dependencies of
// AiAdvisorService"). eslint's consistent-type-imports would "fix" it back
// to a type import; disable it, same as PrismaService/AiKeyService below.
// (Pre-existing since EPIC-023 group G; caught by the group-D DEV deploy —
// unit tests mock the factory and tsc accepts a type import, so only a real
// container boot surfaces it.)
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AiAdvisorFactory } from "./ai-advisor-factory.service";
import { AiAdvisorNotConfiguredError } from "./ai-advisor-not-configured.error";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AiKeyService } from "./ai-key.service";

import type {
  AdvisorChatResult,
  AdvisorContext,
  AdvisorMessage,
} from "./ai-advisor.port";
import type { Role } from "@prisma/client";

@Injectable()
export class AiAdvisorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiKeyService: AiKeyService,
    private readonly advisorFactory: AiAdvisorFactory,
  ) {}

  /**
   * Builds the financial context the model is given.
   *
   * `viewerRole` is NOT decoration. Before it existed this method took only
   * `familyGroupId` and applied no privacy filter at all, while
   * reports.service.ts carefully excluded private accounts and categories
   * for the roles that may not see them. The gap was latent rather than
   * exploited — the demo family has no private rows, and `spouse`/
   * `admin_staff`/`owner` may see private items anyway — but the moment a
   * family marked one account private, a plain `member` asking the advisor
   * would have received totals the reports UI deliberately hides from them.
   * Adding row-level detail below would have turned that into an outright
   * disclosure ("Rekening Pribadi Istri: Rp 50 jt"), so the filter comes
   * first and every query here now carries it.
   */
  async buildContext(
    familyGroupId: string,
    viewerRole: Role | null | undefined,
  ): Promise<AdvisorContext> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const canSeePrivate = canSeePrivateItems(viewerRole);
    const txPrivacy = transactionPrivacyWhere(canSeePrivate);
    const accountPrivacy = accountPrivacyWhere(canSeePrivate);
    const categoryPrivacy = categoryPrivacyWhere(canSeePrivate);

    const [
      incomeAgg,
      expenseAgg,
      assetAgg,
      liabilityAgg,
      topCategories,
      liabilityRows,
      assetRows,
      accountRows,
      goalRows,
    ] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: {
          familyGroupId,
          type: "income",
          occurredAt: { gte: startOfMonth },
          ...txPrivacy,
        },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: {
          familyGroupId,
          type: "expense",
          occurredAt: { gte: startOfMonth },
          ...txPrivacy,
        },
        _sum: { amount: true },
      }),
      // Assets and liabilities carry no `isPrivate` flag of their own (the
      // schema has none), so these stay family-wide — matching what the
      // /aset and /liabilitas pages already show every non-row-scoped role.
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
          ...txPrivacy,
        },
        _sum: { amount: true },
        orderBy: { _sum: { amount: "desc" } },
        take: 5,
      }),
      this.prisma.liability.findMany({
        where: { familyGroupId },
        orderBy: { remainingBalance: "desc" },
        take: MAX_CONTEXT_ROWS + 1,
        select: {
          name: true,
          institution: true,
          type: true,
          remainingBalance: true,
          minimumPayment: true,
          interestRate: true,
          dueDate: true,
        },
      }),
      this.prisma.asset.findMany({
        where: { familyGroupId },
        orderBy: { currentValue: "desc" },
        take: MAX_CONTEXT_ROWS + 1,
        select: { name: true, type: true, currentValue: true },
      }),
      this.prisma.account.findMany({
        where: { familyGroupId, ...accountPrivacy },
        orderBy: { balance: "desc" },
        take: MAX_CONTEXT_ROWS + 1,
        select: {
          name: true,
          type: true,
          institution: true,
          balance: true,
        },
      }),
      this.prisma.goal.findMany({
        where: { familyGroupId },
        orderBy: { targetAmount: "desc" },
        take: MAX_CONTEXT_ROWS + 1,
        select: {
          name: true,
          targetAmount: true,
          currentAmount: true,
          targetDate: true,
        },
      }),
    ]);

    const categoryIds = topCategories
      .map((c) => c.categoryId)
      .filter(Boolean) as string[];
    const categories = await this.prisma.category.findMany({
      where: { id: { in: categoryIds }, ...categoryPrivacy },
      select: { id: true, name: true },
    });
    const catMap = new Map(categories.map((c) => [c.id, c.name]));

    const totalAssets = assetAgg._sum.currentValue ?? 0n;
    const totalLiabilities = liabilityAgg._sum.remainingBalance ?? 0n;
    const monthlyIncome = incomeAgg._sum.amount ?? 0n;
    const monthlyExpense = expenseAgg._sum.amount ?? 0n;

    // Each list was fetched with `take: MAX + 1` purely to detect overflow;
    // the extra row is dropped here and never reaches the prompt.
    const overflowed =
      liabilityRows.length > MAX_CONTEXT_ROWS ||
      assetRows.length > MAX_CONTEXT_ROWS ||
      accountRows.length > MAX_CONTEXT_ROWS ||
      goalRows.length > MAX_CONTEXT_ROWS;

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
      liabilities: liabilityRows.slice(0, MAX_CONTEXT_ROWS).map((l) => ({
        name: l.name,
        institution: l.institution,
        type: l.type,
        remainingBalance: l.remainingBalance,
        minimumPayment: l.minimumPayment,
        // Prisma Decimal — stringified here so the prompt builder never has
        // to know about the Decimal runtime type.
        interestRate: l.interestRate.toString(),
        dueDate: l.dueDate,
      })),
      assets: assetRows.slice(0, MAX_CONTEXT_ROWS),
      accounts: accountRows.slice(0, MAX_CONTEXT_ROWS).map((a) => ({
        ...a,
        name: stripMaskedNumber(a.name),
      })),
      goals: goalRows.slice(0, MAX_CONTEXT_ROWS),
      truncatedLists: overflowed,
    };
  }

  /**
   * EPIC-023 G3 (D16) — resolves the family's OWN key per request and
   * builds the matching provider adapter fresh each call. Throws
   * AiAdvisorNotConfiguredError when no key is set — there is deliberately
   * NO fallback to a shared/server-wide key (ANTHROPIC_API_KEY remains
   * configured for the unrelated auto-categorization feature — EPIC-027 D11
   * moved receipt OCR onto this same family key — but is never read here):
   * a silent server-key fallback would mean one family paying
   * for another's usage, which D16 rules out. There is also no mock
   * fallback — MockAdvisorService is not wired into this path at all.
   */
  async streamChat(
    familyGroupId: string,
    messages: AdvisorMessage[],
    onToken: (token: string) => void,
    viewerRole?: Role | null,
  ): Promise<AdvisorChatResult> {
    const resolvedKey =
      await this.aiKeyService.resolveDecryptedKey(familyGroupId);
    if (!resolvedKey) {
      throw new AiAdvisorNotConfiguredError();
    }

    // An omitted role is treated as the most restricted case (private items
    // hidden), so a future caller that forgets to pass it under-shares
    // rather than over-shares.
    const context = await this.buildContext(familyGroupId, viewerRole ?? null);
    const advisor = this.advisorFactory.create(
      resolvedKey.provider,
      resolvedKey.apiKey,
      // The family's chosen model from Pengaturan; null falls back to the
      // WealthMe default.
      resolvedKey.model,
    );
    return advisor.chat(context, messages, onToken);
  }
}
