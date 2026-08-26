import { AiAdvisorNotConfiguredError } from "./ai-advisor-not-configured.error";
import { AiAdvisorService, stripMaskedNumber } from "./ai-advisor.service";

const FAMILY_GROUP_ID = "fg-1";

function makePrisma() {
  return {
    transaction: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0n } }),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    asset: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { currentValue: 0n } }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    liability: {
      aggregate: jest
        .fn()
        .mockResolvedValue({ _sum: { remainingBalance: 0n } }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    account: { findMany: jest.fn().mockResolvedValue([]) },
    goal: { findMany: jest.fn().mockResolvedValue([]) },
    category: { findMany: jest.fn().mockResolvedValue([]) },
  };
}

function makeAiKeyService() {
  return { resolveDecryptedKey: jest.fn() };
}

function makeFactory() {
  return { create: jest.fn() };
}

describe("AiAdvisorService.streamChat", () => {
  let prisma: ReturnType<typeof makePrisma>;
  let aiKeyService: ReturnType<typeof makeAiKeyService>;
  let factory: ReturnType<typeof makeFactory>;
  let service: AiAdvisorService;

  beforeEach(() => {
    prisma = makePrisma();
    aiKeyService = makeAiKeyService();
    factory = makeFactory();
    service = new AiAdvisorService(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      aiKeyService as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      factory as any,
    );
  });

  it("throws AiAdvisorNotConfiguredError when the family has no key — never a mock reply", async () => {
    aiKeyService.resolveDecryptedKey.mockResolvedValue(null);

    await expect(
      service.streamChat(
        FAMILY_GROUP_ID,
        [{ role: "user", content: "Halo" }],
        jest.fn(),
      ),
    ).rejects.toThrow(AiAdvisorNotConfiguredError);
    expect(factory.create).not.toHaveBeenCalled();
  });

  it("builds the adapter for the family's own configured provider and key", async () => {
    aiKeyService.resolveDecryptedKey.mockResolvedValue({
      provider: "openai",
      apiKey: "sk-family-own-key",
      // The family picked a model in Pengaturan; it must reach the adapter,
      // or the picker would appear to work while changing nothing.
      model: "gpt-4.1-mini",
    });
    const advisor = { chat: jest.fn().mockResolvedValue(undefined) };
    factory.create.mockReturnValue(advisor);

    const onToken = jest.fn();
    await service.streamChat(
      FAMILY_GROUP_ID,
      [{ role: "user", content: "Halo" }],
      onToken,
    );

    expect(factory.create).toHaveBeenCalledWith(
      "openai",
      "sk-family-own-key",
      "gpt-4.1-mini",
    );
    expect(advisor.chat).toHaveBeenCalledWith(
      expect.objectContaining({ familyGroupId: FAMILY_GROUP_ID }),
      [{ role: "user", content: "Halo" }],
      onToken,
      // The tool runner, bound to this family and viewer. Passing it is what
      // lets the model reach months the prompt does not carry.
      expect.any(Function),
    );
  });

  // EPIC-023 Task G retry (CRITICAL five-reviewer finding) — the truncated
  // flag from the provider adapter must reach the caller unchanged so a
  // cut-off answer is never indistinguishable from a complete one.
  it("passes the adapter's truncated result straight through to the caller", async () => {
    aiKeyService.resolveDecryptedKey.mockResolvedValue({
      provider: "claude",
      apiKey: "sk-family-own-key",
    });
    const advisor = { chat: jest.fn().mockResolvedValue({ truncated: true }) };
    factory.create.mockReturnValue(advisor);

    const result = await service.streamChat(
      FAMILY_GROUP_ID,
      [{ role: "user", content: "Halo" }],
      jest.fn(),
    );

    expect(result).toEqual({ truncated: true });
  });
});

/**
 * `buildContext` used to take only a familyGroupId and apply no privacy
 * filter, while reports.service.ts carefully excluded private accounts and
 * categories for the roles that may not see them. That gap was latent — the
 * demo family has no private rows — but adding row-level detail to the
 * prompt would have turned it into an outright disclosure. These tests pin
 * the filter to the role.
 */
