// TDD RED: Verify seed creates demo@wealthme.id with BaAccount credential + Member.
// These tests fail until seed.ts is updated to include the demo user.

jest.mock("argon2", () => ({
  hash: jest.fn().mockResolvedValue("$argon2id$test-hash"),
  argon2id: 2,
}));

const userUpsert = jest
  .fn()
  .mockResolvedValue({ id: "seed-user-demo", email: "demo@wealthme.id" });
const baAccountUpsert = jest.fn().mockResolvedValue({ id: "seed-ba-demo" });
const memberUpsert = jest.fn().mockResolvedValue({ id: "seed-member-demo" });
const familyGroupUpsert = jest
  .fn()
  .mockResolvedValue({ id: "seed-family-demo", name: "Demo Family" });
const accountUpsert = jest.fn().mockResolvedValue({ id: "seed-account-mock" });
const categoryUpsert = jest.fn().mockResolvedValue({ id: "seed-cat-mock" });
const transactionUpsert = jest.fn().mockResolvedValue({ id: "seed-tx-mock" });
const goalUpsert = jest.fn().mockResolvedValue({ id: "seed-goal-mock" });
const disconnectMock = jest.fn().mockResolvedValue(undefined);

jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    familyGroup: { upsert: familyGroupUpsert },
    user: { upsert: userUpsert },
    member: { upsert: memberUpsert },
    baAccount: { upsert: baAccountUpsert },
    account: { upsert: accountUpsert },
    category: { upsert: categoryUpsert },
    transaction: { upsert: transactionUpsert },
    goal: { upsert: goalUpsert },
    $disconnect: disconnectMock,
  })),
}));

// Must import AFTER jest.mock calls so the mocks are in place
import { main } from "./seed";

const stdoutSpy = jest
  .spyOn(process.stdout, "write")
  .mockImplementation(() => true);

describe("seed — demo user contract", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    stdoutSpy.mockImplementation(() => true);
    userUpsert.mockResolvedValue({
      id: "seed-user-demo",
      email: "demo@wealthme.id",
    });
    baAccountUpsert.mockResolvedValue({ id: "seed-ba-demo" });
    memberUpsert.mockResolvedValue({ id: "seed-member-demo" });
    familyGroupUpsert.mockResolvedValue({
      id: "seed-family-demo",
      name: "Demo Family",
    });
    accountUpsert.mockResolvedValue({ id: "seed-account-mock" });
    categoryUpsert.mockResolvedValue({ id: "seed-cat-mock" });
    transactionUpsert.mockResolvedValue({ id: "seed-tx-mock" });
    goalUpsert.mockResolvedValue({ id: "seed-goal-mock" });
    disconnectMock.mockResolvedValue(undefined);
  });

  it("upserts demo@wealthme.id user", async () => {
    await main();
    const emailsUpserted = userUpsert.mock.calls.map(
      ([arg]: [{ where?: { email?: string }; create?: { email?: string } }]) =>
        arg.where?.email ?? arg.create?.email,
    );
    expect(emailsUpserted).toContain("demo@wealthme.id");
  });

  it("creates a BaAccount credential record for demo@wealthme.id", async () => {
    await main();
    const credentialCalls = baAccountUpsert.mock.calls.filter(
      ([arg]: [{ create?: { providerId?: string; accountId?: string } }]) =>
        arg.create?.providerId === "credential" &&
        arg.create?.accountId === "demo@wealthme.id",
    );
    expect(credentialCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("creates a Member record for the demo user", async () => {
    await main();
    expect(memberUpsert).toHaveBeenCalled();
  });
});
