import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class MembershipDto {
  @ApiProperty({ type: String, description: "Membership UUID" })
  id!: string;

  @ApiProperty({ type: String, description: "Family group UUID" })
  familyGroupId!: string;

  @ApiProperty({ type: String, description: "Role in the family group" })
  role!: string;
}

export class UserProfileDto {
  @ApiProperty({ type: String, description: "User UUID" })
  id!: string;

  @ApiProperty({ type: String, description: "Email address" })
  email!: string;

  @ApiProperty({ type: String, description: "Display name" })
  name!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: "Two-letter initials",
  })
  avatarInitials!: string | null;

  // Only present on GET/PATCH /auth/profile — GET /auth/me omits these to
  // keep its Prisma query minimal (see AuthService.getMe).
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: "Phone number (only on /auth/profile)",
  })
  phone?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: "Birth date, ISO date string (only on /auth/profile)",
  })
  birthDate?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: "Gender (only on /auth/profile)",
  })
  gender?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: "Job title (only on /auth/profile)",
  })
  jobTitle?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      "Monthly income, formatted display string (only on /auth/profile)",
  })
  monthlyIncome?: string | null;

  @ApiPropertyOptional({
    type: String,
    description:
      "Display currency preference, ISO 4217 code (only on /auth/profile)",
  })
  currency?: string;

  @ApiPropertyOptional({
    type: "object",
    additionalProperties: { type: "boolean" },
    description: "Resolved notification preferences (only on /auth/profile)",
  })
  notificationPrefs?: Record<string, boolean>;

  @ApiProperty({
    type: String,
    format: "date-time",
    description: "Account creation timestamp",
  })
  createdAt!: Date;

  @ApiProperty({
    type: String,
    nullable: true,
    description: "Primary family group ID (first membership)",
  })
  familyGroupId!: string | null;

  @ApiProperty({
    type: [MembershipDto],
    description: "Family group memberships",
  })
  memberships!: MembershipDto[];
}
