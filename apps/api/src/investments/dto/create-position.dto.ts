import { InvestmentMarket, InvestmentType } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsDefined,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";

import { CreateInvestmentLedgerDto } from "./investment-ledger.dto";

export class PositionHoldingDto {
  @IsString() @MinLength(1) @MaxLength(200) name!: string;
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^[A-Z0-9._-]+$/i)
  ticker?: string;
  @IsEnum(InvestmentType) type!: InvestmentType;
  @IsEnum(InvestmentMarket) market!: InvestmentMarket;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(64) ownerUserId?: string;
  /** "Shared with others" OFF: only Master / Co-Master see the holding. */
  @IsOptional() @IsBoolean() isPrivate?: boolean;
  @IsOptional() @IsUUID() platformAccountId?: string;
  @IsOptional() @IsBoolean() manualInstrument?: boolean;
  @IsOptional() @IsString() @MaxLength(100) priceSymbol?: string;
  @IsOptional() @IsObject() details?: Record<string, unknown>;
}

/** Metadata + initial event commit together, including the pocket cash leg. */
export class CreatePositionDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => PositionHoldingDto)
  holding!: PositionHoldingDto;
  @IsDefined()
  @ValidateNested()
  @Type(() => CreateInvestmentLedgerDto)
  entry!: CreateInvestmentLedgerDto;
  @IsOptional() @IsBoolean() costBasisKnown?: boolean;
}
