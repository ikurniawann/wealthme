import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional, Matches } from "class-validator";

export class PpnPreviewDto {
  @ApiProperty({ example: "2026-09-26" })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;
  @ApiProperty() @Matches(/^\d{1,15}$/) amount!: string;
  @ApiProperty() @IsBoolean() luxury!: boolean;
  @ApiProperty() @IsBoolean() priceIncludesPpn!: boolean;
}

export class TaxRulesQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;
  @ApiPropertyOptional({ description: "comma-separated rule keys" })
  @IsOptional()
  @Matches(/^[A-Za-z0-9.,]+$/)
  keys?: string;
}
