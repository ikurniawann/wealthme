/**
 * Rekening v3 — "Ingatkan 7 hari sebelum jatuh tempo". With no scheduler,
 * the reminder is raised lazily when the bell loads; these tests pin when it
 * fires, that it fires once per maturity, and who a private deposit's
 * reminder is addressed to.
 */
import { NotificationsService } from "./notifications.service";

const FAMILY_GROUP_ID = "fg-1";

function isoInDays(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Placement date so that a 3-month non-ARO deposit matures in `days`. */
function placementMaturingIn(days: number): Date {
  const maturity = new Date(`${isoInDays(days)}T00:00:00.000Z`);
  const placement = new Date(maturity);
  placement.setUTCMonth(placement.getUTCMonth() - 3);
  // Clamp so adding 3 months lands back on `maturity` (month-end safe).
  if (placement.getUTCDate() !== maturity.getUTCDate()) {
    placement.setUTCDate(0);
  }
  return placement;
}

function makePrisma(opts: {
  billDue?: boolean;
  deposits: Array<Record<string, unknown>>;
  claimCount?: number;
}) {
  const prisma = {
    member: {
      findFirst: jest.fn().mockResolvedValue({
        user: {
          notificationPrefs: opts.billDue === false ? { billDue: false } : null,
        },
      }),
      findMany: jest
        .fn()
        .mockResolvedValue([{ userId: "user-master" }, { userId: "user-co" }]),
    },
    account: {
      findMany: jest.fn().mockResolvedValue(opts.deposits),
      updateMany: jest.fn().mockResolvedValue({ count: opts.claimCount ?? 1 }),
    },
    notification: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    // Claim + notify run in one interactive transaction.
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
    fn(prisma),
  );
  return prisma;
}

function deposit(overrides: Record<string, unknown> = {}) {
  return {
    id: "dep-1",
    name: "Deposito Mandiri",
    isPrivate: false,
    placementDate: placementMaturingIn(3),
    tenorMonths: 3,
    maturityInstruction: "non_aro",
    maturityReminderSentFor: null,
    ...overrides,
  };
}

function service(prisma: ReturnType<typeof makePrisma>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new NotificationsService(prisma as any);
}

describe("NotificationsService.raiseDepositMaturityReminders", () => {
  it("raises one household reminder for a deposit maturing within 7 days", async () => {
    const prisma = makePrisma({ deposits: [deposit()] });
    await service(prisma).raiseDepositMaturityReminders(FAMILY_GROUP_ID);

    expect(prisma.account.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.notification.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          familyGroupId: FAMILY_GROUP_ID,
          userId: null,
          title: "Deposito segera jatuh tempo",
          body: expect.stringContaining("3 hari lagi"),
        }),
      ],
    });
  });

  it("does nothing when the deposit matures more than 7 days out", async () => {
    const prisma = makePrisma({
      deposits: [deposit({ placementDate: placementMaturingIn(20) })],
    });
    await service(prisma).raiseDepositMaturityReminders(FAMILY_GROUP_ID);
    expect(prisma.account.updateMany).not.toHaveBeenCalled();
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });

  it("fires once per maturity: a lost claim (already sent) creates nothing", async () => {
    const prisma = makePrisma({ deposits: [deposit()], claimCount: 0 });
    await service(prisma).raiseDepositMaturityReminders(FAMILY_GROUP_ID);
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });

  it("addresses a private deposit only to Master and Co-Master", async () => {
    const prisma = makePrisma({ deposits: [deposit({ isPrivate: true })] });
    await service(prisma).raiseDepositMaturityReminders(FAMILY_GROUP_ID);
    expect(prisma.member.findMany).toHaveBeenCalledWith({
      where: {
        familyGroupId: FAMILY_GROUP_ID,
        role: { in: ["owner", "spouse"] },
      },
      select: { userId: true },
    });
    const data = prisma.notification.createMany.mock.calls[0][0].data as Array<{
      userId: string | null;
    }>;
    expect(data.map((d) => d.userId)).toEqual(["user-master", "user-co"]);
  });

  it("respects the family owner's due-date notification preference", async () => {
    const prisma = makePrisma({ billDue: false, deposits: [deposit()] });
    await service(prisma).raiseDepositMaturityReminders(FAMILY_GROUP_ID);
    expect(prisma.account.findMany).not.toHaveBeenCalled();
  });

  it("a failed insert rolls the claim back so the reminder is retried", async () => {
    const prisma = makePrisma({ deposits: [deposit()] });
    prisma.notification.createMany.mockRejectedValue(
      new Error("insert failed"),
    );
    await service(prisma).raiseDepositMaturityReminders(FAMILY_GROUP_ID);
    // The claim ran inside the same $transaction the failure aborted.
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.account.updateMany).toHaveBeenCalledTimes(1);
  });

  it("never breaks the bell: a failing lookup is swallowed", async () => {
    const prisma = makePrisma({ deposits: [] });
    prisma.account.findMany.mockRejectedValue(new Error("db down"));
    await expect(
      service(prisma).findAll(FAMILY_GROUP_ID, "user-x", null),
    ).resolves.toEqual([]);
  });
});
