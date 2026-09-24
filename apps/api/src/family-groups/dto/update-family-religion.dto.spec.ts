import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { UpdateFamilyReligionDto } from "./update-family-religion.dto";

describe("UpdateFamilyReligionDto", () => {
  it.each(["islam", "kristen", "katolik", "hindu", "buddha", "none"])(
    "accepts %s",
    async (religion) => {
      const dto = plainToInstance(UpdateFamilyReligionDto, { religion });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    },
  );

  it("rejects a value outside the enum", async () => {
    const dto = plainToInstance(UpdateFamilyReligionDto, {
      religion: "atheist",
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.property).toBe("religion");
  });

  it("rejects a missing religion", async () => {
    const dto = plainToInstance(UpdateFamilyReligionDto, {});
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
