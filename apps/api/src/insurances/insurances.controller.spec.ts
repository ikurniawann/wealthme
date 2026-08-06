/**
 * EPIC-023 E1 — `AbilitiesGuard` fails OPEN on an undecorated route (this
 * epic's own group-C lesson, see reconciliation.controller.spec.ts's doc
 * comment). The new `pay` route is money-moving, so it MUST carry an
 * explicit `@CheckAbility` and MUST be covered by a guard-level test, not
 * just a service-level one — a service test proves the business logic is
 * correct but proves nothing about who is allowed to reach it. This spec
 * wires the REAL `AbilitiesGuard` against the REAL `CaslAbilityFactory` and
 * the REAL `InsurancesController` (no DB), matching
 * reconciliation.controller.spec.ts's technique.
 */
import "reflect-metadata";

import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Role } from "@prisma/client";

import { CaslAbilityFactory } from "../casl/casl-ability.factory";
import { AbilitiesGuard } from "../common/guards/abilities.guard";

import { InsurancesController } from "./insurances.controller";

import type { ExecutionContext } from "@nestjs/common";

const FAMILY_GROUP_ID = "fg-1";

function buildContext(
  controller: InsurancesController,
  handler: keyof InsurancesController,
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
    getClass: () => InsurancesController,
  } as unknown as ExecutionContext;
}

describe("InsurancesController (real AbilitiesGuard + CaslAbilityFactory)", () => {
  let guard: AbilitiesGuard;
  let controller: InsurancesController;

  // casl-ability.factory.ts: owner/member/spouse get "manage Insurance"
  // (full CRUD, including pay); admin_staff gets "read Insurance" only;
  // dependant/operational get no Insurance grant at all.
  const owner = { id: "member-1", userId: "user-1", role: Role.owner };
  const member = { id: "member-2", userId: "user-2", role: Role.member };
  const adminStaff = {
    id: "member-3",
    userId: "user-3",
    role: Role.admin_staff,
  };
  const dependant = { id: "member-4", userId: "user-4", role: Role.dependant };
  const operational = {
    id: "member-5",
    userId: "user-5",
    role: Role.operational,
  };

  const readRoutes = ["findAll", "getSummary"] as const;
  const manageRoutes = ["create", "update", "pay", "remove"] as const;

  beforeEach(() => {
    guard = new AbilitiesGuard(new Reflector(), new CaslAbilityFactory());
    controller = new InsurancesController({} as never);
  });

  it("PERMISSION — owner/member can read AND pay a premium (manage Insurance)", () => {
    for (const role of [owner, member]) {
      for (const handler of [...readRoutes, ...manageRoutes]) {
        expect(guard.canActivate(buildContext(controller, handler, role))).toBe(
          true,
        );
      }
    }
  });

  it("PERMISSION — admin_staff can read policies but is refused pay/create/update/remove", () => {
    for (const handler of readRoutes) {
      expect(
        guard.canActivate(buildContext(controller, handler, adminStaff)),
      ).toBe(true);
    }
    for (const handler of manageRoutes) {
      expect(() =>
        guard.canActivate(buildContext(controller, handler, adminStaff)),
      ).toThrow(ForbiddenException);
    }
  });

  it("DENIAL — dependant/operational are refused every insurance route, including pay", () => {
    for (const role of [dependant, operational]) {
      for (const handler of [...readRoutes, ...manageRoutes]) {
        expect(() =>
          guard.canActivate(buildContext(controller, handler, role)),
        ).toThrow(ForbiddenException);
      }
    }
  });

  it("DENIAL — an unauthenticated request (no tenantContext) is refused pay", () => {
    expect(() =>
      guard.canActivate(buildContext(controller, "pay", null)),
    ).toThrow(ForbiddenException);
  });
});
