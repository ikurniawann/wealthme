import { Injectable } from "@nestjs/common";

import {
  isRowScopedRole,
  restrictedAccountWhere,
  restrictedTransactionWhere,
} from "../common/utils/privacy.util";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

// GDPR/PDP export caps the ledger slice at the 500 most recent transactions
// across every family group the caller belongs to (matches the pre-existing
// single-query behavior — not 500 PER group).
const MAX_EXPORTED_TRANSACTIONS = 500;

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

    // EPIC-023 Task C retry (HIGH six-reviewer finding) — CASL grants
    // `dependant`/`operational` NOTHING on Goal or Notification
    // (casl-ability.factory.ts), yet `goals`/`notifications` below were
    // still queried against the unfiltered `familyGroupIds` list, exporting
    // every goal (target/current amounts, status) and up to 100
    // notifications for every group a row-scoped membership belongs to.
    // Notification `body` text is the worst leak: transactions.service.ts's
    // checkBudgetAlert/checkCashFlowAlert/notifyTransaction write literal
    // ledger amounts into it, so the household ledger leaked through
    // notification text even though `restrictedTransactionWhere` correctly
    // hides the transactions themselves. Scope to memberships whose role is
    // NOT row-scoped — identical shape to the account/transaction scoping
    // below, just denying outright (D3/D5 get no Goal/Notification grant at
    // all) rather than restricting to "own" rows.
    const unrestrictedFamilyGroupIds = memberships
      .filter((m) => !isRowScopedRole(m.role))
      .map((m) => m.familyGroupId);

    // Scoped PER membership, not with one blanket `familyGroupId: { in: [...]
    // }` query: a `dependant`/`operational` membership in one family group
    // must only export the accounts/transactions in THAT group they own or
    // recorded, even though the very same user may be `owner` (fully
    // unrestricted) in another family group. `restrictedAccountWhere`/
    // `restrictedTransactionWhere` are no-ops for every other role, so this
    // changes nothing for owner/spouse/member/admin_staff memberships.
    const [
      accountsByMembership,
      transactionsByMembership,
      goals,
      notifications,
    ] = await Promise.all([
      Promise.all(
        memberships.map((m) =>
          this.prisma.account.findMany({
            where: {
              familyGroupId: m.familyGroupId,
              ...restrictedAccountWhere(m.role, userId),
            },
            select: {
              id: true,
              name: true,
              type: true,
              balance: true,
              currency: true,
              createdAt: true,
            },
          }),
        ),
      ),
      Promise.all(
        memberships.map((m) =>
          this.prisma.transaction.findMany({
            where: {
              familyGroupId: m.familyGroupId,
              ...restrictedTransactionWhere(m.role, userId),
            },
            select: {
              id: true,
              description: true,
              amount: true,
              type: true,
              occurredAt: true,
            },
            orderBy: { occurredAt: "desc" },
            take: MAX_EXPORTED_TRANSACTIONS,
          }),
        ),
      ),
      this.prisma.goal.findMany({
        where: { familyGroupId: { in: unrestrictedFamilyGroupIds } },
        select: {
          id: true,
          name: true,
          targetAmount: true,
          currentAmount: true,
          status: true,
        },
      }),
      this.prisma.notification.findMany({
        where: { familyGroupId: { in: unrestrictedFamilyGroupIds } },
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

    const accounts = accountsByMembership.flat();
    // Re-merged, re-sorted, and re-capped across ALL groups combined (each
    // per-membership query above is independently capped at
    // MAX_EXPORTED_TRANSACTIONS, so the flattened total can exceed it).
    const transactions = transactionsByMembership
      .flat()
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
      .slice(0, MAX_EXPORTED_TRANSACTIONS);

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
}
