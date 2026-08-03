import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { CreateInvitationDto } from "./create-invitation.dto";

describe("CreateInvitationDto", () => {
  it("accepts a member role", async () => {
    const dto = plainToInstance(CreateInvitationDto, {
      email: "a@b.com",
      role: "member",
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("accepts an admin_staff role", async () => {
    const dto = plainToInstance(CreateInvitationDto, {
      email: "a@b.com",
      role: "admin_staff",
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("rejects role 'owner' (a forged owner-caller request can't mint a co-owner)", async () => {
    const dto = plainToInstance(CreateInvitationDto, {
      email: "a@b.com",
      role: "owner",
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.property).toBe("role");
  });

  it("omitting role is still valid (defaults to member downstream)", async () => {
    const dto = plainToInstance(CreateInvitationDto, { email: "a@b.com" });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
