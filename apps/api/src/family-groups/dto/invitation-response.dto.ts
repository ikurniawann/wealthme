import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Role } from "@prisma/client";

export class InvitationResponseDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  token!: string;

  @ApiProperty({ type: String })
  familyGroupId!: string;

  @ApiProperty({ type: String })
  familyGroupName!: string;

  @ApiProperty({ type: String })
  email!: string;

  @ApiProperty({ enum: Role })
  role!: Role;

  @ApiProperty({ type: String, format: "date-time" })
  expiresAt!: string;

  @ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
  usedAt!: string | null;

  @ApiProperty({ type: String, format: "date-time" })
  createdAt!: string;
}
