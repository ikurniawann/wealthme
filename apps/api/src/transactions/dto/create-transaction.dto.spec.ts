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

  // EPIC-023 group E retry (CRITICAL 1.4 / C2) — `liabilityId`/`insuranceId`
  // were REMOVED from this DTO: they used to let ANY caller (any `member`,
  // via a plain `POST /transactions`) link an arbitrary expense to someone
  // else's liability/insurance id just by guessing it, flipping that
  // obligation's `paidThisPeriod` to "paid" without a real payment — a
  // forgeable double-payment bypass. Only `LiabilitiesService.pay()`/
  // `purchase()` and `InsurancesService.pay()` may set these fields, writing
  // directly via Prisma inside their own transaction, never from client
  // input. These tests assert the field stays UNRECOGNIZED by validation —
  // a class-validator decorator reappearing here would silently reopen the
  // forgery bypass even if nothing else changed.
  it("ignores a client-supplied liabilityId — no validator decorates it, so it never surfaces as a validation error regardless of shape", async () => {
    const dto = plainToInstance(CreateTransactionDto, {
      ...BASE,
      liabilityId: "not-a-uuid",
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "liabilityId")).toBe(false);
  });

  it("ignores a client-supplied insuranceId — no validator decorates it, so it never surfaces as a validation error regardless of shape", async () => {
    const dto = plainToInstance(CreateTransactionDto, {
      ...BASE,
      insuranceId: "not-a-uuid",
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "insuranceId")).toBe(false);
  });
});
