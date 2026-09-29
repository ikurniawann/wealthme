import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { InvestmentCalcRequestDto, KprCalcRequestDto } from "./investment.dto";
import { PerpuluhanRequestDto } from "./perpuluhan.dto";
import { ZakatRequestDto } from "./zakat.dto";

/**
 * Hardening audit (validation, MEDIUM) — public `@Public` calculator
 * endpoints had `@Min(0)` with no `@Max`, unlike pph21.dto.ts.
 */
describe("Calculator DTOs — MEDIUM Max bound", () => {
  it("ZakatRequestDto rejects an absurdly large cash value", async () => {
    const dto = plainToInstance(ZakatRequestDto, {
      cash: 1e30,
      investments: 0,
      gold: 0,
      liabilities: 0,
      haulConfirmed: true,
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "cash")).toBe(true);
  });

  it("PerpuluhanRequestDto rejects an absurdly large income", async () => {
    const dto = plainToInstance(PerpuluhanRequestDto, { income: 1e30 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "income")).toBe(true);
  });

  it("InvestmentCalcRequestDto rejects an absurd rate/years", async () => {
    const dto = plainToInstance(InvestmentCalcRequestDto, {
      pv: 0,
      pmt: 0,
      rate: 1e9,
      years: 1e9,
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "rate")).toBe(true);
    expect(errors.some((e) => e.property === "years")).toBe(true);
  });

  it("KprCalcRequestDto rejects an absurd principal", async () => {
    const dto = plainToInstance(KprCalcRequestDto, {
      principal: 1e30,
      annualRate: 0.07,
      years: 15,
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "principal")).toBe(true);
  });

  it("KprCalcRequestDto accepts realistic values", async () => {
    const dto = plainToInstance(KprCalcRequestDto, {
      principal: 500_000_000,
      annualRate: 0.07,
      years: 15,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
