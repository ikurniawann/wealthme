import { Test, type TestingModule } from "@nestjs/testing";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";

import { BudgetsService } from "./budgets.service";

/** Mirrors liabilities.service.spec.ts's helper for constructing Prisma errors. */
function serializationFailure() {
  return new Prisma.PrismaClientKnownRequestError(
    "Transaction failed due to a write conflict or a deadlock. Please retry your transaction",
    { code: "P2034", clientVersion: "test" },
  );
}

const FAMILY_GROUP_ID = "fg-1";
const PUBLIC_BUDGET_ID = "budget-public";
const PRIVATE_BUDGET_ID = "budget-private";
const PUBLIC_CATEGORY_ID = "cat-public";
const PRIVATE_CATEGORY_ID = "cat-private";
// EPIC-023 group E retry round 4 (C5) — a liability's own FIXED principal
// budget line: `liabilityId` set, spend posted as `type: "transfer"`.
const LIABILITY_BUDGET_ID = "budget-liability";
const LIABILITY_CATEGORY_ID = "cat-liability-own";
const LIABILITY_ID = "liab-1";

const NOW = new Date("2026-06-15T12:00:00+07:00");
// Well before the current monthly/weekly period start, so `budgetSpendWindow`
// resolves to the plain period start (no C3 clamp) unless a test overrides it.
const OLD_CREATED_AT = new Date("2020-01-01T00:00:00Z");

interface FakeBudgetRow {
  id: string;
  categoryId: string;
  period: string;
  limitAmount: bigint;
  createdAt: Date;
  liabilityId?: string | null;
  // C2 (group E retry round 4) — production ALWAYS writes this column
  // (`syncPrincipalBudgetLine`/`syncPremiumBudgetLine` both set
  // `budgetType: "FIXED"` on the Budget row itself), never only the shared
  // `category.coaAccount.budgetType` the pre-fix `toDto` read exclusively.
  budgetType?: "FIXED" | "VARIABLE" | "REIMBURSEMENT" | null;
  category: {
    name: string;
    icon: string | null;
    isPrivate: boolean;
    coaAccount: { budgetType: null };
  };
}

interface FakeCategoryRow {
  id: string;
  familyGroupId: string;
  isPrivate: boolean;
  name: string;
  icon: string | null;
}

function buildBudgetRows(): FakeBudgetRow[] {
  return [
    {
      id: PUBLIC_BUDGET_ID,
      categoryId: PUBLIC_CATEGORY_ID,
      period: "monthly",
      limitAmount: 1_000_000n,
      createdAt: OLD_CREATED_AT,
      category: {
        name: "Belanja",
        icon: "🛒",
        isPrivate: false,
        coaAccount: { budgetType: null },
      },
    },
    {
      id: PRIVATE_BUDGET_ID,
      categoryId: PRIVATE_CATEGORY_ID,
      period: "monthly",
      limitAmount: 2_000_000n,
      createdAt: OLD_CREATED_AT,
      category: {
        name: "Personal",
        icon: "🔒",
        isPrivate: true,
        coaAccount: { budgetType: null },
      },
    },
  ];
}

function buildCategoryRows(): FakeCategoryRow[] {
  return [
    {
      id: PUBLIC_CATEGORY_ID,
      familyGroupId: FAMILY_GROUP_ID,
      isPrivate: false,
      name: "Belanja",
      icon: "🛒",
    },
    {
      id: PRIVATE_CATEGORY_ID,
      familyGroupId: FAMILY_GROUP_ID,
      isPrivate: true,
      name: "Personal",
      icon: "🔒",
    },
  ];
}

/**
 * A minimal in-memory Prisma stand-in that honors the nested
 * `category: { isPrivate: false }` filter the service builds via
 * `categoryPrivacyWhere`, so these tests exercise real filtering behavior
 * (same approach as categories.service.spec.ts's privacy-enforcement suite).
 */
