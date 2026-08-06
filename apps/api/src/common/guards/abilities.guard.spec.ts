/**
 * EPIC-023 Task C retry (root-cause finding) — `AbilitiesGuard` returns
 * `true` when a route carries no `@CheckAbility` at all (see
 * abilities.guard.ts:32-34), and CASL's "manage" is NOT implied by holding
 * "create" (verified against the installed @casl/ability). Both defects
 * lived in this exact seam — the guard + real ability factory wired
 * together — and no test exercised it: every existing unit test called
 * `service.create()` directly, bypassing `AbilitiesGuard` entirely.
 *
 * This spec wires the REAL `AbilitiesGuard` to the REAL `CaslAbilityFactory`
 * (no DB, no `.env.test`) against a small fixture controller decorated with
 * the real `@CheckAbility` decorator, so metadata is read via a real
 * `Reflector` exactly like production.
 *
 * EPIC-023 Task C retry (MEDIUM six-reviewer finding) — the fixture above
 * proves the MECHANISM works, but nothing here fails if a real controller's
 * `@CheckAbility` regresses (e.g. `transactions.controller.ts`'s `create`
 * reverting to `can("manage", …)`, or a `@CheckAbility` being dropped from a
 * reconciliation route). The block below resolves the `@CheckAbility`
 * handler actually registered on the REAL `ReconciliationController`,
 * `SplitBillsController`, and `TransactionsController.create` — via the same
 * `CHECK_ABILITY_KEY` reflection the guard uses in production — and asserts
 * each evaluates as expected for each role, closing that seam.
 */
import "reflect-metadata";

import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Role } from "@prisma/client";

import {
  CaslAbilityFactory,
  type AppAbility,
} from "../../casl/casl-ability.factory";
import { FamilyGroupsController } from "../../family-groups/family-groups.controller";
import { ReconciliationController } from "../../reconciliation/reconciliation.controller";
import { SplitBillsController } from "../../split-bills/split-bills.controller";
import { TransactionsController } from "../../transactions/transactions.controller";
import { CheckAbility } from "../decorators/check-ability.decorator";

import { AbilitiesGuard } from "./abilities.guard";

import type { ExecutionContext } from "@nestjs/common";

class FixtureController {
  @CheckAbility((ab: AppAbility) => ab.can("create", "Transaction"))
  create(): string {
    return "create";
  }

  @CheckAbility((ab: AppAbility) => ab.can("update", "Transaction"))
  update(): string {
    return "update";
  }

  @CheckAbility((ab: AppAbility) => ab.can("delete", "Transaction"))
  remove(): string {
    return "remove";
  }

  // No `@CheckAbility` at all — the root-cause shape this retry fixes
  // elsewhere (reconciliation/split-bills). Kept here to prove the guard's
  // documented (if dangerous) fail-open behavior for an UNGATED handler.
  ungated(): string {
    return "ungated";
  }
}

function buildContext(
  handler: keyof FixtureController,
  member: { id: string; userId: string; role: Role } | null,
): ExecutionContext {
  const instance = new FixtureController();
  const req = {
    tenantContext: member
      ? {
          userId: member.userId,
          familyGroupId: "fg-1",
          role: member.role,
          member,
        }
      : undefined,
  };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => instance[handler],
    getClass: () => FixtureController,
  } as unknown as ExecutionContext;
}

