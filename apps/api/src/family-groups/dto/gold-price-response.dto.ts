import { ApiProperty } from "@nestjs/swagger";

// EPIC-021 Group F (#6) — pricePerGram is a serialized BigInt string (same
// convention as NetWorthDto's totals), null until an owner sets one.
export class GoldPriceResponseDto {
  @ApiProperty({ type: String, nullable: true })
  pricePerGram!: string | null;

  @ApiProperty({ type: String, format: "date-time", nullable: true })
  updatedAt!: string | null;
}