function makePrisma() {
  const budgetRows = buildBudgetRows();
  const categoryRows = buildCategoryRows();
  const groupByCalls: unknown[] = [];

  const findBudget = (id: string, familyGroupId: string) =>
    budgetRows.find(
      (r) => r.id === id && r.categoryId && familyGroupId === FAMILY_GROUP_ID,
    ) ?? null;

  const prisma = {
    budget: {
      findMany: jest.fn(
        ({ where }: { where: { category?: { isPrivate?: boolean } } }) => {
          const excludePrivate = where.category?.isPrivate === false;
          const filtered = excludePrivate
            ? budgetRows.filter((r) => !r.category.isPrivate)
            : budgetRows;
          return Promise.resolve(filtered);
        },
      ),
      findFirst: jest.fn(() => Promise.resolve(null)),
      findUnique: jest.fn(
        ({ where }: { where: { id: string; familyGroupId: string } }) => {
          const row = findBudget(where.id, where.familyGroupId);
          if (!row) return Promise.resolve(null);
          return Promise.resolve({
            id: row.id,
            familyGroupId: where.familyGroupId,
            category: { isPrivate: row.category.isPrivate },
          });
        },
      ),
      update: jest.fn(
        ({
          where,
          data,
        }: {
          where: { id: string; familyGroupId: string };
          data: { limitAmount?: bigint; period?: string };
        }) => {
          const row = findBudget(where.id, where.familyGroupId);
          if (!row) throw new Error("budget not found in fake prisma");
          return Promise.resolve({
            ...row,
            limitAmount: data.limitAmount ?? row.limitAmount,
            period: data.period ?? row.period,
          });
        },
      ),
      delete: jest.fn(() => Promise.resolve({})),
      create: jest.fn(
        ({
          data,
        }: {
          data: { categoryId: string; period: string; limitAmount: bigint };
        }) => {
          const category = categoryRows.find((c) => c.id === data.categoryId);
          return Promise.resolve({
            id: "budget-new",
            categoryId: data.categoryId,
            period: data.period,
            limitAmount: data.limitAmount,
            createdAt: new Date(),
            liabilityId: null,
            budgetType: null,
            category: {
              name: category?.name ?? "Unknown",
              icon: category?.icon ?? null,
              coaAccount: { budgetType: null },
            },
          });
        },
      ),
    },
    category: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) => {
        const row = categoryRows.find((c) => c.id === where.id) ?? null;
        if (!row) return Promise.resolve(null);
        return Promise.resolve({
          familyGroupId: row.familyGroupId,
          isPrivate: row.isPrivate,
        });
      }),
    },
    transaction: {
      groupBy: jest.fn((args: unknown) => {
        groupByCalls.push(args);
        return Promise.resolve([]);
      }),
    },
    // C5 TOCTOU fix — `create()` now runs its pre-check + insert through
    // `runSerializableWithRetry`, which calls `$transaction(fn, { isolationLevel })`.
    // `mockImplementation` is wired below (mirrors liabilities.service.spec.ts /
    // split-bills.service.spec.ts): the callback runs against the SAME mocked
    // client so `budget.findFirst`/`budget.create` assertions above still
    // work unchanged.
    $transaction: jest.fn(),
    __groupByCalls: groupByCalls,
  };
  prisma.$transaction.mockImplementation(
    (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma),
  );
  return prisma;
}

describe("BudgetsService.findAll privacy enforcement (EPIC-022 A6)", () => {
  let service: BudgetsService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    prisma = makePrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [BudgetsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(BudgetsService);
  });

  it("excludes a private category's budget for a member viewer (canSeePrivate=false)", async () => {
    const result = await service.findAll(FAMILY_GROUP_ID, false);
    expect(result.map((b) => b.id)).toEqual([PUBLIC_BUDGET_ID]);
    expect(result.some((b) => b.categoryName === "Personal")).toBe(false);
  });

  it("includes every budget for an owner/admin_staff viewer (canSeePrivate=true)", async () => {
    const result = await service.findAll(FAMILY_GROUP_ID, true);
    expect(result.map((b) => b.id).sort()).toEqual(
      [PUBLIC_BUDGET_ID, PRIVATE_BUDGET_ID].sort(),
    );
  });

  it("defaults to unfiltered when canSeePrivate is omitted (internal callers)", async () => {
    const result = await service.findAll(FAMILY_GROUP_ID);
    expect(result.map((b) => b.id).sort()).toEqual(
      [PUBLIC_BUDGET_ID, PRIVATE_BUDGET_ID].sort(),
    );
  });

  it("applies the same category privacy filter to the spend groupBy query (plus the C6 COA-direction filter)", async () => {
    await service.findAll(FAMILY_GROUP_ID, false);
    const call = prisma.__groupByCalls[0] as {
      where: { category?: { isPrivate?: boolean } };
    };
    expect(call.where.category).toEqual({
      isPrivate: false,
      coaAccount: { direction: "EXPENSE" },
    });
  });

  it("does not restrict the spend groupBy query for a viewer who can see private categories", async () => {
    await service.findAll(FAMILY_GROUP_ID, true);
    const call = prisma.__groupByCalls[0] as {
      where: { category?: { isPrivate?: boolean } };
    };
    expect(call.where.category).toEqual({
      coaAccount: { direction: "EXPENSE" },
    });
  });
});

