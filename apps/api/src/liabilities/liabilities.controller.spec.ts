/**
 * EPIC-023 group E retry (MEDIUM 5) — `apps/api/src/liabilities/` had NO
 * `liabilities.controller.spec.ts` at all, so the money-moving `POST
 * :id/pay` and `POST :id/purchase` routes were protected by decorators no
 * test exercised — in the epic whose own group-C lesson is that
 * `AbilitiesGuard` fails OPEN on an undecorated route (see
 * reconciliation.controller.spec.ts's doc comment and
 * insurances.controller.spec.ts, which this file mirrors exactly). This
 * spec wires the REAL `AbilitiesGuard` against the REAL `CaslAbilityFactory`
 * and the REAL `LiabilitiesController` (no DB).
 *
 * A reviewer proved this spec class has teeth by stripping `@CheckAbility`
 * off the insurance `pay` route and watching 3 tests fail — the same
 * applies here: strip `@CheckAbility` from `pay`/`purchase` and the DENIAL
 * tests below fail immediately (AbilitiesGuard would fail OPEN).
 */
import "reflect-metadata";

import { ForbiddenException, ValidationPipe } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { Role } from "@prisma/client";
import request from "supertest";

import { CaslAbilityFactory } from "../casl/casl-ability.factory";
import { AbilitiesGuard } from "../common/guards/abilities.guard";

import { LiabilitiesController } from "./liabilities.controller";
import { LiabilitiesService } from "./liabilities.service";

import type { ExecutionContext } from "@nestjs/common";

const FAMILY_GROUP_ID = "fg-1";

function buildContext(
  controller: LiabilitiesController,
  handler: keyof LiabilitiesController,
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
    getClass: () => LiabilitiesController,
  } as unknown as ExecutionContext;
}

describe("LiabilitiesController (real AbilitiesGuard + CaslAbilityFactory)", () => {
  let guard: AbilitiesGuard;
  let controller: LiabilitiesController;

  // casl-ability.factory.ts: owner/member/spouse get "manage Liability"
  // (full CRUD, including pay/purchase); admin_staff gets "read Liability"
  // only; dependant/operational get no Liability grant at all — the SAME
  // shape as Insurance (insurances.controller.spec.ts).
  const owner = { id: "member-1", userId: "user-1", role: Role.owner };
  const member = { id: "member-2", userId: "user-2", role: Role.member };
  const spouse = { id: "member-6", userId: "user-6", role: Role.spouse };
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

  const readRoutes = [
    "findAll",
    "getSummary",
    "getSchedule",
    "previewPayment",
  ] as const;
  const manageRoutes = [
    "create",
    "update",
    "pay",
    "purchase",
    "remove",
  ] as const;

  beforeEach(() => {
    guard = new AbilitiesGuard(new Reflector(), new CaslAbilityFactory());
    controller = new LiabilitiesController({} as never);
  });

  it("PERMISSION — owner/member/spouse can read AND pay/purchase (manage Liability)", () => {
    for (const role of [owner, member, spouse]) {
      for (const handler of [...readRoutes, ...manageRoutes]) {
        expect(guard.canActivate(buildContext(controller, handler, role))).toBe(
          true,
        );
      }
    }
  });

  it("PERMISSION — admin_staff can read liabilities but is refused pay/purchase/create/update/remove", () => {
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

  it("DENIAL — dependant/operational are refused every liability route, including pay and purchase", () => {
    for (const role of [dependant, operational]) {
      for (const handler of [...readRoutes, ...manageRoutes]) {
        expect(() =>
          guard.canActivate(buildContext(controller, handler, role)),
        ).toThrow(ForbiddenException);
      }
    }
  });

  it("DENIAL — an unauthenticated request (no tenantContext) is refused pay and purchase", () => {
    expect(() =>
      guard.canActivate(buildContext(controller, "pay", null)),
    ).toThrow(ForbiddenException);
    expect(() =>
      guard.canActivate(buildContext(controller, "purchase", null)),
    ).toThrow(ForbiddenException);
  });
});

describe("LiabilitiesController — GET :id/schedule over HTTP", () => {
  it("routes to getSchedule with the family group and liability ids", async () => {
    const service = {
      getSchedule: jest.fn().mockResolvedValue({
        liabilityId: "lid-1",
        interestMethod: "flat",
        installmentAmount: "6555556",
        rows: [],
      }),
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [LiabilitiesController],
      providers: [{ provide: LiabilitiesService, useValue: service }],
    }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();

    const res = await request(app.getHttpServer())
      .get("/family-groups/fg-1/liabilities/lid-1/schedule")
      .expect(200);

    expect(service.getSchedule).toHaveBeenCalledWith("fg-1", "lid-1");
    expect(res.body.installmentAmount).toBe("6555556");
    await app.close();
  });
});

describe("LiabilitiesController — GET :id/payment-preview over HTTP", () => {
  async function bootstrap() {
    const service = {
      previewPayment: jest.fn().mockResolvedValue({
        liabilityId: "lid-1",
        amount: "2500000",
        interest: "833333",
        principal: "1666667",
        remainingAfter: "48333333",
      }),
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [LiabilitiesController],
      providers: [{ provide: LiabilitiesService, useValue: service }],
    }).compile();
    const app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    return { app, service };
  }

  it("routes to previewPayment with the family group, liability id and amount", async () => {
    const { app, service } = await bootstrap();

    const res = await request(app.getHttpServer())
      .get("/family-groups/fg-1/liabilities/lid-1/payment-preview")
      .query({ amount: "2500000" })
      .expect(200);

    expect(service.previewPayment).toHaveBeenCalledWith(
      "fg-1",
      "lid-1",
      "2500000",
    );
    expect(res.body.interest).toBe("833333");
    await app.close();
  });

  it("rejects a non-numeric amount before reaching the service (the query DTO is a value import)", async () => {
    const { app, service } = await bootstrap();

    await request(app.getHttpServer())
      .get("/family-groups/fg-1/liabilities/lid-1/payment-preview")
      .query({ amount: "12abc" })
      .expect(400);

    expect(service.previewPayment).not.toHaveBeenCalled();
    await app.close();
  });
});
