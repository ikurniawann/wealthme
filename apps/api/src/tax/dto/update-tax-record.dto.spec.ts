import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { UpdateTaxRecordDto } from "./update-tax-record.dto";

/**
 * Hardening audit (validation, HIGH) — `grossIncome`/`ptkp`/`netTax` used a
 * raw `/^\d+$/` with no digit cap, unlike `create-tax-record.dto.ts` which
 * uses the 15-digit-bounded `TAX_DIGITS` pattern for the same fields — a
 * PATCH could write an unbounded numeric string that overflows the BigInt
 * column. Mirrors create-tax-record.dto.spec.ts's boundary coverage.
 */
describe("UpdateTaxRecordDto numeric-string boundary (mirrors create)", () => {
  const MAX_DIGITS_VALUE = "999999999999999"; // 15 nines — the boundary value

  it.each(["grossIncome", "ptkp", "netTax"] as const)(
    "accepts %s exactly at the 15-digit boundary",
    async (field) => {
      const dto = plainToInstance(UpdateTaxRecordDto, {
        [field]: MAX_DIGITS_VALUE,
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === field)).toBe(false);
    },
  );

  it.each(["grossIncome", "ptkp", "netTax"] as const)(
    "rejects %s above 15 digits",
    async (field) => {
      const dto = plainToInstance(UpdateTaxRecordDto, {
        [field]: `1${MAX_DIGITS_VALUE}`, // 16 digits
      });
      const errors = await validate(dto);
      const err = errors.find((e) => e.property === field);
      expect(err).toBeDefined();
      expect(err?.constraints).toHaveProperty("matches");
    },
  );
});
