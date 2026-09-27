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

  // Bugfix (2026-09-26) — Better Auth generates non-UUID ids (e.g.
  // "Yyyw1LCqJDZhOJ00qNCfjxfHhH2P7uCs") for every self-registered account;
  // only Prisma-seeded rows get @default(uuid()). @IsUUID() rejected every
  // real owner-as-heir link with 400. Fails against pre-fix code.
  it("accepts a Better Auth style non-uuid memberUserId", async () => {
    const dto = plainToInstance(CreateHeirDto, {
      name: "Ayah",
      relationship: "Ayah",
      sharePercent: 50,
      memberUserId: "Yyyw1LCqJDZhOJ00qNCfjxfHhH2P7uCs",
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("rejects a memberUserId with invalid characters", async () => {
    const dto = plainToInstance(CreateHeirDto, {
      name: "Anak 1",
      relationship: "Anak",
      sharePercent: 50,
      memberUserId: "not a valid id!",
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.property).toBe("memberUserId");
  });
});
