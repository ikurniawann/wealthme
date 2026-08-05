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

describe("AiAdvisorController.chat (assertHouseholdWideReadAllowed)", () => {
  let service: { streamChat: jest.Mock };
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
    controller = new AiAdvisorController(service as never);
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
      expect(service.streamChat).toHaveBeenCalledWith(
        FAMILY_GROUP_ID,
        [{ role: "user", content: "Halo" }],
        expect.any(Function),
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
    return new AiAdvisorController(service as never);
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
    const controller = makeController(err);
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
