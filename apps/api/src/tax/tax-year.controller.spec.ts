import request from "supertest";

import { DonationsService } from "../donations/donations.service";
import { PrismaService } from "../prisma/prisma.service";

import { FinalTaxService } from "./final-tax.service";
import { TaxExportService } from "./tax-export.service";
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
  familyGroup: { findUnique: jest.fn() },
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
        TaxExportService,
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

  // Hardening batch G2 — "Unduh Ringkasan" used to only toast "belum
  // tersedia"; these are the real CSV/PDF exports of the same summary.
  describe("GET /tax/summary/csv and /tax/summary/pdf", () => {
    beforeEach(() => {
      prisma.taxRecord.findUnique.mockResolvedValue(null);
      prisma.taxUmkmYear.findUnique.mockResolvedValue(null);
      prisma.familyGroup.findUnique.mockResolvedValue({ name: "Keluarga Uji" });
    });

    it("downloads a CSV attachment with the summary rows", async () => {
      const res = await request(app.getHttpServer()).get(
        `/family-groups/${FAMILY_GROUP_ID}/tax/summary/csv?year=2026`,
      );
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/csv");
      expect(res.headers["content-disposition"]).toContain(
        "ringkasan-pajak-2026.csv",
      );
      expect(res.text).toContain("Total Estimasi Pajak");
    });

    it("downloads a PDF attachment", async () => {
      const res = await request(app.getHttpServer())
        .get(`/family-groups/${FAMILY_GROUP_ID}/tax/summary/pdf?year=2026`)
        .buffer(true)
        .parse((response, callback) => {
          const chunks: Buffer[] = [];
          response.on("data", (chunk: Buffer) => chunks.push(chunk));
          response.on("end", () => callback(null, Buffer.concat(chunks)));
        });
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toBe("application/pdf");
      expect(res.headers["content-disposition"]).toContain(
        "ringkasan-pajak-2026.pdf",
      );
      // %PDF is the real PDF magic header — proves pdf-lib actually rendered
      // a document rather than returning a stub/placeholder.
      expect((res.body as Buffer).subarray(0, 4).toString()).toBe("%PDF");
    });
  });
});
