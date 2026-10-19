import { ApiPropertyOptional } from "@nestjs/swagger";
import { FX_CURRENCY_CODES, INVESTMENT_MARKET_KEYS } from "@wealthme/contracts";
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

import type {
  InvestmentMarket,
  InvestmentPortfolioValuationQuery,
  InvestmentType,
} from "@wealthme/contracts";

const INVESTMENT_TYPES: InvestmentType[] = [
  "saham",
  "reksa_dana",
  "obligasi",
  "emas",
  "kripto",
  "lainnya",
  "deposito",
];

/** GET …/investments/valuation query (page filters). */
export class PortfolioValuationQueryDto implements InvestmentPortfolioValuationQuery {
  @ApiPropertyOptional({ enum: FX_CURRENCY_CODES, default: "IDR" })
  @IsOptional()
  @IsIn(FX_CURRENCY_CODES as readonly string[])
  displayCurrency?: string;

  // User ids come from the auth provider; not assumed to be uuids.
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  ownerUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  platformAccountId?: string;

  @ApiPropertyOptional({ enum: INVESTMENT_TYPES })
  @IsOptional()
  @IsIn(INVESTMENT_TYPES)
  type?: InvestmentType;

  @ApiPropertyOptional({ enum: INVESTMENT_MARKET_KEYS })
  @IsOptional()
  @IsIn(INVESTMENT_MARKET_KEYS as readonly string[])
  market?: InvestmentMarket;
}
