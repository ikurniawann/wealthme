import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { CreateParticipantDto } from "./create-participant.dto";
import { CreateSplitBillDto } from "./create-split-bill.dto";

const BASE = {
  totalAmount: 100_000,
  payoutAccountId: "5f0c1f7e-7c1a-4b8e-9d7a-2f1c3b4a5d6e",
  participants: [{ name: "A", amountOwed: 50_000 }],
};

// E2E round 1, bug 1 — sibling audit: `title` must reject "" / whitespace.
describe("CreateSplitBillDto.title — E2E round 1 bug 1", () => {
  it("rejects an empty title", async () => {
    const dto = plainToInstance(CreateSplitBillDto, { ...BASE, title: "" });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "title")).toBe(true);
  });

  it("rejects a whitespace-only title", async () => {
    const dto = plainToInstance(CreateSplitBillDto, {
      ...BASE,
      title: "   ",
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "title")).toBe(true);
  });

  it("accepts a real title and trims surrounding whitespace", async () => {
    const dto = plainToInstance(CreateSplitBillDto, {
      ...BASE,
      title: "  Makan Siang  ",
    });
    const errors = await validate(dto);
    expect(errors.filter((e) => e.property === "title")).toHaveLength(0);
    expect(dto.title).toBe("Makan Siang");
  });
});

// E2E round 1, bug 1 — sibling audit: participant `name` must reject "" / whitespace.
describe("CreateParticipantDto.name — E2E round 1 bug 1", () => {
  it("rejects an empty name", async () => {
    const dto = plainToInstance(CreateParticipantDto, {
      name: "",
      amountOwed: 0,
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "name")).toBe(true);
  });

  it("rejects a whitespace-only name", async () => {
    const dto = plainToInstance(CreateParticipantDto, {
      name: "   ",
      amountOwed: 0,
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "name")).toBe(true);
  });
});
