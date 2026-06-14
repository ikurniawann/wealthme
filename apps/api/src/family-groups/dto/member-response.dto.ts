import { ApiProperty } from "@nestjs/swagger";
import { Role } from "@prisma/client";

export class MemberResponseDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  userId!: string;

  @ApiProperty({ type: String })
  familyGroupId!: string;

  @ApiProperty({ enum: Role })
  role!: Role;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: String })
  email!: string;

  @ApiProperty({ type: String, format: "date-time" })
  createdAt!: string;
}
