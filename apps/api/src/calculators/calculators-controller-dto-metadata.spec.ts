import "reflect-metadata";

import { ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";

import { CalculatorsController } from "./calculators.controller";
import { CalculatorsService } from "./calculators.service";
import {
  InvestmentCalcRequestDto,
  KprCalcRequestDto,
  RetirementCalcRequestDto,
} from "./dto/investment.dto";
import { PerpuluhanRequestDto } from "./dto/perpuluhan.dto";
import { Pph21RequestDto } from "./dto/pph21.dto";
import { ZakatRequestDto } from "./dto/zakat.dto";

import type { INestApplication } from "@nestjs/common";

// A type-only DTO import degrades design:paramtypes to Object, and the global
// ValidationPipe({ whitelist: true }) then strips every field from the body.
function paramTypesOf(method: string): unknown[] {
  const types = Reflect.getMetadata(
    "design:paramtypes",
    CalculatorsController.prototype,
    method,
  ) as unknown[] | undefined;
  if (!types) throw new Error(`no design:paramtypes for ${method}()`);
  return types;
}

describe("CalculatorsController — request DTOs survive to runtime", () => {
  it.each([
    ["calculateZakat", ZakatRequestDto],
    ["calculatePerpuluhan", PerpuluhanRequestDto],
    ["calculatePph21", Pph21RequestDto],
    ["calculateInvestment", InvestmentCalcRequestDto],
    ["calculateKpr", KprCalcRequestDto],
    ["calculateRetirement", RetirementCalcRequestDto],
  ])("%s() still receives its DTO class", (method, dto) => {
    const types = paramTypesOf(method as string);
    expect(types).toContain(dto);
    expect(types).not.toContain(Object);
  });
});

describe("CalculatorsController over HTTP with the production ValidationPipe", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [CalculatorsController],
      providers: [CalculatorsService],
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

  it("zakat: 100 jt cash above nisab yields zakatable 100 jt and zakat 2.5 jt", async () => {
    const res = await request(app.getHttpServer())
      .post("/calculators/zakat")
      .send({
        cash: 100_000_000,
        investments: 0,
        gold: 0,
        liabilities: 0,
        haulConfirmed: true,
      })
      .expect(200);

    expect(res.body.zakatable).toBe(100_000_000);
    expect(res.body.zakat).toBe(2_500_000);
    expect(res.body.isObligated).toBe(true);
  });

  it("pph21: 100 jt/year gross with TK/0 PTKP yields a positive tax", async () => {
    const res = await request(app.getHttpServer())
      .post("/calculators/pph21")
      .send({ grossIncome: 100_000_000, zakatPaid: 0, ptkp: 54_000_000 })
      .expect(200);

    expect(res.body.grossIncome).toBe(100_000_000);
    expect(res.body.totalTax).toBeGreaterThan(0);
  });
});
