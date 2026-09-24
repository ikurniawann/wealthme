/**
 * EPIC-023 Task C retry (HIGH six-reviewer finding) — `GET /users/me/gdpr/
 * export` had no per-role scoping at all: it fetched every account and up
 * to 500 transactions across every family group the caller belongs to,
 * regardless of role. A `dependant`/`operational` clicking "download my
 * data" got the entire household ledger. These tests prove the export is
 * now scoped PER membership — including the case where the same user holds
 * a row-scoped role in one family group and an unrestricted role in
 * another, which a single blanket `familyGroupId: { in: [...] }` query
 * cannot express.
 *
 * A second retry pass closed a leak the first left open: `goals` and
 * `notifications` still queried the UNFILTERED per-user family group list,
 * even though CASL grants `dependant`/`operational` nothing at all on Goal
 * or Notification. Notification bodies are the worst part — they embed
 * literal ledger amounts (transactions.service.ts's checkBudgetAlert/
 * checkCashFlowAlert/notifyTransaction) — so the household ledger leaked
 * through notification *text* even though transactions themselves were
 * already correctly hidden.
 */
import { Test, type TestingModule } from "@nestjs/testing";
import { Role } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";

import { GdprService } from "./gdpr.service";

const USER_ID = "user-child";

function makePrisma() {
  return {
    user: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        id: USER_ID,
        email: "child@example.com",
        name: "Anak",
        avatarInitials: "A",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
    },
    member: { findMany: jest.fn() },
    account: { findMany: jest.fn() },
    transaction: { findMany: jest.fn() },
    goal: { findMany: jest.fn().mockResolvedValue([]) },
    notification: { findMany: jest.fn().mockResolvedValue([]) },
  };
}

