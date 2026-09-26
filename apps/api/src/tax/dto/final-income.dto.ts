import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from "class-validator";

import { FINAL_INSTRUMENTS } from "../../tax-engine/final-tax.engine";

import { TAX_DIGITS } from "./tax-preview.dto";

import type { FinalInstrument } from "../../tax-engine/final-tax.engine";

export class CreateFinalIncomeEntryDto {
  @ApiProperty({ enum: FINAL_INSTRUMENTS })
  @IsIn(FINAL_INSTRUMENTS)
  instrument!: FinalInstrument;
  @ApiProperty() @Matches(TAX_DIGITS) grossAmount!: string;
  @ApiProperty({ example: "2026-05-04" })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  occurredAt!: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() reinvested?: boolean;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((o: CreateFinalIncomeEntryDto) => o.rateBpsOverride !== null)
  @IsInt()
  @Min(0)
  @Max(10_000)
  rateBpsOverride?: number | null;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((o: CreateFinalIncomeEntryDto) => o.investmentId !== null)
  @IsUUID()
  investmentId?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((o: CreateFinalIncomeEntryDto) => o.accountId !== null)
  @IsUUID()
  accountId?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((o: CreateFinalIncomeEntryDto) => o.notes !== null)
  @IsString()
  @MaxLength(200)
  notes?: string | null;
}
export class UpdateFinalIncomeEntryDto extends PartialType(
  CreateFinalIncomeEntryDto,
) {}

export class TaxYearQueryDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;
}

export class CryptoExchangeProfileDto {
  @ApiProperty({ enum: ["domestik", "luar_negeri"], nullable: true })
  @ValidateIf((o: CryptoExchangeProfileDto) => o.cryptoExchange !== null)
  @IsIn(["domestik", "luar_negeri"])
  cryptoExchange!: "domestik" | "luar_negeri" | null;
}
