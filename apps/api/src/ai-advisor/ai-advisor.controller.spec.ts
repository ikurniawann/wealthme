/**
 * EPIC-023 Task C retry (MEDIUM six-reviewer finding) — `chat()`'s
 * `assertHouseholdWideReadAllowed(req.tenantContext?.member?.role)` call had
 * zero coverage, neither positive nor denial. CASL's "read Transaction" gate
 * on the route is held by EVERY role (including `dependant`/`operational`,
 * D3/D5), so the real access control for this household-wide AI advisor
 * context lives entirely in this in-controller assertion — the same
 * household-wide-aggregate denial `reports`/`exports`/net-worth history
 * already prove via `privacy.util.ts#assertHouseholdWideReadAllowed`.
 */
import { ForbiddenException } from "@nestjs/common";
import { Role } from "@prisma/client";

import { ExternalRequestTimeoutError } from "../common/utils/external-fetch.util";

import { AiAdvisorNotConfiguredError } from "./ai-advisor-not-configured.error";
import {
  AiAdvisorAuthError,
  AiAdvisorRateLimitError,
} from "./ai-advisor-provider.error";
import { AiAdvisorController } from "./ai-advisor.controller";
import { AiKeyCorruptedError } from "./ai-key-corrupted.error";

import type { Request, Response } from "express";

const FAMILY_GROUP_ID = "fg-1";
const USER_ID = "user-1";
const MEMBER_ID = "member-1";

function makeReq(role: Role): Request {
  return {
    tenantContext: {
      userId: USER_ID,
      familyGroupId: FAMILY_GROUP_ID,
      role,
      member: { id: MEMBER_ID, userId: USER_ID, role },
    },
  } as unknown as Request;
}

function makeRes(): Response {
  return {
    setHeader: jest.fn(),
    flushHeaders: jest.fn(),
    write: jest.fn(),
    end: jest.fn(),
  } as unknown as Response;
}

/** A stub of AiConversationService with every method the controller calls. */
function makeConversations() {
  return {
    appendExchange: jest.fn().mockResolvedValue({ conversationId: "conv-new" }),
    list: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue({ id: "conv-1", messages: [] }),
    remove: jest.fn().mockResolvedValue(undefined),
  };
}

