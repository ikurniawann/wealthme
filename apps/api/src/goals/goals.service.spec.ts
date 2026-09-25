import { Test, type TestingModule } from "@nestjs/testing";
import { GoalStatus as PrismaGoalStatus } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";

import { GoalsService } from "./goals.service";

const FAMILY_GROUP_ID = "fg-1";
const GOAL_ID = "goal-1";

interface FakeGoal {
  id: string;
  familyGroupId: string;
  name: string;
  icon: string | null;
  targetAmount: bigint;
  currentAmount: bigint;
  targetDate: Date | null;
  autoDebitAmount: bigint | null;
  autoDebitDay: number | null;
  sourceAccountId: string | null;
  status: PrismaGoalStatus;
  lastAutoDebitAt: Date | null;
  createdAt: Date;
}

const ACCOUNT_ID = "acc-1";

// Far enough in the past that a goal with no explicit `createdAt` override
// never gets mistaken for "brand new" by the C7 elapsed-pace heuristic.
const OLD_CREATED_AT = new Date("2020-01-01T00:00:00Z");

function makeGoal(overrides: Partial<FakeGoal> = {}): FakeGoal {
  return {
    id: GOAL_ID,
    familyGroupId: FAMILY_GROUP_ID,
    name: "Dana Liburan",
    icon: "✈️",
    targetAmount: 10_000_000n,
    currentAmount: 0n,
    targetDate: null,
    autoDebitAmount: 500_000n,
    autoDebitDay: 15,
    sourceAccountId: ACCOUNT_ID,
    status: PrismaGoalStatus.on_track,
    lastAutoDebitAt: null,
    createdAt: OLD_CREATED_AT,
    ...overrides,
  };
}

function makePrisma() {
  const prisma = {
    goal: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    member: {
      // Default: no stored prefs → `resolveNotifPrefs(null)` defaults, which
      // has `goalMilestone: true`.
      findFirst: jest
        .fn()
        .mockResolvedValue({ user: { notificationPrefs: null } }),
    },
    account: {
      findUnique: jest.fn().mockResolvedValue({
        id: ACCOUNT_ID,
        name: "BCA Tahapan",
        type: "bank",
        balance: 50_000_000n,
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
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: "contrib-1", createdAt: new Date(), ...data }),
      ),
    },
    notification: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(
    (cb: (tx: typeof prisma) => Promise<unknown>) => cb(prisma),
  );
  return prisma;
}

