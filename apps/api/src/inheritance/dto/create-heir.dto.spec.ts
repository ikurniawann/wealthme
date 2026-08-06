import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { CreateHeirDto } from "./create-heir.dto";

const VALID_UUID = "5b8f0f9e-3d4b-4b8a-9a7a-8d4b2c1e0f11";

describe("CreateHeirDto", () => {
  it("accepts a heir with no memberUserId (free text only)", async () => {
    const dto = plainToInstance(CreateHeirDto, {
      name: "Anak 1",
      relationship: "Anak",
      sharePercent: 50,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("accepts a valid uuid memberUserId", async () => {
    const dto = plainToInstance(CreateHeirDto, {
      name: "Anak 1",
      relationship: "Anak",
      sharePercent: 50,
      memberUserId: VALID_UUID,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  // EPIC-023 F1 (D14) — `memberUserId` previously had no shape validation
  // at all; garbage reached the tenant-scope lookup instead of being
  // rejected at the boundary. Fails against pre-F1 code.
  it("rejects a non-uuid memberUserId", async () => {
    const dto = plainToInstance(CreateHeirDto, {
      name: "Anak 1",
      relationship: "Anak",
      sharePercent: 50,
      memberUserId: "not-a-uuid",
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.property).toBe("memberUserId");
  });
});
