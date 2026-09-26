/**
 * Revisi K — AbilitiesGuard fails OPEN on an undecorated route, so every new
 * route is proven here against the REAL guard + CaslAbilityFactory (mirrors
 * liabilities.controller.spec.ts).
 */
import "reflect-metadata";

import { ForbiddenException, ValidationPipe } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { Role } from "@prisma/client";
import request from "supertest";

import { CaslAbilityFactory } from "../casl/casl-ability.factory";
import { AbilitiesGuard } from "../common/guards/abilities.guard";

import { LiabilityFloatingRatesController } from "./liability-floating-rates.controller";
import { LiabilityFloatingRatesService } from "./liability-floating-rates.service";

import type { ExecutionContext } from "@nestjs/common";

function buildContext(
  controller: LiabilityFloatingRatesController,
  handler: keyof LiabilityFloatingRatesController,
  role: Role | null,
): ExecutionContext {
  const member = role ? { id: "m-1", userId: "u-1", role } : null;
  const req = {
    tenantContext: member
      ? { userId: member.userId, familyGroupId: "fg-1", role, member }
      : undefined,
  };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => controller[handler],
    getClass: () => LiabilityFloatingRatesController,
  } as unknown as ExecutionContext;
}

describe("LiabilityFloatingRatesController (real AbilitiesGuard)", () => {
  const guard = new AbilitiesGuard(new Reflector(), new CaslAbilityFactory());
  const controller = new LiabilityFloatingRatesController({} as never);

  it("PERMISSION — owner/member/spouse can list, add and remove", () => {
    for (const role of [Role.owner, Role.member, Role.spouse]) {
      for (const handler of ["list", "add", "remove"] as const) {
        expect(guard.canActivate(buildContext(controller, handler, role))).toBe(
          true,
        );
      }
    }
  });

  it("PERMISSION — admin_staff can list but not add or remove", () => {
    expect(
      guard.canActivate(buildContext(controller, "list", Role.admin_staff)),
    ).toBe(true);
    for (const handler of ["add", "remove"] as const) {
      expect(() =>
        guard.canActivate(buildContext(controller, handler, Role.admin_staff)),
      ).toThrow(ForbiddenException);
    }
  });

  it("DENIAL — dependant/operational/anonymous are refused every route", () => {
    for (const role of [Role.dependant, Role.operational, null]) {
      for (const handler of ["list", "add", "remove"] as const) {
        expect(() =>
          guard.canActivate(buildContext(controller, handler, role)),
        ).toThrow(ForbiddenException);
      }
    }
  });
});

describe("LiabilityFloatingRatesController over HTTP", () => {
  async function bootstrap() {
    const service = {
      list: jest.fn().mockResolvedValue([]),
      add: jest.fn().mockResolvedValue({ id: "fr-1" }),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [LiabilityFloatingRatesController],
      providers: [
        { provide: LiabilityFloatingRatesService, useValue: service },
      ],
    }).compile();
    const app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    return { app, service };
  }

  it("POST validates the body before the service (the DTO is a value import)", async () => {
    const { app, service } = await bootstrap();
    await request(app.getHttpServer())
      .post("/family-groups/fg-1/liabilities/lid-1/floating-rates")
      .send({ effectiveDate: "2031-02-30", ratePercent: "9.75" })
      .expect(400);
    await request(app.getHttpServer())
      .post("/family-groups/fg-1/liabilities/lid-1/floating-rates")
      .send({ effectiveDate: "2031-01-15", ratePercent: "9,75" })
      .expect(400);
    expect(service.add).not.toHaveBeenCalled();

    await request(app.getHttpServer())
      .post("/family-groups/fg-1/liabilities/lid-1/floating-rates")
      .send({ effectiveDate: "2031-01-15", ratePercent: "9.75" })
      .expect(201);
    expect(service.add).toHaveBeenCalledWith(
      "fg-1",
      "lid-1",
      { effectiveDate: "2031-01-15", ratePercent: "9.75" },
      null,
    );
    await app.close();
  });

  it("DELETE routes the rate id and answers 204", async () => {
    const { app, service } = await bootstrap();
    await request(app.getHttpServer())
      .delete("/family-groups/fg-1/liabilities/lid-1/floating-rates/fr-1")
      .expect(204);
    expect(service.remove).toHaveBeenCalledWith("fg-1", "lid-1", "fr-1");
    await app.close();
  });
});
