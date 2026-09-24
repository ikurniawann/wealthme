import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

const MAX_AMOUNT = 999_999_999_999;

export class UpdateGoalDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10)
  icon?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @IsPositive()
  @Max(MAX_AMOUNT)
  targetAmount?: number;

  // EPIC-022 A4/C9 — `0` must be a legal value: a fresh goal is created with
  // `currentAmount: 0`, so `@IsPositive()` (which rejects 0, unlike
  // `@IsOptional()` which only skips `undefined`) 400'd every edit of a
  // brand-new goal, and there was no way to withdraw/clear a goal back to
  // 0 either. `@Min(0)` still rejects negative values.
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_AMOUNT)
  currentAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  targetDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @IsPositive()
  @Max(MAX_AMOUNT)
  autoDebitAmount?: number;

  @ApiPropertyOptional({
    description: "EPIC-033 group 5 — day of month (1-28) the auto-debit runs",
    example: 25,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(28)
  autoDebitDay?: number;
}
