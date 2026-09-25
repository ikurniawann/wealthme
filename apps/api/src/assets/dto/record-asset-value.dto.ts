import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from "class-validator";

/**
 * EPIC-033 group 3 (p17) — "Add History": a dated valuation entered by a
 * member, either as the new value or as a percent change on the latest one.
 * Exactly one of `value` / `changePercent` must be given (checked in the
 * service so the error names the field).
 */
export class RecordAssetValueDto {
  @ApiPropertyOptional({
    example: "3250000000",
    description: "New value, integer Rupiah string",
  })
  @IsOptional()
  @Matches(/^\d+$/, { message: "value must be an integer string" })
  value?: string;

  @ApiPropertyOptional({
    example: "-2.5",
    description: "Percent change on the current value",
  })
  @IsOptional()
  @Matches(/^-?\d+(\.\d{1,2})?$/, {
    message: "changePercent must be a decimal string with up to 2 places",
  })
  changePercent?: string;

  @ApiPropertyOptional({ example: "2026-09-25" })
  @IsOptional()
  @IsISO8601()
  recordedAt?: string;

  @ApiPropertyOptional({ example: "Taksiran notaris" })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}
