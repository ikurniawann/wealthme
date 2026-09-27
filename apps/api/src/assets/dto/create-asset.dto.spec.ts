import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { CreateAssetDto } from "./create-asset.dto";

const BASE = {
  type: "properti",
  currentValue: "200000000",
};

// E2E round 1, bug 1 — sibling audit: `name` must reject "" / whitespace.
describe("CreateAssetDto.name — E2E round 1 bug 1", () => {
  it("rejects an empty name", async () => {
    const dto = plainToInstance(CreateAssetDto, { ...BASE, name: "" });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "name")).toBe(true);
  });

  it("rejects a whitespace-only name", async () => {
    const dto = plainToInstance(CreateAssetDto, { ...BASE, name: "   " });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "name")).toBe(true);
  });

  it("accepts a real name and trims surrounding whitespace", async () => {
    const dto = plainToInstance(CreateAssetDto, {
      ...BASE,
      name: "  Rumah  ",
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.name).toBe("Rumah");
  });
});
