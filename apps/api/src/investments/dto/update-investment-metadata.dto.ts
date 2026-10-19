import { InvestmentMarket } from "@prisma/client";
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";
export class UpdateInvestmentMetadataDto {
  @IsEnum(InvestmentMarket) market!: InvestmentMarket;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) name?: string;
  @IsOptional() @IsString() @MaxLength(64) ownerUserId?: string | null;
  @IsOptional() @IsUUID() platformAccountId?: string | null;
  @IsOptional() @IsUUID() cashAccountId?: string | null;
  @IsOptional() @IsString() @MaxLength(100) priceSymbol?: string | null;
  @IsOptional() @IsBoolean() manualInstrument?: boolean;
}
