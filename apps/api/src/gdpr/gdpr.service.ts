import { Injectable } from "@nestjs/common";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

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

    const [accounts, transactions, goals, notifications] = await Promise.all([
      this.prisma.account.findMany({
        where: { familyGroupId: { in: familyGroupIds } },
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
        where: { familyGroupId: { in: familyGroupIds } },
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
}
