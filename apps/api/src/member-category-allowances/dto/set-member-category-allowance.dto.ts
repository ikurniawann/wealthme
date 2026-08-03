import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsUUID } from "class-validator";

export class SetMemberCategoryAllowanceDto {
  @ApiProperty({
    type: [String],
    description:
      "Full replacement set of allowed expense category ids. Empty array = unrestricted.",
  })
  @IsArray()
  @IsUUID("4", { each: true })
  categoryIds!: string[];
}