describe("AiAdvisorController.chat (assertHouseholdWideReadAllowed)", () => {
  let service: { streamChat: jest.Mock };
  let conversations: ReturnType<typeof makeConversations>;
  let controller: AiAdvisorController;

  beforeEach(() => {
    // EPIC-023 Task G retry — streamChat now resolves an AdvisorChatResult
    // (`{ truncated }`), not `void`; the mock mirrors the real contract so
    // the controller's `const { truncated } = await ...` destructure
    // reflects an actual successful call rather than accidentally exercising
    // the catch branch.
    service = {
      streamChat: jest.fn().mockResolvedValue({ truncated: false }),
    };
    conversations = makeConversations();
    controller = new AiAdvisorController(
      service as never,
      conversations as never,
    );
  });

  it("DENIAL — dependant/operational are refused the household-wide advisor context (a partial 'my own' context would be wrong, not private)", async () => {
    for (const role of [Role.dependant, Role.operational]) {
      service.streamChat.mockClear();
      await expect(
        controller.chat(
          FAMILY_GROUP_ID,
          { messages: [{ role: "user", content: "Halo" }] },
          makeRes(),
          makeReq(role),
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(service.streamChat).not.toHaveBeenCalled();
    }
  });

  it("PERMISSION — owner/admin_staff/spouse/member reach the streamed advisor response", async () => {
    for (const role of [
      Role.owner,
      Role.admin_staff,
      Role.spouse,
      Role.member,
    ]) {
      service.streamChat.mockClear();
      const res = makeRes();
      await controller.chat(
        FAMILY_GROUP_ID,
        { messages: [{ role: "user", content: "Halo" }] },
        res,
        makeReq(role),
      );
      // The 4th argument is the caller's own role, and it is load-bearing:
      // `buildContext` uses it to decide whether private accounts and
      // categories may appear in the prompt. Forwarding the wrong role (or
      // none) would hand a restricted member data the reports UI hides.
      expect(service.streamChat).toHaveBeenCalledWith(
        FAMILY_GROUP_ID,
        [{ role: "user", content: "Halo" }],
        expect.any(Function),
        role,
      );
      // A genuinely successful call writes a `done` frame carrying the
      // truncated flag — never an `error` frame from mishandling the
      // resolved AdvisorChatResult.
      expect(res.write).toHaveBeenCalledWith(
        `data: ${JSON.stringify({ done: true, truncated: false })}\n\n`,
      );
      expect(res.end).toHaveBeenCalled();
    }
  });
});

// EPIC-023 Task G retry (MEDIUM five-reviewer finding) — every provider
// failure kind gets its own distinguishable SSE `code` instead of one
// generic message for auth failure, rate limit, and timeout alike.
describe("AiAdvisorController.chat — error code mapping", () => {
  function makeController(err: Error) {
    const service = { streamChat: jest.fn().mockRejectedValue(err) };
    const conversations = makeConversations();
    return {
      controller: new AiAdvisorController(
        service as never,
        conversations as never,
      ),
      conversations,
    };
  }

  const owner = Role.owner;

  it.each([
    [new AiAdvisorNotConfiguredError(), "AI_NOT_CONFIGURED"],
    [new AiKeyCorruptedError(), "AI_KEY_CORRUPTED"],
    [new AiAdvisorAuthError("Claude"), "AI_AUTH_FAILED"],
    [new AiAdvisorRateLimitError("Claude"), "AI_RATE_LIMITED"],
    [new ExternalRequestTimeoutError("Claude request"), "AI_TIMEOUT"],
    [new Error("some other failure"), undefined],
  ])("maps %p to code %p", async (err, expectedCode) => {
    const { controller } = makeController(err);
    const res = makeRes();

    await controller.chat(
      FAMILY_GROUP_ID,
      { messages: [{ role: "user", content: "Halo" }] },
      res,
      makeReq(owner),
    );

    const writeCalls = (res.write as jest.Mock).mock.calls as [string][];
    const lastFrame = writeCalls[writeCalls.length - 1]?.[0] ?? "";
    const payload = JSON.parse(lastFrame.replace(/^data: /, "")) as {
      error?: string;
      code?: string;
    };
    expect(payload.code).toBe(expectedCode);
  });
});

// Saved sessions — the persistence side of `chat`, plus the three history
// routes. The gate under test throughout is that a transcript is as
// household-wide as the advisor context that produced it.
describe("AiAdvisorController — saved conversations", () => {
  function makeController(opts?: { answer?: string; truncated?: boolean }) {
    const answer = opts?.answer ?? "Jawaban lengkap.";
    const service = {
      streamChat: jest
        .fn()
        .mockImplementation(
          async (
            _fg: string,
            _messages: unknown,
            onToken: (t: string) => void,
          ) => {
            // Stream the answer in two chunks so the controller's
            // accumulation is exercised, not just a single write.
            if (answer.length > 0) {
              onToken(answer.slice(0, 3));
              onToken(answer.slice(3));
            }
            return { truncated: opts?.truncated ?? false };
          },
        ),
    };
    const conversations = makeConversations();
    return {
      controller: new AiAdvisorController(
        service as never,
        conversations as never,
      ),
      conversations,
      service,
    };
  }

  function doneFrame(res: Response) {
    const calls = (res.write as jest.Mock).mock.calls as [string][];
    const last = calls[calls.length - 1]?.[0] ?? "";
    return JSON.parse(last.replace(/^data: /, "")) as {
      done?: boolean;
      truncated?: boolean;
      conversationId?: string;
    };
  }

  it("files the completed exchange under the caller's own user id and returns the new session id", async () => {
    const { controller, conversations } = makeController();
    const res = makeRes();

    await controller.chat(
      FAMILY_GROUP_ID,
      { messages: [{ role: "user", content: "Bagaimana arus kas saya?" }] },
      res,
      makeReq(Role.owner),
    );

    expect(conversations.appendExchange).toHaveBeenCalledWith({
      familyGroupId: FAMILY_GROUP_ID,
      userId: USER_ID,
      conversationId: null,
      userMessage: "Bagaimana arus kas saya?",
      assistantMessage: "Jawaban lengkap.",
      truncated: false,
    });
    expect(doneFrame(res).conversationId).toBe("conv-new");
  });

  it("appends to the session the client names, and carries the truncated flag into storage", async () => {
    const { controller, conversations } = makeController({ truncated: true });
    const res = makeRes();

    await controller.chat(
      FAMILY_GROUP_ID,
      {
        messages: [
          { role: "user", content: "Pertanyaan lama" },
          { role: "assistant", content: "Jawaban lama" },
          { role: "user", content: "Pertanyaan baru" },
        ],
        conversationId: "conv-existing",
      },
      res,
      makeReq(Role.owner),
    );

    // Only the newest user turn is filed — the earlier pair was stored by the
    // request that produced it, and re-appending it would duplicate history.
    expect(conversations.appendExchange).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: "conv-existing",
        userMessage: "Pertanyaan baru",
        truncated: true,
      }),
    );
  });

  it("stores nothing when the provider produced no text, so a failed turn leaves no empty session behind", async () => {
    const { controller, conversations } = makeController({ answer: "" });
    const res = makeRes();

    await controller.chat(
      FAMILY_GROUP_ID,
      { messages: [{ role: "user", content: "Halo" }] },
      res,
      makeReq(Role.owner),
    );

    expect(conversations.appendExchange).not.toHaveBeenCalled();
    expect(doneFrame(res).conversationId).toBeUndefined();
  });

  it("still delivers the answer when saving it fails — a storage error costs history, not the reply", async () => {
    const { controller, conversations } = makeController();
    conversations.appendExchange.mockRejectedValue(new Error("db down"));
    const res = makeRes();

    await expect(
      controller.chat(
        FAMILY_GROUP_ID,
        { messages: [{ role: "user", content: "Halo" }] },
        res,
        makeReq(Role.owner),
      ),
    ).resolves.toBeUndefined();

    const frame = doneFrame(res);
    expect(frame.done).toBe(true);
    expect(frame.conversationId).toBeUndefined();
  });

  it("DENIAL — dependant/operational cannot list, open, or delete a saved session", async () => {
    const { controller, conversations } = makeController();

    for (const role of [Role.dependant, Role.operational]) {
      await expect(
        controller.listConversations(FAMILY_GROUP_ID, makeReq(role)),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        controller.getConversation(FAMILY_GROUP_ID, "conv-1", makeReq(role)),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        controller.deleteConversation(FAMILY_GROUP_ID, "conv-1", makeReq(role)),
      ).rejects.toThrow(ForbiddenException);
    }

    expect(conversations.list).not.toHaveBeenCalled();
    expect(conversations.findOne).not.toHaveBeenCalled();
    expect(conversations.remove).not.toHaveBeenCalled();
  });

  it("scopes every history route to the calling member, never to the family alone", async () => {
    const { controller, conversations } = makeController();

    await controller.listConversations(FAMILY_GROUP_ID, makeReq(Role.owner));
    await controller.getConversation(
      FAMILY_GROUP_ID,
      "conv-1",
      makeReq(Role.owner),
    );
    await controller.deleteConversation(
      FAMILY_GROUP_ID,
      "conv-1",
      makeReq(Role.owner),
    );

    expect(conversations.list).toHaveBeenCalledWith(FAMILY_GROUP_ID, USER_ID);
    expect(conversations.findOne).toHaveBeenCalledWith(
      FAMILY_GROUP_ID,
      USER_ID,
      "conv-1",
    );
    expect(conversations.remove).toHaveBeenCalledWith(
      FAMILY_GROUP_ID,
      USER_ID,
      "conv-1",
    );
  });
});

