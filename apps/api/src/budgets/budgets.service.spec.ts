import { Test, type TestingModule } from "@nestjs/testing";

import { PrismaService } from "../prisma/prisma.service";

import { BudgetsService } from "./budgets.service";

const FAMILY_GROUP_ID = "fg-1";
const PUBLIC_BUDGET_ID = "budget-public";
const PRIVATE_BUDGET_ID = "budget-private";

interface FakeBudgetRow {
  id: string;
  categoryId: string;
  period: string;
  limitAmount: bigint;
  category: {
    name: string;
    icon: string | null;
    isPrivate: boolean;
    coaAccount: { budgetType: null };
  };
}

function buildBudgetRows(): FakeBudgetRow[] {
  return [
    {
      id: PUBLIC_BUDGET_ID,
      categoryId: "cat-public",
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
      categoryId: "cat-private",
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

/**
 * A minimal in-memory Prisma stand-in that honors the nested
 * `category: { isPrivate: false }` filter the service builds via
 * `categoryPrivacyWhere`, so these tests exercise real filtering behavior
 * (same approach as categories.service.spec.ts's privacy-enforcement suite).
 */
function makePrisma() {
  const rows = buildBudgetRows();
  const groupByCalls: unknown[] = [];

  return {
    budget: {
      findMany: jest.fn(
        ({ where }: { where: { category?: { isPrivate?: boolean } } }) => {
          const excludePrivate = where.category?.isPrivate === false;
          const filtered = excludePrivate
            ? rows.filter((r) => !r.category.isPrivate)
            : rows;
          return Promise.resolve(filtered);
        },
      ),
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
