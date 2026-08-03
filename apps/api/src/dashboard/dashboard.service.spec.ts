import { Test, type TestingModule } from "@nestjs/testing";
import { Decimal } from "@prisma/client/runtime/library";

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
  // EPIC-017: dashboard classifies income/expense by COA direction.
  coaAccount: { direction: "INCOME" | "EXPENSE" | "TRANSFER" };
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

interface FakeInvestment {
  quantity: Decimal;
  costBasisPerUnit: Decimal;
  // Empty array simulates "no price row yet" (cost-basis fallback).
  prices: { price: Decimal }[];
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
  investments: FakeInvestment[] = [],
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
    investment: { findMany: jest.fn(() => Promise.resolve(investments)) },
    liability: { findMany: jest.fn(() => Promise.resolve([])) },
    netWorthSnapshot: {
      upsert: jest.fn(({ create }: { create: Record<string, unknown> }) =>
        Promise.resolve(create),
      ),
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
                ? {
                    name: categoryById.get(t.categoryId)?.name ?? "",
                    coaAccount: categoryById.get(t.categoryId)?.coaAccount ?? {
                      direction: "EXPENSE",
                    },
                  }
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
    {
      id: "cat-visible",
      name: "Public Cat",
      isPrivate: false,
      coaAccount: { direction: "INCOME" },
    },
    {
      id: "cat-private",
      name: "Private Cat",
      isPrivate: true,
      coaAccount: { direction: "EXPENSE" },
    },
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

  it("classifies income/expense by COA direction, not tx.type (EPIC-017)", async () => {
    // An expense-TYPE tx mapped to a TRANSFER (wealth allocation) COA account
    // must be excluded from dashboard expense — matching /laporan.
    const now = new Date();
    const accounts: FakeAccount[] = [
      { id: "a1", balance: 0n, type: "bank", name: "A", isPrivate: false },
    ];
    const categories: FakeCategory[] = [
      {
        id: "c-tr",
        name: "Tabungan",
        isPrivate: false,
        coaAccount: { direction: "TRANSFER" },
      },
    ];
    const transactions: FakeTransaction[] = [
      {
        id: "t1",
        accountId: "a1",
        categoryId: "c-tr",
        amount: 1000n,
        type: "expense",
        description: null,
        occurredAt: now,
        createdAt: now,
      },
    ];
    const p = makeFakePrisma(accounts, categories, transactions);
    const mod = await Test.createTestingModule({
      providers: [DashboardService, { provide: PrismaService, useValue: p }],
    }).compile();
    const svc = mod.get<DashboardService>(DashboardService);

    const summary = await svc.getSummary(FAMILY_GROUP_ID, true);
    expect(summary.currentMonth.expense).toBe(0);
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
    const now = new Date();
    const written = await service.captureSnapshot(FAMILY_GROUP_ID, now);

    expect(written).toBe(true);
    expect(prisma.netWorthSnapshot.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          familyGroupId_date: expect.objectContaining({
            familyGroupId: FAMILY_GROUP_ID,
          }),
        }),
        create: expect.objectContaining({ totalCash: 600n }),
      }),
    );
  });

  it("captureSnapshot upserts atomically instead of check-then-insert (no double-write)", async () => {
    // Simulate "a snapshot already exists for today": upsert's `update: {}`
    // no-op path returns the existing row untouched (capturedAt from the
    // original capture, not the new call's `now`).
    const originalCapturedAt = new Date("2026-01-01T00:00:00.000Z");
    prisma.netWorthSnapshot.upsert.mockResolvedValueOnce({
      capturedAt: originalCapturedAt,
    });

    const written = await service.captureSnapshot(
      FAMILY_GROUP_ID,
      new Date("2026-01-01T18:00:00.000Z"),
    );

    expect(written).toBe(false);
  });
});

describe("DashboardService investment valuation (EPIC-QA-sweep #2)", () => {
  it("getNetWorth values a holding at its latest recorded price, not cost basis", async () => {
    const investments: FakeInvestment[] = [
      {
        quantity: new Decimal("10"),
        costBasisPerUnit: new Decimal("9500"),
        prices: [{ price: new Decimal("10000") }],
      },
    ];
    const prisma = makeFakePrisma([], [], [], investments);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    const service = module.get<DashboardService>(DashboardService);

    const netWorth = await service.getNetWorth(FAMILY_GROUP_ID, true);

    // 10 * 10,000 (latest price) = 100,000 — NOT 10 * 9,500 (cost basis) = 95,000.
    expect(netWorth.investmentsTotal).toBe("100000");
  });

  it("getNetWorth falls back to cost basis when an investment has no price row yet", async () => {
    const investments: FakeInvestment[] = [
      {
        quantity: new Decimal("5"),
        costBasisPerUnit: new Decimal("2000"),
        prices: [],
      },
    ];
    const prisma = makeFakePrisma([], [], [], investments);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    const service = module.get<DashboardService>(DashboardService);

    const netWorth = await service.getNetWorth(FAMILY_GROUP_ID, true);

    expect(netWorth.investmentsTotal).toBe("10000"); // 5 * 2,000 fallback
  });
});
