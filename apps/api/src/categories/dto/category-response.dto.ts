import { ApiProperty } from "@nestjs/swagger";
import { CategoryKind } from "@prisma/client";

export class CategoryResponseDto {
  @ApiProperty({ type: String, description: "Category UUID" })
  id!: string;

  @ApiProperty({ type: String, description: "Family group UUID" })
  familyGroupId!: string;

  @ApiProperty({ type: String, description: "Category name" })
  name!: string;

  @ApiProperty({ enum: CategoryKind, description: "Category kind" })
  kind!: CategoryKind;

  @ApiProperty({ type: String, nullable: true, description: "Hex color" })
  color!: string | null;

  @ApiProperty({ type: String, nullable: true, description: "Icon identifier" })
  icon!: string | null;

  @ApiProperty({
    type: Boolean,
    description:
      "Hidden from `member` viewers in shared family views when true",
  })
  isPrivate!: boolean;

  @ApiProperty({ type: String, format: "date-time" })
  createdAt!: string;
}
