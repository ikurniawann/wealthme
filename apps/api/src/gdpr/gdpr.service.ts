import { Injectable } from "@nestjs/common";

import {
  accountPrivacyWhere,
  canSeePrivateItems,
  transactionPrivacyWhere,
} from "../common/utils/privacy.util";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import type { Prisma } from "@prisma/client";

@Injectable()
export class GdprService {
  constructor(private readonly prisma: PrismaService) {}

  async exportUserData(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarInitials: true,
        createdAt: true,
      },
    });

    const memberships = await this.prisma.member.findMany({
      where: { userId },
      select: { familyGroupId: true, role: true, createdAt: true },
    });

    const familyGroupIds = memberships.map((m) => m.familyGroupId);

    // Privacy is per-family-group: the caller may be `owner` in one group
    // and a plain `member` in another, so split groups by whether *that*
    // group's role can see private items instead of applying one role
    // check globally across every group's data.
    const privilegedGroupIds = memberships
      .filter((m) => canSeePrivateItems(m.role))
      .map((m) => m.familyGroupId);
    const restrictedGroupIds = memberships
      .filter((m) => !canSeePrivateItems(m.role))
      .map((m) => m.familyGroupId);

    const [accounts, transactions, goals, notifications] = await Promise.all([
      this.prisma.account.findMany({
        where: this.buildAccountWhere(privilegedGroupIds, restrictedGroupIds),
        select: {
          id: true,
          name: true,
          type: true,
          balance: true,
          currency: true,
          createdAt: true,
        },
      }),
      this.prisma.transaction.findMany({
        where: this.buildTransactionWhere(
          privilegedGroupIds,
          restrictedGroupIds,
        ),
        select: {
          id: true,
          description: true,
          amount: true,
          type: true,
          occurredAt: true,
        },
        take: 500,
        orderBy: { occurredAt: "desc" },
      }),
      this.prisma.goal.findMany({
        where: { familyGroupId: { in: familyGroupIds } },
        select: {
          id: true,
          name: true,
          targetAmount: true,
          currentAmount: true,
          status: true,
        },
      }),
      this.prisma.notification.findMany({
        where: { familyGroupId: { in: familyGroupIds } },
        select: {
          id: true,
          title: true,
          body: true,
          isRead: true,
          createdAt: true,
        },
        take: 100,
      }),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      user,
      memberships,
      accounts: accounts.map((a) => ({ ...a, balance: a.balance.toString() })),
      transactions: transactions.map((t) => ({
        ...t,
        amount: t.amount.toString(),
      })),
      goals: goals.map((g) => ({
        ...g,
        targetAmount: g.targetAmount.toString(),
        currentAmount: g.currentAmount.toString(),
      })),
      notifications,
    };
  }

  async deleteAccount(userId: string): Promise<void> {
    // Cascade: member → familyGroup data stays (other members still own it)
    // Only the user record and their memberships are deleted
    await this.prisma.user.delete({ where: { id: userId } });
  }

  /**
   * Builds the account `where` clause across every family group the caller
   * belongs to, applying `accountPrivacyWhere` only to the groups where
   * their role can't see private items — mirrors the pattern used by
   * `accounts.service.ts`, but per-group instead of for a single tenant.
   */
  private buildAccountWhere(
    privilegedGroupIds: string[],
    restrictedGroupIds: string[],
  ): Prisma.AccountWhereInput {
    const privileged: Prisma.AccountWhereInput | null =
      privilegedGroupIds.length > 0
        ? { familyGroupId: { in: privilegedGroupIds } }
        : null;
    const restricted: Prisma.AccountWhereInput | null =
      restrictedGroupIds.length > 0
        ? {
            familyGroupId: { in: restrictedGroupIds },
            ...accountPrivacyWhere(false),
          }
        : null;

    if (privileged && restricted) return { OR: [privileged, restricted] };
    if (privileged) return privileged;
    if (restricted) return restricted;
    return { familyGroupId: { in: [] } };
  }

  /**
   * Same per-group split as `buildAccountWhere`, using
   * `transactionPrivacyWhere` (which also excludes transactions tied to a
   * private category) for the restricted groups.
   */
  private buildTransactionWhere(
    privilegedGroupIds: string[],
    restrictedGroupIds: string[],
  ): Prisma.TransactionWhereInput {
    const privileged: Prisma.TransactionWhereInput | null =
      privilegedGroupIds.length > 0
        ? { familyGroupId: { in: privilegedGroupIds } }
        : null;
    const restricted: Prisma.TransactionWhereInput | null =
      restrictedGroupIds.length > 0
        ? {
            familyGroupId: { in: restrictedGroupIds },
            ...transactionPrivacyWhere(false),
          }
        : null;

    if (privileged && restricted) return { OR: [privileged, restricted] };
    if (privileged) return privileged;
    if (restricted) return restricted;
    return { familyGroupId: { in: [] } };
  }
}
