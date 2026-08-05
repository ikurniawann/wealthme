/**
 * EPIC-023 Task C retry (HIGH six-reviewer finding) — `assertSelfOrOwner`
 * was missing `spouse`: a spouse holds "manage MemberCategoryAllowance"
 * (D2, full financial co-owner) and can blindly PUT another member's
 * allow-list with no per-row check, but was 403'd reading the very
 * allow-list they can already overwrite. These tests prove the fix and pin
 * the pre-existing owner/admin_staff/member behavior.
 */
import { ForbiddenException } from "@nestjs/common";
import { Role } from "@prisma/client";

import { MemberCategoryAllowancesController } from "./member-category-allowances.controller";

import type { Request } from "express";

const FAMILY_GROUP_ID = "fg-1";
const SELF_MEMBER_ID = "member-self";
const OTHER_MEMBER_ID = "member-other";

function makeReq(role: Role): Request {
  return {
    tenantContext: {
      userId: "user-1",
      familyGroupId: FAMILY_GROUP_ID,
      role,
      member: { id: SELF_MEMBER_ID, userId: "user-1", role },
    },
  } as unknown as Request;
}

describe("MemberCategoryAllowancesController.findAll (assertSelfOrOwner)", () => {
  let service: { findAll: jest.Mock };
  let controller: MemberCategoryAllowancesController;

  beforeEach(() => {
    service = { findAll: jest.fn().mockResolvedValue({}) };
    controller = new MemberCategoryAllowancesController(service as never);
  });

  it("PERMISSION — spouse may read ANOTHER member's allow-list (elevated, symmetric with their existing manage grant)", async () => {
    await controller.findAll(
      FAMILY_GROUP_ID,
      OTHER_MEMBER_ID,
      makeReq(Role.spouse),
    );
    expect(service.findAll).toHaveBeenCalledWith(
      FAMILY_GROUP_ID,
      OTHER_MEMBER_ID,
    );
  });

  it("PERMISSION — owner/admin_staff may read another member's allow-list (pre-existing)", async () => {
    for (const role of [Role.owner, Role.admin_staff]) {
      service.findAll.mockClear();
      await controller.findAll(FAMILY_GROUP_ID, OTHER_MEMBER_ID, makeReq(role));
      expect(service.findAll).toHaveBeenCalledWith(
        FAMILY_GROUP_ID,
        OTHER_MEMBER_ID,
      );
    }
  });

  it("DENIAL — a plain member cannot read another member's allow-list", () => {
    expect(() =>
      controller.findAll(
        FAMILY_GROUP_ID,
        OTHER_MEMBER_ID,
        makeReq(Role.member),
      ),
    ).toThrow(ForbiddenException);
    expect(service.findAll).not.toHaveBeenCalled();
  });

  it("PERMISSION — a plain member may still read their OWN allow-list", async () => {
    await controller.findAll(
      FAMILY_GROUP_ID,
      SELF_MEMBER_ID,
      makeReq(Role.member),
    );
    expect(service.findAll).toHaveBeenCalledWith(
      FAMILY_GROUP_ID,
      SELF_MEMBER_ID,
    );
  });
});
