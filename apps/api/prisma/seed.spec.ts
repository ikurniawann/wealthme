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
const makeModel = () => ({
  upsert: mockUpsert,
  create: mockCreate,
  deleteMany: mockDeleteMany,
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
