/**
 * The security-relevant claim this file pins down is narrow and easy to
 * regress: a saved AI transcript belongs to ONE member, not to the family.
 * Every read and delete must carry `userId` in its `where`, because the
 * conversation id is a uuid the client supplies — if a query ever filtered on
 * the id alone, holding the id would become the authorisation, and a member
 * could open a sibling's advisor session inside the same family.
 */
import { NotFoundException } from "@nestjs/common";

import { AiConversationService } from "./ai-conversation.service";

const FAMILY_GROUP_ID = "fg-1";
const USER_ID = "user-1";
const CONVERSATION_ID = "conv-1";

type PrismaMock = {
  aiConversation: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    deleteMany: jest.Mock;
  };
  aiMessage: { createMany: jest.Mock };
  $transaction: jest.Mock;
};

function makePrisma(): PrismaMock {
  return {
    aiConversation: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: "conv-created" }),
      update: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    aiMessage: { createMany: jest.fn().mockResolvedValue({ count: 2 }) },
    $transaction: jest.fn().mockResolvedValue([]),
  };
}

describe("AiConversationService — tenant scoping", () => {
  let prisma: PrismaMock;
  let service: AiConversationService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new AiConversationService(prisma as never);
  });

  it("list filters on family AND user, newest activity first", async () => {
    await service.list(FAMILY_GROUP_ID, USER_ID);

    expect(prisma.aiConversation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { familyGroupId: FAMILY_GROUP_ID, userId: USER_ID },
        orderBy: { updatedAt: "desc" },
      }),
    );
  });

  it("findOne filters on family AND user, never on the id alone", async () => {
    prisma.aiConversation.findFirst.mockResolvedValue({
      id: CONVERSATION_ID,
      title: "Arus kas",
      createdAt: new Date("2026-08-17T00:00:00Z"),
      updatedAt: new Date("2026-08-17T01:00:00Z"),
      _count: { messages: 2 },
      messages: [
        {
          id: "m1",
          role: "user",
          content: "Halo",
          truncated: false,
          createdAt: new Date("2026-08-17T00:00:00Z"),
        },
      ],
    });

    const result = await service.findOne(
      FAMILY_GROUP_ID,
      USER_ID,
      CONVERSATION_ID,
    );

    expect(prisma.aiConversation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: CONVERSATION_ID,
          familyGroupId: FAMILY_GROUP_ID,
          userId: USER_ID,
        },
      }),
    );
    expect(result.messages).toHaveLength(1);
  });

  it("findOne reports another member's conversation as missing, not forbidden", async () => {
    // A 403 would confirm the id exists and belongs to someone; 404 does not.
    prisma.aiConversation.findFirst.mockResolvedValue(null);

    await expect(
      service.findOne(FAMILY_GROUP_ID, USER_ID, CONVERSATION_ID),
    ).rejects.toThrow(NotFoundException);
  });

  it("remove deletes by the tenant pair and 404s when it matched nothing", async () => {
    prisma.aiConversation.deleteMany.mockResolvedValue({ count: 0 });

    await expect(
      service.remove(FAMILY_GROUP_ID, USER_ID, CONVERSATION_ID),
    ).rejects.toThrow(NotFoundException);

    expect(prisma.aiConversation.deleteMany).toHaveBeenCalledWith({
      where: {
        id: CONVERSATION_ID,
        familyGroupId: FAMILY_GROUP_ID,
        userId: USER_ID,
      },
    });
  });
});

describe("AiConversationService.appendExchange", () => {
  let prisma: PrismaMock;
  let service: AiConversationService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new AiConversationService(prisma as never);
  });

  it("creates the session on the first turn, titled from the question", async () => {
    const { conversationId } = await service.appendExchange({
      familyGroupId: FAMILY_GROUP_ID,
      userId: USER_ID,
      conversationId: null,
      userMessage: "Bagaimana arus kas keluarga bulan ini?",
      assistantMessage: "Surplus Anda sehat.",
      truncated: false,
    });

    expect(conversationId).toBe("conv-created");
    const arg = prisma.aiConversation.create.mock.calls[0][0] as {
      data: { title: string; familyGroupId: string; userId: string };
    };
    expect(arg.data.title).toBe("Bagaimana arus kas keluarga bulan ini?");
    expect(arg.data.familyGroupId).toBe(FAMILY_GROUP_ID);
    expect(arg.data.userId).toBe(USER_ID);
  });

  it("truncates a long question into a title that still fits a list row", async () => {
    await service.appendExchange({
      familyGroupId: FAMILY_GROUP_ID,
      userId: USER_ID,
      conversationId: null,
      userMessage: "a".repeat(200),
      assistantMessage: "ok",
      truncated: false,
    });

    const arg = prisma.aiConversation.create.mock.calls[0][0] as {
      data: { title: string };
    };
    expect(arg.data.title).toHaveLength(60);
    expect(arg.data.title.endsWith("…")).toBe(true);
  });

  it("appends to an existing session it can prove the caller owns", async () => {
    prisma.aiConversation.findFirst.mockResolvedValue({ id: CONVERSATION_ID });

    const { conversationId } = await service.appendExchange({
      familyGroupId: FAMILY_GROUP_ID,
      userId: USER_ID,
      conversationId: CONVERSATION_ID,
      userMessage: "Lanjut",
      assistantMessage: "Baik.",
      truncated: true,
    });

    expect(conversationId).toBe(CONVERSATION_ID);
    expect(prisma.aiConversation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: CONVERSATION_ID,
          familyGroupId: FAMILY_GROUP_ID,
          userId: USER_ID,
        },
      }),
    );
    expect(prisma.aiMessage.createMany).toHaveBeenCalledWith({
      data: [
        {
          conversationId: CONVERSATION_ID,
          role: "user",
          content: "Lanjut",
        },
        {
          conversationId: CONVERSATION_ID,
          role: "assistant",
          content: "Baik.",
          truncated: true,
        },
      ],
    });
    expect(prisma.aiConversation.create).not.toHaveBeenCalled();
    // The parent is touched so the list stays ordered by real activity —
    // createMany on the child does not bump the parent's @updatedAt.
    expect(prisma.aiConversation.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: CONVERSATION_ID } }),
    );
  });

  it("starts a fresh session rather than writing into one it cannot prove the caller owns", async () => {
    // findFirst returns null for both "no such id" and "someone else's id".
    prisma.aiConversation.findFirst.mockResolvedValue(null);

    const { conversationId } = await service.appendExchange({
      familyGroupId: FAMILY_GROUP_ID,
      userId: USER_ID,
      conversationId: "conv-belonging-to-someone-else",
      userMessage: "Halo",
      assistantMessage: "Hai.",
      truncated: false,
    });

    expect(conversationId).toBe("conv-created");
    expect(prisma.aiMessage.createMany).not.toHaveBeenCalled();
    const arg = prisma.aiConversation.create.mock.calls[0][0] as {
      data: { userId: string };
    };
    expect(arg.data.userId).toBe(USER_ID);
  });
});
