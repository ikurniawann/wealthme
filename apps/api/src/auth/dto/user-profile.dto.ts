import { ApiProperty } from "@nestjs/swagger";

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

  @ApiProperty({
    type: String,
    format: "date-time",
    description: "Account creation timestamp",
  })
  createdAt!: Date;

  @ApiProperty({
    type: [MembershipDto],
    description: "Family group memberships",
  })
  memberships!: MembershipDto[];
}
