import { Test, type TestingModule } from "@nestjs/testing";
import { GoalStatus as PrismaGoalStatus, Prisma } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";

import { GoalsService } from "./goals.service";

const FAMILY_GROUP_ID = "fg-1";
const GOAL_ID = "goal-1";
const ACCOUNT_ID = "acc-1";
const NOW = new Date(2026, 8, 25, 10, 0, 0);

function makeGoal(overrides: Record<string, unknown> = {}) {
  return {
    id: GOAL_ID,
    familyGroupId: FAMILY_GROUP_ID,
    name: "Dana Liburan",
    icon: "✈️",
    targetAmount: 10_000_000n,
    currentAmount: 1_000_000n,
    targetDate: null,
    autoDebitAmount: null,
    autoDebitDay: null,
    sourceAccountId: null,
    lastAutoDebitAt: null,
    status: PrismaGoalStatus.on_track,
    createdAt: new Date("2020-01-01T00:00:00Z"),
    updatedAt: new Date("2020-01-01T00:00:00Z"),
    ...overrides,
  };
}

function makePrisma() {
  const prisma = {
    goal: {
      findUnique: jest.fn().mockResolvedValue(makeGoal()),
      update: jest
        .fn()
        .mockResolvedValue(makeGoal({ currentAmount: 1_250_000n })),
    },
    account: {
      // Serves both our {id,name} lookup and assertBankNotOverdrawn's {type,balance,name}.
      findUnique: jest.fn().mockResolvedValue({
        id: ACCOUNT_ID,
        name: "BCA Tahapan",
        type: "bank",
        balance: 5_000_000n,
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    coaAccount: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ id: "coa-30001", name: "Tabungan" }),
    },
    category: { upsert: jest.fn().mockResolvedValue({ id: "cat-goal" }) },
    transaction: { create: jest.fn().mockResolvedValue({ id: "txn-1" }) },
    goalContribution: {
      create: jest.fn(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: "contrib-1", createdAt: NOW, ...data }),
      ),
      findMany: jest.fn(),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(
    (cb: (tx: typeof prisma) => Promise<unknown>) => cb(prisma),
  );
  return prisma;
}

