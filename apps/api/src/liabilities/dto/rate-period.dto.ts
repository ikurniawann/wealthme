import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { RatePeriodKind } from "@prisma/client";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from "class-validator";

export class RatePeriodDto {
  @ApiProperty({ enum: RatePeriodKind })
  @IsEnum(RatePeriodKind)
  kind!: RatePeriodKind;

  @ApiPropertyOptional({
    nullable: true,
    type: Number,
    minimum: 1,
    maximum: 600,
    description:
      "Installments this period covers; null/omitted only on the last period (runs to maturity)",
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(600)
  months?: number | null;

  @ApiProperty({ description: "Annual rate or margin, e.g. '3.50' (0-30)" })
  @IsString()
  @Matches(/^\d{1,2}(\.\d{1,2})?$/, {
    message: "ratePercent must be a decimal string",
  })
  ratePercent!: string;
}