describe("GoalsService.runAutoDebit — daily, real money, via the contribution path (Revisi F)", () => {
  let service: GoalsService;
  let prisma: ReturnType<typeof makePrisma>;
  // Local-time constructor: the suite runs under TZ=Asia/Jakarta (jest.global-setup.js).
  const NOW = new Date(2026, 2, 15, 3, 0, 0);

  beforeEach(async () => {
    prisma = makePrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [GoalsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(GoalsService);
  });

  function dueGoal(overrides: Partial<FakeGoal> = {}) {
    const goal = makeGoal(overrides);
    prisma.goal.findMany.mockResolvedValue([goal]);
    prisma.goal.findUnique.mockResolvedValue(goal);
    prisma.goal.update.mockImplementation(
      ({ data }: { data: { currentAmount?: { increment: bigint } } }) =>
        Promise.resolve({
          ...goal,
          currentAmount:
            goal.currentAmount + (data.currentAmount?.increment ?? 0n),
        }),
    );
    return goal;
  }

  it("queries only goals due today that have a source account", async () => {
    prisma.goal.findMany.mockResolvedValue([]);
    await service.runAutoDebit(NOW);
    expect(prisma.goal.findMany).toHaveBeenCalledWith({
      where: {
        autoDebitAmount: { not: null },
        sourceAccountId: { not: null },
        OR: [{ autoDebitDay: 15 }],
      },
    });
  });

  it("on the 1st, a legacy goal with no autoDebitDay is due too", async () => {
    prisma.goal.findMany.mockResolvedValue([]);
    await service.runAutoDebit(new Date(2026, 3, 1, 3, 0, 0));
    expect(prisma.goal.findMany).toHaveBeenCalledWith({
      where: {
        autoDebitAmount: { not: null },
        sourceAccountId: { not: null },
        OR: [{ autoDebitDay: 1 }, { autoDebitDay: null }],
      },
    });
  });

  it("debits the source account and records a source=auto contribution, then notifies", async () => {
    dueGoal();

    const debited = await service.runAutoDebit(NOW);

    expect(debited).toBe(1);
    expect(prisma.account.update).toHaveBeenCalledWith({
      where: { id: ACCOUNT_ID, familyGroupId: FAMILY_GROUP_ID },
      data: { balance: { decrement: 500_000n } },
    });
    expect(prisma.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "transfer", amount: 500_000n }),
      }),
    );
    expect(prisma.goalContribution.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        goalId: GOAL_ID,
        amount: 500_000n,
        accountId: ACCOUNT_ID,
        source: "auto",
        occurredAt: NOW,
      }),
    });
    expect(prisma.goal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lastAutoDebitAt: NOW }),
      }),
    );
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          familyGroupId: FAMILY_GROUP_ID,
          title: "Auto-debit tujuan",
        }),
      }),
    );
  });

  it("is idempotent per goal per calendar day", async () => {
    dueGoal();
    prisma.goalContribution.findFirst.mockResolvedValue({ id: "c-earlier" });

    const debited = await service.runAutoDebit(NOW);

    expect(debited).toBe(0);
    expect(prisma.goalContribution.findFirst).toHaveBeenCalledWith({
      where: {
        familyGroupId: FAMILY_GROUP_ID,
        goalId: GOAL_ID,
        source: "auto",
        occurredAt: {
          gte: new Date(2026, 2, 15),
          lt: new Date(2026, 2, 16),
        },
      },
      select: { id: true },
    });
    expect(prisma.account.update).not.toHaveBeenCalled();
    expect(prisma.goalContribution.create).not.toHaveBeenCalled();
  });

  it("caps the debit at what is left to reach the target", async () => {
    dueGoal({ currentAmount: 9_800_000n, targetAmount: 10_000_000n });

    await service.runAutoDebit(NOW);

    expect(prisma.account.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { balance: { decrement: 200_000n } },
      }),
    );
    expect(prisma.goal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: PrismaGoalStatus.achieved }),
      }),
    );
  });

  it("a goal already at target moves no money but stamps the run", async () => {
    dueGoal({ currentAmount: 10_000_000n, targetAmount: 10_000_000n });

    const debited = await service.runAutoDebit(NOW);

    expect(debited).toBe(0);
    expect(prisma.account.update).not.toHaveBeenCalled();
    expect(prisma.goal.update).toHaveBeenCalledWith({
      where: { id: GOAL_ID, familyGroupId: FAMILY_GROUP_ID },
      data: { lastAutoDebitAt: NOW },
    });
  });

  it("one goal's insufficient balance does not stop the next goal", async () => {
    const broke = makeGoal({ id: "goal-broke", sourceAccountId: "acc-empty" });
    const fine = makeGoal({ id: "goal-fine" });
    prisma.goal.findMany.mockResolvedValue([broke, fine]);
    prisma.goal.findUnique.mockImplementation(
      ({ where }: { where: { id: string } }) =>
        Promise.resolve(where.id === broke.id ? broke : fine),
    );
    prisma.goal.update.mockResolvedValue(fine);
    prisma.account.findUnique.mockImplementation(
      ({ where }: { where: { id: string } }) =>
        Promise.resolve(
          where.id === "acc-empty"
            ? { id: "acc-empty", name: "Kosong", type: "bank", balance: 0n }
            : {
                id: ACCOUNT_ID,
                name: "BCA Tahapan",
                type: "bank",
                balance: 50_000_000n,
              },
        ),
    );

    const debited = await service.runAutoDebit(NOW);

    expect(debited).toBe(1);
    expect(prisma.goalContribution.create).toHaveBeenCalledTimes(1);
    expect(prisma.goalContribution.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ goalId: "goal-fine" }),
    });
    expect(prisma.account.update).toHaveBeenCalledTimes(1);
  });
});

