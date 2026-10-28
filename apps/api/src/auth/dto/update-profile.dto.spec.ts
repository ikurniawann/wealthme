import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { UpdateProfileDto } from "./update-profile.dto";

// EPIC-021 Group F (#1) — AUD + CNY added to the supported display
// currencies validated by PATCH /auth/profile.
describe("UpdateProfileDto currency", () => {
  it.each([
    "IDR",
    "USD",
    "SGD",
    "EUR",
    "JPY",
    "AUD",
    "CNY",
    "GBP",
    "HKD",
    "MYR",
    "THB",
    "PHP",
    "KRW",
    "INR",
  ])("accepts %s as a valid currency", async (currency) => {
    const dto = plainToInstance(UpdateProfileDto, { currency });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("rejects an unsupported currency code", async () => {
    const dto = plainToInstance(UpdateProfileDto, { currency: "ZZZ" });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.property).toBe("currency");
  });

  it("currency is optional (undefined is valid)", async () => {
    const dto = plainToInstance(UpdateProfileDto, { name: "Irfan" });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
