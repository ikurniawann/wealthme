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

// Hardening audit (validation, MEDIUM) — currentValue was an unbounded
// `/^\d+$/`, which can overflow the BigInt column.
describe("CreateAssetDto.currentValue — hardening audit MEDIUM", () => {
  it("accepts currentValue exactly at the 15-digit boundary", async () => {
    const dto = plainToInstance(CreateAssetDto, {
      ...BASE,
      name: "Rumah",
      currentValue: "999999999999999",
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "currentValue")).toBe(false);
  });

  it("rejects currentValue above 15 digits", async () => {
    const dto = plainToInstance(CreateAssetDto, {
      ...BASE,
      name: "Rumah",
      currentValue: "1999999999999999",
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "currentValue")).toBe(true);
  });
});

// Client bug 2026-10-21 — Pemilik = a registered member failed with 400:
// better-auth user ids are 32-char alphanumerics, not UUIDs.
describe("CreateAssetDto.ownerUserId — non-UUID member ids", () => {
  const owner = (ownerUserId: unknown) =>
    validate(
      plainToInstance(CreateAssetDto, { ...BASE, name: "Emas", ownerUserId }),
    );

  it("accepts a better-auth (non-UUID) user id", async () => {
    const errors = await owner("Ds9yq8La3yfVTwyTNOkb5P1J4lVTsBn6");
    expect(errors.some((e) => e.property === "ownerUserId")).toBe(false);
  });

  it("accepts a seeded UUID and null (Bersama)", async () => {
    expect(await owner("6f2a1d54-9c3b-4f7e-9a10-2b8c5d4e1f03")).toHaveLength(0);
    expect(await owner(null)).toHaveLength(0);
  });

  it("rejects an empty string and a non-string", async () => {
    for (const bad of ["", 42]) {
      const errors = await owner(bad);
      expect(errors.some((e) => e.property === "ownerUserId")).toBe(true);
    }
  });
});
