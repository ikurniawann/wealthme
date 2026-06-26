import { ApiProperty } from "@nestjs/swagger";
import { CoaBudgetType, CoaDirection } from "@prisma/client";

export class CoaAccountResponseDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  familyGroupId!: string;

  @ApiProperty({ type: String })
  code!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: Number })
  groupNum!: number;

  @ApiProperty({ enum: CoaDirection })
  direction!: CoaDirection;

  @ApiProperty({ enum: CoaBudgetType, nullable: true })
  budgetType!: CoaBudgetType | null;

  @ApiProperty({ type: String, nullable: true })
  parentCode!: string | null;

  @ApiProperty({ type: String, format: "date-time" })
  createdAt!: string;

  @ApiProperty({ type: String, format: "date-time" })
  updatedAt!: string;
}
