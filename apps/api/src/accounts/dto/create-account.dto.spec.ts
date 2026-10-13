import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { CreateAccountDto } from "./create-account.dto";
import { UpdateAccountDto } from "./update-account.dto";

// EPIC-021 Group A (#21/#22) — `balance` must stay >= 0 for every account
// type EXCEPT `cash` (physical cash can run short with no external floor).
// Bank overdraft protection for transaction-driven debits lives in
// transactions.service.ts — this only locks in the DTO-level shape guard.
const BASE = {
  name: "Test Account",
  balance: -50000,
};

// E2E round 1, bug 1 — sibling audit: `name` must reject "" / whitespace.
describe("CreateAccountDto.name — E2E round 1 bug 1", () => {
  it("rejects an empty name", async () => {
    const dto = plainToInstance(CreateAccountDto, {
      ...BASE,
      name: "",
      type: "bank",
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "name")).toBe(true);
  });

  it("rejects a whitespace-only name", async () => {
    const dto = plainToInstance(CreateAccountDto, {
      ...BASE,
      name: "   ",
      type: "bank",
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "name")).toBe(true);
  });
});

describe("CreateAccountDto balance validation (#21/#22)", () => {
  it("passes with a negative balance when type is cash", async () => {
    const dto = plainToInstance(CreateAccountDto, { ...BASE, type: "cash" });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "balance")).toBe(false);
  });

  it.each(["bank", "ewallet", "investment", "property"])(
    "fails with a negative balance when type is %s",
    async (type) => {
      const dto = plainToInstance(CreateAccountDto, { ...BASE, type });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === "balance")).toBe(true);
    },
  );

  it("passes with a zero balance for a bank account", async () => {
    const dto = plainToInstance(CreateAccountDto, {
      ...BASE,
      type: "bank",
      balance: 0,
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "balance")).toBe(false);
  });
});

describe("UpdateAccountDto has no balance (2026-10-13 staging incident)", () => {
  it("strips balance and fxInputs under the app's whitelist ValidationPipe", async () => {
    const { ValidationPipe } = await import("@nestjs/common");
    const pipe = new ValidationPipe({ whitelist: true, transform: true });
    const out = (await pipe.transform(
      {
        name: "BCA",
        balance: 15_111_882,
        fxInputs: [{ field: "balance", currency: "USD", amount: "1.00" }],
      },
      { type: "body", metatype: UpdateAccountDto },
    )) as Record<string, unknown>;
    expect(out).toEqual({ name: "BCA" });
  });
});
