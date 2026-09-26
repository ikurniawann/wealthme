import request from "supertest";

import { DonationsService } from "../donations/donations.service";
import { PrismaService } from "../prisma/prisma.service";

import { FinalTaxService } from "./final-tax.service";
import { TaxSummaryService } from "./tax-summary.service";
import { TaxYearController } from "./tax-year.controller";
import { TaxController } from "./tax.controller";
import { TaxService } from "./tax.service";
import {
  FAMILY_GROUP_ID,
  buildTaxTestApp,
} from "./test-utils/tax-http-harness";
import { UmkmYearService } from "./umkm-year.service";

import type { INestApplication } from "@nestjs/common";

const prisma = {
  taxRecord: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  taxUmkmYear: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  investment: { findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
  account: { findFirst: jest.fn() },
  taxFinalIncomeEntry: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

const donationsMock = { getTotalDeductibleAmount: jest.fn() };

const OMZET_70JT = Array.from({ length: 12 }, () => "70000000");

describe("TaxYearController", () => {
  let app: INestApplication;
  let setRole: (
    r: "owner" | "admin_staff" | "dependant" | "operational" | null,
  ) => void;

  beforeAll(async () => {
    ({ app, setRole } = await buildTaxTestApp({
      controllers: [TaxYearController, TaxController],
      providers: [
        TaxService,
        FinalTaxService,
        UmkmYearService,
        TaxSummaryService,
        { provide: PrismaService, useValue: prisma },
        { provide: DonationsService, useValue: donationsMock },
      ],
    }));
  });
  afterAll(() => app.close());
  beforeEach(() => {
    jest.clearAllMocks();
    setRole("owner");
    donationsMock.getTotalDeductibleAmount.mockResolvedValue(0n);
    prisma.investment.findMany.mockResolvedValue([]);
    prisma.taxFinalIncomeEntry.findMany.mockResolvedValue([]);
  });

  it("GET /tax/summary?year=2026 uses the familyGroupId_taxYear key, not { id: 'summary' }", async () => {
    prisma.taxRecord.findUnique.mockResolvedValue(null);
    prisma.taxUmkmYear.findUnique.mockResolvedValue(null);
    const res = await request(app.getHttpServer()).get(
      `/family-groups/${FAMILY_GROUP_ID}/tax/summary?year=2026`,
    );
    expect(res.status).toBe(200);
    expect(prisma.taxRecord.findUnique).toHaveBeenCalledWith({
      where: {
        familyGroupId_taxYear: {
          familyGroupId: FAMILY_GROUP_ID,
          taxYear: 2026,
        },
      },
    });
  });

  it("PUT /tax/umkm/2026 with 12x 70.000.000 saves and returns totalTax 1.700.000", async () => {
    prisma.taxUmkmYear.upsert.mockResolvedValue({});
    const res = await request(app.getHttpServer())
      .put(`/family-groups/${FAMILY_GROUP_ID}/tax/umkm/2026`)
      .send({ monthlyOmzet: OMZET_70JT });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ totalTax: "1700000", saved: true });
    const upsertArgs = prisma.taxUmkmYear.upsert.mock.calls[0][0];
    expect(
      upsertArgs.create.omzetByMonth.every(
        (v: unknown) => typeof v === "bigint",
      ),
    ).toBe(true);
  });

  it("admin_staff cannot PUT umkm but can GET it", async () => {
    setRole("admin_staff");
    prisma.taxUmkmYear.findUnique.mockResolvedValue(null);
    const put = await request(app.getHttpServer())
      .put(`/family-groups/${FAMILY_GROUP_ID}/tax/umkm/2026`)
      .send({ monthlyOmzet: OMZET_70JT });
    const get = await request(app.getHttpServer()).get(
      `/family-groups/${FAMILY_GROUP_ID}/tax/umkm/2026`,
    );
    expect(put.status).toBe(403);
    expect(get.status).toBe(200);
  });

  it("PUT /tax/umkm/1999 is rejected (year out of range)", async () => {
    const res = await request(app.getHttpServer())
      .put(`/family-groups/${FAMILY_GROUP_ID}/tax/umkm/1999`)
      .send({ monthlyOmzet: OMZET_70JT });
    expect(res.status).toBe(400);
  });

  it("PUT /tax/umkm/2026 with 11 months is rejected", async () => {
    const res = await request(app.getHttpServer())
      .put(`/family-groups/${FAMILY_GROUP_ID}/tax/umkm/2026`)
      .send({ monthlyOmzet: OMZET_70JT.slice(0, 11) });
    expect(res.status).toBe(400);
  });

  it("POST /tax with neither maritalStatus nor ptkp is rejected", async () => {
    const res = await request(app.getHttpServer())
      .post(`/family-groups/${FAMILY_GROUP_ID}/tax`)
      .send({ taxYear: 2026, grossIncome: "0" });
    expect(res.status).toBe(400);
  });

  it("POST /tax with maritalStatus K and dependents 5 is rejected", async () => {
    const res = await request(app.getHttpServer())
      .post(`/family-groups/${FAMILY_GROUP_ID}/tax`)
      .send({
        taxYear: 2026,
        grossIncome: "0",
        maritalStatus: "K",
        dependents: 5,
      });
    expect(res.status).toBe(400);
  });
});
