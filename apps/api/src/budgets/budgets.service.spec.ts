import { Test, type TestingModule } from "@nestjs/testing";

import { PrismaService } from "../prisma/prisma.service";

import { BudgetsService } from "./budgets.service";

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

interface FakeBudgetRow {
  id: string;
  categoryId: string;
  period: string;
  limitAmount: bigint;
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

  return {
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
    __groupByCalls: groupByCalls,
  };
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

  it("applies the same category privacy filter to the spend groupBy query", async () => {
    await service.findAll(FAMILY_GROUP_ID, false);
    const call = prisma.__groupByCalls[0] as {
      where: { category?: { isPrivate?: boolean } };
    };
    expect(call.where.category).toEqual({ isPrivate: false });
  });

  it("does not restrict the spend groupBy query for a viewer who can see private categories", async () => {
    await service.findAll(FAMILY_GROUP_ID, true);
    const call = prisma.__groupByCalls[0] as {
      where: { category?: { isPrivate?: boolean } };
    };
    expect(call.where.category).toEqual({});
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
          where: { type: string; categoryId: { in: string[] } };
        }) => {
          const matching = transactionRows.filter(
            (t) =>
              t.type === where.type &&
              where.categoryId.in.includes(t.categoryId),
          );
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
