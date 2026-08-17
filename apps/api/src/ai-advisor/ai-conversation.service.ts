import { Injectable, NotFoundException } from "@nestjs/common";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

const TITLE_MAX_LENGTH = 60;

export type ConversationSummaryDto = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
};

export type ConversationMessageDto = {
  id: string;
  role: "user" | "assistant";
  content: string;
  truncated: boolean;
  createdAt: string;
};

export type ConversationDetailDto = ConversationSummaryDto & {
  messages: ConversationMessageDto[];
};

/**
 * Derives a session title from the question that started it. Deliberately not
 * a model call: a second provider round-trip to name a chat costs the family
 * real tokens, adds latency to the first answer, and can fail on its own —
 * leaving a titled-nothing or an untitled session depending on which half
 * broke. The first question is also what the user would recognise in a list.
 */
function deriveTitle(firstUserMessage: string): string {
  const flat = firstUserMessage.replace(/\s+/g, " ").trim();
  if (flat.length === 0) return "Percakapan baru";
  if (flat.length <= TITLE_MAX_LENGTH) return flat;
  return `${flat.slice(0, TITLE_MAX_LENGTH - 1).trimEnd()}…`;
}

/**
 * Saved AI advisor sessions.
 *
 * Every method takes BOTH `familyGroupId` and `userId` and filters on the
 * pair. That is the whole tenant story for this feature: the chat endpoint is
 * already gated to household-wide readers (see the controller's
 * `assertHouseholdWideReadAllowed`), but "allowed to use the advisor" is not
 * "allowed to read a sibling's advisor transcript". A conversation is scoped
 * to the member who held it. Passing only the id — even an unguessable uuid —
 * would make the id itself the authorisation, so the id is never trusted
 * alone anywhere below.
 */
@Injectable()
export class AiConversationService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    familyGroupId: string,
    userId: string,
  ): Promise<ConversationSummaryDto[]> {
    const rows = await this.prisma.aiConversation.findMany({
      where: { familyGroupId, userId },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { messages: true } } },
    });

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      messageCount: row._count.messages,
    }));
  }

  async findOne(
    familyGroupId: string,
    userId: string,
    conversationId: string,
  ): Promise<ConversationDetailDto> {
    const row = await this.prisma.aiConversation.findFirst({
      where: { id: conversationId, familyGroupId, userId },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
        _count: { select: { messages: true } },
      },
    });

    // A conversation that belongs to another member is reported as missing,
    // not forbidden — a 403 here would confirm the id exists.
    if (!row) throw new NotFoundException("Conversation not found");

    return {
      id: row.id,
      title: row.title,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      messageCount: row._count.messages,
      messages: row.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        truncated: m.truncated,
        createdAt: m.createdAt.toISOString(),
      })),
    };
  }

  async remove(
    familyGroupId: string,
    userId: string,
    conversationId: string,
  ): Promise<void> {
    // deleteMany, not delete: the where clause carries the tenant filter, so
    // a mismatched owner deletes nothing instead of throwing a Prisma
    // "record not found" that would leak existence. count === 0 then means
    // either "no such id" or "not yours", reported identically.
    const { count } = await this.prisma.aiConversation.deleteMany({
      where: { id: conversationId, familyGroupId, userId },
    });
    if (count === 0) throw new NotFoundException("Conversation not found");
  }

  /**
   * Appends one completed exchange, creating the session on the first turn.
   *
   * Called only after the provider stream finished, so a failed or aborted
   * request stores nothing: no empty session appears in the list, and no
   * question is left sitting in history with no answer beneath it. The
   * consequence — a turn whose stream died mid-answer is not recorded even
   * though the user saw partial text — is the honest trade: the transcript
   * holds exchanges that actually completed.
   */
  async appendExchange(params: {
    familyGroupId: string;
    userId: string;
    conversationId: string | null;
    userMessage: string;
    assistantMessage: string;
    truncated: boolean;
  }): Promise<{ conversationId: string }> {
    const {
      familyGroupId,
      userId,
      conversationId,
      userMessage,
      assistantMessage,
      truncated,
    } = params;

    const existing = conversationId
      ? await this.prisma.aiConversation.findFirst({
          where: { id: conversationId, familyGroupId, userId },
          select: { id: true },
        })
      : null;

    // An unknown or foreign conversationId starts a fresh session rather than
    // throwing: the answer has already been streamed to the user and billed
    // by the provider, so refusing to file it would throw away work that
    // succeeded. It cannot write into someone else's session either, because
    // `existing` only matches on the tenant pair.
    if (!existing) {
      const created = await this.prisma.aiConversation.create({
        data: {
          familyGroupId,
          userId,
          title: deriveTitle(userMessage),
          messages: {
            create: [
              { role: "user", content: userMessage },
              { role: "assistant", content: assistantMessage, truncated },
            ],
          },
        },
        select: { id: true },
      });
      return { conversationId: created.id };
    }

    await this.prisma.$transaction([
      this.prisma.aiMessage.createMany({
        data: [
          { conversationId: existing.id, role: "user", content: userMessage },
          {
            conversationId: existing.id,
            role: "assistant",
            content: assistantMessage,
            truncated,
          },
        ],
      }),
      // Touch the parent so the list stays ordered by real activity —
      // createMany on the child does not bump the parent's @updatedAt.
      this.prisma.aiConversation.update({
        where: { id: existing.id },
        data: { updatedAt: new Date() },
      }),
    ]);

    return { conversationId: existing.id };
  }
}