// The rate-limit frame carries the only detail a user can act on: wait seconds,
// or wait until tomorrow. Sending just the code is what made the UI repeat
// "coba lagi sebentar lagi" for a per-day cap on every suggestion chip.
describe("AiAdvisorController.chat — rate-limit detail on the wire", () => {
  function frameFor(err: Error) {
    const service = { streamChat: jest.fn().mockRejectedValue(err) };
    const controller = new AiAdvisorController(
      service as never,
      makeConversations() as never,
    );
    const res = makeRes();
    return controller
      .chat(
        FAMILY_GROUP_ID,
        { messages: [{ role: "user", content: "Halo" }] },
        res,
        makeReq(Role.owner),
      )
      .then(() => {
        const calls = (res.write as jest.Mock).mock.calls as [string][];
        const last = calls[calls.length - 1]?.[0] ?? "";
        return JSON.parse(last.replace(/^data: /, "")) as {
          code?: string;
          scope?: string;
          retryAfterSeconds?: number;
        };
      });
  }

  it("forwards a daily-quota scope with no retry delay", async () => {
    const frame = await frameFor(
      new AiAdvisorRateLimitError("Gemini", "daily", undefined, "quota gone"),
    );

    expect(frame.code).toBe("AI_RATE_LIMITED");
    expect(frame.scope).toBe("daily");
    expect(frame.retryAfterSeconds).toBeUndefined();
  });

  it("forwards a short-window retry delay", async () => {
    const frame = await frameFor(
      new AiAdvisorRateLimitError("Gemini", "short", 13),
    );

    expect(frame.scope).toBe("short");
    expect(frame.retryAfterSeconds).toBe(13);
  });

  it("omits both when the provider said nothing beyond 429", async () => {
    // Claude/OpenAI throw the bare form; the UI must fall back to the generic
    // wording rather than rendering "retry in undefined seconds".
    const frame = await frameFor(new AiAdvisorRateLimitError("Claude"));

    expect(frame.code).toBe("AI_RATE_LIMITED");
    expect(frame.scope).toBeUndefined();
    expect(frame.retryAfterSeconds).toBeUndefined();
  });
});
