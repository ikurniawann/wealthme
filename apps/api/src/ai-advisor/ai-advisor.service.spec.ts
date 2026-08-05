import { AiAdvisorNotConfiguredError } from "./ai-advisor-not-configured.error";
import { AiAdvisorService } from "./ai-advisor.service";

const FAMILY_GROUP_ID = "fg-1";

function makePrisma() {
  return {
    transaction: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0n } }),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    asset: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { currentValue: 0n } }),
    },
    liability: {
      aggregate: jest
        .fn()
        .mockResolvedValue({ _sum: { remainingBalance: 0n } }),
    },
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
    });
    const advisor = { chat: jest.fn().mockResolvedValue(undefined) };
    factory.create.mockReturnValue(advisor);

    const onToken = jest.fn();
    await service.streamChat(
      FAMILY_GROUP_ID,
      [{ role: "user", content: "Halo" }],
      onToken,
    );

    expect(factory.create).toHaveBeenCalledWith("openai", "sk-family-own-key");
    expect(advisor.chat).toHaveBeenCalledWith(
      expect.objectContaining({ familyGroupId: FAMILY_GROUP_ID }),
      [{ role: "user", content: "Halo" }],
      onToken,
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
