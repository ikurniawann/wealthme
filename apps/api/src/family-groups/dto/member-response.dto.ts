import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { MemberRelationship, Role } from "@prisma/client";

export class MemberResponseDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  userId!: string;

  @ApiProperty({ type: String })
  familyGroupId!: string;

  @ApiProperty({ enum: Role })
  role!: Role;

  // EPIC-023 Task C (D1) — purely descriptive kinship; null for every
  // pre-existing member.
  @ApiPropertyOptional({ enum: MemberRelationship, nullable: true })
  relationship!: MemberRelationship | null;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: String })
  email!: string;

  @ApiProperty({ type: String, format: "date-time" })
  createdAt!: string;
}
