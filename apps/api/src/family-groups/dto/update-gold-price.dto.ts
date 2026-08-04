import { ApiProperty } from "@nestjs/swagger";
import { IsInt, Min } from "class-validator";

// EPIC-021 Group F (#6) — a single owner-editable gold price per gram (IDR,
// smallest currency unit, no decimals — mirrors CreateAccountDto.balance).
// No live gold price feed exists or may be fabricated (Open Design
// Decision #6); this is manual master data, not a market quote.
export class UpdateGoldPriceDto {
  @ApiProperty({
    description: "Gold price per gram in IDR (must be a positive integer)",
  })
  @IsInt()
  @Min(1)
  pricePerGram!: number;
}
