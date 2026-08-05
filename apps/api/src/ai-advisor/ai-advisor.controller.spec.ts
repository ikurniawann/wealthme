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

import { AiAdvisorController } from "./ai-advisor.controller";

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
    service = { streamChat: jest.fn().mockResolvedValue(undefined) };
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
      expect(res.end).toHaveBeenCalled();
    }
  });
});
