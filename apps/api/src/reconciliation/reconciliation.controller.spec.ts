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
  const owner = { id: "member-4", userId: "user-4", role: Role.owner };

  const readOrCreateRoutes = [
    "upload",
    "uploadFile",
    "findAll",
    "getEntries",
    "matchEntry",
    "autoMatch",
    // EPIC-029 groups 1-3 — the statement-PDF routes. Included in the SAME
    // lists as every other import route because `AbilitiesGuard` waves
    // through any handler carrying no `@CheckAbility`: an ungated route here
    // would be open to `dependant`/`operational`, who are refused everywhere
    // else on this controller. The denial case below is what proves the
    // decorator is actually present.
    "readStatementPdf",
    "confirmStatementPdf",
  ] as const;

  // EPIC-023 G2 (D17) — column-mapping templates are a saved-configuration
  // surface: read is available to the day-to-day reconciliation workflow
  // (member+), but create/update/delete is owner-level (see
  // casl-ability.factory.ts).
  const templateReadRoutes = ["listTemplates"] as const;
  const templateManageRoutes = ["upsertTemplate", "deleteTemplate"] as const;

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

  // EPIC-023 G2 (D17) — column-mapping templates: member reads, owner
  // manages; dependant/operational are refused entirely (no AiKey/
  // ReconciliationTemplate grant at all — see casl-ability.factory.ts).
  it("PERMISSION — member can list templates but not create/update/delete one", () => {
    for (const handler of templateReadRoutes) {
      expect(guard.canActivate(buildContext(controller, handler, member))).toBe(
        true,
      );
    }
    for (const handler of templateManageRoutes) {
      expect(() =>
        guard.canActivate(buildContext(controller, handler, member)),
      ).toThrow(ForbiddenException);
    }
  });

  it("PERMISSION — owner can list and manage templates", () => {
    for (const handler of [...templateReadRoutes, ...templateManageRoutes]) {
      expect(guard.canActivate(buildContext(controller, handler, owner))).toBe(
        true,
      );
    }
  });

  /**
   * EPIC-029 — the guard against the failure mode this repo has a documented
   * history of: a NEW route added without `@CheckAbility` is not refused by
   * `AbilitiesGuard`, it is waved through for every role. Enumerating the
   * controller's own handlers means a route added tomorrow is caught here
   * rather than by whoever finds it in production.
   */
  it("DENIAL — dependant is refused EVERY route on this controller, enumerated from the class", () => {
    const handlers = Object.getOwnPropertyNames(
      ReconciliationController.prototype,
    ).filter(
      (name) => name !== "constructor",
    ) as (keyof ReconciliationController)[];

    expect(handlers.length).toBeGreaterThan(readOrCreateRoutes.length);
    for (const handler of handlers) {
      expect(() =>
        guard.canActivate(buildContext(controller, handler, dependant)),
      ).toThrow(ForbiddenException);
    }
  });

  it("DENIAL — dependant/operational are refused every template route", () => {
    for (const role of [dependant, operational]) {
      for (const handler of [...templateReadRoutes, ...templateManageRoutes]) {
        expect(() =>
          guard.canActivate(buildContext(controller, handler, role)),
        ).toThrow(ForbiddenException);
      }
    }
  });
});
