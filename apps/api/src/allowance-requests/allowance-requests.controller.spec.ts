/**
 * EPIC-023 Task C retry (HIGH six-reviewer finding) — `findAll`'s
 * `canSeeAll` predicate was missing `spouse`: a spouse holds
 * "manage AllowanceRequest" (D2, full financial co-owner) and can
 * approve/reject a request, but the list endpoint showed only their own
 * requests, so they could never discover one to approve. These tests prove
 * the fix and pin the pre-existing owner/admin_staff behavior plus the
 * member/dependant/operational DENIAL.
 */
import { Role } from "@prisma/client";

import { fxTesting } from "../../test/fx-testing";

import { AllowanceRequestsController } from "./allowance-requests.controller";

import type { Request } from "express";

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

describe("AllowanceRequestsController.findAll", () => {
  let service: { findAll: jest.Mock };
  let controller: AllowanceRequestsController;

  beforeEach(() => {
    service = { findAll: jest.fn().mockResolvedValue([]) };
    controller = new AllowanceRequestsController(
      service as never,
      fxTesting().service,
    );
  });

  it("PERMISSION — passes canSeeAll=true for owner", async () => {
    await controller.findAll(FAMILY_GROUP_ID, makeReq(Role.owner));
    expect(service.findAll).toHaveBeenCalledWith(
      FAMILY_GROUP_ID,
      USER_ID,
      true,
    );
  });

  it("PERMISSION — passes canSeeAll=true for admin_staff", async () => {
    await controller.findAll(FAMILY_GROUP_ID, makeReq(Role.admin_staff));
    expect(service.findAll).toHaveBeenCalledWith(
      FAMILY_GROUP_ID,
      USER_ID,
      true,
    );
  });

  it("PERMISSION — passes canSeeAll=true for spouse (D2 financial co-owner can now discover requests to approve)", async () => {
    await controller.findAll(FAMILY_GROUP_ID, makeReq(Role.spouse));
    expect(service.findAll).toHaveBeenCalledWith(
      FAMILY_GROUP_ID,
      USER_ID,
      true,
    );
  });

  it("DENIAL — passes canSeeAll=false for member/dependant/operational (own requests only)", async () => {
    for (const role of [Role.member, Role.dependant, Role.operational]) {
      service.findAll.mockClear();
      await controller.findAll(FAMILY_GROUP_ID, makeReq(role));
      expect(service.findAll).toHaveBeenCalledWith(
        FAMILY_GROUP_ID,
        USER_ID,
        false,
      );
    }
  });
});

/**
 * Regression: the funding-approval path was entirely unusable because
 * `ApproveAllowanceRequestDto` was imported `type`-only. TypeScript erases a
 * type-only import, so no runtime class reached `design:paramtypes`, the
 * global `whitelist: true` ValidationPipe stripped every body property, and
 * `approve()` answered "fromAccountId is required to approve a funding
 * request" for every request — including ones sending a perfectly valid
 * account UUID.
 *
 * A service-level unit test cannot catch this: the service is fine, and by
 * the time it runs the property is already gone. The defect lives in what
 * the decorator metadata says at runtime, so that is what this asserts.
 */
describe("approve() body DTO metadata", () => {
  it("resolves a real runtime class for the @Body() parameter", () => {
    const paramTypes: unknown[] =
      Reflect.getMetadata(
        "design:paramtypes",
        AllowanceRequestsController.prototype,
        "approve",
      ) ?? [];

    // (familyGroupId: string, id: string, dto: ApproveAllowanceRequestDto, req)
    const dtoType = paramTypes[2];

    expect(dtoType).toBeDefined();
    expect(typeof dtoType).toBe("function");
    // A type-only import degrades this to `Object`; the real class is what
    // ValidationPipe needs to find `fromAccountId`'s validators.
    expect(dtoType).not.toBe(Object);
    expect((dtoType as { name: string }).name).toBe(
      "ApproveAllowanceRequestDto",
    );
  });
});
