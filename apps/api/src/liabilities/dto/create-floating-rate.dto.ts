import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from "class-validator";

export class CreateFloatingRateDto {
  @ApiProperty({
    description: "Date the new rate takes effect (bank notice), YYYY-MM-DD",
  })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: "effectiveDate must be YYYY-MM-DD",
  })
  @IsDateString({ strict: true })
  effectiveDate!: string;

  @ApiProperty({ description: "New annual floating rate, e.g. '9.75' (0-30)" })
  @IsString()
  @Matches(/^\d{1,2}(\.\d{1,2})?$/, {
    message: "ratePercent must be a decimal string",
  })
  ratePercent!: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}
