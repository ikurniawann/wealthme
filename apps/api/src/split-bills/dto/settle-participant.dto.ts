import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional } from "class-validator";

export class SettleParticipantDto {
  @ApiPropertyOptional({ description: "Override paid-at timestamp (ISO 8601)" })
  @IsOptional()
  @IsDateString()
  paidAt?: string;
}
