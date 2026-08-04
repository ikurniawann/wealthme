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
