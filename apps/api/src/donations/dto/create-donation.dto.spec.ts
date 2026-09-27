import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { CreateDonationDto } from "./create-donation.dto";
import { UpdateDonationDto } from "./update-donation.dto";

const BASE = {
  type: "sedekah",
  amount: "50000",
  donatedAt: "2026-09-01",
};

// E2E round 1, bug 1 — sibling audit: `recipient` must reject "" / whitespace.
describe("CreateDonationDto.recipient — E2E round 1 bug 1", () => {
  it("rejects an empty recipient", async () => {
    const dto = plainToInstance(CreateDonationDto, {
      ...BASE,
      recipient: "",
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "recipient")).toBe(true);
  });

  it("rejects a whitespace-only recipient", async () => {
    const dto = plainToInstance(CreateDonationDto, {
      ...BASE,
      recipient: "   ",
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "recipient")).toBe(true);
  });
});

describe("UpdateDonationDto.recipient — E2E round 1 bug 1", () => {
  it("rejects an explicit empty recipient", async () => {
    const dto = plainToInstance(UpdateDonationDto, { recipient: "" });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "recipient")).toBe(true);
  });
});
