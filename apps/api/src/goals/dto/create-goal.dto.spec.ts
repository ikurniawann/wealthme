import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { CreateGoalDto } from "./create-goal.dto";

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
