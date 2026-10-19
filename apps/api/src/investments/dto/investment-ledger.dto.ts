import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { FX_CURRENCY_CODES } from "@wealthme/contracts";
import {
  IsIn,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from "class-validator";

import type {
  CreateInvestmentLedgerInput,
  InvestmentTxKind,
  UpdateInvestmentLedgerInput,
  VoidInvestmentLedgerInput,
} from "@wealthme/contracts";

const LEDGER_KINDS: InvestmentTxKind[] = [
  "buy",
  "sell",
  "opening",
  "dividend",
  "coupon",
  "interest",
  "corporate_action",
];
/** Signed decimal, ≤ 16 integer digits and ≤ 8 decimals (Decimal(24,8)). */
const DECIMAL = /^-?\d{1,16}(\.\d{1,8})?$/;
const RATE = /^\d{1,17}(\.\d{1,6})?$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Investasi ledger — POST .../investments/:id/ledger. Semantics per kind in
 * CreateInvestmentLedgerInput (packages/contracts).
 */
export class CreateInvestmentLedgerDto implements CreateInvestmentLedgerInput {
  @ApiProperty({ enum: LEDGER_KINDS })
  @IsIn(LEDGER_KINDS)
  kind!: InvestmentTxKind;

  @ApiProperty({ description: "uuid generated when the form opens (R7)" })
  @IsUUID()
  idempotencyKey!: string;

  @ApiProperty({ example: "2026-10-17" })
  @Matches(DATE)
  effectiveDate!: string;

  @ApiPropertyOptional({ example: "09:30", nullable: true })
  @IsOptional()
  @Matches(TIME)
  effectiveTime?: string | null;

  @ApiPropertyOptional({ example: "Asia/Jakarta", nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timeZone?: string | null;

  @ApiPropertyOptional({ example: "100", description: "Base units" })
  @IsOptional()
  @Matches(DECIMAL)
  quantity?: string;

  @ApiPropertyOptional({ example: "9150" })
  @IsOptional()
  @Matches(DECIMAL)
  pricePerUnit?: string;

  @ApiPropertyOptional({ description: "Default quantity × pricePerUnit" })
  @IsOptional()
  @Matches(DECIMAL)
  grossAmount?: string;

  @ApiPropertyOptional({ example: "1372.5" })
  @IsOptional()
  @Matches(DECIMAL)
  fee?: string;

  @ApiPropertyOptional({ example: "0" })
  @IsOptional()
  @Matches(DECIMAL)
  tax?: string;

  @ApiProperty({ enum: FX_CURRENCY_CODES })
  @IsIn(FX_CURRENCY_CODES)
  currency!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  feeCurrency?: string | null;

  @ApiPropertyOptional({ description: "IDR per 1 unit of currency" })
  @IsOptional()
  @Matches(RATE)
  fxRate?: string | null;

  @ApiPropertyOptional({ example: "2026-10-21", nullable: true })
  @IsOptional()
  @Matches(DATE)
  settlementDate?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: "Omitted → holding default; null → no cash leg",
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  cashAccountId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string | null;
}

/** PATCH .../investments/:id/ledger/:txId — kind and key are fixed. */
export class UpdateInvestmentLedgerDto implements UpdateInvestmentLedgerInput {
  @IsOptional()
  @IsBoolean()
  completeCostBasis?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(DATE)
  effectiveDate?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Matches(TIME)
  effectiveTime?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timeZone?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(DECIMAL)
  quantity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(DECIMAL)
  pricePerUnit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(DECIMAL)
  grossAmount?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(DECIMAL)
  fee?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(DECIMAL)
  tax?: string;

  @ApiPropertyOptional({ enum: FX_CURRENCY_CODES })
  @IsOptional()
  @IsIn(FX_CURRENCY_CODES)
  currency?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  feeCurrency?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Matches(RATE)
  fxRate?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Matches(DATE)
  settlementDate?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  cashAccountId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string | null;
}

export class VoidInvestmentLedgerDto implements VoidInvestmentLedgerInput {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string | null;
}
