import { ApiProperty } from "@nestjs/swagger";
import { ReferenceItemGroup } from "@prisma/client";
import { IsEnum, IsString, MaxLength } from "class-validator";

export class CreateReferenceItemDto {
  @ApiProperty({
    enum: ReferenceItemGroup,
    description: "Which reference list this item belongs to",
  })
  @IsEnum(ReferenceItemGroup)
  group!: ReferenceItemGroup;

  @ApiProperty({ type: String, description: "Item label", maxLength: 100 })
  @IsString()
  @MaxLength(100)
  label!: string;
}