/**
 * EPIC-023 group E retry round 4 (C5) — a liability's own budget line
 * (`Budget.liabilityId` set, HIGH 4/E2) posts its spend as `type:
 * "transfer"` (E1), not `type: "expense"`. `findAll` used to group spend on
 * `type: "expense"` only, so this line's `spentAmount` stayed 0 forever
 * however many payments were made, and its progress bar (`/anggaran`) never
 * filled. This fake `transaction.groupBy` actually filters by `type` and
 * `categoryId` (unlike the plain `[]`-returning stub above) so the test
 * fails without the fix: it exercises the REAL split-by-type behavior the
 * service must implement, not just "some query ran".
 */
function makePrismaWithTransactions() {
  const budgetRows: FakeBudgetRow[] = [
    {
      id: PUBLIC_BUDGET_ID,
      categoryId: PUBLIC_CATEGORY_ID,
      period: "monthly",
      limitAmount: 1_000_000n,
      createdAt: OLD_CREATED_AT,
      liabilityId: null,
      category: {
        name: "Belanja",
        icon: "🛒",
        isPrivate: false,
        coaAccount: { budgetType: null },
      },
    },
    {
      id: LIABILITY_BUDGET_ID,
      categoryId: LIABILITY_CATEGORY_ID,
      period: "monthly",
      limitAmount: 5_000_000n,
      createdAt: OLD_CREATED_AT,
      liabilityId: LIABILITY_ID,
      category: {
        name: "Cicilan Pokok KPR",
        icon: null,
        isPrivate: false,
        coaAccount: { budgetType: "FIXED" },
      },
    },
  ];

  // Simulates the real ledger: an ordinary expense on the public category,
  // and a liability principal payment (type "transfer") on the liability's
  // OWN category — exactly what `LiabilitiesService.pay()` posts.
  const transactionRows = [
    {
      categoryId: PUBLIC_CATEGORY_ID,
      type: "expense",
      amount: 300_000n,
      familyGroupId: FAMILY_GROUP_ID,
    },
    {
      categoryId: LIABILITY_CATEGORY_ID,
      type: "transfer",
      amount: 5_000_000n,
      familyGroupId: FAMILY_GROUP_ID,
    },
  ];

  return {
    budget: {
      findMany: jest.fn(() => Promise.resolve(budgetRows)),
    },
    transaction: {
      groupBy: jest.fn(
        ({
          where,
        }: {
          where: {
            type?: string;
            categoryId: { in: string[] };
            category?: { coaAccount?: { direction?: string } };
          };
        }) => {
          // The ordinary bucket no longer filters by `type` directly (C6) —
          // it relies on the (fixed) COA-direction filter to select
          // EXPENSE-classified categories; the liability bucket still
          // filters by `type: "transfer"` explicitly (unrelated to C6).
          const matching = transactionRows.filter((t) => {
            if (!where.categoryId.in.includes(t.categoryId)) return false;
            if (where.type) return t.type === where.type;
            // Ordinary bucket: every category in this fake fixture that
            // ISN'T the liability's own is COA-EXPENSE-direction and
            // posts as `type: "expense"` — mirrors the real join.
            return t.type === "expense";
          });
          const byCategory = new Map<string, bigint>();
          for (const t of matching) {
            byCategory.set(
              t.categoryId,
              (byCategory.get(t.categoryId) ?? 0n) + t.amount,
            );
          }
          return Promise.resolve(
            [...byCategory.entries()].map(([categoryId, sum]) => ({
              categoryId,
              _sum: { amount: sum },
            })),
          );
        },
      ),
    },
  };
}

