import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsNumber, IsOptional, Min } from "class-validator";

/** Legal PTKP (non-taxable income threshold) values per UU HPP, TK/0 through K/3. */
export const PTKP_VALUES = [
  54_000_000, 58_500_000, 63_000_000, 67_500_000, 72_000_000,
] as const;

export class Pph21RequestDto {
  @ApiProperty({ description: "Annual gross income (IDR)" })
  @IsNumber()
  @Min(0)
  grossIncome!: number;

  @ApiPropertyOptional({ description: "Zakat paid in the year (reduces PKP)" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  zakatPaid?: number;

  @ApiPropertyOptional({
    description:
      "PTKP (non-taxable income threshold) for the taxpayer's marital/dependents status (IDR): one of TK/0 54.000.000, K/0 58.500.000, K/1 63.000.000, K/2 67.500.000, K/3 72.000.000. Defaults to TK/0 when omitted.",
    enum: PTKP_VALUES,
  })
  @IsOptional()
  @IsIn(PTKP_VALUES)
  ptkp?: number;
}

export class TaxBracketDto {
  @ApiProperty()
  bracket!: string;

  @ApiProperty()
  taxableAmount!: number;

  @ApiProperty()
  rate!: number;

  @ApiProperty()
  tax!: number;
}

export class Pph21ResultDto {
  @ApiProperty()
  grossIncome!: number;

  @ApiProperty()
  biayaJabatan!: number;

  @ApiProperty()
  ptkp!: number;

  @ApiProperty()
  zakatDeduction!: number;

  @ApiProperty()
  pkp!: number;

  @ApiProperty({ type: [TaxBracketDto] })
  taxBreakdown!: TaxBracketDto[];

  @ApiProperty()
  totalTax!: number;

  @ApiProperty()
  effectiveRate!: number;
}
