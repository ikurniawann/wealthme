import request from "supertest";

import { DonationsService } from "../donations/donations.service";
import { PrismaService } from "../prisma/prisma.service";

import { FinalTaxController } from "./final-tax.controller";
import { FinalTaxService } from "./final-tax.service";
import { InvestmentTaxController } from "./investment-tax.controller";
import { TaxController } from "./tax.controller";
import { TaxService } from "./tax.service";
import {
  FAMILY_GROUP_ID,
  buildTaxTestApp,
} from "./test-utils/tax-http-harness";

import type { INestApplication } from "@nestjs/common";

const prisma = {
  investment: { findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
  account: { findFirst: jest.fn() },
  taxFinalIncomeEntry: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  taxRecord: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

const donationsMock = { getTotalDeductibleAmount: jest.fn() };

describe("FinalTaxController / InvestmentTaxController", () => {
  let app: INestApplication;
  let setRole: (
    r: "owner" | "admin_staff" | "dependant" | "operational" | null,
  ) => void;

  beforeAll(async () => {
    ({ app, setRole } = await buildTaxTestApp({
      controllers: [FinalTaxController, InvestmentTaxController, TaxController],
      providers: [
        FinalTaxService,
        TaxService,
        { provide: PrismaService, useValue: prisma },
        { provide: DonationsService, useValue: donationsMock },
      ],
    }));
  });
  afterAll(() => app.close());
  beforeEach(() => {
    jest.clearAllMocks();
    setRole("owner");
  });

  it("GET /tax/final-tax is not swallowed by GET /tax/:id", async () => {
    prisma.investment.findMany.mockResolvedValue([]);
    prisma.taxFinalIncomeEntry.findMany.mockResolvedValue([]);
    const res = await request(app.getHttpServer()).get(
      `/family-groups/${FAMILY_GROUP_ID}/tax/final-tax?year=2026`,
    );
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ taxYear: 2026, lines: [], totalTax: "0" });
    expect(prisma.taxRecord.findUnique).not.toHaveBeenCalled();
  });

  it("admin_staff reads final-tax but cannot POST an entry; operational cannot read", async () => {
    prisma.investment.findMany.mockResolvedValue([]);
    prisma.taxFinalIncomeEntry.findMany.mockResolvedValue([]);
    const url = `/family-groups/${FAMILY_GROUP_ID}/tax`;
    setRole("admin_staff");
    await request(app.getHttpServer())
      .get(`${url}/final-tax?year=2026`)
      .expect(200);
    await request(app.getHttpServer())
      .post(`${url}/final-income`)
      .send({ instrument: "sewa", grossAmount: "1", occurredAt: "2026-01-01" })
      .expect(403);
    setRole("operational");
    await request(app.getHttpServer())
      .get(`${url}/final-tax?year=2026`)
      .expect(403);
  });

  it("investment-tax/estimate never includes manual entries", async () => {
    prisma.investment.findMany.mockResolvedValue([]);
    await request(app.getHttpServer())
      .get(
        `/family-groups/${FAMILY_GROUP_ID}/investment-tax/estimate?year=2026`,
      )
      .expect(200);
    expect(prisma.taxFinalIncomeEntry.findMany).not.toHaveBeenCalled();
  });

  it("year is required and bounded", async () => {
    await request(app.getHttpServer())
      .get(`/family-groups/${FAMILY_GROUP_ID}/tax/final-tax`)
      .expect(400);
    await request(app.getHttpServer())
      .get(`/family-groups/${FAMILY_GROUP_ID}/tax/final-tax?year=1999`)
      .expect(400);
  });

  it("POST final-income validates instrument and digits", async () => {
    await request(app.getHttpServer())
      .post(`/family-groups/${FAMILY_GROUP_ID}/tax/final-income`)
      .send({
        instrument: "bitcoin",
        grossAmount: "1",
        occurredAt: "2026-01-01",
      })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/family-groups/${FAMILY_GROUP_ID}/tax/final-income`)
      .send({ instrument: "sewa", grossAmount: "-1", occurredAt: "2026-01-01" })
      .expect(400);
  });

  it("PATCH investment-tax/:investmentId/profile sets the crypto exchange", async () => {
    prisma.investment.findFirst.mockResolvedValue({ id: "k", type: "kripto" });
    const res = await request(app.getHttpServer())
      .patch(`/family-groups/${FAMILY_GROUP_ID}/investment-tax/k/profile`)
      .send({ cryptoExchange: "luar_negeri" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      investmentId: "k",
      cryptoExchange: "luar_negeri",
    });
    setRole("dependant");
    const forbidden = await request(app.getHttpServer())
      .patch(`/family-groups/${FAMILY_GROUP_ID}/investment-tax/k/profile`)
      .send({ cryptoExchange: "luar_negeri" });
    expect(forbidden.status).toBe(403);
  });

  it("full CRUD on final-income entries", async () => {
    prisma.taxFinalIncomeEntry.create.mockResolvedValue({
      id: "e1",
      taxYear: 2026,
      instrument: "sewa",
      grossAmount: 1_000_000n,
      occurredAt: new Date("2025-12-31T17:00:00.000Z"),
      reinvested: false,
      rateBpsOverride: null,
      investmentId: null,
      accountId: null,
      notes: null,
    });
    const created = await request(app.getHttpServer())
      .post(`/family-groups/${FAMILY_GROUP_ID}/tax/final-income`)
      .send({
        instrument: "sewa",
        grossAmount: "1000000",
        occurredAt: "2026-01-01",
      });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ id: "e1", occurredAt: "2026-01-01" });

    prisma.taxFinalIncomeEntry.findFirst.mockResolvedValue({
      id: "e1",
      taxYear: 2026,
      instrument: "sewa",
      grossAmount: 1_000_000n,
      occurredAt: new Date("2025-12-31T17:00:00.000Z"),
      reinvested: false,
      rateBpsOverride: null,
      investmentId: null,
      accountId: null,
      notes: null,
    });
    prisma.taxFinalIncomeEntry.update.mockResolvedValue({
      id: "e1",
      taxYear: 2026,
      instrument: "sewa",
      grossAmount: 2_000_000n,
      occurredAt: new Date("2025-12-31T17:00:00.000Z"),
      reinvested: false,
      rateBpsOverride: null,
      investmentId: null,
      accountId: null,
      notes: null,
    });
    const updated = await request(app.getHttpServer())
      .patch(`/family-groups/${FAMILY_GROUP_ID}/tax/final-income/e1`)
      .send({ grossAmount: "2000000" });
    expect(updated.status).toBe(200);
    expect(updated.body.grossAmount).toBe("2000000");

    await request(app.getHttpServer())
      .delete(`/family-groups/${FAMILY_GROUP_ID}/tax/final-income/e1`)
      .expect(204);
  });

  // Task 10 date-prefill bug: the edit dialog used to always submit
  // `occurredAt: ""` when it couldn't prefill the stored date. Guard the
  // regression itself — an empty date must never silently overwrite the
  // stored one — rather than only the now-fixed prefill.
  it("PATCH with an empty occurredAt is rejected, not silently applied", async () => {
    prisma.taxFinalIncomeEntry.findFirst.mockResolvedValue({
      id: "e1",
      taxYear: 2026,
      instrument: "sewa",
      grossAmount: 1_000_000n,
      occurredAt: new Date("2025-12-31T17:00:00.000Z"),
      reinvested: false,
      rateBpsOverride: null,
      investmentId: null,
      accountId: null,
      notes: null,
    });
    const res = await request(app.getHttpServer())
      .patch(`/family-groups/${FAMILY_GROUP_ID}/tax/final-income/e1`)
      .send({ occurredAt: "" });
    expect(res.status).toBe(400);
    expect(prisma.taxFinalIncomeEntry.update).not.toHaveBeenCalled();
  });
});
