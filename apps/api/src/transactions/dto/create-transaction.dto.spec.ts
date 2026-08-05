import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { CreateTransactionDto } from "./create-transaction.dto";

// EPIC-021 Group B (#23/#27/#28) — validation for the new transfer fields.
// RFC4122-shaped UUIDs (version nibble 4, variant nibble 8) — class-validator's
// @IsUUID() rejects non-RFC-shaped strings like all-"1" placeholders.
const BASE = {
  accountId: "11111111-1111-4111-8111-111111111111",
  amount: 50000,
  type: "expense",
  occurredAt: new Date().toISOString(),
};

describe("CreateTransactionDto validation", () => {
  it("passes with the pre-existing income/expense shape (no toAccountId/adminFee)", async () => {
    const dto = plainToInstance(CreateTransactionDto, BASE);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("passes when toAccountId is a valid UUID and adminFee is a positive integer", async () => {
    const dto = plainToInstance(CreateTransactionDto, {
      ...BASE,
      type: "transfer",
      toAccountId: "22222222-2222-4222-8222-222222222222",
      adminFee: 2500,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("passes when adminFee is exactly 0", async () => {
    const dto = plainToInstance(CreateTransactionDto, {
      ...BASE,
      adminFee: 0,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("fails when adminFee is negative", async () => {
    const dto = plainToInstance(CreateTransactionDto, {
      ...BASE,
      adminFee: -1,
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "adminFee")).toBe(true);
  });

  it("fails when adminFee is not an integer", async () => {
    const dto = plainToInstance(CreateTransactionDto, {
      ...BASE,
      adminFee: 12.5,
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "adminFee")).toBe(true);
  });

  it("fails when toAccountId is not a valid UUID", async () => {
    const dto = plainToInstance(CreateTransactionDto, {
      ...BASE,
      toAccountId: "not-a-uuid",
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "toAccountId")).toBe(true);
  });

  // EPIC-023 E1 — optional obligation links.
  it("passes when liabilityId is a valid UUID", async () => {
    const dto = plainToInstance(CreateTransactionDto, {
      ...BASE,
      liabilityId: "33333333-3333-4333-8333-333333333333",
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("passes when insuranceId is a valid UUID", async () => {
    const dto = plainToInstance(CreateTransactionDto, {
      ...BASE,
      insuranceId: "44444444-4444-4444-8444-444444444444",
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("fails when liabilityId is not a valid UUID", async () => {
    const dto = plainToInstance(CreateTransactionDto, {
      ...BASE,
      liabilityId: "not-a-uuid",
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "liabilityId")).toBe(true);
  });

  it("fails when insuranceId is not a valid UUID", async () => {
    const dto = plainToInstance(CreateTransactionDto, {
      ...BASE,
      insuranceId: "not-a-uuid",
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "insuranceId")).toBe(true);
  });
});
