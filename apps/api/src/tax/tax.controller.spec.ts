/**
 * EPIC-023 Task I (I1) — diagnosis harness for the reported Tax Center
 * "Gagal menyimpan data pajak" failure.
 *
 * The web toast (apps/web/src/app/(app)/tax/page.tsx:144) fires on ANY
 * rejection of `POST /family-groups/:familyGroupId/tax`, so reproducing the
 * report means driving that exact request over HTTP with the real
 * `ValidationPipe` (matching main.ts), the real `AbilitiesGuard` +
 * `CaslAbilityFactory`, and the real `TaxService`. Only Prisma and
 * `DonationsService` are stubbed — everything the request actually passes
 * through on the way to the database is genuine.
 */
import "reflect-metadata";

import { ValidationPipe } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { Role } from "@prisma/client";
import request from "supertest";

import { CaslAbilityFactory } from "../casl/casl-ability.factory";
import { AbilitiesGuard } from "../common/guards/abilities.guard";
import { DonationsService } from "../donations/donations.service";
import { PrismaService } from "../prisma/prisma.service";

import { TaxController } from "./tax.controller";
import { TaxService } from "./tax.service";

import type { INestApplication } from "@nestjs/common";
import type { Request, Response, NextFunction } from "express";

const FAMILY_GROUP_ID = "fg-1";
const CURRENT_YEAR = new Date().getFullYear();

// TS review fix (HIGH 3) — this was missing `familyGroupId`, which the real
// `TenantContext.member` shape (common/types/tenant-context.ts) requires.
// apps/api's *.spec.ts files are excluded from tsconfig.json and ts-jest runs
// transpile-only (isolatedModules, from packages/config/tsconfig.base.json),
// so a mismatch like this compiles and passes silently — see the epic's
// Automation Log for the recorded gap; do not "fix" the tsconfig/ts-jest
// setup here, that is its own piece of work.
type TenantMember = {
  id: string;
  userId: string;
  familyGroupId: string;
  role: Role;
};

const prismaMock = {
  taxRecord: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

const donationsMock = {
  getTotalDeductibleAmount: jest.fn(),
};

function taxRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "tax-1",
    familyGroupId: FAMILY_GROUP_ID,
    taxYear: CURRENT_YEAR,
    grossIncome: BigInt(0),
    ptkp: BigInt(54_000_000),
    zakatDeduction: BigInt(0),
    netTax: BigInt(0),
    sptStatus: "belum_lapor",
    documentUrl: null,
    notes: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("TaxController — POST /family-groups/:familyGroupId/tax (real pipe + guard + service)", () => {
  let app: INestApplication;
  let member: TenantMember | null;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TaxController],
      providers: [
        TaxService,
        CaslAbilityFactory,
        { provide: PrismaService, useValue: prismaMock },
        { provide: DonationsService, useValue: donationsMock },
        { provide: APP_GUARD, useClass: AbilitiesGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    // Stand in for TenantGuard, which has already resolved the caller's
    // Member row by the time AbilitiesGuard runs.
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

  beforeEach(() => {
    jest.clearAllMocks();
    donationsMock.getTotalDeductibleAmount.mockResolvedValue(BigInt(0));
    prismaMock.taxRecord.upsert.mockResolvedValue(taxRow());
    prismaMock.taxRecord.findMany.mockResolvedValue([taxRow()]);
    member = {
      id: "m-owner",
      userId: "u-owner",
      familyGroupId: FAMILY_GROUP_ID,
      role: Role.owner,
    };
  });

  /** The exact body apps/web .../tax/page.tsx `handleSaveTaxRecord` builds. */
  function webSavePayload() {
    return {
      taxYear: CURRENT_YEAR,
      grossIncome: "0",
      ptkp: "54000000",
      netTax: "0",
    };
  }

  function post(body: unknown) {
    return request(app.getHttpServer())
      .post(`/family-groups/${FAMILY_GROUP_ID}/tax`)
      .send(body);
  }

  describe("payload the Tax Center actually sends", () => {
    it("owner saving the untouched calculator (all zeroes) succeeds", async () => {
      const res = await post(webSavePayload());
      expect(res.status).toBe(201);
    });

    it("owner saving a typed-in gross income succeeds", async () => {
      const res = await post({
        taxYear: CURRENT_YEAR,
        grossIncome: "250000000",
        ptkp: "63000000",
        netTax: "20800000",
      });
      expect(res.status).toBe(201);
    });
  });

  // These four cases are the canonical role→grant contract for TaxRecord.
  // `TAX_MANAGE_ROLES` in apps/web/src/app/(app)/tax/page.tsx is a
  // hand-maintained mirror of the same grant, for deciding whether to offer
  // the Save/SPT-status controls — it is NOT imported or asserted against
  // here, so changing the grants in casl-ability.factory.ts fails this block
  // but does not itself fail anything on the web constant; update it by hand.
  describe("role gate — who may save", () => {
    it("REGRESSION: admin_staff can READ the tax page but POST is refused", async () => {
      member = {
        id: "m-staff",
        userId: "u-staff",
        familyGroupId: FAMILY_GROUP_ID,
        role: Role.admin_staff,
      };

      const read = await request(app.getHttpServer()).get(
        `/family-groups/${FAMILY_GROUP_ID}/tax`,
      );
      const write = await post(webSavePayload());

      expect(read.status).toBe(200);
      expect(write.status).toBe(403);
    });

    it("REGRESSION: dependant is refused both read and save", async () => {
      member = {
        id: "m-kid",
        userId: "u-kid",
        familyGroupId: FAMILY_GROUP_ID,
        role: Role.dependant,
      };

      const read = await request(app.getHttpServer()).get(
        `/family-groups/${FAMILY_GROUP_ID}/tax`,
      );
      const write = await post(webSavePayload());

      expect(read.status).toBe(403);
      expect(write.status).toBe(403);
    });

    it("REGRESSION: operational is refused both read and save", async () => {
      member = {
        id: "m-ops",
        userId: "u-ops",
        familyGroupId: FAMILY_GROUP_ID,
        role: Role.operational,
      };

      const read = await request(app.getHttpServer()).get(
        `/family-groups/${FAMILY_GROUP_ID}/tax`,
      );
      const write = await post(webSavePayload());

      expect(read.status).toBe(403);
      expect(write.status).toBe(403);
    });

    it("spouse and member may save", async () => {
      for (const role of [Role.spouse, Role.member]) {
        member = {
          id: `m-${role}`,
          userId: `u-${role}`,
          familyGroupId: FAMILY_GROUP_ID,
          role,
        };
        const res = await post(webSavePayload());
        expect([role, res.status]).toEqual([role, 201]);
      }
    });
  });
});
