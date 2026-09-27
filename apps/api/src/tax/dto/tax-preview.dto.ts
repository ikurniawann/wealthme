import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  Matches,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from "class-validator";

export const TAX_DIGITS = /^\d{1,15}$/;
const DIGITS_MSG = "must be a numeric string of up to 15 digits";
export const MARITAL = ["TK", "K", "KI"] as const;
export const DTP_SECTORS = [
  "alas_kaki",
  "tekstil_pakaian",
  "furnitur",
  "kulit",
  "pariwisata",
] as const;

export class PphOpPreviewDto {
  @ApiProperty() @IsInt() @Min(2000) @Max(2100) taxYear!: number;
  @ApiProperty({ enum: MARITAL })
  @IsIn(MARITAL)
  maritalStatus!: (typeof MARITAL)[number];
  @ApiProperty() @IsInt() @Min(0) @Max(3) dependents!: number;
  @ApiProperty()
  @Matches(TAX_DIGITS, { message: `employmentGross ${DIGITS_MSG}` })
  employmentGross!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(TAX_DIGITS)
  pensionContribution?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(TAX_DIGITS)
  freelanceGross?: string;
  @ApiPropertyOptional({ description: "NPPN % in basis points (5000 = 50%)" })
  @ValidateIf(
    (o: PphOpPreviewDto) =>
      o.freelanceGross !== undefined && !/^0+$/.test(o.freelanceGross),
  )
  @IsInt()
  @Min(1)
  @Max(10_000)
  nppnRateBps?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(TAX_DIGITS)
  otherNetIncome?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(TAX_DIGITS) zakat?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(TAX_DIGITS)
  withheldPph21?: string;
}

export class TerDtpProfileDto {
  @ApiPropertyOptional({ enum: DTP_SECTORS, nullable: true })
  @ValidateIf((o: TerDtpProfileDto) => o.sector !== null)
  @IsIn(DTP_SECTORS)
  sector!: (typeof DTP_SECTORS)[number] | null;
  @ApiProperty({ enum: ["permanent", "non_permanent"] })
  @IsIn(["permanent", "non_permanent"])
  employment!: "permanent" | "non_permanent";
  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((o: TerDtpProfileDto) => o.dailyWage !== null)
  @Matches(TAX_DIGITS)
  dailyWage?: string | null;
  @ApiProperty() @IsBoolean() nikValidated!: boolean;
}

export class TerPreviewDto {
  @ApiProperty() @IsInt() @Min(2000) @Max(2100) taxYear!: number;
  @ApiProperty({ enum: MARITAL })
  @IsIn(MARITAL)
  maritalStatus!: (typeof MARITAL)[number];
  @ApiProperty() @IsInt() @Min(0) @Max(3) dependents!: number;
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(12)
  @ArrayMaxSize(12)
  @Matches(TAX_DIGITS, { each: true })
  monthlyGross!: string[];
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(12)
  @ArrayMaxSize(12)
  @Matches(TAX_DIGITS, { each: true })
  monthlyPension?: string[];
  @ApiPropertyOptional({
    type: [String],
    description:
      "Fixed/regular monthly gross excl. THR/bonus, for the DTP cap only; defaults to monthlyGross.",
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(12)
  @ArrayMaxSize(12)
  @Matches(TAX_DIGITS, { each: true })
  monthlyFixedGross?: string[];
  @ApiPropertyOptional() @IsOptional() @Matches(TAX_DIGITS) zakat?: string;
  @ApiPropertyOptional({ type: TerDtpProfileDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => TerDtpProfileDto)
  dtp?: TerDtpProfileDto | null;
}

export class UmkmPreviewDto {
  @ApiProperty() @IsInt() @Min(2000) @Max(2100) taxYear!: number;
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(12)
  @ArrayMaxSize(12)
  @Matches(TAX_DIGITS, { each: true })
  monthlyOmzet!: string[];
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((o: UmkmPreviewDto) => o.firstRegisteredYear !== null)
  @IsInt()
  @Min(1990)
  @Max(2100)
  firstRegisteredYear?: number | null;
}

export class UmkmYearPutDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(12)
  @ArrayMaxSize(12)
  @Matches(TAX_DIGITS, { each: true })
  monthlyOmzet!: string[];
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((o: UmkmYearPutDto) => o.firstRegisteredYear !== null)
  @IsInt()
  @Min(1990)
  @Max(2100)
  firstRegisteredYear?: number | null;
}
