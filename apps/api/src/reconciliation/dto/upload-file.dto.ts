import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";

/**
 * EPIC-023 G2 (D17) — the non-file form field alongside the multipart
 * upload. `bankCode` selects a saved column-mapping template; omitted, the
 * server falls back to header-alias auto-detection (reconciliation-parsers.ts).
 */
export class UploadFileDto {
  @ApiPropertyOptional({ example: "BCA" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  bankCode?: string;
}
