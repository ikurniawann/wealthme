import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";

export class RejectAllowanceRequestDto {
  @ApiPropertyOptional({
    type: String,
    description: "Optional rejection reason",
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
