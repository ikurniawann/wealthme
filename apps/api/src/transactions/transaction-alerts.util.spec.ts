import {
  checkBudgetAlert,
  checkCashFlowAlert,
  notifyTransaction,
} from "./transaction-alerts.util";

import type { NotificationSenderPort } from "../notifications/notification-sender.port";

/**
 * EPIC-023 group E retry round 4 (H5) — `checkBudgetAlert` hardcoded
 * `type: "expense"` in its spend aggregate while a liability's OWN
 * principal budget line (`Budget.liabilityId` set) posts its spend as
 * `type: "transfer"` (E1/C5) — so a FIXED line paid at 133% of its limit
 * never raised an 80%/100% notification. These tests exercise the real
 * branch (not a canned return value): the fake `transaction.aggregate`
 * actually filters by the `type` the query asked for, so the test fails
 * without the fix (it would sum the WRONG bucket — always 0 for a
 * liability's transfer-only spend).
 */
function makePrisma(transactionsByType: Record<string, bigint>) {
  return {
    budget: { findFirst: jest.fn() },
    transaction: {
      aggregate: jest.fn(({ where }: { where: { type: string } }) =>
        Promise.resolve({
          _sum: { amount: transactionsByType[where.type] ?? BigInt(0) },
        }),
      ),
    },
    member: {
      findFirst: jest.fn().mockResolvedValue({
        user: {
          email: "owner@example.com",
          name: "Owner",
          notificationPrefs: { budget80: true },
        },
      }),
    },
    category: {
      findUnique: jest.fn().mockResolvedValue({ name: "Cicilan Pokok KPR" }),
    },
    // EPIC-022 C4 — the "already alerted this period" guard queries for a
    // prior matching Notification; `null` (no prior alert) so these
    // pre-existing tests keep exercising the "alert fires" path unchanged.
    notification: {
      create: jest.fn().mockResolvedValue({}),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

function makeNotificationSender(): NotificationSenderPort {
  return { sendEmail: jest.fn().mockResolvedValue(undefined) } as never;
}

describe("checkBudgetAlert spend-type resolution (EPIC-023 group E retry round 4, H5)", () => {
  it("sums TRANSFER-type spend (not expense) for a liability's own budget line", async () => {
    const prisma = makePrisma({ transfer: BigInt(2_000_000) });
    prisma.budget.findFirst.mockResolvedValue({
      id: "budget-liability",
      limitAmount: BigInt(1_500_000),
      liabilityId: "liab-1",
      period: "monthly",
      createdAt: new Date("2020-01-01T00:00:00Z"),
    });
    const sender = makeNotificationSender();

    await checkBudgetAlert(prisma, sender, "fg-1", "cat-liability-own");

    expect(prisma.transaction.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: "transfer" }),
      }),
    );
    // 2,000,000 / 1,500,000 = 133% — over budget, so the alert must fire.
    expect(prisma.notification.create).toHaveBeenCalled();
    expect(sender.sendEmail).toHaveBeenCalled();
  });

  it("still sums EXPENSE-type spend for an ordinary (non-liability) budget line", async () => {
    const prisma = makePrisma({ expense: BigInt(900_000) });
    prisma.budget.findFirst.mockResolvedValue({
      id: "budget-ordinary",
      limitAmount: BigInt(1_000_000),
      liabilityId: null,
      period: "monthly",
      createdAt: new Date("2020-01-01T00:00:00Z"),
    });
    const sender = makeNotificationSender();

    await checkBudgetAlert(prisma, sender, "fg-1", "cat-ordinary");

    expect(prisma.transaction.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: "expense" }),
      }),
    );
    // 900,000 / 1,000,000 = 90% — over 80%, alert fires.
    expect(prisma.notification.create).toHaveBeenCalled();
  });

  it("never fires when the liability's own line is queried as expense-type spend that doesn't exist (the regression this fix closes)", async () => {
    // Only TRANSFER-type spend actually exists for this liability's line —
    // an `expense`-type query (the pre-fix bug) would always sum 0.
    const prisma = makePrisma({ transfer: BigInt(2_000_000) });
    prisma.budget.findFirst.mockResolvedValue({
      id: "budget-liability",
      limitAmount: BigInt(1_500_000),
      liabilityId: "liab-1",
      period: "monthly",
      createdAt: new Date("2020-01-01T00:00:00Z"),
    });
    const sender = makeNotificationSender();

    await checkBudgetAlert(prisma, sender, "fg-1", "cat-liability-own");

    // If this fails, the fix regressed back to summing `expense` (always 0
    // for this category) and the alert would never have fired.
    expect(prisma.notification.create).toHaveBeenCalled();
  });
});

