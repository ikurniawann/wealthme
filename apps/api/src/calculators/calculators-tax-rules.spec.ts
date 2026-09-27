import request from "supertest";

import { buildTaxTestApp } from "../tax/test-utils/tax-http-harness";

import { CalculatorsController } from "./calculators.controller";
import { CalculatorsService } from "./calculators.service";

import type { INestApplication } from "@nestjs/common";

describe("public tax-rule + PPN calculators", () => {
  let app: INestApplication;
  beforeAll(async () => {
    ({ app } = await buildTaxTestApp({
      controllers: [CalculatorsController],
      providers: [CalculatorsService],
    }));
  });
  afterAll(() => app.close());

  it("GET /calculators/tax-rules returns refs for the asked keys at a date", async () => {
    const res = await request(app.getHttpServer()).get(
      "/calculators/tax-rules?date=2025-07-31&keys=final.cryptoDomestic,ppn.rate",
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      expect.objectContaining({
        key: "final.cryptoDomestic",
        effectiveFrom: "2022-05-01",
        verified: false,
      }),
      expect.objectContaining({
        key: "ppn.rate",
        effectiveFrom: "2025-02-01",
        verified: true,
      }),
    ]);
  });

  it("serves rule values with BigInt as digit strings", async () => {
    const res = await request(app.getHttpServer()).get(
      "/calculators/tax-rules?date=2026-09-26&keys=final.savingsInterest",
    );
    expect(res.body[0]).toMatchObject({
      key: "final.savingsInterest",
      verified: false,
      value: { rateBps: 2000, minPrincipal: "7500000" },
    });
  });

  it("unknown key or malformed date → 400", async () => {
    expect(
      (
        await request(app.getHttpServer()).get(
          "/calculators/tax-rules?keys=nope",
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app.getHttpServer()).get(
          "/calculators/tax-rules?date=2025-7-1",
        )
      ).status,
    ).toBe(400);
  });

  it("POST /calculators/ppn: luxury on 2025-02-01 → 120.000; non-luxury → 110.000", async () => {
    const lux = await request(app.getHttpServer())
      .post("/calculators/ppn")
      .send({
        date: "2025-02-01",
        amount: "1000000",
        luxury: true,
        priceIncludesPpn: false,
      });
    expect(lux.status).toBe(200);
    expect(lux.body).toMatchObject({ ppn: "120000", effectiveBps: 1200 });
    const std = await request(app.getHttpServer())
      .post("/calculators/ppn")
      .send({
        date: "2026-09-26",
        amount: "1000000",
        luxury: false,
        priceIncludesPpn: false,
      });
    expect(std.body).toMatchObject({
      ppn: "110000",
      dpp: "916667",
      effectiveBps: 1100,
    });
  });
});
