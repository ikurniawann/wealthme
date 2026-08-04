/**
 * EPIC-023 Task C retry (MEDIUM six-reviewer finding) — this controller had
 * zero test coverage, neither positive nor denial, for either the CRITICAL
 * "no @CheckAbility at all" defect or the HIGH regression the immediately
 * preceding retry introduced (flattening every route onto "manage
 * Reconciliation" 403'd a plain `member` on the upload/list/match/auto-match
 * workflow they always had — see casl-ability.factory.ts and
 * reconciliation.controller.ts).
 *
 * Authorization here is entirely declarative (`@CheckAbility` + the real
 * `AbilitiesGuard`), not an in-method check, so — unlike
 * `allowance-requests.controller.spec.ts`'s `canSeeAll` assertions — calling
 * the controller's methods directly would prove nothing about access
 * control. This spec wires the REAL `AbilitiesGuard` to the REAL
 * `CaslAbilityFactory` against the REAL `ReconciliationController` (no DB),
 * matching the technique in `common/guards/abilities.guard.spec.ts`.
 */
import "reflect-metadata";

import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Role } from "@prisma/client";

import { CaslAbilityFactory } from "../casl/casl-ability.factory";
import { AbilitiesGuard } from "../common/guards/abilities.guard";

import { ReconciliationController } from "./reconciliation.controller";

import type { ExecutionContext } from "@nestjs/common";

const FAMILY_GROUP_ID = "fg-1";

function buildContext(
  controller: ReconciliationController,
  handler: keyof ReconciliationController,
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
    getClass: () => ReconciliationController,
  } as unknown as ExecutionContext;
}

describe("ReconciliationController (real AbilitiesGuard + CaslAbilityFactory)", () => {
  let guard: AbilitiesGuard;
  let controller: ReconciliationController;

  const member = { id: "member-1", userId: "user-1", role: Role.member };
  const dependant = { id: "member-2", userId: "user-2", role: Role.dependant };
  const operational = {
    id: "member-3",
    userId: "user-3",
    role: Role.operational,
  };

  const readOrCreateRoutes = [
    "upload",
    "findAll",
    "getEntries",
    "matchEntry",
    "autoMatch",
  ] as const;

  beforeEach(() => {
    guard = new AbilitiesGuard(new Reflector(), new CaslAbilityFactory());
    controller = new ReconciliationController({} as never);
  });

  it("PERMISSION — member can read and upload/match/auto-match (the regression this retry fixes)", () => {
    for (const handler of readOrCreateRoutes) {
      expect(guard.canActivate(buildContext(controller, handler, member))).toBe(
        true,
      );
    }
  });

  it("DENIAL — member is refused splitEntry (ledger-writing action stays reserved for owner/admin_staff/spouse)", () => {
    expect(() =>
      guard.canActivate(buildContext(controller, "splitEntry", member)),
    ).toThrow(ForbiddenException);
  });

  it("DENIAL — dependant/operational are refused every reconciliation route", () => {
    for (const role of [dependant, operational]) {
      for (const handler of [...readOrCreateRoutes, "splitEntry"] as const) {
        expect(() =>
          guard.canActivate(buildContext(controller, handler, role)),
        ).toThrow(ForbiddenException);
      }
    }
  });
});
