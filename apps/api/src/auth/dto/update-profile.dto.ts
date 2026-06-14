import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateProfileDto {
  @ApiPropertyOptional({ type: String, description: "Display name" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    type: String,
    description: "Two-letter avatar initials",
  })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  avatarInitials?: string;
}