describe("GoalsService.update — currentAmount vs targetAmount (EPIC-022 A4 follow-up)", () => {
  let service: GoalsService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    prisma = makePrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [GoalsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(GoalsService);
  });

  it("rejects a currentAmount that exceeds the existing targetAmount, and never writes", async () => {
    prisma.goal.findUnique.mockResolvedValue(makeGoal({ currentAmount: 0n }));

    await expect(
      service.update(FAMILY_GROUP_ID, GOAL_ID, { currentAmount: 15_000_000 }),
    ).rejects.toMatchObject({ status: 400 });
    expect(prisma.goal.update).not.toHaveBeenCalled();
  });

  it("rejects when a lowered targetAmount would put the EXISTING currentAmount over it", async () => {
    prisma.goal.findUnique.mockResolvedValue(
      makeGoal({ currentAmount: 8_000_000n, targetAmount: 10_000_000n }),
    );

    await expect(
      service.update(FAMILY_GROUP_ID, GOAL_ID, { targetAmount: 5_000_000 }),
    ).rejects.toMatchObject({ status: 400 });
    expect(prisma.goal.update).not.toHaveBeenCalled();
  });

  it("judges both fields together: raising target and current in the same PATCH is allowed", async () => {
    prisma.goal.findUnique.mockResolvedValue(
      makeGoal({ currentAmount: 5_000_000n, targetAmount: 10_000_000n }),
    );
    prisma.goal.update.mockResolvedValue(
      makeGoal({
        currentAmount: 18_000_000n,
        targetAmount: 20_000_000n,
        status: PrismaGoalStatus.on_track,
      }),
    );

    const result = await service.update(FAMILY_GROUP_ID, GOAL_ID, {
      targetAmount: 20_000_000,
      currentAmount: 18_000_000,
    });

    expect(result.currentAmount).toBe(18_000_000);
    expect(prisma.goal.update).toHaveBeenCalled();
  });

  it("allows currentAmount exactly equal to targetAmount (achieved boundary)", async () => {
    prisma.goal.findUnique.mockResolvedValue(
      makeGoal({ currentAmount: 0n, targetAmount: 10_000_000n }),
    );
    prisma.goal.update.mockResolvedValue(
      makeGoal({
        currentAmount: 10_000_000n,
        status: PrismaGoalStatus.achieved,
      }),
    );

    const result = await service.update(FAMILY_GROUP_ID, GOAL_ID, {
      currentAmount: 10_000_000,
    });

    expect(result.currentAmount).toBe(10_000_000);
    expect(result.status).toBe("achieved");
  });

  it("(C8) uses the provided currentAmount at creation instead of discarding it to 0", async () => {
    prisma.goal.create.mockImplementation(
      ({
        data,
      }: {
        data: {
          currentAmount: bigint;
          targetAmount: bigint;
          targetDate: Date | null;
          createdAt: Date;
          status: PrismaGoalStatus;
        };
      }) =>
        Promise.resolve(
          makeGoal({
            currentAmount: data.currentAmount,
            targetAmount: data.targetAmount,
          }),
        ),
    );

    const result = await service.create(FAMILY_GROUP_ID, {
      name: "Dana Darurat",
      targetAmount: 20_000_000,
      currentAmount: 5_000_000,
    });

    expect(result.currentAmount).toBe(5_000_000);
    expect(prisma.goal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ currentAmount: 5_000_000n }),
      }),
    );
  });

  it("(C8) rejects an initial currentAmount above targetAmount", async () => {
    await expect(
      service.create(FAMILY_GROUP_ID, {
        name: "Dana Darurat",
        targetAmount: 1_000_000,
        currentAmount: 2_000_000,
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(prisma.goal.create).not.toHaveBeenCalled();
  });

  it("allows an unrelated edit (name only) that never touches either amount", async () => {
    prisma.goal.findUnique.mockResolvedValue(
      makeGoal({ currentAmount: 2_000_000n, targetAmount: 10_000_000n }),
    );
    prisma.goal.update.mockResolvedValue(
      makeGoal({
        name: "Renamed",
        currentAmount: 2_000_000n,
        targetAmount: 10_000_000n,
      }),
    );

    const result = await service.update(FAMILY_GROUP_ID, GOAL_ID, {
      name: "Renamed",
    });

    expect(result.name).toBe("Renamed");
    expect(prisma.goal.update).toHaveBeenCalled();
  });
});

/**
 * EPIC-022 C7 — status is recomputed on EVERY read from the live
 * currentAmount/targetDate/createdAt, never trusted from the stored `status`
 * column (which is only ever refreshed by a write). These exercise
 * `findAll` directly against a fake `goal.findMany` whose stored `status`
 * deliberately DISAGREES with what a live recomputation would say, so the
 * test fails if `toDto` ever goes back to trusting the stored column.
 */
describe("GoalsService.findAll recomputes status on read (EPIC-022 C7)", () => {
  let service: GoalsService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    prisma = makePrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [GoalsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(GoalsService);
  });

  it("an overdue, under-funded goal reads at_risk even though its stored status says on_track", async () => {
    prisma.goal.findMany.mockResolvedValue([
      makeGoal({
        currentAmount: 1_000_000n,
        targetAmount: 10_000_000n,
        // The deadline has already passed.
        targetDate: new Date("2020-06-01T00:00:00Z"),
        createdAt: new Date("2020-01-01T00:00:00Z"),
        status: PrismaGoalStatus.on_track, // stale, stored the day it was saved
      }),
    ]);

    const [result] = await service.findAll(FAMILY_GROUP_ID);

    expect(result!.status).toBe("at_risk");
  });

  it("a brand-new, long-horizon goal with 0 saved is on_track, not at_risk", async () => {
    const now = new Date("2026-06-15T00:00:00Z");
    jest.useFakeTimers().setSystemTime(now);
    try {
      prisma.goal.findMany.mockResolvedValue([
        makeGoal({
          currentAmount: 0n,
          targetAmount: 100_000_000n,
          // A 10-year horizon, created moments ago.
          targetDate: new Date("2036-06-15T00:00:00Z"),
          createdAt: now,
          status: PrismaGoalStatus.on_track,
        }),
      ]);

      const [result] = await service.findAll(FAMILY_GROUP_ID);

      expect(result!.status).toBe("on_track");
    } finally {
      jest.useRealTimers();
    }
  });

  it("a goal already meeting or beating its expected pace reads on_track", async () => {
    const createdAt = new Date("2026-01-01T00:00:00Z");
    const targetDate = new Date("2026-07-01T00:00:00Z"); // 6 months total
    const now = new Date("2026-04-01T00:00:00Z"); // 3 months elapsed = 50%
    jest.useFakeTimers().setSystemTime(now);
    try {
      prisma.goal.findMany.mockResolvedValue([
        makeGoal({
          currentAmount: 5_000_000n, // 50% of target — right on pace
          targetAmount: 10_000_000n,
          targetDate,
          createdAt,
          status: PrismaGoalStatus.at_risk, // stale
        }),
      ]);

      const [result] = await service.findAll(FAMILY_GROUP_ID);

      expect(result!.status).toBe("on_track");
    } finally {
      jest.useRealTimers();
    }
  });

  it("a goal well behind its expected pace reads needs_boost or at_risk, not achieved's neighbor on_track", async () => {
    const createdAt = new Date("2026-01-01T00:00:00Z");
    const targetDate = new Date("2026-07-01T00:00:00Z");
    const now = new Date("2026-04-01T00:00:00Z"); // 50% elapsed
    jest.useFakeTimers().setSystemTime(now);
    try {
      prisma.goal.findMany.mockResolvedValue([
        makeGoal({
          currentAmount: 1_000_000n, // 10% of target, way behind the 50% pace
          targetAmount: 10_000_000n,
          targetDate,
          createdAt,
          status: PrismaGoalStatus.on_track, // stale
        }),
      ]);

      const [result] = await service.findAll(FAMILY_GROUP_ID);

      expect(["needs_boost", "at_risk"]).toContain(result!.status);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe("GoalsService create/update — sourceAccountId (Revisi F)", () => {
  let service: GoalsService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    prisma = makePrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [GoalsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(GoalsService);
    prisma.goal.create.mockImplementation(
      ({ data }: { data: Partial<FakeGoal> }) =>
        Promise.resolve(makeGoal({ ...data })),
    );
    prisma.goal.update.mockImplementation(
      ({ data }: { data: Partial<FakeGoal> }) =>
        Promise.resolve(makeGoal({ ...data })),
    );
  });

  it("create rejects autoDebitAmount without a source account (400)", async () => {
    await expect(
      service.create(FAMILY_GROUP_ID, {
        name: "Dana Liburan",
        targetAmount: 10_000_000,
        autoDebitAmount: 500_000,
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(prisma.goal.create).not.toHaveBeenCalled();
  });

  it("create rejects a sourceAccountId from another family group (404)", async () => {
    prisma.account.findUnique.mockResolvedValue(null);
    await expect(
      service.create(FAMILY_GROUP_ID, {
        name: "Dana Liburan",
        targetAmount: 10_000_000,
        autoDebitAmount: 500_000,
        sourceAccountId: "acc-other",
      }),
    ).rejects.toMatchObject({ status: 404 });
    expect(prisma.account.findUnique).toHaveBeenCalledWith({
      where: { id: "acc-other", familyGroupId: FAMILY_GROUP_ID },
      select: { id: true },
    });
    expect(prisma.goal.create).not.toHaveBeenCalled();
  });

  it("create stores and returns the source account", async () => {
    const result = await service.create(FAMILY_GROUP_ID, {
      name: "Dana Liburan",
      targetAmount: 10_000_000,
      autoDebitAmount: 500_000,
      sourceAccountId: ACCOUNT_ID,
    });
    expect(prisma.goal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sourceAccountId: ACCOUNT_ID }),
      }),
    );
    expect(result.sourceAccountId).toBe(ACCOUNT_ID);
  });

  it("update rejects setting autoDebitAmount on a goal with no source account (400)", async () => {
    prisma.goal.findUnique.mockResolvedValue(
      makeGoal({ autoDebitAmount: null, sourceAccountId: null }),
    );
    await expect(
      service.update(FAMILY_GROUP_ID, GOAL_ID, { autoDebitAmount: 500_000 }),
    ).rejects.toMatchObject({ status: 400 });
    expect(prisma.goal.update).not.toHaveBeenCalled();
  });

  it("a name-only edit of a legacy auto-debit goal without a source account still saves", async () => {
    prisma.goal.findUnique.mockResolvedValue(
      makeGoal({ autoDebitAmount: 500_000n, sourceAccountId: null }),
    );
    const result = await service.update(FAMILY_GROUP_ID, GOAL_ID, {
      name: "Renamed",
    });
    expect(result.name).toBe("Renamed");
    expect(prisma.account.findUnique).not.toHaveBeenCalled();
  });

  it("update can attach a source account to a legacy goal", async () => {
    prisma.goal.findUnique.mockResolvedValue(
      makeGoal({ autoDebitAmount: 500_000n, sourceAccountId: null }),
    );
    await service.update(FAMILY_GROUP_ID, GOAL_ID, {
      autoDebitAmount: 500_000,
      sourceAccountId: ACCOUNT_ID,
    });
    expect(prisma.goal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sourceAccountId: ACCOUNT_ID }),
      }),
    );
  });
});
