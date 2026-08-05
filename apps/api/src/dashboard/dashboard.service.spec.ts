import { Test, type TestingModule } from "@nestjs/testing";
import { Role } from "@prisma/client";
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
  // EPIC-023 Task C — per-member ownership, needed by the row-scoped
  // viewer tests below. Optional so every pre-existing fixture stays valid.
  ownerUserId?: string | null;
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
  // EPIC-023 Task C — who recorded this row. Optional so every pre-existing
  // fixture stays valid.
  createdByUserId?: string | null;
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
  assets: { currentValue: bigint }[] = [],
) {
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  return {
    account: {
      findMany: jest.fn(
        ({
          where,
        }: {
          where: { isPrivate?: boolean; ownerUserId?: string };
        }) => {
          let rows =
            where.isPrivate === false
              ? accounts.filter((a) => !a.isPrivate)
              : accounts;
          // EPIC-023 Task C — restrictedAccountWhere's ownerUserId filter.
          if (where.ownerUserId !== undefined) {
            rows = rows.filter((a) => a.ownerUserId === where.ownerUserId);
          }
          return Promise.resolve(rows);
        },
      ),
    },
    // EPIC-023 D19/US-ASSET-4 — the service selects only { currentValue: true
    // }, never valueChangeRatePct or an acquisition/created date, so the fake
    // deliberately exposes nothing else an accidental regression could read.
    asset: { findMany: jest.fn(() => Promise.resolve(assets)) },
    investment: { findMany: jest.fn(() => Promise.resolve(investments)) },
    liability: { findMany: jest.fn(() => Promise.resolve([])) },
    netWorthSnapshot: {
      upsert: jest.fn(({ create }: { create: Record<string, unknown> }) =>
        Promise.resolve(create),
      ),
    },
    transaction: {
      // EPIC-023 Task C — the service now combines its privacy fragment and
      // its row-scoping fragment (restrictedTransactionWhere) via a shared
      // `AND` array rather than flat top-level keys (so neither fragment's
      // `OR` can clobber the other's — see transactions.service.ts#buildWhere).
      // This fake reads both privacy AND row-scoping out of `where.AND`.
      findMany: jest.fn(
        ({
          where,
        }: {
          where: {
            AND?: {
              account?: { isPrivate?: boolean; ownerUserId?: string };
              createdByUserId?: string;
              OR?: { account?: { ownerUserId?: string } }[];
            }[];
          };
        }) => {
          let rows = transactions;
          const privacyFragment = where.AND?.[0];
          const scopeFragment = where.AND?.[1];

          if (privacyFragment?.account?.isPrivate === false) {
            rows = rows.filter((t) => !accountById.get(t.accountId)?.isPrivate);
          }
          if (privacyFragment?.OR) {
            rows = rows.filter((t) => {
              if (t.categoryId === null) return true;
              return !categoryById.get(t.categoryId)?.isPrivate;
            });
          }
          if (scopeFragment?.OR) {
            rows = rows.filter((t) =>
              scopeFragment.OR?.some(
                (clause) =>
                  clause.account?.ownerUserId ===
                    accountById.get(t.accountId)?.ownerUserId ||
                  (clause as { createdByUserId?: string }).createdByUserId ===
                    t.createdByUserId,
              ),
            );
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

// EPIC-023 Task C (D5) — a row-scoped viewer's dashboard rollup must reflect
// only their own account, never the family-shared account or its assets/
// investments/liabilities (neither role holds "read" on those subjects).
describe("DashboardService row-scoped viewer (dependant/operational)", () => {
  const DRIVER_USER_ID = "user-driver";

  function buildRestrictedFixtures() {
    const now = new Date();
    const accounts: FakeAccount[] = [
      {
        id: "acc-driver",
        balance: 250_000n,
        type: "cash",
        name: "Kas Sopir",
        isPrivate: false,
        ownerUserId: DRIVER_USER_ID,
      },
      {
        id: "acc-shared",
        balance: 10_000_000n,
        type: "bank",
        name: "Rekening Keluarga",
        isPrivate: false,
        ownerUserId: null,
      },
    ];
    const transactions: FakeTransaction[] = [
      {
        id: "tx-driver",
        accountId: "acc-driver",
        categoryId: null,
        amount: 50_000n,
        type: "expense",
        description: "Bensin",
        occurredAt: now,
        createdAt: now,
        createdByUserId: DRIVER_USER_ID,
      },
      {
        id: "tx-family",
        accountId: "acc-shared",
        categoryId: null,
        amount: 1_000_000n,
        type: "expense",
        description: "Belanja bulanan",
        occurredAt: now,
        createdAt: now,
        createdByUserId: "user-head",
      },
    ];
    return { accounts, transactions };
  }

  it("getSummary/getNetWorth restrict an operational viewer to their own account — the family-shared account is absent", async () => {
    const { accounts, transactions } = buildRestrictedFixtures();
    const prisma = makeFakePrisma(accounts, [], transactions);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    const service = module.get<DashboardService>(DashboardService);

    const netWorth = await service.getNetWorth(
      FAMILY_GROUP_ID,
      true,
      Role.operational,
      DRIVER_USER_ID,
    );
    // Only the driver's own 250,000 counts — the 10,000,000 shared account
    // never appears.
    expect(netWorth.accountsTotal).toBe("250000");
    expect(netWorth.netWorth).toBe("250000");

    const summary = await service.getSummary(
      FAMILY_GROUP_ID,
      true,
      Role.operational,
      DRIVER_USER_ID,
    );
    expect(summary.netWorth).toBe(250_000);
    expect(summary.recentTransactions.map((t) => t.id)).toEqual(["tx-driver"]);
    expect(summary.recentTransactions.map((t) => t.id)).not.toContain(
      "tx-family",
    );
  });

  it("collapses assets/investments/liabilities to 0 for a row-scoped viewer, without querying them", async () => {
    const investments: FakeInvestment[] = [
      {
        quantity: new Decimal("10"),
        costBasisPerUnit: new Decimal("9500"),
        prices: [{ price: new Decimal("10000") }],
      },
    ];
    const { accounts } = buildRestrictedFixtures();
    const prisma = makeFakePrisma(accounts, [], [], investments);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    const service = module.get<DashboardService>(DashboardService);

    const netWorth = await service.getNetWorth(
      FAMILY_GROUP_ID,
      true,
      Role.dependant,
      DRIVER_USER_ID,
    );

    expect(netWorth.investmentsTotal).toBe("0");
    expect(netWorth.assetsTotal).toBe("0");
    expect(netWorth.liabilitiesTotal).toBe("0");
    expect(prisma.investment.findMany).not.toHaveBeenCalled();
    expect(prisma.asset.findMany).not.toHaveBeenCalled();
    expect(prisma.liability.findMany).not.toHaveBeenCalled();
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

// EPIC-023 D19/US-ASSET-4 — the acceptance criterion this task exists to
// prove: net worth must use Asset.currentValue (the recorded, authoritative
// figure), never the compute-on-read projection. The fixture below sets a
// large positive rate and a decade-old acquisition date so that, if this
// call site ever regressed to reading the projection, the asserted total
// would be far above the value below and this test would fail loudly.
describe("DashboardService net worth — recorded value is authoritative (EPIC-023 D19)", () => {
  it("getNetWorth sums Asset.currentValue, not the inflated compute-on-read projection", async () => {
    const recordedValue = 1_000_000_000n; // Rp 1,000,000,000 recorded
    const assets = [
      {
        currentValue: recordedValue,
        // Present on the fixture to prove the service never reads them —
        // if it did, a +80%/yr rate over 10 years would inflate the total
        // far beyond recordedValue.
        valueChangeRatePct: new Decimal("80"),
        acquisitionDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 365 * 10),
      },
    ];
    const prisma = makeFakePrisma([], [], [], [], assets);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    const service = module.get<DashboardService>(DashboardService);

    const netWorth = await service.getNetWorth(FAMILY_GROUP_ID, true);

    expect(netWorth.assetsTotal).toBe(recordedValue.toString());
    // Pins the call site itself: it must only ever ask Prisma for
    // currentValue, so a future edit can't silently start reading the rate
    // or an acquisition/created date back into this computation.
    expect(prisma.asset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ select: { currentValue: true } }),
    );
  });
});