describe("checkBudgetAlert already-alerted guard (EPIC-022 C4)", () => {
  it("does not re-fire when a matching alert already exists for the current period", async () => {
    const prisma = makePrisma({ expense: BigInt(900_000) });
    prisma.budget.findFirst.mockResolvedValue({
      id: "budget-ordinary",
      limitAmount: BigInt(1_000_000),
      liabilityId: null,
      period: "monthly",
      createdAt: new Date("2020-01-01T00:00:00Z"),
    });
    // A prior 80%/100% alert for this exact category already exists within
    // the current period — this is the state C4 exists to detect.
    prisma.notification.findFirst.mockResolvedValue({ id: "notif-1" });
    const sender = makeNotificationSender();

    await checkBudgetAlert(prisma, sender, "fg-1", "cat-ordinary");

    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(sender.sendEmail).not.toHaveBeenCalled();
  });

  it("still fires when usage is over 80% and no prior alert exists this period", async () => {
    const prisma = makePrisma({ expense: BigInt(900_000) });
    prisma.budget.findFirst.mockResolvedValue({
      id: "budget-ordinary",
      limitAmount: BigInt(1_000_000),
      liabilityId: null,
      period: "monthly",
      createdAt: new Date("2020-01-01T00:00:00Z"),
    });
    prisma.notification.findFirst.mockResolvedValue(null);
    const sender = makeNotificationSender();

    await checkBudgetAlert(prisma, sender, "fg-1", "cat-ordinary");

    expect(prisma.notification.create).toHaveBeenCalled();
    expect(sender.sendEmail).toHaveBeenCalled();
  });
});

/**
 * Batch 2 (#5) — `checkCashFlowAlert`'s `usagePct = (expense * 100n) /
 * income` is unclamped: a low-income/high-expense month (e.g. Rp10.000
 * income vs Rp1.450.000 expense) legitimately produces `14500`, which then
 * flows straight into the notification title/body ("...sudah 14500% dari
 * total pemasukan..."). The income/expense division itself is correct —
 * only the DISPLAY needs a sanity cap.
 */
function makeCashFlowPrisma(income: bigint, expense: bigint) {
  return {
    transaction: {
      aggregate: jest.fn(({ where }: { where: { type: string } }) =>
        Promise.resolve({
          _sum: {
            amount: where.type === "income" ? income : expense,
          },
        }),
      ),
    },
    notification: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("checkCashFlowAlert usage-percentage cap (batch-2 #5)", () => {
  it("caps an implausible ratio (low income, high expense) instead of interpolating a raw 14500% into the alert", async () => {
    const prisma = makeCashFlowPrisma(BigInt(10_000), BigInt(1_450_000));

    await checkCashFlowAlert(prisma, "fg-1");

    expect(prisma.notification.create).toHaveBeenCalled();
    const { title, body } = prisma.notification.create.mock.calls[0]![0]
      .data as { title: string; body: string };
    expect(title).not.toContain("14500%");
    expect(body).not.toContain("14500%");
  });

  it("still reports the real, plausible percentage when it isn't implausible", async () => {
    const prisma = makeCashFlowPrisma(BigInt(1_000_000), BigInt(900_000));

    await checkCashFlowAlert(prisma, "fg-1");

    expect(prisma.notification.create).toHaveBeenCalled();
    const { body } = prisma.notification.create.mock.calls[0]![0].data as {
      body: string;
    };
    expect(body).toContain("90%");
  });
});

describe("notifyTransaction — personal copy for row-scoped recorder", () => {
  function prismaMock() {
    return {
      member: {
        findFirst: jest.fn().mockResolvedValue({
          user: { notificationPrefs: null },
        }),
      },
      notification: { create: jest.fn().mockResolvedValue({}) },
    };
  }
  const tx = { category: { name: "Makan" }, account: { name: "Kas" } };

  it("adds a notification addressed to the recorder", async () => {
    const prisma = prismaMock();
    await notifyTransaction(
      prisma as never,
      "fg1",
      "expense",
      BigInt(50_000),
      tx,
      undefined,
      "child-user",
    );
    expect(prisma.notification.create).toHaveBeenCalledTimes(2);
    expect(prisma.notification.create.mock.calls[1][0].data.userId).toBe(
      "child-user",
    );
  });

  it("creates only the household row for other roles", async () => {
    const prisma = prismaMock();
    await notifyTransaction(
      prisma as never,
      "fg1",
      "expense",
      BigInt(50_000),
      tx,
    );
    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    expect(
      prisma.notification.create.mock.calls[0][0].data.userId,
    ).toBeUndefined();
  });

  it("writes the amount with 'Rp ' + dot grouping, never 'Rp5000000'", async () => {
    const prisma = prismaMock();
    await notifyTransaction(
      prisma as never,
      "fg1",
      "expense",
      BigInt(5_000_000),
      tx,
    );
    expect(prisma.notification.create.mock.calls[0][0].data.body).toBe(
      "Rp 5.000.000 · Makan",
    );
  });

  it("does not HTML-escape the category name in the in-app body", async () => {
    const prisma = prismaMock();
    await notifyTransaction(prisma as never, "fg1", "expense", BigInt(10_000), {
      category: { name: "Tabungan & Investasi" },
      account: null,
    });
    expect(prisma.notification.create.mock.calls[0][0].data.body).toBe(
      "Rp 10.000 · Tabungan & Investasi",
    );
  });
});
