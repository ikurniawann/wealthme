import "reflect-metadata";

import { APP_GUARD } from "@nestjs/core";
import { Role } from "@prisma/client";
import request from "supertest";

import { createFxTestApp, FG, fxTesting } from "../../test/fx-testing";
import { CaslAbilityFactory } from "../casl/casl-ability.factory";
import { AbilitiesGuard } from "../common/guards/abilities.guard";
import { FamilyGroupsController } from "../family-groups/family-groups.controller";
import { FamilyGroupsService } from "../family-groups/family-groups.service";
import { MemberEmailService } from "../family-groups/member-email.service";

import type { INestApplication } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

const svc = { updateGoldPrice: jest.fn(), updateMemberRole: jest.fn() };
let role: Role = Role.owner;

describe("fx wiring — /akun settings (revisi I)", () => {
  let app: INestApplication;
  const fx = fxTesting();

  beforeAll(async () => {
    app = await createFxTestApp({
      controllers: [FamilyGroupsController],
      providers: [
        CaslAbilityFactory,
        { provide: APP_GUARD, useClass: AbilitiesGuard },
        { provide: FamilyGroupsService, useValue: svc },
        { provide: MemberEmailService, useValue: {} },
      ],
      fx,
      // The controller reads req.user.sub (JWT), not only tenantContext.
      extraMiddleware: (req: Request, _res: Response, next: NextFunction) => {
        (req as Request & { user: { sub: string } }).user = { sub: "u-owner" };
        if (req.tenantContext?.member) req.tenantContext.member.role = role;
        req.tenantContext!.role = role;
        next();
      },
    });
  });
  afterAll(() => app.close());
  beforeEach(() => {
    jest.clearAllMocks();
    role = Role.owner;
    svc.updateGoldPrice.mockResolvedValue({ pricePerGram: "1" });
    svc.updateMemberRole.mockResolvedValue({ id: "m-2" });
  });
  const http = () => request(app.getHttpServer());

  it("gold price: owner converts USD per gram; admin_staff is refused", async () => {
    await http()
      .patch(`/family-groups/${FG}/gold-price`)
      .send({
        pricePerGram: 1,
        fxInputs: [
          { field: "pricePerGram", currency: "USD", amount: "100.00" },
        ],
      })
      .expect(200);
    expect(svc.updateGoldPrice.mock.calls[0][2]).toEqual({
      pricePerGram: 1_791_390,
    });
    expect(
      fx.prisma.fxConversion.createMany.mock.calls[0][0].data[0],
    ).toMatchObject({
      entity: "FamilyGroup",
      entityId: FG,
      field: "goldPrice.pricePerGram",
    });

    role = Role.admin_staff;
    await http()
      .patch(`/family-groups/${FG}/gold-price`)
      .send({ pricePerGram: 1 })
      .expect(403);
  });

  it("gold price in IDR is unchanged (no fxInputs, no snapshot)", async () => {
    await http()
      .patch(`/family-groups/${FG}/gold-price`)
      .send({ pricePerGram: 1_500_000 })
      .expect(200);
    expect(svc.updateGoldPrice.mock.calls[0][2]).toEqual({
      pricePerGram: 1_500_000,
    });
    expect(fx.fxPort.getSnapshot).not.toHaveBeenCalled();
  });

  it("member threshold converts, and null still clears", async () => {
    await http()
      .patch(`/family-groups/${FG}/members/m-2`)
      .send({
        role: "dependant",
        largeTxnThreshold: 1,
        fxInputs: [
          { field: "largeTxnThreshold", currency: "SGD", amount: "100.00" },
        ],
      })
      .expect(200);
    expect(svc.updateMemberRole.mock.calls[0][3]).toMatchObject({
      largeTxnThreshold: 1_402_679,
    });
    expect(
      fx.prisma.fxConversion.createMany.mock.calls[0][0].data[0],
    ).toMatchObject({
      entity: "Member",
      entityId: "m-2",
      field: "largeTxnThreshold",
    });

    await http()
      .patch(`/family-groups/${FG}/members/m-2`)
      .send({ role: "dependant", largeTxnThreshold: null })
      .expect(200);
    expect(svc.updateMemberRole.mock.calls[1][3]).toMatchObject({
      largeTxnThreshold: null,
    });
  });
});
