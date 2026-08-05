/**
 * EPIC-023 G3 (D16) — declarative ability coverage for the AI key surface,
 * mirroring reconciliation.controller.spec.ts's technique: wires the REAL
 * AbilitiesGuard + CaslAbilityFactory against the REAL AiKeyController (no
 * DB), since authorization here is entirely `@CheckAbility` metadata, not
 * an in-method check.
 */
import "reflect-metadata";

import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Role } from "@prisma/client";

import { CaslAbilityFactory } from "../casl/casl-ability.factory";
import { AbilitiesGuard } from "../common/guards/abilities.guard";

import { AiKeyController } from "./ai-key.controller";

import type { ExecutionContext } from "@nestjs/common";

const FAMILY_GROUP_ID = "fg-1";

function buildContext(
  controller: AiKeyController,
  handler: keyof AiKeyController,
  member: { id: string; userId: string; role: Role } | null,
): ExecutionContext {
  const req = {
    tenantContext: member
      ? {
          userId: member.userId,
          familyGroupId: FAMILY_GROUP_ID,
          role: member.role,
          member,
        }
      : undefined,
  };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => controller[handler],
    getClass: () => AiKeyController,
  } as unknown as ExecutionContext;
}

describe("AiKeyController (real AbilitiesGuard + CaslAbilityFactory)", () => {
  let guard: AbilitiesGuard;
  let controller: AiKeyController;

  const owner = { id: "member-1", userId: "user-1", role: Role.owner };
  const spouse = { id: "member-2", userId: "user-2", role: Role.spouse };
  const adminStaff = {
    id: "member-3",
    userId: "user-3",
    role: Role.admin_staff,
  };
  const member = { id: "member-4", userId: "user-4", role: Role.member };
  const dependant = { id: "member-5", userId: "user-5", role: Role.dependant };
  const operational = {
    id: "member-6",
    userId: "user-6",
    role: Role.operational,
  };

  const readRoutes = ["getStatus"] as const;
  const manageRoutes = ["setKey", "deleteKey"] as const;

  beforeEach(() => {
    guard = new AbilitiesGuard(new Reflector(), new CaslAbilityFactory());
    controller = new AiKeyController({} as never);
  });

  it("PERMISSION — owner/spouse can read and manage the AI key", () => {
    for (const role of [owner, spouse]) {
      for (const handler of [...readRoutes, ...manageRoutes]) {
        expect(guard.canActivate(buildContext(controller, handler, role))).toBe(
          true,
        );
      }
    }
  });

  it("PERMISSION — admin_staff/member can read status but never manage the key", () => {
    for (const role of [adminStaff, member]) {
      for (const handler of readRoutes) {
        expect(guard.canActivate(buildContext(controller, handler, role))).toBe(
          true,
        );
      }
      for (const handler of manageRoutes) {
        expect(() =>
          guard.canActivate(buildContext(controller, handler, role)),
        ).toThrow(ForbiddenException);
      }
    }
  });

  it("DENIAL — dependant/operational are refused every AI key route", () => {
    for (const role of [dependant, operational]) {
      for (const handler of [...readRoutes, ...manageRoutes]) {
        expect(() =>
          guard.canActivate(buildContext(controller, handler, role)),
        ).toThrow(ForbiddenException);
      }
    }
  });
});
