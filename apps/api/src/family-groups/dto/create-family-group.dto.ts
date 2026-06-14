import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";

export class CreateFamilyGroupDto {
  @ApiProperty({ type: String, description: "Family group name" })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;
}
