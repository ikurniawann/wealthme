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
}

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
      update: jest.fn(),
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
