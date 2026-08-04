import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { UpdateGoldPriceDto } from "./update-gold-price.dto";

describe("UpdateGoldPriceDto", () => {
  it("accepts a positive integer price per gram", async () => {
    const dto = plainToInstance(UpdateGoldPriceDto, { pricePerGram: 1150000 });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("rejects zero (must be > 0)", async () => {
    const dto = plainToInstance(UpdateGoldPriceDto, { pricePerGram: 0 });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.property).toBe("pricePerGram");
  });

  it("rejects a negative price", async () => {
    const dto = plainToInstance(UpdateGoldPriceDto, { pricePerGram: -500 });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it("rejects a non-integer price", async () => {
    const dto = plainToInstance(UpdateGoldPriceDto, {
      pricePerGram: 1150000.5,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it("rejects a missing price", async () => {
    const dto = plainToInstance(UpdateGoldPriceDto, {});
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
