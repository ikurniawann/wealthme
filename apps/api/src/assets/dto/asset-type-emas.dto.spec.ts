import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { CreateAssetDto } from "./create-asset.dto";
import { UpdateAssetDto } from "./update-asset.dto";

describe("Asset DTOs — AssetType.emas (Revisi D item 10)", () => {
  it("CreateAssetDto accepts type emas", async () => {
    const dto = plainToInstance(CreateAssetDto, {
      name: "Logam Mulia 10 g",
      type: "emas",
      currentValue: "15000000",
    });
    expect(await validate(dto)).toEqual([]);
  });

  it("UpdateAssetDto accepts type emas", async () => {
    const dto = plainToInstance(UpdateAssetDto, { type: "emas" });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "type")).toBe(false);
  });

  it("still rejects an unknown asset type", async () => {
    const dto = plainToInstance(CreateAssetDto, {
      name: "X",
      type: "saham",
      currentValue: "1",
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "type")).toBe(true);
  });
});
