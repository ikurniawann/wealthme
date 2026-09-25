import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from "class-validator";

export class CreateGoalContributionDto {
  @ApiProperty({
    description: "Whole rupiah as a digit string, 1..999999999999",
    example: "250000",
  })
  @IsString()
  @Matches(/^[1-9]\d{0,11}$/, {
    message: "amount must be a positive whole-rupiah digit string",
  })
  amount!: string;

  @ApiPropertyOptional({
    description:
      "Account to debit; omit to record progress without moving money",
  })
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @ApiPropertyOptional({
    description: "When the contribution happened (ISO 8601); defaults to now",
  })
  @IsOptional()
  @IsDateString()
  occurredAt?: string;
}
