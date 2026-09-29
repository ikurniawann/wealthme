import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { SetManualPriceDto } from "./set-manual-price.dto";

/**
 * Hardening audit (validation, HIGH) — `@IsNumberString()` alone accepted a
 * negative price and an unbounded digit count. Negative rejection is
 * enforced in `investments.service.ts` (`assertValidManualPrice`); this
 * class now also bounds the shape itself.
 */
describe("SetManualPriceDto.price", () => {
  it("accepts a plain positive integer string", async () => {
    const dto = plainToInstance(SetManualPriceDto, { price: "15250" });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("accepts a bounded decimal string", async () => {
    const dto = plainToInstance(SetManualPriceDto, { price: "15250.00" });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("rejects a negative price at the DTO shape level", async () => {
    const dto = plainToInstance(SetManualPriceDto, { price: "-15250" });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "price")).toBe(true);
  });

  it("rejects a non-numeric price", async () => {
    const dto = plainToInstance(SetManualPriceDto, { price: "abc" });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "price")).toBe(true);
  });

  it("rejects more than 15 integer digits", async () => {
    const dto = plainToInstance(SetManualPriceDto, {
      price: "1".repeat(16),
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "price")).toBe(true);
  });

  it("rejects more than 6 decimal places", async () => {
    const dto = plainToInstance(SetManualPriceDto, { price: "1.1234567" });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "price")).toBe(true);
  });
});
