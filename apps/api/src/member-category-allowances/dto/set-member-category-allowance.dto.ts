import { ApiProperty } from "@nestjs/swagger";
import { ArrayMaxSize, IsArray, IsUUID } from "class-validator";

export class SetMemberCategoryAllowanceDto {
  @ApiProperty({
    type: [String],
    description:
      "Full replacement set of allowed expense category ids. Empty array = unrestricted.",
  })
  @IsArray()
  // A family's expense category list is realistically well under this —
  // caps the allow-list payload against an abusive/malformed request.
  @ArrayMaxSize(200)
  @IsUUID("4", { each: true })
  categoryIds!: string[];
}
