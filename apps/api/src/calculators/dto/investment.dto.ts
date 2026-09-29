import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNumber, IsOptional, Max, Min } from "class-validator";

import { MAX_TAX_AMOUNT } from "./pph21.dto";

// Hardening audit (validation, MEDIUM) — public `@Public` endpoints with
// `@Min(0)` and no `@Max`. Money fields reuse pph21.dto.ts's
// MAX_TAX_AMOUNT; rate/years/compounding get a smaller sanity bound since
// they feed an exponent (an unbounded `years` or `rate` can make the
// compounding math blow up/overflow well before MAX_TAX_AMOUNT matters).
const MAX_RATE_DECIMAL = 100; // 10,000% annual return — generous but finite
const MAX_YEARS = 200;
const MAX_COMPOUNDS_PER_YEAR = 366;

export class InvestmentCalcRequestDto {
  @ApiProperty({ description: "Present value / initial investment (IDR)" })
  @IsNumber()
  @Min(0)
  @Max(MAX_TAX_AMOUNT)
  pv!: number;

  @ApiProperty({ description: "Periodic contribution (IDR)" })
  @IsNumber()
  @Min(0)
  @Max(MAX_TAX_AMOUNT)
  pmt!: number;

  @ApiProperty({ description: "Annual return rate as decimal (e.g. 0.12)" })
  @IsNumber()
  @Min(0)
  @Max(MAX_RATE_DECIMAL)
  rate!: number;

  @ApiProperty({ description: "Duration in years" })
  @IsNumber()
  @Min(0)
  @Max(MAX_YEARS)
  years!: number;

  @ApiPropertyOptional({
    description: "Compounding periods per year (default 12)",
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(MAX_COMPOUNDS_PER_YEAR)
  compoundsPerYear?: number;
}

export class InvestmentCalcResultDto {
  @ApiProperty()
  futureValue!: number;

  @ApiProperty()
  totalContributions!: number;

  @ApiProperty()
  totalInterest!: number;
}

export class KprCalcRequestDto {
  @ApiProperty({ description: "Principal loan amount (IDR)" })
  @IsNumber()
  @Min(0)
  @Max(MAX_TAX_AMOUNT)
  principal!: number;

  @ApiProperty({ description: "Annual interest rate as decimal (e.g. 0.07)" })
  @IsNumber()
  @Min(0)
  @Max(MAX_RATE_DECIMAL)
  annualRate!: number;

  @ApiProperty({ description: "Loan duration in years" })
  @IsNumber()
  @Min(1)
  @Max(MAX_YEARS)
  years!: number;
}

export class KprCalcResultDto {
  @ApiProperty()
  monthlyPayment!: number;

  @ApiProperty()
  totalPayment!: number;

  @ApiProperty()
  totalInterest!: number;
}

export class RetirementCalcRequestDto {
  @ApiProperty({ description: "Target retirement fund (IDR)" })
  @IsNumber()
  @Min(0)
  @Max(MAX_TAX_AMOUNT)
  targetAmount!: number;

  @ApiProperty({ description: "Years until retirement" })
  @IsNumber()
  @Min(1)
  @Max(MAX_YEARS)
  years!: number;

  @ApiProperty({ description: "Annual return rate as decimal" })
  @IsNumber()
  @Min(0)
  @Max(MAX_RATE_DECIMAL)
  annualRate!: number;

  @ApiPropertyOptional({ description: "Existing savings (IDR, default 0)" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(MAX_TAX_AMOUNT)
  existingAmount?: number;
}

export class RetirementCalcResultDto {
  @ApiProperty()
  monthlyContribution!: number;

  @ApiProperty()
  totalContributions!: number;

  @ApiProperty()
  projectedValue!: number;
}
