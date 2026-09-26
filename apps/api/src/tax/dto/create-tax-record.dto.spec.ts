import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { CreateTaxRecordDto } from "./create-tax-record.dto";

// EPIC-024 Group E (E1 retry) — review gate HIGH finding: no test coverage
// for the numeric-string digit cap. `grossIncome`/`ptkp`/`netTax` land in a
// Postgres BigInt column; the previous `/^\d+$/` regex had no upper bound at
// all, so an unbounded digit string (e.g. a `String(1e21)`-style
// scientific-notation escape or a pasted 100-digit number) could reach
// persistence without ever tripping validation. These pin the 15-digit cap
// (MAX_TAX_DIGITS in create-tax-record.dto.ts, matching MAX_TAX_AMOUNT =
// 999_999_999_999_999 in pph21.dto.ts) at its exact boundary.
describe("CreateTaxRecordDto numeric-string boundary", () => {
  const MAX_DIGITS_VALUE = "999999999999999"; // 15 nines — the boundary value

  function baseDto(overrides: Partial<Record<string, unknown>> = {}) {
    return plainToInstance(CreateTaxRecordDto, {
      taxYear: 2024,
      grossIncome: "100000000",
      ptkp: "54000000",
      ...overrides,
    });
  }

  it("accepts grossIncome exactly at the 15-digit boundary", async () => {
    const dto = baseDto({ grossIncome: MAX_DIGITS_VALUE });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("rejects grossIncome above 15 digits", async () => {
    const dto = baseDto({ grossIncome: `1${MAX_DIGITS_VALUE}` }); // 16 digits
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.property).toBe("grossIncome");
    expect(errors[0]?.constraints).toHaveProperty("matches");
  });

  it("accepts ptkp exactly at the 15-digit boundary", async () => {
    const dto = baseDto({ ptkp: MAX_DIGITS_VALUE });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("rejects ptkp above 15 digits", async () => {
    const dto = baseDto({ ptkp: `1${MAX_DIGITS_VALUE}` }); // 16 digits
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.property).toBe("ptkp");
    expect(errors[0]?.constraints).toHaveProperty("matches");
  });

  it("accepts netTax exactly at the 15-digit boundary", async () => {
    const dto = baseDto({ netTax: MAX_DIGITS_VALUE });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("rejects netTax above 15 digits", async () => {
    const dto = baseDto({ netTax: `1${MAX_DIGITS_VALUE}` }); // 16 digits
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.property).toBe("netTax");
    expect(errors[0]?.constraints).toHaveProperty("matches");
  });

  it("rejects a scientific-notation-shaped string (never matches the digit-only pattern regardless of length)", async () => {
    const dto = baseDto({ grossIncome: "1e+21" });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.property).toBe("grossIncome");
    expect(errors[0]?.constraints).toHaveProperty("matches");
  });
});

// Carry-over (Task 5 → Task 8): ptkp is required unless maritalStatus is
// present — reject when both are absent instead of silently defaulting.
describe("CreateTaxRecordDto — ptkp required unless maritalStatus is present", () => {
  it("rejects when both ptkp and maritalStatus are absent", async () => {
    const dto = plainToInstance(CreateTaxRecordDto, {
      taxYear: 2026,
      grossIncome: "100000000",
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "ptkp")).toBe(true);
  });

  it("accepts when ptkp is given and maritalStatus is absent", async () => {
    const dto = plainToInstance(CreateTaxRecordDto, {
      taxYear: 2026,
      grossIncome: "100000000",
      ptkp: "54000000",
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("accepts when maritalStatus is given and ptkp is absent", async () => {
    const dto = plainToInstance(CreateTaxRecordDto, {
      taxYear: 2026,
      grossIncome: "100000000",
      maritalStatus: "TK",
      dependents: 0,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
