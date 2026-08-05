import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

const DATE_FORMATS = ["DD/MM/YYYY", "MM/DD/YYYY"] as const;

/**
 * EPIC-023 G2 (D17) — one saved column-mapping template per bank per
 * family. POST upserts by `bankCode` (create-or-replace), matching the
 * "saved per bank as a reusable template" decision — a family never
 * accumulates more than one template per bank.
 */
export class UpsertReconciliationTemplateDto {
  @ApiProperty({ example: "BCA" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  bankCode!: string;

  @ApiProperty({ example: "BCA Giro" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: "Tanggal" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  dateColumn!: string;

  @ApiProperty({ example: "Keterangan" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  descriptionColumn!: string;

  @ApiProperty({ example: "Jumlah" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  amountColumn!: string;

  @ApiPropertyOptional({ enum: DATE_FORMATS })
  @IsOptional()
  @IsIn(DATE_FORMATS)
  dateFormat?: (typeof DATE_FORMATS)[number];
}
