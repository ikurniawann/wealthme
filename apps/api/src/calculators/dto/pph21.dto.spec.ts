import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { MAX_TAX_AMOUNT, Pph21RequestDto, PTKP_VALUES } from "./pph21.dto";

// TS review fix (MEDIUM #3) — /calculators/pph21 is @Public() (no auth
// guard), so `ptkp` must be whitelisted to the 5 legal UU HPP values
// instead of accepting an arbitrary number.
describe("Pph21RequestDto validation", () => {
  it("passes without a ptkp (defaults to TK/0 server-side)", async () => {
    const dto = plainToInstance(Pph21RequestDto, { grossIncome: 100_000_000 });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it.each(PTKP_VALUES)("passes with the legal ptkp value %d", async (ptkp) => {
    const dto = plainToInstance(Pph21RequestDto, {
      grossIncome: 100_000_000,
      ptkp,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  // Review fix round 1 (Important #2) — PTKP_VALUES used to be a hardcoded
  // 5-value list (TK/0..K/3), so every K/I (istri penghasilan digabung)
  // household — whose PTKP starts at 112.500.000 — was rejected by this
  // public endpoint. PTKP_VALUES is now derived from the registry via
  // ptkpFor for every marital-status × dependents combination.
  it("accepts the K/I/2 PTKP value (112.500.000 + 2×4.500.000 = 121.500.000)", async () => {
    const dto = plainToInstance(Pph21RequestDto, {
      grossIncome: 200_000_000,
      ptkp: 121_500_000,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("rejects a ptkp value outside the legal UU HPP thresholds", async () => {
    const dto = plainToInstance(Pph21RequestDto, {
      grossIncome: 100_000_000,
      ptkp: 999_000_000,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.property).toBe("ptkp");
    expect(errors[0]?.constraints).toHaveProperty("isIn");
  });

  it("rejects a negative ptkp value", async () => {
    const dto = plainToInstance(Pph21RequestDto, {
      grossIncome: 100_000_000,
      ptkp: -54_000_000,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.property).toBe("ptkp");
  });

  // Review gate retry (HIGH #1) — /calculators/pph21 is @Public(), and
  // grossIncome/zakatPaid ultimately land in TaxRecord's BigInt columns.
  // `@Max(MAX_TAX_AMOUNT)` closes the gap where an unbounded number could
  // round-trip through JS's exponential `Number#toString` (>= 1e21).
  it("accepts grossIncome exactly at MAX_TAX_AMOUNT (the boundary)", async () => {
    const dto = plainToInstance(Pph21RequestDto, {
      grossIncome: MAX_TAX_AMOUNT,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("rejects grossIncome one above MAX_TAX_AMOUNT", async () => {
    const dto = plainToInstance(Pph21RequestDto, {
      grossIncome: MAX_TAX_AMOUNT + 1,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.property).toBe("grossIncome");
    expect(errors[0]?.constraints).toHaveProperty("max");
  });

  it("accepts zakatPaid exactly at MAX_TAX_AMOUNT (the boundary)", async () => {
    const dto = plainToInstance(Pph21RequestDto, {
      grossIncome: 100_000_000,
      zakatPaid: MAX_TAX_AMOUNT,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("rejects zakatPaid above MAX_TAX_AMOUNT", async () => {
    const dto = plainToInstance(Pph21RequestDto, {
      grossIncome: 100_000_000,
      zakatPaid: MAX_TAX_AMOUNT + 1,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.property).toBe("zakatPaid");
    expect(errors[0]?.constraints).toHaveProperty("max");
  });
});
