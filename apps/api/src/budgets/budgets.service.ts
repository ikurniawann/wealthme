import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { CoaDirection, Prisma } from "@prisma/client";

import { budgetSpendWindow } from "../common/utils/budget-period.util";
import { effectiveBudgetType } from "../common/utils/effective-budget-type.util";
import { categoryPrivacyWhere } from "../common/utils/privacy.util";
import { runSerializableWithRetry } from "../common/utils/serializable-retry.util";
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
  autoDebitDay?: number | null;
  createdAt: Date;
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

/**
 * EPIC-022 group C (C1/C3/C6) — one bucket of budgets whose spend can be
 * summed with a SINGLE `groupBy` query: same spend-kind (ordinary
 * COA-EXPENSE-direction vs. a liability's own transfer-posted principal
 * line, E1/C5) and the SAME computed [start, end] window. Most families'
 * budgets are monthly and predate the current period, so they collapse into
 * one bucket per kind; a budget created mid-period (C3's own clamp) gets its
 * own bucket because its `start` is unique to it.
 */
type SpendBucket = {
  kind: "ordinary" | "liability";
  start: Date;
  end: Date;
  categoryIds: string[];
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
    const spendingMap = await this.computeSpendingMap(
      familyGroupId,
      budgets,
      canSeePrivate,
      now,
    );

    return budgets.map((b) =>
      this.toDto(b, spendingMap.get(b.categoryId) ?? 0),
    );
  }

  /**
   * C1 (Open Design Decision #2, DECIDED: implement) — the spend window
   * follows each budget's OWN `period` (weekly/monthly/yearly), not a
   * hardcoded calendar month. C3 — the window's START is additionally
   * clamped to the budget's `createdAt`, so a budget created mid-period does
   * not read spend from before it existed. C6 — an ordinary budget's spend
   * is defined by the category's COA direction (matches every report), not
   * the transaction's raw `type`; a liability's own principal line keeps its
   * `type: "transfer"` definition (E1), unrelated to C6's fix.
   */
  private async computeSpendingMap(
    familyGroupId: string,
    budgets: BudgetWithCategory[],
    canSeePrivate: boolean,
    now: Date,
  ): Promise<Map<string, number>> {
    const buckets = new Map<string, SpendBucket>();
    for (const b of budgets) {
      const { start, end } = budgetSpendWindow(
        b.period as BudgetPeriod,
        b.createdAt,
        now,
      );
      const kind: SpendBucket["kind"] = b.liabilityId
        ? "liability"
        : "ordinary";
      const key = `${kind}|${start.getTime()}|${end.getTime()}`;
      const bucket = buckets.get(key);
      if (bucket) bucket.categoryIds.push(b.categoryId);
      else buckets.set(key, { kind, start, end, categoryIds: [b.categoryId] });
    }

    const results = await Promise.all(
      [...buckets.values()].map((bucket) =>
        this.prisma.transaction.groupBy({
          by: ["categoryId"],
          where:
            bucket.kind === "liability"
              ? {
                  familyGroupId,
                  type: "transfer",
                  occurredAt: { gte: bucket.start, lte: bucket.end },
                  categoryId: { in: bucket.categoryIds },
                  // EPIC-022 A6 — belt-and-suspenders, same as the ordinary
                  // branch below: `budgets` is already privacy-filtered, so
                  // `categoryId: { in: ... }` already excludes private
                  // categories' spend; repeated directly on the spend query
                  // so it stays correct even if that list is ever computed
                  // differently.
                  category: categoryPrivacyWhere(canSeePrivate),
                }
              : {
                  familyGroupId,
                  occurredAt: { gte: bucket.start, lte: bucket.end },
                  categoryId: { in: bucket.categoryIds },
                  // C6 — COA-direction-based expense definition (matches
                  // reports.service.ts's `txCoaDirection`), not raw
                  // `type: "expense"`: a category mapped to a
                  // TRANSFER-direction COA account (e.g. a savings/
                  // investment transfer) must not count against a budget
                  // the way it doesn't count against Beranda's expenses.
                  category: {
                    ...categoryPrivacyWhere(canSeePrivate),
                    coaAccount: { direction: CoaDirection.EXPENSE },
                  },
                },
          _sum: { amount: true },
        }),
      ),
    );

    const spendingMap = new Map<string, number>();
    for (const rows of results) {
      for (const row of rows) {
        // `categoryId: { in: bucket.categoryIds }` above guarantees this is
        // never null at runtime; the guard only satisfies the nullable
        // Prisma field type on `groupBy`'s result.
        if (!row.categoryId) continue;
        spendingMap.set(row.categoryId, Number(row._sum.amount ?? 0));
      }
    }
    return spendingMap;
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

    // C5 (review round, TOCTOU fix) — a category may hold only ONE budget,
    // regardless of period. The DB's real unique index
    // (`@@unique([familyGroupId, categoryId, period])`) only rejects a
    // collision on the SAME period, so a plain pre-check + create (even
    // wrapped in a try/catch on P2002) left a race window open: two
    // concurrent `create()` calls for the SAME category but DIFFERENT
    // periods (e.g. one weekly, one monthly — reachable through the UI's
    // 409-fallback create path) both pass the `findFirst` pre-check before
    // either commits, and neither insert collides with the narrower index —
    // both succeed, leaving the category double-budgeted, exactly what C5
    // exists to prevent.
    //
    // Fix: run the pre-check + insert inside ONE Serializable transaction
    // (this repo's established pattern for read-then-write races, see
    // `serializable-retry.util.ts`, used by liabilities/split-bills). The
    // pre-check's read predicate is `familyGroupId + categoryId` (no
    // `period`), so it overlaps with BOTH transactions' inserts regardless
    // of which period each one picks. Under Postgres's Serializable
    // Snapshot Isolation, two concurrent transactions where each one reads
    // a predicate the other's write falls into is a write-skew anomaly —
    // SSI detects the rw-conflict cycle and aborts the loser with a
    // serialization failure (P2034), which `runSerializableWithRetry`
    // catches and retries in a fresh transaction. The retry's pre-check now
    // reads the winner's already-committed row and throws the 409 below
    // instead of inserting a second budget. This closes the gap for ANY
    // period combination, not just the identical-period case the unique
    // index alone catches — no schema/migration change needed. A
    // liability/insurance's own auto-created line uses its own EXCLUSIVE
    // category and `tx.budget.upsert` directly, never this method, so it
    // can never collide with this check.
    return runSerializableWithRetry(this.prisma, async (tx) => {
      const existing = await tx.budget.findFirst({
        where: { familyGroupId, categoryId: dto.categoryId },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException(
          "A budget already exists for this category",
        );
      }

      try {
        const budget = await tx.budget.create({
          data: {
            familyGroupId,
            categoryId: dto.categoryId,
            period: dto.period,
            limitAmount: BigInt(dto.limitAmount),
            autoDebitDay: dto.autoDebitDay ?? null,
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
      } catch (err) {
        // Belt-and-suspenders for the identical-period case: the DB's own
        // `@@unique([familyGroupId, categoryId, period])` still fires a
        // P2002 if two same-period creates somehow reach the insert without
        // SSI catching them first (e.g. a lower isolation level in a future
        // refactor). The different-period race is closed above by SSI, not
        // by this index.
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          throw new ConflictException(
            "A budget already exists for this category",
          );
        }
        throw err;
      }
    });
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
        ...(dto.autoDebitDay !== undefined && {
          autoDebitDay: dto.autoDebitDay,
        }),
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
      autoDebitDay: budget.autoDebitDay ?? null,
      spentAmount: spent,
      remainingAmount: Math.max(0, limit - spent),
      usagePercent: usagePct,
      isOverBudget: spent > limit,
      isNearLimit: usagePct >= 80 && spent <= limit,
      // C2 (group E retry round 4) — `toDto` used to read ONLY
      // `category.coaAccount.budgetType`, never `budget.budgetType` (the
      // per-Budget-row column `syncPrincipalBudgetLine`/
      // `syncPremiumBudgetLine` actually WRITE, MEDIUM 12's own migration).
      // A liability/insurance's own line's CoaAccount is the shared group-5
      // TRANSFER account, whose `budgetType` is null — so this always read
      // null for a real obligation line, dropping it out of `/anggaran`'s
      // FIXED section. `budget.budgetType` now wins when set; the CoaAccount
      // fallback stays for every other (non-obligation) budget row, which
      // never has its own `budgetType` set.
      budgetType: effectiveBudgetType(budget),
    };
  }
}
