import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { CreateGoalDto } from "./create-goal.dto";

// E2E round 1, bug 1 — a goal with an empty/whitespace name was silently
// persisted (201, toast success). `name` must be trimmed and non-empty.
describe("CreateGoalDto.name — E2E round 1 bug 1", () => {
  it("rejects an empty name", async () => {
    const dto = plainToInstance(CreateGoalDto, {
      name: "",
      targetAmount: 10_000_000,
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "name")).toBe(true);
  });

  it("rejects a whitespace-only name", async () => {
    const dto = plainToInstance(CreateGoalDto, {
      name: "   ",
      targetAmount: 10_000_000,
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "name")).toBe(true);
  });

  it("accepts a real name and trims surrounding whitespace", async () => {
    const dto = plainToInstance(CreateGoalDto, {
      name: "  Dana Liburan  ",
      targetAmount: 10_000_000,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.name).toBe("Dana Liburan");
  });
});

describe("CreateGoalDto.currentAmount — EPIC-022 C8", () => {
  it("accepts 0 (a goal started with nothing saved yet)", async () => {
    const dto = plainToInstance(CreateGoalDto, {
      name: "Dana Liburan",
      targetAmount: 10_000_000,
      currentAmount: 0,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("accepts a positive value (a goal started with existing savings)", async () => {
    const dto = plainToInstance(CreateGoalDto, {
      name: "Dana Liburan",
      targetAmount: 10_000_000,
      currentAmount: 2_000_000,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("rejects a negative value", async () => {
    const dto = plainToInstance(CreateGoalDto, {
      name: "Dana Liburan",
      targetAmount: 10_000_000,
      currentAmount: -1,
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "currentAmount")).toBe(true);
  });

  it("omitting currentAmount is still valid (defaults to 0 in the service)", async () => {
    const dto = plainToInstance(CreateGoalDto, {
      name: "Dana Liburan",
      targetAmount: 10_000_000,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});

describe("CreateGoalDto.sourceAccountId — Revisi F item 5", () => {
  const SOURCE = "5f0c1f7e-7c1a-4b8e-9d7a-2f1c3b4a5d6e";

  it("is required when autoDebitAmount is set", async () => {
    const dto = plainToInstance(CreateGoalDto, {
      name: "Dana Liburan",
      targetAmount: 10_000_000,
      autoDebitAmount: 500_000,
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "sourceAccountId")).toBe(true);
  });

  it("accepts autoDebitAmount together with a UUID sourceAccountId", async () => {
    const dto = plainToInstance(CreateGoalDto, {
      name: "Dana Liburan",
      targetAmount: 10_000_000,
      autoDebitAmount: 500_000,
      sourceAccountId: SOURCE,
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it("rejects a non-UUID sourceAccountId", async () => {
    const dto = plainToInstance(CreateGoalDto, {
      name: "Dana Liburan",
      targetAmount: 10_000_000,
      sourceAccountId: "acc-1",
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "sourceAccountId")).toBe(true);
  });

  it("a goal without auto-debit needs no source account", async () => {
    const dto = plainToInstance(CreateGoalDto, {
      name: "Dana Liburan",
      targetAmount: 10_000_000,
    });
    expect(await validate(dto)).toHaveLength(0);
  });
});
