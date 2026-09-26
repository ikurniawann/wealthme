import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { FxInputDto } from "./fx-input.dto";

const BASE = { currency: "USD", amount: "1.00" };

async function fieldErrors(field: string) {
  const dto = plainToInstance(FxInputDto, { ...BASE, field });
  const errors = await validate(dto);
  return errors.filter((e) => e.property === "field");
}

describe("FxInputDto.field — revisi I fix round 1", () => {
  it("accepts a plain field name", async () => {
    expect(await fieldErrors("balance")).toHaveLength(0);
  });

  it("accepts a single-digit array index", async () => {
    expect(await fieldErrors("participants.1.amountOwed")).toHaveLength(0);
  });

  it("accepts index 0 written as a bare zero", async () => {
    expect(await fieldErrors("participants.0.amountOwed")).toHaveLength(0);
  });

  it("rejects a leading-zero array index ('01') that would alias index 1", async () => {
    expect(await fieldErrors("participants.01.amountOwed")).not.toHaveLength(0);
  });

  it("rejects a leading-zero array index ('007')", async () => {
    expect(await fieldErrors("participants.007.amountOwed")).not.toHaveLength(
      0,
    );
  });
});
