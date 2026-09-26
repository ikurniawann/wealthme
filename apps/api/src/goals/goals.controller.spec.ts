import "reflect-metadata";

import { ValidationPipe } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { Role } from "@prisma/client";
import request from "supertest";

import { fxTesting } from "../../test/fx-testing";
import { CaslAbilityFactory } from "../casl/casl-ability.factory";
import { AbilitiesGuard } from "../common/guards/abilities.guard";

import { GoalsController } from "./goals.controller";
import { GoalsService } from "./goals.service";

import type { INestApplication } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

const FAMILY_GROUP_ID = "fg-1";
const GOAL_ID = "goal-1";
const ACCOUNT_ID = "5f0c1f7e-7c1a-4b8e-9d7a-2f1c3b4a5d6e";
const BASE = `/family-groups/${FAMILY_GROUP_ID}/goals/${GOAL_ID}/contributions`;

type TenantMember = {
  id: string;
  userId: string;
  familyGroupId: string;
  role: Role;
};

const goalsServiceMock = {
  findAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  contribute: jest.fn(),
  listContributions: jest.fn(),
};

describe("GoalsController contributions (real ValidationPipe + AbilitiesGuard)", () => {
  let app: INestApplication;
  let member: TenantMember | null;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [GoalsController],
      providers: [
        CaslAbilityFactory,
        { provide: GoalsService, useValue: goalsServiceMock },
        { provide: APP_GUARD, useClass: AbilitiesGuard },
        ...fxTesting().providers,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    // Stand-in for TenantGuard.
    app.use((req: Request, _res: Response, next: NextFunction) => {
      req.tenantContext = member
        ? {
            userId: member.userId,
            familyGroupId: FAMILY_GROUP_ID,
            role: member.role,
            member,
          }
        : undefined;
      next();
    });
    // Must match apps/api/src/main.ts exactly.
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  function actAs(role: Role) {
    member = {
      id: `m-${role}`,
      userId: `u-${role}`,
      familyGroupId: FAMILY_GROUP_ID,
      role,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    goalsServiceMock.contribute.mockResolvedValue({
      contribution: { id: "contrib-1" },
      goal: { id: GOAL_ID },
    });
    goalsServiceMock.listContributions.mockResolvedValue([{ id: "contrib-1" }]);
    actAs(Role.owner);
  });

  it("owner POST with a valid body reaches the service with every field intact (201)", async () => {
    const occurredAt = "2026-09-20T00:00:00.000Z";
    const res = await request(app.getHttpServer())
      .post(BASE)
      .send({ amount: "250000", accountId: ACCOUNT_ID, occurredAt });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      contribution: { id: "contrib-1" },
      goal: { id: GOAL_ID },
    });
    expect(goalsServiceMock.contribute).toHaveBeenCalledWith(
      FAMILY_GROUP_ID,
      GOAL_ID,
      expect.objectContaining({
        amount: "250000",
        accountId: ACCOUNT_ID,
        occurredAt,
      }),
    );
  });

  it("owner POST without accountId (progress only) is accepted", async () => {
    const res = await request(app.getHttpServer())
      .post(BASE)
      .send({ amount: "1" });
    expect(res.status).toBe(201);
  });

  it.each([
    ["amount as a number", { amount: 250000 }],
    ["amount zero", { amount: "0" }],
    ["negative amount", { amount: "-5" }],
    ["decimal amount", { amount: "12.5" }],
    ["13-digit amount", { amount: "1000000000000" }],
    ["missing amount", {}],
    ["non-uuid accountId", { amount: "250000", accountId: "acc-1" }],
    ["non-date occurredAt", { amount: "250000", occurredAt: "kemarin" }],
  ])("400s on %s and never calls the service", async (_label, body) => {
    const res = await request(app.getHttpServer()).post(BASE).send(body);
    expect(res.status).toBe(400);
    expect(goalsServiceMock.contribute).not.toHaveBeenCalled();
  });

  it("admin_staff (read-only Goal) cannot contribute (403)", async () => {
    actAs(Role.admin_staff);
    const res = await request(app.getHttpServer())
      .post(BASE)
      .send({ amount: "250000" });
    expect(res.status).toBe(403);
    expect(goalsServiceMock.contribute).not.toHaveBeenCalled();
  });

  it("admin_staff can read the contribution history (200)", async () => {
    actAs(Role.admin_staff);
    const res = await request(app.getHttpServer()).get(BASE);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: "contrib-1" }]);
    expect(goalsServiceMock.listContributions).toHaveBeenCalledWith(
      FAMILY_GROUP_ID,
      GOAL_ID,
    );
  });

  it("dependant (no Goal grant) cannot read the history (403)", async () => {
    actAs(Role.dependant);
    const res = await request(app.getHttpServer()).get(BASE);
    expect(res.status).toBe(403);
    expect(goalsServiceMock.listContributions).not.toHaveBeenCalled();
  });
});
