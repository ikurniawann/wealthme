import request from "supertest";

import { TaxPreviewController } from "./tax-preview.controller";
import {
  FAMILY_GROUP_ID,
  buildTaxTestApp,
} from "./test-utils/tax-http-harness";

import type { INestApplication } from "@nestjs/common";

const base = `/family-groups/${FAMILY_GROUP_ID}/tax`;
const twelve = (v: string) => Array.from({ length: 12 }, () => v);

describe("TaxPreviewController", () => {
  let app: INestApplication;
  let setRole: (
    r: "owner" | "admin_staff" | "dependant" | "operational" | null,
  ) => void;

  beforeAll(async () => {
    ({ app, setRole } = await buildTaxTestApp({
      controllers: [TaxPreviewController],
      providers: [],
    }));
  });
  afterAll(() => app.close());
  beforeEach(() => setRole("owner"));

  const post = (path: string, body: unknown) =>
    request(app.getHttpServer()).post(`${base}/${path}`).send(body);

  it("PPh OP preview: K/1 120jt, pension 3,6jt, zakat 2,5jt → tax 2.245.000 with rules", async () => {
    const res = await post("pph-op/preview", {
      taxYear: 2026,
      maritalStatus: "K",
      dependents: 1,
      employmentGross: "120000000",
      pensionContribution: "3600000",
      zakat: "2500000",
      withheldPph21: "2000000",
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      ptkp: "63000000",
      pkp: "44900000",
      tax: "2245000",
      balance: "245000",
    });
    expect(res.body.brackets[0]).toMatchObject({
      rateBps: 500,
      label: "0 – 60 Juta",
      taxable: "44900000",
      tax: "2245000",
    });
    expect(
      res.body.rules.some(
        (r: { key: string; verified: boolean }) =>
          r.key === "pph.pasal17" && r.verified === false,
      ),
    ).toBe(true);
  });

  it("PPh OP preview rejects dependents=4 and a float gross", async () => {
    expect(
      (
        await post("pph-op/preview", {
          taxYear: 2026,
          maritalStatus: "K",
          dependents: 4,
          employmentGross: "1",
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await post("pph-op/preview", {
          taxYear: 2026,
          maritalStatus: "K",
          dependents: 0,
          employmentGross: "1.5",
        })
      ).status,
    ).toBe(400);
  });

  it("PPh OP preview requires nppnRateBps when freelanceGross > 0", async () => {
    const res = await post("pph-op/preview", {
      taxYear: 2026,
      maritalStatus: "TK",
      dependents: 0,
      employmentGross: "0",
      freelanceGross: "600000000",
    });
    expect(res.status).toBe(400);
  });

  it("PPh OP preview rejects NPPN above the Rp4,8 miliar turnover ceiling", async () => {
    const res = await post("pph-op/preview", {
      taxYear: 2026,
      maritalStatus: "TK",
      dependents: 0,
      employmentGross: "0",
      freelanceGross: "5000000000",
      nppnRateBps: 5000,
    });
    expect(res.status).toBe(400);
  });

  it("PPh OP preview accepts NPPN exactly at the Rp4,8 miliar ceiling", async () => {
    const res = await post("pph-op/preview", {
      taxYear: 2026,
      maritalStatus: "TK",
      dependents: 0,
      employmentGross: "0",
      freelanceGross: "4800000000",
      nppnRateBps: 5000,
    });
    expect(res.status).toBe(200);
  });

  it("TER preview: refund case returns a negative December as a string", async () => {
    const res = await post("ter/preview", {
      taxYear: 2026,
      maritalStatus: "TK",
      dependents: 0,
      monthlyGross: [
        "50000000",
        ...Array.from({ length: 11 }, () => "10000000"),
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      december: "-2000000",
      isRefund: true,
      withheldJanNov: "11000000",
    });
    expect(res.body.months).toHaveLength(12);
  });

  it("TER preview for 2023 is 422 (TER starts 2024)", async () => {
    expect(
      (
        await post("ter/preview", {
          taxYear: 2023,
          maritalStatus: "TK",
          dependents: 0,
          monthlyGross: twelve("1"),
        })
      ).status,
    ).toBe(422);
  });

  it("TER preview needs exactly 12 months", async () => {
    expect(
      (
        await post("ter/preview", {
          taxYear: 2026,
          maritalStatus: "TK",
          dependents: 0,
          monthlyGross: ["1"],
        })
      ).status,
    ).toBe(400);
  });

  it("TER preview with DTP profile flags eligibility per month", async () => {
    const res = await post("ter/preview", {
      taxYear: 2026,
      maritalStatus: "TK",
      dependents: 0,
      monthlyGross: twelve("10000000"),
      dtp: {
        sector: "tekstil_pakaian",
        employment: "permanent",
        nikValidated: true,
      },
    });
    expect(res.body.months[0].dtp).toEqual({
      eligible: true,
      reasons: [],
      amount: "200000",
    });
  });

  it("TER preview: fixedMonthlyGross keeps a March THR bonus DTP-eligible", async () => {
    const gross = twelve("8000000").map((v, i) => (i === 2 ? "13000000" : v));
    const res = await post("ter/preview", {
      taxYear: 2026,
      maritalStatus: "TK",
      dependents: 0,
      monthlyGross: gross,
      monthlyFixedGross: twelve("8000000"),
      dtp: {
        sector: "tekstil_pakaian",
        employment: "permanent",
        nikValidated: true,
      },
    });
    expect(res.status).toBe(200);
    expect(res.body.months[2].dtp.eligible).toBe(true);
  });

  it("UMKM preview: 12 × 70jt → 1.700.000, saved=false", async () => {
    const res = await post("umkm/preview", {
      taxYear: 2026,
      monthlyOmzet: twelve("70000000"),
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      totalTax: "1700000",
      saved: false,
      exceedsCeiling: false,
    });
  });

  it("admin_staff may preview (read); dependant and operational may not", async () => {
    const body = {
      taxYear: 2026,
      maritalStatus: "TK",
      dependents: 0,
      employmentGross: "1",
    };
    setRole("admin_staff");
    expect((await post("pph-op/preview", body)).status).toBe(200);
    setRole("dependant");
    expect((await post("pph-op/preview", body)).status).toBe(403);
    setRole("operational");
    expect((await post("pph-op/preview", body)).status).toBe(403);
  });
});
