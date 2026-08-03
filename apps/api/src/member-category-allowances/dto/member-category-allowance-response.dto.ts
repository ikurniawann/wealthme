import { ApiProperty } from "@nestjs/swagger";

class AllowedCategoryDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  name!: string;
}

export class MemberCategoryAllowanceResponseDto {
  @ApiProperty({ type: String })
  memberId!: string;

  @ApiProperty({
    type: [AllowedCategoryDto],
    description: "Empty = unrestricted (backward compatible default)",
  })
  categories!: AllowedCategoryDto[];
}
