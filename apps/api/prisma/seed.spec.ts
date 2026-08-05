// Verifies seed creates demo@wealthme.id with BaAccount credential + Member.

jest.mock("argon2", () => ({
  hash: jest.fn().mockResolvedValue("$argon2id$test-hash"),
  argon2id: 2,
}));

const mockUpsert = jest.fn().mockResolvedValue({
  id: "mock-id",
  email: "demo@wealthme.id",
  name: "Demo Family",
});
const mockCreate = jest.fn().mockResolvedValue({ id: "mock-id" });
const disconnectMock = jest.fn().mockResolvedValue(undefined);

const mockDeleteMany = jest.fn().mockResolvedValue({ count: 0 });
// EPIC-017: seed now reads back the generic chart to link demo categories.
// Resolved value is set in beforeEach to avoid a module-init TDZ on the import.
const mockFindMany = jest.fn();
const makeModel = () => ({
  upsert: mockUpsert,
  create: mockCreate,
  deleteMany: mockDeleteMany,
  findMany: mockFindMany,
});

jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    familyGroup: makeModel(),
    user: makeModel(),
    member: makeModel(),
    baAccount: makeModel(),
    account: makeModel(),
    category: makeModel(),
    transaction: makeModel(),
    budget: makeModel(),
    goal: makeModel(),
    liability: makeModel(),
    asset: makeModel(),
    assetHistory: makeModel(),
    investment: makeModel(),
    investmentPrice: makeModel(),
    insurance: makeModel(),
    splitBill: makeModel(),
    splitParticipant: makeModel(),
    inheritanceAsset: makeModel(),
    inheritanceHeir: makeModel(),
    donation: makeModel(),
    taxRecord: makeModel(),
    notification: makeModel(),
    bankSync: makeModel(),
    bankSyncEntry: makeModel(),
    baSession: makeModel(),
    coaAccount: makeModel(),
    $disconnect: disconnectMock,
  })),
}));

import { GENERIC_COA_CHART } from "../src/common/coa/default-coa-chart";

import { main } from "./seed";

jest.spyOn(process.stdout, "write").mockImplementation(() => true);

describe("seed — demo user contract", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpsert.mockResolvedValue({
      id: "mock-id",
      email: "demo@wealthme.id",
      name: "Demo Family",
    });
    mockCreate.mockResolvedValue({ id: "mock-id" });
    disconnectMock.mockResolvedValue(undefined);
    mockFindMany.mockResolvedValue(
      GENERIC_COA_CHART.map((c) => ({ id: `coa-${c.code}`, code: c.code })),
    );
  });

  it("upserts demo@wealthme.id user", async () => {
    await main();
    const emails = mockUpsert.mock.calls
      .map(
        ([arg]: [
          { where?: { email?: string }; create?: { email?: string } },
        ]) => arg.where?.email ?? arg.create?.email,
      )
      .filter(Boolean);
    expect(emails).toContain("demo@wealthme.id");
  });

  it("creates a BaAccount credential record for demo@wealthme.id", async () => {
    await main();
    const found = mockUpsert.mock.calls.some(
      ([arg]: [{ create?: { providerId?: string; accountId?: string } }]) =>
        arg.create?.providerId === "credential" &&
        arg.create?.accountId === "demo@wealthme.id",
    );
    expect(found).toBe(true);
  });

  it("creates a Member record", async () => {
    await main();
    expect(mockUpsert).toHaveBeenCalled();
  });
});

/**
 * EPIC-023 Task A1 (RED phase) — the demo seed's richer personalized COA
 * chart (the local `coaSeeds` array inside `main()`, distinct from
 * `GENERIC_COA_CHART`) currently mis-points groups 4 (Account Receivable)
 * and 5 (Account Payable) at `INCOME`/`EXPENSE` instead of `TRANSFER`
 * (seed.ts:2448-2533). `mockUpsert` is shared across every Prisma model in
 * this test file's mock (see `makeModel()` above), so every model's
 * `.upsert(...)` call — including `coaAccount.upsert` — lands in the same
 * `mockUpsert.mock.calls` array; each CoaAccount create is identified by
 * having both a `code` and a `direction` field, which no other seeded model
 * has together.
 */
describe("seed — COA taxonomy per group (EPIC-023 Task A1)", () => {
  interface CoaAccountCreate {
    code: string;
    name: string;
    groupNum: number;
    direction: "INCOME" | "EXPENSE" | "TRANSFER";
  }

  function seededCoaAccounts(): CoaAccountCreate[] {
    return mockUpsert.mock.calls
      .map(
        ([arg]: [{ create?: Record<string, unknown> }]) =>
          arg.create as Record<string, unknown> | undefined,
      )
      .filter(
        (c): c is CoaAccountCreate =>
          !!c && typeof c.code === "string" && typeof c.direction === "string",
      );
  }

  it("classifies every seeded group-4 (Account Receivable) account as TRANSFER, not INCOME", async () => {
    await main();
    const group4 = seededCoaAccounts().filter((c) => c.groupNum === 4);
    expect(group4.length).toBeGreaterThan(0);
    for (const account of group4) {
      expect(account.direction).toBe("TRANSFER");
    }
  });

  it("classifies every seeded group-5 (Account Payable) account as TRANSFER, not EXPENSE", async () => {
    await main();
    const group5 = seededCoaAccounts().filter((c) => c.groupNum === 5);
    expect(group5.length).toBeGreaterThan(0);
    for (const account of group5) {
      expect(account.direction).toBe("TRANSFER");
    }
  });

  it("leaves group 1 (Income), group 2 (Expense) and group 3 (Wealth Allocation) unchanged — guards against over-correction", async () => {
    await main();
    const all = seededCoaAccounts();
    const group1 = all.filter((c) => c.groupNum === 1);
    const group2 = all.filter((c) => c.groupNum === 2);
    const group3 = all.filter((c) => c.groupNum === 3);

    expect(group1.length).toBeGreaterThan(0);
    expect(group2.length).toBeGreaterThan(0);
    expect(group3.length).toBeGreaterThan(0);

    for (const account of group1) expect(account.direction).toBe("INCOME");
    for (const account of group2) expect(account.direction).toBe("EXPENSE");
    for (const account of group3) expect(account.direction).toBe("TRANSFER");
  });

  it("seeds a group-2 'Loan Interest' account at code 21304 with EXPENSE direction", async () => {
    await main();
    const account = seededCoaAccounts().find((c) => c.code === "21304");
    expect(account).toBeDefined();
    expect(account?.name).toBe("Loan Interest");
    expect(account?.groupNum).toBe(2);
    expect(account?.direction).toBe("EXPENSE");
  });
});
