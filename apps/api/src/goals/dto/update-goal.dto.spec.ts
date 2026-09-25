import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { UpdateGoalDto } from "./update-goal.dto";

describe("UpdateGoalDto.currentAmount — EPIC-022 A4/C9", () => {
  it("accepts 0 (a fresh goal's currentAmount, and 'withdraw everything')", async () => {
    const dto = plainToInstance(UpdateGoalDto, { currentAmount: 0 });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("accepts a positive value", async () => {
    const dto = plainToInstance(UpdateGoalDto, { currentAmount: 500_000 });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("rejects a negative value", async () => {
    const dto = plainToInstance(UpdateGoalDto, { currentAmount: -1 });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.property).toBe("currentAmount");
  });

  it("omitting currentAmount is still valid (unrelated fields can be edited alone)", async () => {
    const dto = plainToInstance(UpdateGoalDto, { name: "Renamed" });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});

// Revisi F final-review Finding 1 — explicit `null` must be a legal,
// distinct value from `undefined` so the web form can request "clear
// auto-debit" rather than having it silently ignored.
describe("UpdateGoalDto.autoDebitAmount — Revisi F Finding 1 (explicit null)", () => {
  it("accepts an explicit null (clear auto-debit)", async () => {
    const dto = plainToInstance(UpdateGoalDto, { autoDebitAmount: null });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.autoDebitAmount).toBeNull();
  });

  it("accepts a positive value", async () => {
    const dto = plainToInstance(UpdateGoalDto, { autoDebitAmount: 500_000 });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("rejects 0 (must stay positive when set)", async () => {
    const dto = plainToInstance(UpdateGoalDto, { autoDebitAmount: 0 });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.property).toBe("autoDebitAmount");
  });

  it("omitting autoDebitAmount is still valid (unrelated fields can be edited alone)", async () => {
    const dto = plainToInstance(UpdateGoalDto, { name: "Renamed" });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