describe("GdprService.exportUserData", () => {
  let service: GdprService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    prisma = makePrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [GdprService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(GdprService);
  });

  it("PERMISSION/DENIAL — a dependant membership in one family group stays scoped to their own account/transactions, while an owner membership in ANOTHER family group for the SAME user stays fully unrestricted", async () => {
    prisma.member.findMany.mockResolvedValue([
      {
        familyGroupId: "fg-child-household",
        role: Role.dependant,
        createdAt: new Date(),
      },
      {
        familyGroupId: "fg-own-household",
        role: Role.owner,
        createdAt: new Date(),
      },
    ]);

    prisma.account.findMany.mockImplementation(
      ({
        where,
      }: {
        where: { familyGroupId: string; ownerUserId?: string };
      }) => {
        if (where.familyGroupId === "fg-child-household") {
          // DENIAL half — restrictedAccountWhere must have added the
          // ownership filter for the row-scoped membership.
          expect(where.ownerUserId).toBe(USER_ID);
          return Promise.resolve([
            {
              id: "acc-child-own",
              name: "Tabungan Anak",
              type: "bank",
              balance: 10_000n,
              currency: "IDR",
              createdAt: new Date(),
            },
          ]);
        }
        // PERMISSION half — an owner membership must NOT be filtered by
        // ownerUserId; the household's shared accounts are exported too.
        expect(where.ownerUserId).toBeUndefined();
        return Promise.resolve([
          {
            id: "acc-owner-shared",
            name: "Rekening Bersama",
            type: "bank",
            balance: 5_000_000n,
            currency: "IDR",
            createdAt: new Date(),
          },
        ]);
      },
    );

    prisma.transaction.findMany.mockImplementation(
      ({ where }: { where: { familyGroupId: string; OR?: unknown[] } }) => {
        if (where.familyGroupId === "fg-child-household") {
          expect(where.OR).toBeDefined();
          return Promise.resolve([
            {
              id: "tx-child-own",
              description: "Jajan",
              amount: 20_000n,
              type: "expense",
              occurredAt: new Date("2026-06-01T00:00:00.000Z"),
            },
          ]);
        }
        expect(where.OR).toBeUndefined();
        return Promise.resolve([
          {
            id: "tx-owner-household",
            description: "Belanja bulanan",
            amount: 2_000_000n,
            type: "expense",
            occurredAt: new Date("2026-06-02T00:00:00.000Z"),
          },
        ]);
      },
    );

    const result = await service.exportUserData(USER_ID);

    expect(result.accounts.map((a) => a.id).sort()).toEqual(
      ["acc-child-own", "acc-owner-shared"].sort(),
    );
    // The row-scoped membership's account never leaks the OTHER family
    // group's shared account, and vice versa — proven by each mock's own
    // assertion above; here we just confirm both survived the merge.
    expect(result.transactions.map((t) => t.id).sort()).toEqual(
      ["tx-child-own", "tx-owner-household"].sort(),
    );
    expect(result.accounts.find((a) => a.id === "acc-child-own")?.balance).toBe(
      "10000",
    );
  });

  it("PERMISSION/DENIAL — goals and notifications are scoped to non-row-scoped memberships: an owner membership in group A keeps its goals/notifications, a dependant membership in group B for the SAME user gets none of group B's", async () => {
    prisma.member.findMany.mockResolvedValue([
      {
        familyGroupId: "fg-owner-household",
        role: Role.owner,
        createdAt: new Date(),
      },
      {
        familyGroupId: "fg-child-household",
        role: Role.dependant,
        createdAt: new Date(),
      },
    ]);
    prisma.account.findMany.mockResolvedValue([]);
    prisma.transaction.findMany.mockResolvedValue([]);

    prisma.goal.findMany.mockImplementation(
      ({ where }: { where: { familyGroupId: { in: string[] } } }) => {
        // DENIAL half — the row-scoped dependant membership's family group
        // must never appear in the `in` list CASL grants it no Goal access.
        expect(where.familyGroupId.in).toEqual(["fg-owner-household"]);
        return Promise.resolve([
          {
            id: "goal-owner",
            name: "Dana Darurat",
            targetAmount: 50_000_000n,
            currentAmount: 12_000_000n,
            status: "active",
          },
        ]);
      },
    );

    prisma.notification.findMany.mockImplementation(
      ({ where }: { where: { familyGroupId: { in: string[] } } }) => {
        // DENIAL half — notification bodies embed literal ledger amounts
        // (transactions.service.ts), so this list must exclude the
        // dependant's group even though it is row-scoped-readable elsewhere.
        expect(where.familyGroupId.in).toEqual(["fg-owner-household"]);
        return Promise.resolve([
          {
            id: "notif-owner",
            title: "Anggaran",
            body: "Rp 2.000.000 · Belanja",
            createdAt: new Date("2026-06-01T00:00:00.000Z"),
            // Per-member read receipts (NotificationRead) — none for this user.
            reads: [],
          },
        ]);
      },
    );

    const result = await service.exportUserData(USER_ID);

    // PERMISSION half — the owner membership's goal/notification survive.
    expect(result.goals.map((g) => g.id)).toEqual(["goal-owner"]);
    expect(result.notifications.map((n) => n.id)).toEqual(["notif-owner"]);
    expect(result.notifications[0]).toMatchObject({ isRead: false });
    expect(result.notifications[0]).not.toHaveProperty("reads");
  });

  it("caps the merged transaction export at 500, keeping the most recent across ALL family groups combined (not 500 per group)", async () => {
    prisma.member.findMany.mockResolvedValue([
      { familyGroupId: "fg-a", role: Role.owner, createdAt: new Date() },
      { familyGroupId: "fg-b", role: Role.owner, createdAt: new Date() },
    ]);
    prisma.account.findMany.mockResolvedValue([]);

    function makeRows(prefix: string, count: number, startDay: number) {
      return Array.from({ length: count }, (_, i) => ({
        id: `${prefix}-${i}`,
        description: null,
        amount: 1n,
        type: "expense" as const,
        occurredAt: new Date(2026, 0, startDay - i),
      }));
    }

    // 300 rows per group (each individually under this service's own
    // per-query cap), 600 combined — must be capped to 500 after merging.
    prisma.transaction.findMany.mockImplementation(
      ({ where }: { where: { familyGroupId: string } }) => {
        if (where.familyGroupId === "fg-a") {
          return Promise.resolve(makeRows("a", 300, 300));
        }
        return Promise.resolve(makeRows("b", 300, 300));
      },
    );

    const result = await service.exportUserData(USER_ID);

    expect(result.transactions).toHaveLength(500);
    // Sorted desc by occurredAt across the merge, not grouped by family
    // group — the single most recent row from either group comes first.
    const dates = result.transactions.map((t) =>
      new Date(t.occurredAt).getTime(),
    );
    expect(dates).toEqual([...dates].sort((a, b) => b - a));
  });
});
