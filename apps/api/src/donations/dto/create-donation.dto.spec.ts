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

// Hardening audit (validation, HIGH) — receiptUrl is rendered as `<a href>`
// to every family member; a non-http(s) scheme (e.g. `javascript:`) would
// have been stored XSS.
describe("receiptUrl — hardening audit HIGH", () => {
  it("CreateDonationDto accepts an https URL", async () => {
    const dto = plainToInstance(CreateDonationDto, {
      ...BASE,
      recipient: "Panti Asuhan",
      receiptUrl: "https://example.com/receipt.pdf",
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "receiptUrl")).toBe(false);
  });

  it("CreateDonationDto rejects a javascript: URL", async () => {
    const dto = plainToInstance(CreateDonationDto, {
      ...BASE,
      recipient: "Panti Asuhan",
      receiptUrl: "javascript:alert(1)",
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "receiptUrl")).toBe(true);
  });

  it("CreateDonationDto rejects a bare string that is not a URL", async () => {
    const dto = plainToInstance(CreateDonationDto, {
      ...BASE,
      recipient: "Panti Asuhan",
      receiptUrl: "not a url",
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "receiptUrl")).toBe(true);
  });

  it("UpdateDonationDto rejects a javascript: URL", async () => {
    const dto = plainToInstance(UpdateDonationDto, {
      receiptUrl: "javascript:alert(document.cookie)",
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "receiptUrl")).toBe(true);
  });
});

describe("amount — hardening audit MEDIUM (bounded digits)", () => {
  it("rejects an amount over 15 digits", async () => {
    const dto = plainToInstance(CreateDonationDto, {
      ...BASE,
      recipient: "Panti Asuhan",
      amount: "1".repeat(16),
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "amount")).toBe(true);
  });
});

describe("accountId — hardening audit LOW (must be a UUID)", () => {
  it("rejects a non-UUID accountId", async () => {
    const dto = plainToInstance(CreateDonationDto, {
      ...BASE,
      recipient: "Panti Asuhan",
      accountId: "not-a-uuid",
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "accountId")).toBe(true);
  });
});
