import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNumber, IsOptional, Min } from "class-validator";

export class InvestmentCalcRequestDto {
  @ApiProperty({ description: "Present value / initial investment (IDR)" })
  @IsNumber()
  @Min(0)
  pv!: number;

  @ApiProperty({ description: "Periodic contribution (IDR)" })
  @IsNumber()
  @Min(0)
  pmt!: number;

  @ApiProperty({ description: "Annual return rate as decimal (e.g. 0.12)" })
  @IsNumber()
  @Min(0)
  rate!: number;

  @ApiProperty({ description: "Duration in years" })
  @IsNumber()
  @Min(0)
  years!: number;

  @ApiPropertyOptional({
    description: "Compounding periods per year (default 12)",
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
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
  principal!: number;

  @ApiProperty({ description: "Annual interest rate as decimal (e.g. 0.07)" })
  @IsNumber()
  @Min(0)
  annualRate!: number;

  @ApiProperty({ description: "Loan duration in years" })
  @IsNumber()
  @Min(1)
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
  targetAmount!: number;

  @ApiProperty({ description: "Years until retirement" })
  @IsNumber()
  @Min(1)
  years!: number;

  @ApiProperty({ description: "Annual return rate as decimal" })
  @IsNumber()
  @Min(0)
  annualRate!: number;

  @ApiPropertyOptional({ description: "Existing savings (IDR, default 0)" })
  @IsOptional()
  @IsNumber()
  @Min(0)
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