describe("AiAdvisorService.buildContext — private-item filtering", () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: AiAdvisorService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new AiAdvisorService(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeAiKeyService() as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeFactory() as any,
    );
  });

  it("hides private accounts and categories from a plain member", async () => {
    await service.buildContext(FAMILY_GROUP_ID, "member");

    expect(prisma.account.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { familyGroupId: FAMILY_GROUP_ID, isPrivate: false },
      }),
    );
    expect(prisma.category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isPrivate: false }),
      }),
    );
    // Transaction aggregates must exclude private accounts/categories too,
    // or the headline totals leak what the row lists correctly hide.
    const aggregateWhere = prisma.transaction.aggregate.mock.calls[0][0]
      .where as Record<string, unknown>;
    expect(aggregateWhere.AND).toBeDefined();
  });

  it("shows private items to owner/spouse/admin_staff, who may already see them everywhere else", async () => {
    for (const role of ["owner", "spouse", "admin_staff"] as const) {
      prisma = makePrisma();
      service = new AiAdvisorService(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        prisma as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        makeAiKeyService() as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        makeFactory() as any,
      );

      await service.buildContext(FAMILY_GROUP_ID, role);

      expect(prisma.account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { familyGroupId: FAMILY_GROUP_ID },
        }),
      );
    }
  });

  it("treats a missing role as the most restricted case, so a forgetful caller under-shares", async () => {
    await service.buildContext(FAMILY_GROUP_ID, null);

    expect(prisma.account.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { familyGroupId: FAMILY_GROUP_ID, isPrivate: false },
      }),
    );
  });

  it("never selects the encrypted account number", async () => {
    await service.buildContext(FAMILY_GROUP_ID, "owner");

    const select = prisma.account.findMany.mock.calls[0][0].select as Record<
      string,
      boolean
    >;
    // maskedNumber is AES-encrypted at rest; sending it to a third-party
    // model provider would undo that for no advisory benefit.
    expect(select.maskedNumber).toBeUndefined();
    expect(select.balance).toBe(true);
  });
});

describe("AiAdvisorService.buildContext — row detail", () => {
  it("carries the individual liability rows the aggregate used to flatten away", async () => {
    const prisma = makePrisma();
    prisma.liability.findMany.mockResolvedValue([
      {
        name: "Kartu Kredit BCA",
        institution: "BCA",
        type: "kartu_kredit",
        remainingBalance: 8_500_000n,
        minimumPayment: 425_000n,
        interestRate: { toString: () => "2.25" },
        dueDate: new Date("2026-09-01"),
      },
    ]);
    const service = new AiAdvisorService(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeAiKeyService() as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeFactory() as any,
    );

    const ctx = await service.buildContext(FAMILY_GROUP_ID, "owner");

    expect(ctx.liabilities).toHaveLength(1);
    expect(ctx.liabilities[0]).toMatchObject({
      name: "Kartu Kredit BCA",
      remainingBalance: 8_500_000n,
      interestRate: "2.25",
    });
    expect(ctx.truncatedLists).toBe(false);
  });

  it("caps a long list and flags the truncation instead of presenting it as complete", async () => {
    const prisma = makePrisma();
    // 26 rows — one past the cap, which is exactly how overflow is detected.
    prisma.asset.findMany.mockResolvedValue(
      Array.from({ length: 26 }, (_, i) => ({
        name: `Aset ${i}`,
        type: "lainnya",
        currentValue: BigInt(i),
      })),
    );
    const service = new AiAdvisorService(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeAiKeyService() as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeFactory() as any,
    );

    const ctx = await service.buildContext(FAMILY_GROUP_ID, "owner");

    expect(ctx.assets).toHaveLength(25);
    expect(ctx.truncatedLists).toBe(true);
  });
});

describe("stripMaskedNumber", () => {
  // Excluding the encrypted `maskedNumber` column was not enough: accounts
  // are conventionally NAMED with the suffix baked in, so the digits reached
  // the provider through `name` while the /ai sidebar told the user account
  // numbers are not read.
  it("removes a masked-number suffix from an account name", () => {
    expect(stripMaskedNumber("Mandiri ···5586")).toBe("Mandiri");
    expect(stripMaskedNumber("BCA Tahapan ···9010")).toBe("BCA Tahapan");
    expect(stripMaskedNumber("Jenius **** 1234")).toBe("Jenius");
  });

  it("leaves names that merely contain a number alone", () => {
    // These are names, not masked numbers — mangling them would make the
    // advisor talk about an account the user cannot find.
    expect(stripMaskedNumber("BCA Tahapan 2")).toBe("BCA Tahapan 2");
    expect(stripMaskedNumber("Rekening 2024")).toBe("Rekening 2024");
    expect(stripMaskedNumber("GoPay")).toBe("GoPay");
    expect(stripMaskedNumber("Kas Tunai")).toBe("Kas Tunai");
  });

  it("never returns an empty name", () => {
    // A name that is nothing BUT a masked number would otherwise become "",
    // leaving the model describing a balance with no owner.
    expect(stripMaskedNumber("···9010")).toBe("···9010");
  });
});
