import "reflect-metadata";

import { ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";

import { DonationsController } from "./donations.controller";
import { DonationsService } from "./donations.service";

import type { INestApplication } from "@nestjs/common";

const FG = "fg-1";

describe("DonationsController — GET deductible-total", () => {
  let app: INestApplication;
  const service = {
    getTotalDeductibleAmount: jest.fn(),
    findOne: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [DonationsController],
      providers: [{ provide: DonationsService, useValue: service }],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("returns the deductible total for the requested year as a string", async () => {
    service.getTotalDeductibleAmount.mockResolvedValue(BigInt(2_500_000));

    const res = await request(app.getHttpServer())
      .get(`/family-groups/${FG}/donations/deductible-total?year=2026`)
      .expect(200);

    expect(res.body).toEqual({ year: 2026, total: "2500000" });
    expect(service.getTotalDeductibleAmount).toHaveBeenCalledWith(FG, 2026);
    expect(service.findOne).not.toHaveBeenCalled();
  });

  it("defaults to the current calendar year when year is omitted", async () => {
    service.getTotalDeductibleAmount.mockResolvedValue(BigInt(0));
    const year = new Date().getFullYear();

    const res = await request(app.getHttpServer())
      .get(`/family-groups/${FG}/donations/deductible-total`)
      .expect(200);

    expect(res.body).toEqual({ year, total: "0" });
    expect(service.getTotalDeductibleAmount).toHaveBeenCalledWith(FG, year);
  });

  it.each(["abc", "1999", "2101", "2026.5"])(
    "rejects year=%s with 400",
    async (year) => {
      await request(app.getHttpServer())
        .get(`/family-groups/${FG}/donations/deductible-total?year=${year}`)
        .expect(400);
      expect(service.getTotalDeductibleAmount).not.toHaveBeenCalled();
    },
  );
});