describe("AbilitiesGuard (real CaslAbilityFactory, no DB)", () => {
  let guard: AbilitiesGuard;

  beforeEach(() => {
    guard = new AbilitiesGuard(new Reflector(), new CaslAbilityFactory());
  });

  describe("dependant — the transactions.controller.ts create/scan regression", () => {
    const dependant = {
      id: "member-child",
      userId: "user-child",
      role: Role.dependant,
    };

    it("PERMISSION — a dependant passes the create-Transaction check", () => {
      const ctx = buildContext("create", dependant);
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it("DENIAL — a dependant is refused the update-Transaction check", () => {
      const ctx = buildContext("update", dependant);
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it("DENIAL — a dependant is refused the delete-Transaction check", () => {
      const ctx = buildContext("remove", dependant);
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });
  });

  describe("operational — identical create-only shape as dependant (D5)", () => {
    const operational = {
      id: "member-driver",
      userId: "user-driver",
      role: Role.operational,
    };

    it("PERMISSION — an operational member passes the create-Transaction check", () => {
      const ctx = buildContext("create", operational);
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it("DENIAL — an operational member is refused update/delete", () => {
      expect(() =>
        guard.canActivate(buildContext("update", operational)),
      ).toThrow(ForbiddenException);
      expect(() =>
        guard.canActivate(buildContext("remove", operational)),
      ).toThrow(ForbiddenException);
    });
  });

  describe("admin_staff — identical create-without-manage shape", () => {
    const adminStaff = {
      id: "member-staff",
      userId: "user-staff",
      role: Role.admin_staff,
    };

    it("PERMISSION — admin_staff passes the create-Transaction check", () => {
      const ctx = buildContext("create", adminStaff);
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it("DENIAL — admin_staff is refused update/delete (no manage grant)", () => {
      expect(() =>
        guard.canActivate(buildContext("update", adminStaff)),
      ).toThrow(ForbiddenException);
      expect(() =>
        guard.canActivate(buildContext("remove", adminStaff)),
      ).toThrow(ForbiddenException);
    });
  });

  describe("owner — full manage grant covers every action", () => {
    const owner = {
      id: "member-owner",
      userId: "user-owner",
      role: Role.owner,
    };

    it("PERMISSION — owner passes create/update/delete", () => {
      expect(guard.canActivate(buildContext("create", owner))).toBe(true);
      expect(guard.canActivate(buildContext("update", owner))).toBe(true);
      expect(guard.canActivate(buildContext("remove", owner))).toBe(true);
    });
  });

  describe("no @CheckAbility handler registered (root-cause shape)", () => {
    it("fails open (returns true) regardless of role — matches the documented guard behavior", () => {
      const ctx = buildContext("ungated", {
        id: "member-child",
        userId: "user-child",
        role: Role.dependant,
      });
      expect(guard.canActivate(ctx)).toBe(true);
    });
  });

  describe("no tenantContext.member on the request", () => {
    it("throws ForbiddenException even for a gated handler", () => {
      const ctx = buildContext("create", null);
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });
  });
});

// ── Real controllers (MEDIUM six-reviewer finding) ──────────────────────────
//
// Builds an `ExecutionContext` whose `getHandler()`/`getClass()` point at the
// ACTUAL controller class and method, not a fixture — `Reflector` reads the
// same `CHECK_ABILITY_KEY` metadata production reads, off the real
// `@CheckAbility` decorator on the real route. The controller is constructed
// with a stub service because the guard never calls the handler itself, only
// reads its attached metadata.
function buildRealContext<T extends object>(
  controllerClass: new (...args: never[]) => T,
  instance: T,
  handlerName: keyof T,
  member: { id: string; userId: string; role: Role } | null,
): ExecutionContext {
  const req = {
    tenantContext: member
      ? {
          userId: member.userId,
          familyGroupId: "fg-1",
          role: member.role,
          member,
        }
      : undefined,
  };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => instance[handlerName],
    getClass: () => controllerClass,
  } as unknown as ExecutionContext;
}

describe("AbilitiesGuard against REAL controllers (closes the fixture-only seam)", () => {
  let guard: AbilitiesGuard;

  const member = { id: "member-1", userId: "user-1", role: Role.member };
  const dependant = { id: "member-2", userId: "user-2", role: Role.dependant };
  const operational = {
    id: "member-3",
    userId: "user-3",
    role: Role.operational,
  };

  beforeEach(() => {
    guard = new AbilitiesGuard(new Reflector(), new CaslAbilityFactory());
  });

  describe("ReconciliationController (HIGH six-reviewer finding — round 2 flattened every route onto 'manage')", () => {
    const controller = new ReconciliationController({} as never);
    const readOrCreateHandlers = [
      "upload",
      "findAll",
      "getEntries",
      "matchEntry",
      "autoMatch",
    ] as const;

    function ctxFor(
      handler: keyof ReconciliationController,
      m: { id: string; userId: string; role: Role } | null,
    ) {
      return buildRealContext(ReconciliationController, controller, handler, m);
    }

    it("PERMISSION — member can upload/findAll/getEntries/matchEntry/autoMatch (the regression this retry fixes)", () => {
      for (const handler of readOrCreateHandlers) {
        expect(guard.canActivate(ctxFor(handler, member))).toBe(true);
      }
    });

    it("DENIAL — member is refused splitEntry (ledger-writing action stays reserved for owner/admin_staff/spouse)", () => {
      expect(() => guard.canActivate(ctxFor("splitEntry", member))).toThrow(
        ForbiddenException,
      );
    });

    it("DENIAL — dependant/operational are refused every reconciliation route, including the five HIGH-1 restores", () => {
      for (const m of [dependant, operational]) {
        for (const handler of [
          ...readOrCreateHandlers,
          "splitEntry",
        ] as const) {
          expect(() => guard.canActivate(ctxFor(handler, m))).toThrow(
            ForbiddenException,
          );
        }
      }
    });
  });

  describe("SplitBillsController (CRITICAL six-reviewer finding — previously had NO @CheckAbility at all)", () => {
    const controller = new SplitBillsController({} as never);

    function ctxFor(
      handler: keyof SplitBillsController,
      m: { id: string; userId: string; role: Role } | null,
    ) {
      return buildRealContext(SplitBillsController, controller, handler, m);
    }

    it("PERMISSION — member can read (findAll/findOne) and manage (create/remove/settleParticipant)", () => {
      for (const handler of [
        "findAll",
        "findOne",
        "create",
        "remove",
        "settleParticipant",
      ] as const) {
        expect(guard.canActivate(ctxFor(handler, member))).toBe(true);
      }
    });

    it("DENIAL — dependant/operational are refused every split-bill route", () => {
      for (const m of [dependant, operational]) {
        for (const handler of [
          "findAll",
          "findOne",
          "create",
          "remove",
          "settleParticipant",
        ] as const) {
          expect(() => guard.canActivate(ctxFor(handler, m))).toThrow(
            ForbiddenException,
          );
        }
      }
    });
  });

  describe("TransactionsController.create (CRITICAL six-reviewer finding — 'manage' does NOT imply 'create')", () => {
    const controller = new TransactionsController({} as never);

    function ctxFor(m: { id: string; userId: string; role: Role } | null) {
      return buildRealContext(TransactionsController, controller, "create", m);
    }

    it("PERMISSION — member/dependant/operational all pass the create-Transaction check", () => {
      for (const m of [member, dependant, operational]) {
        expect(guard.canActivate(ctxFor(m))).toBe(true);
      }
    });
  });

  // FIX 4 (MEDIUM, review-qa) — this epic's own group-C postmortem found
  // that unit tests calling a service method directly (bypassing the REAL
  // `AbilitiesGuard`) can miss a real 403 gap. The existing
  // `family-groups.service.spec.ts` tests for `createDependantMember` call
  // the service directly and prove nothing about the guard. This drives the
  // REAL guard + REAL `CaslAbilityFactory` against the REAL
  // `FamilyGroupsController.createDependantMember` handler (its actual
  // `@CheckAbility` metadata, via `Reflector`), proving `owner` is let
  // through and `spouse`/`member`/`dependant`/`operational` are all
  // refused — closing the exact seam the postmortem flagged.
  describe("FamilyGroupsController.createDependantMember (FIX 3/FIX 4 — owner-only, matches D2's Member-management carve-out)", () => {
    const controller = new FamilyGroupsController({} as never);
    const owner = {
      id: "member-owner",
      userId: "user-owner",
      role: Role.owner,
    };
    const spouse = {
      id: "member-spouse",
      userId: "user-spouse",
      role: Role.spouse,
    };

    function ctxFor(m: { id: string; userId: string; role: Role } | null) {
      return buildRealContext(
        FamilyGroupsController,
        controller,
        "createDependantMember",
        m,
      );
    }

    it("PERMISSION — owner passes the guard", () => {
      expect(guard.canActivate(ctxFor(owner))).toBe(true);
    });

    it("DENIAL — spouse is refused (D2: full financial co-owner EXCEPT 'manage Member' — only 'read Member')", () => {
      expect(() => guard.canActivate(ctxFor(spouse))).toThrow(
        ForbiddenException,
      );
    });

    it("DENIAL — member is refused", () => {
      expect(() => guard.canActivate(ctxFor(member))).toThrow(
        ForbiddenException,
      );
    });

    it("DENIAL — dependant is refused", () => {
      expect(() => guard.canActivate(ctxFor(dependant))).toThrow(
        ForbiddenException,
      );
    });

    it("DENIAL — operational is refused", () => {
      expect(() => guard.canActivate(ctxFor(operational))).toThrow(
        ForbiddenException,
      );
    });
  });

  // EPIC-023 F2 (D20) — these are NEW routes, added explicitly decorated
  // (unlike the pre-existing getGoldPrice/updateGoldPrice on this same
  // controller, which carry no `@CheckAbility` at all and only pass today
  // because AbilitiesGuard fails OPEN). This proves the REAL guard enforces
  // "read FamilyGroup"/"manage FamilyGroup" on the REAL controller methods,
  // not just that the DTO/service layer behaves — the exact seam a
  // dropped or never-added `@CheckAbility` would otherwise slip through.
  describe("FamilyGroupsController.getReligion / updateReligion (F2)", () => {
    const controller = new FamilyGroupsController({} as never);
    const owner = {
      id: "member-owner",
      userId: "user-owner",
      role: Role.owner,
    };
    const spouse = {
      id: "member-spouse",
      userId: "user-spouse",
      role: Role.spouse,
    };

    function ctxFor(
      handler: "getReligion" | "updateReligion",
      m: { id: string; userId: string; role: Role } | null,
    ) {
      return buildRealContext(FamilyGroupsController, controller, handler, m);
    }

    it("PERMISSION — every role can read the religion setting (harmless descriptive setting)", () => {
      for (const m of [owner, spouse, member, dependant, operational]) {
        expect(guard.canActivate(ctxFor("getReligion", m))).toBe(true);
      }
    });

    it("PERMISSION — owner can update the religion setting", () => {
      expect(guard.canActivate(ctxFor("updateReligion", owner))).toBe(true);
    });

    it("DENIAL — every non-owner role is refused updateReligion", () => {
      for (const m of [spouse, member, dependant, operational]) {
        expect(() => guard.canActivate(ctxFor("updateReligion", m))).toThrow(
          ForbiddenException,
        );
      }
    });

    it("DENIAL — an unauthenticated request (no tenantContext) is refused both routes", () => {
      expect(() => guard.canActivate(ctxFor("getReligion", null))).toThrow(
        ForbiddenException,
      );
      expect(() => guard.canActivate(ctxFor("updateReligion", null))).toThrow(
        ForbiddenException,
      );
    });
  });
});