describe("GoalsService.contribute (Revisi F item 5)", () => {
  let service: GoalsService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    prisma = makePrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [GoalsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(GoalsService);
  });

  it("with an account: debits it, posts a transfer on the goal's own savings category, records a linked manual contribution, bumps currentAmount", async () => {
    const result = await service.contribute(
      FAMILY_GROUP_ID,
      GOAL_ID,
      { amount: "250000", accountId: ACCOUNT_ID },
      NOW,
    );

    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
    expect(prisma.account.update).toHaveBeenCalledWith({
      where: { id: ACCOUNT_ID, familyGroupId: FAMILY_GROUP_ID },
      data: { balance: { decrement: 250_000n } },
    });
    expect(prisma.coaAccount.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { familyGroupId: FAMILY_GROUP_ID, code: "30001" },
      }),
    );
    expect(prisma.category.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          familyGroupId_name_kind: {
            familyGroupId: FAMILY_GROUP_ID,
            name: "Tabungan: Dana Liburan",
            kind: "expense",
          },
        },
      }),
    );
    expect(prisma.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          familyGroupId: FAMILY_GROUP_ID,
          accountId: ACCOUNT_ID,
          categoryId: "cat-goal",
          amount: 250_000n,
          type: "transfer",
          description: "Setor tujuan Dana Liburan",
          occurredAt: NOW,
        }),
      }),
    );
    expect(prisma.goalContribution.create).toHaveBeenCalledWith({
      data: {
        familyGroupId: FAMILY_GROUP_ID,
        goalId: GOAL_ID,
        amount: 250_000n,
        accountId: ACCOUNT_ID,
        transactionId: "txn-1",
        occurredAt: NOW,
        source: "manual",
      },
    });
    expect(prisma.goal.update).toHaveBeenCalledWith({
      where: { id: GOAL_ID, familyGroupId: FAMILY_GROUP_ID },
      data: {
        currentAmount: { increment: 250_000n },
        status: PrismaGoalStatus.on_track,
      },
    });
    expect(result.contribution).toEqual({
      id: "contrib-1",
      goalId: GOAL_ID,
      amount: "250000",
      accountId: ACCOUNT_ID,
      accountName: "BCA Tahapan",
      transactionId: "txn-1",
      occurredAt: NOW.toISOString(),
      source: "manual",
      createdAt: NOW.toISOString(),
    });
    expect(result.goal.currentAmount).toBe(1_250_000);
  });

  it("falls back to COA 30099 when the family has no 30001", async () => {
    prisma.coaAccount.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "coa-30099", name: "Alokasi Lainnya" });

    await service.contribute(
      FAMILY_GROUP_ID,
      GOAL_ID,
      { amount: "250000", accountId: ACCOUNT_ID },
      NOW,
    );

    expect(prisma.category.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          name: "Alokasi Lainnya: Dana Liburan",
          coaAccountId: "coa-30099",
        }),
      }),
    );
  });

  it("without an account: records progress only — no account, category or ledger writes", async () => {
    const result = await service.contribute(
      FAMILY_GROUP_ID,
      GOAL_ID,
      { amount: "250000" },
      NOW,
    );

    expect(prisma.account.findUnique).not.toHaveBeenCalled();
    expect(prisma.account.update).not.toHaveBeenCalled();
    expect(prisma.category.upsert).not.toHaveBeenCalled();
    expect(prisma.transaction.create).not.toHaveBeenCalled();
    expect(result.contribution.accountId).toBeNull();
    expect(result.contribution.transactionId).toBeNull();
  });

  it("rejects when the bank account would go below zero, and writes nothing", async () => {
    prisma.account.findUnique.mockResolvedValue({
      id: ACCOUNT_ID,
      name: "BCA Tahapan",
      type: "bank",
      balance: 100_000n,
    });

    await expect(
      service.contribute(
        FAMILY_GROUP_ID,
        GOAL_ID,
        { amount: "250000", accountId: ACCOUNT_ID },
        NOW,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(prisma.account.update).not.toHaveBeenCalled();
    expect(prisma.transaction.create).not.toHaveBeenCalled();
    expect(prisma.goalContribution.create).not.toHaveBeenCalled();
    expect(prisma.goal.update).not.toHaveBeenCalled();
  });

  it("rejects an account from another family group (404) and writes nothing", async () => {
    prisma.account.findUnique.mockResolvedValue(null);

    await expect(
      service.contribute(
        FAMILY_GROUP_ID,
        GOAL_ID,
        { amount: "250000", accountId: "acc-other-family" },
        NOW,
      ),
    ).rejects.toMatchObject({ status: 404 });
    expect(prisma.account.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "acc-other-family", familyGroupId: FAMILY_GROUP_ID },
      }),
    );
    expect(prisma.goalContribution.create).not.toHaveBeenCalled();
    expect(prisma.goal.update).not.toHaveBeenCalled();
  });

  it("rejects a contribution larger than what is left to reach the target", async () => {
    await expect(
      service.contribute(FAMILY_GROUP_ID, GOAL_ID, { amount: "9000001" }, NOW),
    ).rejects.toMatchObject({ status: 400 });
    expect(prisma.goalContribution.create).not.toHaveBeenCalled();
  });

  it("accepts a contribution that exactly completes the target", async () => {
    prisma.goal.update.mockResolvedValue(
      makeGoal({ currentAmount: 10_000_000n }),
    );
    const result = await service.contribute(
      FAMILY_GROUP_ID,
      GOAL_ID,
      { amount: "9000000" },
      NOW,
    );
    expect(prisma.goal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: PrismaGoalStatus.achieved }),
      }),
    );
    expect(result.goal.status).toBe("achieved");
  });

  it("rejects an occurredAt in the future", async () => {
    const tomorrow = new Date(NOW.getTime() + 24 * 60 * 60 * 1000);
    await expect(
      service.contribute(
        FAMILY_GROUP_ID,
        GOAL_ID,
        { amount: "250000", occurredAt: tomorrow.toISOString() },
        NOW,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("accepts an occurredAt equal to now (the web sends local midnight of today)", async () => {
    await service.contribute(
      FAMILY_GROUP_ID,
      GOAL_ID,
      { amount: "250000", occurredAt: NOW.toISOString() },
      NOW,
    );
    expect(prisma.goalContribution.create).toHaveBeenCalled();
  });

  it("404s an unknown goal (tenant-scoped lookup)", async () => {
    prisma.goal.findUnique.mockResolvedValue(null);
    await expect(
      service.contribute(FAMILY_GROUP_ID, "nope", { amount: "1" }, NOW),
    ).rejects.toMatchObject({ status: 404 });
    expect(prisma.goal.findUnique).toHaveBeenCalledWith({
      where: { id: "nope", familyGroupId: FAMILY_GROUP_ID },
    });
  });
});

describe("GoalsService.listContributions (Revisi F item 5)", () => {
  let service: GoalsService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    prisma = makePrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [GoalsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(GoalsService);
  });

  it("lists newest first, tenant-scoped, with the account name", async () => {
    prisma.goalContribution.findMany.mockResolvedValue([
      {
        id: "c-2",
        goalId: GOAL_ID,
        amount: 500_000n,
        accountId: null,
        transactionId: null,
        occurredAt: new Date("2026-09-24T00:00:00Z"),
        source: "auto",
        createdAt: new Date("2026-09-24T00:00:00Z"),
        account: null,
      },
      {
        id: "c-1",
        goalId: GOAL_ID,
        amount: 250_000n,
        accountId: ACCOUNT_ID,
        transactionId: "txn-1",
        occurredAt: new Date("2026-09-20T00:00:00Z"),
        source: "manual",
        createdAt: new Date("2026-09-20T00:00:00Z"),
        account: { name: "BCA Tahapan" },
      },
    ]);

    const rows = await service.listContributions(FAMILY_GROUP_ID, GOAL_ID);

    expect(prisma.goalContribution.findMany).toHaveBeenCalledWith({
      where: { familyGroupId: FAMILY_GROUP_ID, goalId: GOAL_ID },
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      include: { account: { select: { name: true } } },
    });
    expect(rows.map((r) => r.id)).toEqual(["c-2", "c-1"]);
    expect(rows[0]).toMatchObject({
      amount: "500000",
      source: "auto",
      accountName: null,
    });
    expect(rows[1]).toMatchObject({
      amount: "250000",
      accountName: "BCA Tahapan",
    });
  });

  it("404s a goal outside the caller's family group", async () => {
    prisma.goal.findUnique.mockResolvedValue(null);
    await expect(
      service.listContributions(FAMILY_GROUP_ID, "nope"),
    ).rejects.toMatchObject({ status: 404 });
    expect(prisma.goalContribution.findMany).not.toHaveBeenCalled();
  });
});
