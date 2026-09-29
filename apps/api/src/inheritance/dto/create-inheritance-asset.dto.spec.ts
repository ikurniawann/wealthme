import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { CreateInheritanceAssetDto } from "./create-inheritance-asset.dto";

/**
 * Hardening audit (validation, MEDIUM/LOW) — `heirs` was unbounded,
 * `estimatedValue` had no upper bound, and `notes` had no max length.
 */
const BASE = {
  name: "Rumah Warisan",
  assetType: "Properti",
  estimatedValue: 500_000_000,
};

function heir() {
  return { name: "Ahli Waris", relationship: "anak", sharePercent: 1 };
}

describe("CreateInheritanceAssetDto.heirs", () => {
  it("rejects more than 20 heirs", async () => {
    const dto = plainToInstance(CreateInheritanceAssetDto, {
      ...BASE,
      heirs: Array.from({ length: 21 }, heir),
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "heirs")).toBe(true);
  });

  it("accepts exactly 20 heirs", async () => {
    const dto = plainToInstance(CreateInheritanceAssetDto, {
      ...BASE,
      heirs: Array.from({ length: 20 }, heir),
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "heirs")).toBe(false);
  });
});

describe("CreateInheritanceAssetDto.estimatedValue", () => {
  it("rejects a value above the 12-digit bound", async () => {
    const dto = plainToInstance(CreateInheritanceAssetDto, {
      ...BASE,
      estimatedValue: 1_000_000_000_000,
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "estimatedValue")).toBe(true);
  });
});

describe("CreateInheritanceAssetDto.notes", () => {
  it("rejects notes over 500 chars", async () => {
    const dto = plainToInstance(CreateInheritanceAssetDto, {
      ...BASE,
      notes: "a".repeat(501),
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "notes")).toBe(true);
  });
});
