import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { MemberRelationship, Role } from "@prisma/client";
import { IsEmail, IsEnum, IsIn, IsOptional } from "class-validator";

// Invitations may only grant "member", "admin_staff", or "spouse" — "owner"
// is assigned exclusively at family-group creation time (see
// FamilyGroupsService#create). Excluding it here stops a forged owner-caller
// request from minting a co-owner through this endpoint, which no
// legitimate caller (the UI never offers it) relies on. `dependant`/
// `operational` are NOT invitable by email (D6 — they are created directly
// by the head, no email; that flow lands in Task D).
const INVITABLE_ROLES: Role[] = [Role.member, Role.admin_staff, Role.spouse];

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

  @ApiPropertyOptional({
    enum: MemberRelationship,
    description:
      "Purely descriptive kinship (EPIC-023 Task C, D1) — carries no permission of its own; pre-fills nothing here since `role` is set explicitly on this endpoint.",
  })
  @IsOptional()
  @IsEnum(MemberRelationship)
  relationship?: MemberRelationship;
}
