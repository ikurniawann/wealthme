import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsNumber, IsOptional, Min } from "class-validator";

export class ZakatRequestDto {
  @ApiProperty({ description: "Total cash holdings (IDR)" })
  @IsNumber()
  @Min(0)
  cash!: number;

  @ApiProperty({ description: "Total investment value (IDR)" })
  @IsNumber()
  @Min(0)
  investments!: number;

  @ApiProperty({ description: "Total gold value (IDR)" })
  @IsNumber()
  @Min(0)
  gold!: number;

  @ApiProperty({ description: "Total short-term / due liabilities (IDR)" })
  @IsNumber()
  @Min(0)
  liabilities!: number;

  @ApiProperty({
    description:
      "Whether this wealth has been held for a full lunar year (haul). A balance-sheet snapshot alone cannot confirm haul — without it, the result is an estimate, not a settled obligation.",
  })
  @IsBoolean()
  haulConfirmed!: boolean;

  @ApiPropertyOptional({
    description:
      "Owner-maintained FamilyGroup.goldPricePerGram (IDR). When provided, nisab = 85g × this price; omit to fall back to the indicative constant.",
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  goldPricePerGram?: number;
}

export class ZakatResultDto {
  @ApiProperty()
  zakatable!: number;

  @ApiProperty()
  nisab!: number;

  @ApiProperty()
  zakat!: number;

  @ApiProperty({
    description:
      "Whether zakatable wealth meets/exceeds nisab (threshold only — does not by itself confirm haul).",
  })
  meetsNisab!: boolean;

  @ApiProperty({
    description:
      "True only when nisab is met AND haul is confirmed by the caller.",
  })
  isObligated!: boolean;

  @ApiProperty({ enum: ["family", "indicative"] })
  nisabSource!: "family" | "indicative";
}
