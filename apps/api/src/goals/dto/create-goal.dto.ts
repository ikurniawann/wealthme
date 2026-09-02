import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
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

export class CreateGoalDto {
  @ApiProperty()
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10)
  icon?: string;

  @ApiProperty()
  @IsInt()
  @IsPositive()
  @Max(MAX_AMOUNT)
  targetAmount!: number;

  // EPIC-022 C8 — the "Sudah Terkumpul" (already collected) amount the
  // create form collects. Was silently discarded to `0n` in the service
  // before this: a family starting a goal with existing savings had that
  // progress erased the moment they saved it. `@Min(0)` (not
  // `@IsPositive()`) so starting a goal already fully funded (or at 0) is a
  // legal value, same reasoning as `UpdateGoalDto.currentAmount` (C9).
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
}
