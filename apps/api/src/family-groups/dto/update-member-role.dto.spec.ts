import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { UpdateMemberRoleDto } from "./update-member-role.dto";

describe("UpdateMemberRoleDto", () => {
  it("accepts a member role", async () => {
    const dto = plainToInstance(UpdateMemberRoleDto, { role: "member" });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("accepts an admin_staff role", async () => {
    const dto = plainToInstance(UpdateMemberRoleDto, { role: "admin_staff" });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("rejects role 'owner' (a forged owner-caller request can't mint a co-owner)", async () => {
    const dto = plainToInstance(UpdateMemberRoleDto, { role: "owner" });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.property).toBe("role");
  });
});
