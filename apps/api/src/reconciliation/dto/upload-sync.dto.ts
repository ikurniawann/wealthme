import { FX_CURRENCY_CODES } from "@wealthme/contracts";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

import { MAX_STATEMENT_ROWS } from "../statement-reader/statement-reader.port";

// Hardening audit (validation, MEDIUM) — mirrors the BigInt bound this
// value goes through downstream (`BigInt(Math.round(r.amount))` in
// reconciliation.controller.ts), so an out-of-range float fails validation
// instead of silently rounding into an implausible statement row.
const MAX_STATEMENT_AMOUNT = 999_999_999_999;

export class ParsedRowDto {
  @IsString()
  @IsNotEmpty()
  date!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsNumber()
  @Min(-MAX_STATEMENT_AMOUNT)
  @Max(MAX_STATEMENT_AMOUNT)
  amount!: number;

  @IsString()
  @IsOptional()
  @IsIn(FX_CURRENCY_CODES)
  currency?: string;
}

// Hardening audit (validation, MEDIUM) — the legacy `/reconciliation/upload`
// endpoint had an unbounded `rows` array, a float `amount` with no bounds,
// and an unchecked `currency`. Bounded like the newer preview/commit
// statement-draft DTOs (`MAX_STATEMENT_ROWS`).
export class UploadSyncDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_STATEMENT_ROWS)
  @ValidateNested({ each: true })
  @Type(() => ParsedRowDto)
  rows!: ParsedRowDto[];
}
