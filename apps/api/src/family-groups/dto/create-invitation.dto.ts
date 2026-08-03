import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Role } from "@prisma/client";
import { IsEmail, IsIn, IsOptional } from "class-validator";

// Invitations may only grant "member" or "admin_staff" — "owner" is assigned
// exclusively at family-group creation time (see FamilyGroupsService#create).
// Excluding it here stops a forged owner-caller request from minting a
// co-owner through this endpoint, which no legitimate caller (the UI never
// offers it) relies on.
const INVITABLE_ROLES: Role[] = [Role.member, Role.admin_staff];

export class CreateInvitationDto {
  @ApiProperty({ type: String, description: "Email address to invite" })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({
    enum: INVITABLE_ROLES,
    description: "Role to assign (defaults to member); owner is not invitable",
  })
  @IsOptional()
  @IsIn(INVITABLE_ROLES)
  role?: Role;
}
