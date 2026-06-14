import { ApiProperty } from "@nestjs/swagger";
import { Role } from "@prisma/client";

export class FamilyGroupResponseDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: Number })
  memberCount!: number;

  @ApiProperty({ enum: Role })
  myRole!: Role;

  @ApiProperty({ type: String, format: "date-time" })
  createdAt!: string;
}
