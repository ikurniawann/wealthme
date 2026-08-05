import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { MemberRelationship, Role } from "@prisma/client";

// EPIC-023 D1/D6 — response for POST .../members/dependant. Never carries
// the password or its hash, and deliberately omits the synthetic email
// (see FamilyGroupsService#createDependantMember) — the member signs in by
// username, so surfacing the placeholder address would only invite
// confusion about it being a real, reachable inbox.
export class DependantMemberResponseDto {
  @ApiProperty({ type: String, description: "Member row id" })
  id!: string;

  @ApiProperty({ type: String })
  userId!: string;

  @ApiProperty({ type: String })
  familyGroupId!: string;

  @ApiProperty({ enum: Role })
  role!: Role;

  @ApiPropertyOptional({ enum: MemberRelationship, nullable: true })
  relationship!: MemberRelationship | null;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({
    type: String,
    description: "Normalized (lowercased) username",
  })
  username!: string;

  @ApiProperty({ type: String, format: "date-time" })
  createdAt!: string;
}
