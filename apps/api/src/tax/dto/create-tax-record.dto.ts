import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { SptStatus } from "@prisma/client";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from "class-validator";

// EPIC-024 Group E (E1) — `grossIncome`/`ptkp`/`netTax` land in a Postgres
// `BigInt` column (schema.prisma TaxRecord), whose signed range tops out
// around 9.2e18. Capping the digit count at 15 keeps every accepted value
// well inside both that range and Number.MAX_SAFE_INTEGER (~9.007e15), so
// nothing here can silently overflow or lose precision downstream. The
// previous `/^\d+$/` had no upper bound at all — an unbounded digit string
// from the client (e.g. a `String(1e21)`-style scientific-notation escape)
// could reach this far without ever tripping the regex.
const MAX_TAX_DIGITS = 15;
const NUMERIC_STRING_PATTERN = new RegExp(`^\\d{1,${MAX_TAX_DIGITS}}$`);
const NUMERIC_STRING_MESSAGE = (field: string) =>
  `${field} must be a numeric string of up to ${MAX_TAX_DIGITS} digits`;

export class CreateTaxRecordDto {
  @ApiProperty({ description: "Tax year e.g. 2024" })
  @IsInt()
  @Min(2000)
  @Max(2100)
  taxYear!: number;

  @ApiProperty({ description: "Gross income as numeric string" })
  @IsString()
  @Matches(NUMERIC_STRING_PATTERN, {
    message: NUMERIC_STRING_MESSAGE("grossIncome"),
  })
  grossIncome!: string;

  @ApiProperty({ description: "PTKP amount as numeric string" })
  @IsString()
  @Matches(NUMERIC_STRING_PATTERN, { message: NUMERIC_STRING_MESSAGE("ptkp") })
  ptkp!: string;

  @ApiPropertyOptional({ description: "Net tax as numeric string" })
  @IsOptional()
  @IsString()
  @Matches(NUMERIC_STRING_PATTERN, {
    message: NUMERIC_STRING_MESSAGE("netTax"),
  })
  netTax?: string;

  @ApiPropertyOptional({ enum: SptStatus })
  @IsOptional()
  @IsEnum(SptStatus)
  sptStatus?: SptStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  documentUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
