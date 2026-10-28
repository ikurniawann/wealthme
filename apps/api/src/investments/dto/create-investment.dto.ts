import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { InvestmentType } from "@prisma/client";
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from "class-validator";

import { FxInputsProperty, type FxInputDto } from "../../fx/fx-input.dto";

export class CreateInvestmentDto {
  // E2E round-2 B1 — only saham/kripto ever reach MarketDataPort (see
  // AUTOMATED_PRICE_TYPES); every other type has no real ticker (a
  // deposito at a bank, emas fisik, ...). Format is checked whenever a
  // value IS given; whether ticker is REQUIRED for this dto.type is
  // enforced in InvestmentsService.create, which needs `type`'s value —
  // not expressible cleanly with per-property class-validator decorators.
  @ApiPropertyOptional({
    example: "BBCA",
    description: "Wajib untuk saham dan kripto (dipakai sinkronisasi harga).",
  })
  @ValidateIf((o: CreateInvestmentDto) => Boolean(o.ticker))
  @IsString()
  @MaxLength(20)
  @Matches(/^[A-Z0-9._-]{1,20}$/i, {
    message: "ticker must be alphanumeric (A-Z, 0-9, ., _, -)",
  })
  ticker?: string;

  @ApiProperty({ example: "Bank Central Asia" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiProperty({ enum: InvestmentType })
  @IsEnum(InvestmentType)
  type!: InvestmentType;

  @ApiProperty({ example: "10.5", description: "Decimal string" })
  @IsNumberString()
  quantity!: string;

  @ApiProperty({ example: "5000.00", description: "Decimal string" })
  @IsNumberString()
  costBasisPerUnit!: string;

  @ApiPropertyOptional({ example: "IDR" })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional({
    example: "6.50",
    description:
      "Annual interest rate (%) for interest-bearing instruments (obligasi, deposito). Must be between 0 and 100.",
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: "interestRatePct must be a decimal string, e.g. '6.50'",
  })
  interestRatePct?: string;

  @ApiPropertyOptional({
    example: "2026-01-01",
    description: "EPIC-024 C2/C3 (D7) — tanggal beli, ISO 8601 date string.",
  })
  @IsOptional()
  @IsDateString()
  purchasedAt?: string;

  @ApiPropertyOptional({
    example: "2027-01-01",
    description:
      "EPIC-024 C2/C3 (D10) — deposito's jatuh tempo, ISO 8601 date string. Meaningless for any other type but not rejected — mirrors interestRatePct's leniency.",
  })
  @IsOptional()
  @IsDateString()
  maturityDate?: string;

  @FxInputsProperty()
  fxInputs?: FxInputDto[];

  @ApiPropertyOptional({
    description:
      "Shared-with-others toggle OFF: hidden from plain members (Owner / Co-Master / admin_staff still see it).",
  })
  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;
}
