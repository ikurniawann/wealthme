import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { MemberRelationship, Role } from "@prisma/client";
import { IsEnum, IsIn, IsOptional } from "class-validator";

// "owner" is intentionally excluded — the UI never offers minting a co-owner
// through this endpoint, so a forged owner-caller request can't use it to
// grant ownership outside the UI's intent (defense in depth).
// EPIC-023 Task C (D1/D2/D3/D5) — spouse/dependant/operational join the
// assignable set. Kinship is not authority (D1): the API accepts any
// (relationship, role) pair the head chooses, so no cross-validation ties a
// specific relationship to a specific role here.
const ASSIGNABLE_ROLES: Role[] = [
  Role.member,
  Role.admin_staff,
  Role.spouse,
  Role.dependant,
  Role.operational,
];

export class UpdateMemberRoleDto {
  @ApiProperty({
    enum: ASSIGNABLE_ROLES,
    description: "New role for the member; owner is not assignable here",
  })
  @IsIn(ASSIGNABLE_ROLES)
  role!: Role;

  @ApiPropertyOptional({
    enum: MemberRelationship,
    description:
      "Purely descriptive kinship (EPIC-023 Task C, D1) — carries no permission of its own. Omit to leave unchanged; pass null to clear it.",
    nullable: true,
  })
  @IsOptional()
  @IsEnum(MemberRelationship)
  relationship?: MemberRelationship | null;
}
