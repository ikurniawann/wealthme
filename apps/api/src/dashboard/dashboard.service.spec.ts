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
  // EPIC-023 group E retry (CRITICAL 1) — nullable, mirroring
  // Transaction.accountId (a credit-card purchase has accountId: null).
  accountId: string | null;
  categoryId: string | null;
  amount: bigint;
  type: "income" | "expense" | "transfer";
  description: string | null;
  occurredAt: Date;
  createdAt: Date;
  // EPIC-023 Task C — who recorded this row. Optional so every pre-existing
  // fixture stays valid.
  createdByUserId?: string | null;
  // restrictedTransactionWhere's incoming-transfer leg. Optional so every
  // pre-existing fixture stays valid.
  toAccountId?: string | null;
}

interface TxWhereClause {
  accountId?: null;
  account?: { isPrivate?: boolean; ownerUserId?: string };
  categoryId?: null;
  category?: { isPrivate?: boolean };
  createdByUserId?: string;
  toAccount?: { ownerUserId?: string };
  OR?: TxWhereClause[];
  AND?: TxWhereClause[];
  familyGroupId?: string;
  occurredAt?: unknown;
}

interface FakeInvestment {
  quantity: Decimal;
  costBasisPerUnit: Decimal;
  // Empty array simulates "no price row yet" (cost-basis fallback).
  prices: { price: Decimal }[];
}

interface FakeSnapshot {
  capturedAt: Date;
  date: Date;
  totalCash: bigint;
  totalInvestments: bigint;
  totalAssets: bigint;
  totalLiabilities: bigint;
  netWorth: bigint;
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

  function evalClause(clause: TxWhereClause, t: FakeTransaction): boolean {
    return Object.entries(clause).every(([key, value]) => {
      switch (key) {
        case "AND":
          return (value as TxWhereClause[]).every((c) => evalClause(c, t));
        case "OR":
          return (value as TxWhereClause[]).some((c) => evalClause(c, t));
        case "accountId":
          return t.accountId === null;
        case "account": {
          const acc = t.accountId ? accountById.get(t.accountId) : undefined;
          const cond = value as { isPrivate?: boolean; ownerUserId?: string };
          if (!acc) return false;
          if (cond.isPrivate !== undefined && acc.isPrivate !== cond.isPrivate)
            return false;
          if (
            cond.ownerUserId !== undefined &&
            acc.ownerUserId !== cond.ownerUserId
          )
            return false;
          return true;
        }
        case "categoryId":
          return t.categoryId === null;
        case "category": {
          const cat = t.categoryId ? categoryById.get(t.categoryId) : undefined;
          const cond = value as { isPrivate?: boolean };
          return !!cat && cat.isPrivate === cond.isPrivate;
        }
        case "createdByUserId":
          return t.createdByUserId === value;
        case "toAccount": {
          const acc = t.toAccountId
            ? accountById.get(t.toAccountId)
            : undefined;
          const cond = value as { ownerUserId?: string };
          return !!acc && acc.ownerUserId === cond.ownerUserId;
        }
        case "familyGroupId":
        case "occurredAt":
          return true;
        default:
          throw new Error(`evalClause: unhandled key "${key}"`);
      }
    });
  }

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
      findMany: jest.fn((): Promise<FakeSnapshot[]> => Promise.resolve([])),
    },
    transaction: {
      // EPIC-023 Task C — the service now combines its privacy fragment and
      // its row-scoping fragment (restrictedTransactionWhere) via a shared
      // `AND` array rather than flat top-level keys (so neither fragment's
      // `OR` can clobber the other's — see transactions.service.ts#buildWhere).
      // EPIC-023 group E retry (CRITICAL 1) — `transactionPrivacyWhere`
      // itself is now `{ AND: [...] }` (nested AND-of-OR), so this fake uses
      // a generic recursive evaluator (not hardcoded to one fragment shape)
      // to stay correct against BOTH the privacy and row-scoping fragments,
      // and to admit an accountId: null row (credit-card purchase).
      findMany: jest.fn(({ where }: { where: TxWhereClause }) => {
        const rows = transactions.filter((t) => evalClause(where, t));
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
            account: t.accountId
              ? { name: accountById.get(t.accountId)?.name ?? "" }
              : null,
          })),
        );
      }),
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

function snapshotRow(day: string, netWorth: bigint): FakeSnapshot {
  return {
    capturedAt: new Date(`${day}T02:00:00.000Z`),
    date: new Date(`${day}T00:00:00.000Z`),
    totalCash: netWorth,
    totalInvestments: 0n,
    totalAssets: 0n,
    totalLiabilities: 0n,
    netWorth,
  };
}

describe("DashboardService net-worth history — live today point", () => {
  const NOW = new Date("2026-09-25T08:00:00.000Z");
  let service: DashboardService;
  let prisma: ReturnType<typeof makeFakePrisma>;

  beforeEach(async () => {
    const { accounts } = buildFixtures();
    prisma = makeFakePrisma(accounts, [], []);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(DashboardService);
  });

  it("a family with no snapshot yet gets one live point from the family-wide rollup", async () => {
    const history = await service.getNetWorthHistory(
      FAMILY_GROUP_ID,
      "1m",
      NOW,
    );

    // 100 visible + 500 private: snapshots are family-wide, so private is included.
    expect(history.points).toEqual([
      {
        capturedAt: NOW.toISOString(),
        totalCash: "600",
        totalInvestments: "0",
        totalAssets: "0",
        totalLiabilities: "0",
        netWorth: "600",
      },
    ]);
  });

  it("appends the live point after persisted snapshots when the newest is older than today", async () => {
    prisma.netWorthSnapshot.findMany.mockResolvedValueOnce([
      snapshotRow("2026-09-23", 400n),
      snapshotRow("2026-09-24", 500n),
    ]);

    const history = await service.getNetWorthHistory(
      FAMILY_GROUP_ID,
      "1m",
      NOW,
    );

    expect(history.points.map((p) => [p.capturedAt, p.netWorth])).toEqual([
      ["2026-09-23T02:00:00.000Z", "400"],
      ["2026-09-24T02:00:00.000Z", "500"],
      [NOW.toISOString(), "600"],
    ]);
  });

  it("does not duplicate today when today's snapshot already exists", async () => {
    prisma.netWorthSnapshot.findMany.mockResolvedValueOnce([
      snapshotRow("2026-09-24", 500n),
      snapshotRow("2026-09-25", 550n),
    ]);

    const history = await service.getNetWorthHistory(
      FAMILY_GROUP_ID,
      "1m",
      NOW,
    );

    expect(history.points.map((p) => p.netWorth)).toEqual(["500", "550"]);
    expect(prisma.account.findMany).not.toHaveBeenCalled();
  });

  it("filters persisted snapshots by the range measured from `now`", async () => {
    await service.getNetWorthHistory(FAMILY_GROUP_ID, "1m", NOW);

    const since = new Date(NOW);
    since.setMonth(since.getMonth() - 1);
    expect(prisma.netWorthSnapshot.findMany).toHaveBeenCalledWith({
      where: { familyGroupId: FAMILY_GROUP_ID, capturedAt: { gte: since } },
      orderBy: { capturedAt: "asc" },
    });
  });
});
