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
  status: PrismaGoalStatus;
  lastAutoDebitAt: Date | null;
  createdAt: Date;
}

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
    status: PrismaGoalStatus.on_track,
    lastAutoDebitAt: null,
    createdAt: OLD_CREATED_AT,
    ...overrides,
  };
}

/**
 * A minimal fake Prisma client. `$transaction` invokes its callback with the
 * SAME object (real Prisma would hand back a distinct `tx`, but nothing here
 * depends on that distinction) so assertions can inspect calls made both
 * inside and outside the transaction via one set of jest.fn()s.
 */
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
    // EPIC-022 A3 — these must NEVER be called again: the phantom ledger row
    // this auto-debit used to write picked an arbitrary account and category
    // through these two lookups.
    account: { findFirst: jest.fn() },
    category: { findFirst: jest.fn() },
    transaction: { create: jest.fn() },
    notification: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(
    (cb: (tx: typeof prisma) => Promise<void>) => cb(prisma),
  );
  return prisma;
}

describe("GoalsService.runAutoDebit — goals are a manual tracker (EPIC-022 A3)", () => {
  let service: GoalsService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    prisma = makePrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [GoalsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(GoalsService);
  });

  it("bumps currentAmount and notifies, but writes NO Transaction and looks up NO account/category", async () => {
    prisma.goal.findMany.mockResolvedValue([makeGoal()]);
    const now = new Date("2026-03-15T00:00:00.000Z");

    const debited = await service.runAutoDebit(now);

    expect(debited).toBe(1);
    // The tracker bump — unchanged behavior.
    expect(prisma.goal.update).toHaveBeenCalledWith({
      where: { id: GOAL_ID },
      data: {
        currentAmount: 500_000n,
        status: PrismaGoalStatus.on_track,
        lastAutoDebitAt: now,
      },
    });
    // The notification — unchanged behavior.
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          familyGroupId: FAMILY_GROUP_ID,
          title: "Auto-debit tujuan",
        }),
      }),
    );

    // The fix: no phantom ledger row, and no arbitrary account/category pick.
    expect(prisma.transaction.create).not.toHaveBeenCalled();
    expect(prisma.account.findFirst).not.toHaveBeenCalled();
    expect(prisma.category.findFirst).not.toHaveBeenCalled();
  });

  it("caps the bump at targetAmount and reports the actual (not full) delta via currentAmount", async () => {
    prisma.goal.findMany.mockResolvedValue([
      makeGoal({
        currentAmount: 9_800_000n,
        targetAmount: 10_000_000n,
        autoDebitAmount: 500_000n,
      }),
    ]);
    const now = new Date("2026-03-15T00:00:00.000Z");

    await service.runAutoDebit(now);

    expect(prisma.goal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          currentAmount: 10_000_000n,
          status: PrismaGoalStatus.achieved,
        }),
      }),
    );
    expect(prisma.transaction.create).not.toHaveBeenCalled();
  });

  it("is idempotent within the same calendar month (no double bump, no transaction either way)", async () => {
    prisma.goal.findMany.mockResolvedValue([
      makeGoal({ lastAutoDebitAt: new Date("2026-03-01T00:00:00.000Z") }),
    ]);
    const now = new Date("2026-03-20T00:00:00.000Z");

    const debited = await service.runAutoDebit(now);

    expect(debited).toBe(0);
    expect(prisma.goal.update).not.toHaveBeenCalled();
    expect(prisma.transaction.create).not.toHaveBeenCalled();
  });

  it("skips a goal already at/over target but stamps the run, without writing a transaction", async () => {
    prisma.goal.findMany.mockResolvedValue([
      makeGoal({ currentAmount: 10_000_000n, targetAmount: 10_000_000n }),
    ]);
    const now = new Date("2026-03-15T00:00:00.000Z");

    const debited = await service.runAutoDebit(now);

    expect(debited).toBe(0);
    expect(prisma.goal.update).toHaveBeenCalledWith({
      where: { id: GOAL_ID },
      data: { lastAutoDebitAt: now },
    });
    expect(prisma.transaction.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
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
