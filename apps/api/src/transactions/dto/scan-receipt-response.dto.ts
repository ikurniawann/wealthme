import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

/**
 * EPIC-027 B7 (D13) — the scan result the client fills the transaction form
 * with. `categoryHint` is the model's raw free text (kept so the UI can show
 * what was read); `categoryId` is that hint resolved against the family's
 * REAL categories, or null when nothing matched — the form then leaves the
 * category blank instead of inventing one.
 */
export class ScanReceiptResponseDto {
  @ApiProperty({
    type: Number,
    description: "Detected total in IDR (whole rupiah)",
  })
  amount!: number;

  @ApiProperty({ type: String, description: "Merchant or store name" })
  description!: string;

  @ApiProperty({ type: String, description: "Detected date, ISO 8601" })
  occurredAt!: string;

  @ApiProperty({
    type: String,
    description: "Raw category label returned by the vision model",
  })
  categoryHint!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      "The family's own Category matching categoryHint, or null when no category matched. Never auto-created.",
  })
  categoryId!: string | null;
}
