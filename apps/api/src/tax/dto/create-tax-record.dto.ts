import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { SptStatus } from "@prisma/client";
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateIf,
} from "class-validator";

import { MARITAL } from "./tax-preview.dto";

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

  @ApiPropertyOptional({
    description:
      "PTKP amount as numeric string; required unless maritalStatus is set",
  })
  @ValidateIf((o: CreateTaxRecordDto) => o.maritalStatus == null)
  @IsString()
  @Matches(NUMERIC_STRING_PATTERN, { message: NUMERIC_STRING_MESSAGE("ptkp") })
  ptkp?: string;

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

  @ApiPropertyOptional({ enum: MARITAL })
  @IsOptional()
  @IsIn(MARITAL)
  maritalStatus?: "TK" | "K" | "KI";

  @ApiPropertyOptional()
  @ValidateIf((o: CreateTaxRecordDto) => o.maritalStatus != null)
  @IsInt()
  @Min(0)
  @Max(3)
  dependents?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(NUMERIC_STRING_PATTERN, {
    message: NUMERIC_STRING_MESSAGE("pensionContribution"),
  })
  pensionContribution?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(NUMERIC_STRING_PATTERN, {
    message: NUMERIC_STRING_MESSAGE("freelanceGross"),
  })
  freelanceGross?: string;

  @ApiPropertyOptional({ description: "NPPN % in basis points (5000 = 50%)" })
  @ValidateIf(
    (o: CreateTaxRecordDto) =>
      o.freelanceGross !== undefined && !/^0+$/.test(o.freelanceGross),
  )
  @IsInt()
  @Min(1)
  @Max(10_000)
  nppnRateBps?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(NUMERIC_STRING_PATTERN, {
    message: NUMERIC_STRING_MESSAGE("otherNetIncome"),
  })
  otherNetIncome?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(NUMERIC_STRING_PATTERN, {
    message: NUMERIC_STRING_MESSAGE("withheldPph21"),
  })
  withheldPph21?: string;
}
