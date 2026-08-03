import { ApiProperty } from "@nestjs/swagger";
import { Role } from "@prisma/client";
import { IsIn } from "class-validator";

// "owner" is intentionally excluded — the UI never offers minting a co-owner
// through this endpoint, so a forged owner-caller request can't use it to
// grant ownership outside the UI's intent (defense in depth).
const ASSIGNABLE_ROLES: Role[] = [Role.member, Role.admin_staff];

export class UpdateMemberRoleDto {
  @ApiProperty({
    enum: ASSIGNABLE_ROLES,
    description: "New role for the member; owner is not assignable here",
  })
  @IsIn(ASSIGNABLE_ROLES)
  role!: Role;
}
