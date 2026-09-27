import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { CreateInsuranceDto } from "./create-insurance.dto";
import { UpdateInsuranceDto } from "./update-insurance.dto";

const BASE = {
  type: "jiwa",
  premiumAmount: "500000",
};

// E2E round 1, bug 1 — sibling audit: `name` must reject "" / whitespace.
describe("CreateInsuranceDto.name — E2E round 1 bug 1", () => {
  it("rejects an empty name", async () => {
    const dto = plainToInstance(CreateInsuranceDto, { ...BASE, name: "" });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "name")).toBe(true);
  });

  it("rejects a whitespace-only name", async () => {
    const dto = plainToInstance(CreateInsuranceDto, {
      ...BASE,
      name: "   ",
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "name")).toBe(true);
  });
});

describe("UpdateInsuranceDto.name — E2E round 1 bug 1", () => {
  it("rejects an explicit empty name", async () => {
    const dto = plainToInstance(UpdateInsuranceDto, { name: "" });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "name")).toBe(true);
  });

  it("omitting name is still valid (unrelated fields can be edited alone)", async () => {
    const dto = plainToInstance(UpdateInsuranceDto, { policyNumber: "X-1" });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