describe("BudgetsService.findAll spend computation (EPIC-023 group E retry round 4, C5)", () => {
  let service: BudgetsService;
  let prisma: ReturnType<typeof makePrismaWithTransactions>;

  beforeEach(async () => {
    prisma = makePrismaWithTransactions();
    const module: TestingModule = await Test.createTestingModule({
      providers: [BudgetsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(BudgetsService);
  });

  it("counts a liability's transfer-type principal payments toward ITS OWN budget line's spentAmount", async () => {
    const result = await service.findAll(FAMILY_GROUP_ID, true);
    const liabilityBudget = result.find((b) => b.id === LIABILITY_BUDGET_ID);
    expect(liabilityBudget?.spentAmount).toBe(5_000_000);
    expect(liabilityBudget?.isOverBudget).toBe(false);
    expect(liabilityBudget?.usagePercent).toBe(100);
  });

  it("still counts an ordinary category's expense-type spend correctly", async () => {
    const result = await service.findAll(FAMILY_GROUP_ID, true);
    const publicBudget = result.find((b) => b.id === PUBLIC_BUDGET_ID);
    expect(publicBudget?.spentAmount).toBe(300_000);
  });
});

/**
 * C2 (group E retry round 4) — production writes `Budget.budgetType`
 * directly (`syncPrincipalBudgetLine`/`syncPremiumBudgetLine`), never only
 * `category.coaAccount.budgetType` (the shared group-5 TRANSFER account,
 * which has NO budgetType of its own). This fake `budget.findMany` returns
 * a row with `budgetType: "FIXED"` set on the BUDGET itself while its
 * category's CoaAccount carries `budgetType: null` — exactly what a real
 * obligation line looks like — so the test fails without the fix (the old
 * `toDto` would read `null` from the CoaAccount and drop this line out of
 * `/anggaran`'s FIXED section).
 */
function makePrismaWithBudgetOwnType() {
  const rows: FakeBudgetRow[] = [
    {
      id: "budget-own-fixed",
      categoryId: "cat-liability-own",
      period: "monthly",
      limitAmount: 2_083_000n,
      createdAt: OLD_CREATED_AT,
      liabilityId: "liab-1",
      budgetType: "FIXED",
      category: {
        name: "Cicilan Pokok KTA BNI",
        icon: null,
        isPrivate: false,
        coaAccount: { budgetType: null }, // shared group-5 TRANSFER account
      },
    },
  ];
  return {
    budget: { findMany: jest.fn(() => Promise.resolve(rows)) },
    transaction: { groupBy: jest.fn(() => Promise.resolve([])) },
  };
}

describe("BudgetsService.findAll budgetType resolution (EPIC-023 group E retry round 4, C2)", () => {
  it("prefers Budget.budgetType over the (null) shared CoaAccount.budgetType", async () => {
    const prisma = makePrismaWithBudgetOwnType();
    const module: TestingModule = await Test.createTestingModule({
      providers: [BudgetsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    const service = module.get(BudgetsService);

    const [result] = await service.findAll(FAMILY_GROUP_ID, true);

    expect(result.budgetType).toBe("FIXED");
  });
});

/**
 * EPIC-022 C1/C3 — the spend window follows `budget.period`, not a
 * hardcoded calendar month, and its START is clamped to the budget's own
 * `createdAt` so a mid-period create doesn't read spend from before it
 * existed. Uses a real `Date.now()` fake so the assertions aren't sensitive
 * to whichever day the suite happens to run on.
 */
describe("BudgetsService.findAll period-aware spend window (EPIC-022 C1/C3)", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  function makePrismaCapturingWindow(budgetRows: FakeBudgetRow[]) {
    const groupByCalls: Array<{
      where: { occurredAt: { gte: Date; lte: Date } };
    }> = [];
    return {
      budget: { findMany: jest.fn(() => Promise.resolve(budgetRows)) },
      transaction: {
        groupBy: jest.fn((args: (typeof groupByCalls)[number]) => {
          groupByCalls.push(args);
          return Promise.resolve([]);
        }),
      },
      __groupByCalls: groupByCalls,
    };
  }

  it("uses a weekly window (not the calendar month) for a weekly budget", async () => {
    const prisma = makePrismaCapturingWindow([
      {
        id: "budget-weekly",
        categoryId: "cat-weekly",
        period: "weekly",
        limitAmount: 500_000n,
        createdAt: OLD_CREATED_AT,
        category: {
          name: "Belanja Mingguan",
          icon: null,
          isPrivate: false,
          coaAccount: { budgetType: null },
        },
      },
    ]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [BudgetsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    const service = module.get(BudgetsService);

    await service.findAll(FAMILY_GROUP_ID, true);

    const { gte, lte } = prisma.__groupByCalls[0]!.where.occurredAt;
    // 2026-06-15 is a Monday — the weekly window must be exactly that week,
    // not the whole of June (the pre-fix hardcoded calendar-month bug).
    const spanMs = lte.getTime() - gte.getTime();
    expect(spanMs).toBeLessThan(8 * 24 * 60 * 60_000);
    expect(spanMs).toBeGreaterThan(6 * 24 * 60 * 60_000);
  });

  it("uses a yearly window for a yearly budget", async () => {
    const prisma = makePrismaCapturingWindow([
      {
        id: "budget-yearly",
        categoryId: "cat-yearly",
        period: "yearly",
        limitAmount: 12_000_000n,
        createdAt: OLD_CREATED_AT,
        category: {
          name: "SPP Tahunan",
          icon: null,
          isPrivate: false,
          coaAccount: { budgetType: null },
        },
      },
    ]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [BudgetsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    const service = module.get(BudgetsService);

    await service.findAll(FAMILY_GROUP_ID, true);

    const { gte, lte } = prisma.__groupByCalls[0]!.where.occurredAt;
    const spanDays = (lte.getTime() - gte.getTime()) / (24 * 60 * 60_000);
    expect(spanDays).toBeGreaterThan(360);
  });

  it("clamps the window start to createdAt for a budget created mid-period (C3)", async () => {
    const createdAt = new Date("2026-06-10T00:00:00+07:00");
    const prisma = makePrismaCapturingWindow([
      {
        id: "budget-mid-period",
        categoryId: "cat-mid-period",
        period: "monthly",
        limitAmount: 1_000_000n,
        createdAt,
        category: {
          name: "Baru Dibuat",
          icon: null,
          isPrivate: false,
          coaAccount: { budgetType: null },
        },
      },
    ]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [BudgetsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    const service = module.get(BudgetsService);

    await service.findAll(FAMILY_GROUP_ID, true);

    const { gte } = prisma.__groupByCalls[0]!.where.occurredAt;
    expect(gte).toEqual(createdAt);
  });

  it("buckets two same-period budgets predating the period start into ONE groupBy call", async () => {
    const prisma = makePrismaCapturingWindow([
      {
        id: "budget-a",
        categoryId: "cat-a",
        period: "monthly",
        limitAmount: 1_000_000n,
        createdAt: OLD_CREATED_AT,
        category: {
          name: "A",
          icon: null,
          isPrivate: false,
          coaAccount: { budgetType: null },
        },
      },
      {
        id: "budget-b",
        categoryId: "cat-b",
        period: "monthly",
        limitAmount: 1_000_000n,
        createdAt: OLD_CREATED_AT,
        category: {
          name: "B",
          icon: null,
          isPrivate: false,
          coaAccount: { budgetType: null },
        },
      },
    ]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [BudgetsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    const service = module.get(BudgetsService);

    await service.findAll(FAMILY_GROUP_ID, true);

    expect(prisma.__groupByCalls.length).toBe(1);
  });
});

describe("BudgetsService.create privacy enforcement (EPIC-022 A6 follow-up)", () => {
  let service: BudgetsService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    prisma = makePrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [BudgetsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(BudgetsService);
  });

  it("rejects budgeting a private category for a member viewer (canSeePrivate=false)", async () => {
    await expect(
      service.create(
        FAMILY_GROUP_ID,
        {
          categoryId: PRIVATE_CATEGORY_ID,
          period: "monthly",
          limitAmount: 100,
        },
        false,
      ),
    ).rejects.toMatchObject({ status: 422 });
    expect(prisma.budget.create).not.toHaveBeenCalled();
  });

  it("allows budgeting a private category for an owner/admin_staff viewer (canSeePrivate=true)", async () => {
    const result = await service.create(
      FAMILY_GROUP_ID,
      { categoryId: PRIVATE_CATEGORY_ID, period: "monthly", limitAmount: 100 },
      true,
    );
    expect(result.categoryId).toBe(PRIVATE_CATEGORY_ID);
  });

  it("still allows budgeting a public category for a member viewer", async () => {
    const result = await service.create(
      FAMILY_GROUP_ID,
      { categoryId: PUBLIC_CATEGORY_ID, period: "monthly", limitAmount: 100 },
      false,
    );
    expect(result.categoryId).toBe(PUBLIC_CATEGORY_ID);
  });
});

/**
 * EPIC-022 C5 — a category may hold only ONE budget, regardless of period.
 * Without this, the UI's 409-fallback create path (retry with the resolved
 * existing category, a different period) could leave the SAME category with
 * both a weekly AND a monthly budget, double-counting its spend in the page
 * totals.
 */
describe("BudgetsService.create rejects a second budget for the same category (EPIC-022 C5)", () => {
  it("409s when a budget already exists for the category, in ANY period", async () => {
    const prisma = makePrisma();
    prisma.budget.findFirst = jest
      .fn()
      .mockResolvedValue({ id: PUBLIC_BUDGET_ID });
    const module: TestingModule = await Test.createTestingModule({
      providers: [BudgetsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    const service = module.get(BudgetsService);

    await expect(
      service.create(
        FAMILY_GROUP_ID,
        { categoryId: PUBLIC_CATEGORY_ID, period: "weekly", limitAmount: 100 },
        true,
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(prisma.budget.create).not.toHaveBeenCalled();
  });
});

/**
 * Review round (TOCTOU fix) — proves the mechanism that closes the
 * concurrent-DIFFERENT-period race, not just the serial case the test above
 * already covers. A real two-request race can't be reproduced against this
 * in-memory fake (there is only one Postgres and one SSI conflict detector),
 * so this proves the two halves of the argument at the code level instead:
 * (1) `create()` genuinely runs inside `runSerializableWithRetry` — a P2034
 * (the error Postgres's SSI raises for exactly this kind of write-skew, see
 * the method's comment) is transparently retried rather than surfacing as a
 * 500, mirroring liabilities.service.spec.ts's identical proof for its own
 * read-then-write race; and (2) once retried, the pre-check re-reads
 * whatever the winning transaction already committed and 409s instead of
 * inserting a duplicate — which is the behavior that makes the retry safe
 * regardless of which period either side picked.
 */
describe("BudgetsService.create closes the cross-period race (TOCTOU fix)", () => {
  it("retries once on a P2034 serialization failure and still succeeds", async () => {
    const prisma = makePrisma();
    // First attempt: SSI aborts the transaction (simulates two concurrent
    // creates for the same category racing each other, whichever period).
    prisma.$transaction.mockImplementationOnce(() =>
      Promise.reject(serializationFailure()),
    );

    const result = await service_create(prisma, {
      categoryId: PUBLIC_CATEGORY_ID,
      period: "weekly",
      limitAmount: 100,
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(result.categoryId).toBe(PUBLIC_CATEGORY_ID);
  });

  it("409s on retry instead of inserting a duplicate once the pre-check sees the winner's committed row", async () => {
    const prisma = makePrisma();
    // Attempt 1 loses the SSI race (aborted before its own insert commits).
    prisma.$transaction.mockImplementationOnce(() =>
      Promise.reject(serializationFailure()),
    );
    // Attempt 2 re-enters the transaction and now reads the OTHER
    // transaction's already-committed row — e.g. it won with a "monthly"
    // budget while this caller asked for "weekly" — proving the guard
    // still fires across different periods, not only the identical-period
    // case the DB's own unique index also catches.
    prisma.budget.findFirst = jest
      .fn()
      .mockResolvedValue({ id: "budget-won-the-race" });

    await expect(
      service_create(prisma, {
        categoryId: PUBLIC_CATEGORY_ID,
        period: "weekly",
        limitAmount: 100,
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(prisma.budget.create).not.toHaveBeenCalled();
  });
});

/** Builds a fresh service bound to `prisma` and calls `create()` on it. */
async function service_create(
  prisma: ReturnType<typeof makePrisma>,
  dto: {
    categoryId: string;
    period: "monthly" | "weekly" | "yearly";
    limitAmount: number;
  },
) {
  const module: TestingModule = await Test.createTestingModule({
    providers: [BudgetsService, { provide: PrismaService, useValue: prisma }],
  }).compile();
  const service = module.get(BudgetsService);
  return service.create(FAMILY_GROUP_ID, dto, true);
}

describe("BudgetsService.update privacy enforcement (EPIC-022 A6 follow-up)", () => {
  let service: BudgetsService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    prisma = makePrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [BudgetsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(BudgetsService);
  });

  it("404s on a private-category budget for a member viewer, and never calls update", async () => {
    await expect(
      service.update(
        FAMILY_GROUP_ID,
        PRIVATE_BUDGET_ID,
        { limitAmount: 500 },
        false,
      ),
    ).rejects.toMatchObject({ status: 404 });
    expect(prisma.budget.update).not.toHaveBeenCalled();
  });

  it("allows an owner/admin_staff viewer to update a private-category budget", async () => {
    const result = await service.update(
      FAMILY_GROUP_ID,
      PRIVATE_BUDGET_ID,
      { limitAmount: 500 },
      true,
    );
    expect(result.limitAmount).toBe(500);
  });

  it("allows a member viewer to update a public-category budget", async () => {
    const result = await service.update(
      FAMILY_GROUP_ID,
      PUBLIC_BUDGET_ID,
      { limitAmount: 500 },
      false,
    );
    expect(result.limitAmount).toBe(500);
  });
});

describe("BudgetsService.remove privacy enforcement (EPIC-022 A6 follow-up)", () => {
  let service: BudgetsService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    prisma = makePrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [BudgetsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(BudgetsService);
  });

  it("404s on a private-category budget for a member viewer, and never deletes", async () => {
    await expect(
      service.remove(FAMILY_GROUP_ID, PRIVATE_BUDGET_ID, false),
    ).rejects.toMatchObject({ status: 404 });
    expect(prisma.budget.delete).not.toHaveBeenCalled();
  });

  it("allows an owner/admin_staff viewer to delete a private-category budget", async () => {
    await service.remove(FAMILY_GROUP_ID, PRIVATE_BUDGET_ID, true);
    expect(prisma.budget.delete).toHaveBeenCalledWith({
      where: { id: PRIVATE_BUDGET_ID, familyGroupId: FAMILY_GROUP_ID },
    });
  });

  it("allows a member viewer to delete a public-category budget", async () => {
    await service.remove(FAMILY_GROUP_ID, PUBLIC_BUDGET_ID, false);
    expect(prisma.budget.delete).toHaveBeenCalledWith({
      where: { id: PUBLIC_BUDGET_ID, familyGroupId: FAMILY_GROUP_ID },
    });
  });
});

describe("BudgetsService — budgets carry no auto-debit (Revisi F item 4)", () => {
  let service: BudgetsService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    prisma = makePrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [BudgetsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(BudgetsService);
  });

  it("does not expose autoDebitDay on the budget DTO", async () => {
    const [result] = await service.findAll(FAMILY_GROUP_ID, true);
    expect(result).not.toHaveProperty("autoDebitDay");
  });

  it("never writes autoDebitDay on create, even if a caller smuggles one in", async () => {
    await service.create(
      FAMILY_GROUP_ID,
      {
        categoryId: PUBLIC_CATEGORY_ID,
        period: "monthly",
        limitAmount: 100,
        autoDebitDay: 25,
      } as never,
      true,
    );
    const [[args]] = prisma.budget.create.mock.calls as unknown as [
      [{ data: Record<string, unknown> }],
    ];
    expect(args.data).not.toHaveProperty("autoDebitDay");
  });

  it("never writes autoDebitDay on update, even if a caller smuggles one in", async () => {
    await service.update(
      FAMILY_GROUP_ID,
      PUBLIC_BUDGET_ID,
      { limitAmount: 200, autoDebitDay: 25 } as never,
      true,
    );
    const [[args]] = prisma.budget.update.mock.calls as unknown as [
      [{ data: Record<string, unknown> }],
    ];
    expect(args.data).not.toHaveProperty("autoDebitDay");
  });
});
