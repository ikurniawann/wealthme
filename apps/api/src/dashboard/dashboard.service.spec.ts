import { Test, type TestingModule } from "@nestjs/testing";

import { PrismaService } from "../prisma/prisma.service";

import { DashboardService } from "./dashboard.service";

const FAMILY_GROUP_ID = "fg-1";

interface FakeAccount {
  id: string;
  balance: bigint;
  type: string;
  name: string;
  isPrivate: boolean;
}

interface FakeCategory {
  id: string;
  name: string;
  isPrivate: boolean;
}

interface FakeTransaction {
  id: string;
  accountId: string;
  categoryId: string | null;
  amount: bigint;
  type: "income" | "expense" | "transfer";
  description: string | null;
  occurredAt: Date;
  createdAt: Date;
}

/**
 * A minimal in-memory Prisma stand-in that actually honors the `isPrivate`
 * and transitive account/category `where` filters the service builds, so
 * these tests exercise real filtering behavior rather than just asserting on
 * call shapes.
 */
function makeFakePrisma(
  accounts: FakeAccount[],
  categories: FakeCategory[],
  transactions: FakeTransaction[],
) {
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  return {
    account: {
      findMany: jest.fn(({ where }: { where: { isPrivate?: boolean } }) => {
        const rows =
          where.isPrivate === false
            ? accounts.filter((a) => !a.isPrivate)
            : accounts;
        return Promise.resolve(rows);
      }),
    },
    asset: { findMany: jest.fn(() => Promise.resolve([])) },
    investment: { findMany: jest.fn(() => Promise.resolve([])) },
    liability: { findMany: jest.fn(() => Promise.resolve([])) },
    netWorthSnapshot: {
      findFirst: jest.fn(() => Promise.resolve(null)),
      create: jest.fn((args: { data: unknown }) => Promise.resolve(args.data)),
    },
    transaction: {
      findMany: jest.fn(
        ({
          where,
        }: {
          where: {
            account?: { isPrivate: boolean };
            OR?: unknown;
          };
        }) => {
          let rows = transactions;
          if (where.account?.isPrivate === false) {
            rows = rows.filter((t) => !accountById.get(t.accountId)?.isPrivate);
          }
          if (where.OR) {
            rows = rows.filter((t) => {
              if (t.categoryId === null) return true;
              return !categoryById.get(t.categoryId)?.isPrivate;
            });
          }
          return Promise.resolve(
            rows.map((t) => ({
              ...t,
              category: t.categoryId
                ? { name: categoryById.get(t.categoryId)?.name ?? "" }
                : null,
              account: { name: accountById.get(t.accountId)?.name ?? "" },
            })),
          );
        },
      ),
    },
  };
}

function buildFixtures() {
  const accounts: FakeAccount[] = [
    {
      id: "acc-visible",
      balance: 100n,
      type: "bank",
      name: "Visible",
      isPrivate: false,
    },
    {
      id: "acc-private",
      balance: 500n,
      type: "bank",
      name: "Private",
      isPrivate: true,
    },
  ];
  const categories: FakeCategory[] = [
    { id: "cat-visible", name: "Public Cat", isPrivate: false },
    { id: "cat-private", name: "Private Cat", isPrivate: true },
  ];
  const now = new Date();
  const transactions: FakeTransaction[] = [
    {
      id: "tx-visible",
      accountId: "acc-visible",
      categoryId: null,
      amount: 50n,
      type: "income",
      description: null,
      occurredAt: now,
      createdAt: now,
    },
    {
      id: "tx-private-account",
      accountId: "acc-private",
      categoryId: null,
      amount: 30n,
      type: "expense",
      description: null,
      occurredAt: now,
      createdAt: now,
    },
    {
      id: "tx-private-category",
      accountId: "acc-visible",
      categoryId: "cat-private",
      amount: 20n,
      type: "expense",
      description: null,
      occurredAt: now,
      createdAt: now,
    },
  ];
  return { accounts, categories, transactions };
}

describe("DashboardService privacy enforcement", () => {
  let service: DashboardService;
  let prisma: ReturnType<typeof makeFakePrisma>;

  beforeEach(async () => {
    const { accounts, categories, transactions } = buildFixtures();
    prisma = makeFakePrisma(accounts, categories, transactions);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(DashboardService);
  });

  it("getSummary excludes private account/category transactions for a member viewer", async () => {
    const summary = await service.getSummary(FAMILY_GROUP_ID, false);

    // Only the visible account's balance (100) counts toward net worth.
    expect(summary.netWorth).toBe(100);
    // Only tx-visible (income 50) is counted — the private-account and
    // private-category expense transactions are excluded.
    expect(summary.currentMonth.income).toBe(50);
    expect(summary.currentMonth.expense).toBe(0);
    expect(summary.recentTransactions.map((t) => t.id).sort()).toEqual([
      "tx-visible",
    ]);
  });

  it("getSummary includes private accounts/categories for an owner/admin_staff viewer", async () => {
    const summary = await service.getSummary(FAMILY_GROUP_ID, true);

    // Both accounts (100 + 500) count toward net worth.
    expect(summary.netWorth).toBe(600);
    expect(summary.currentMonth.income).toBe(50);
    expect(summary.currentMonth.expense).toBe(50); // 30 + 20
    expect(summary.recentTransactions.map((t) => t.id).sort()).toEqual(
      ["tx-private-account", "tx-private-category", "tx-visible"].sort(),
    );
  });

  it("getNetWorth excludes the private account's balance for a member viewer", async () => {
    const netWorth = await service.getNetWorth(FAMILY_GROUP_ID, false);
    expect(netWorth.accountsTotal).toBe("100");
    expect(netWorth.netWorth).toBe("100");
  });

  it("getNetWorth includes the private account's balance for an owner viewer", async () => {
    const netWorth = await service.getNetWorth(FAMILY_GROUP_ID, true);
    expect(netWorth.accountsTotal).toBe("600");
    expect(netWorth.netWorth).toBe("600");
  });

  it("captureSnapshot always sums the full account set regardless of privacy flags", async () => {
    await service.captureSnapshot(FAMILY_GROUP_ID, new Date());

    expect(prisma.netWorthSnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ totalCash: 600n }),
      }),
    );
  });
});
