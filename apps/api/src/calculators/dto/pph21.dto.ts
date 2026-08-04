import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNumber, IsOptional, Min } from "class-validator";

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
      "PTKP (non-taxable income threshold) for the taxpayer's marital/dependents status (IDR). Defaults to TK/0 (Rp 54.000.000) when omitted.",
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
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
