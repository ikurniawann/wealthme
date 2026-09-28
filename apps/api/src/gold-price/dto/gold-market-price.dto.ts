import { ApiProperty } from "@nestjs/swagger";

/** B9 — GET /gold-price/antam response shape. */
export class GoldMarketPriceDto {
  @ApiProperty({
    nullable: true,
    description:
      "Antam 1 kg bar price in IDR (integer digits), or null when nothing has ever been cached and the live fetch also failed.",
  })
  pricePerKgIdr!: string | null;

  @ApiProperty({ nullable: true, example: "emasantam" })
  source!: string | null;

  @ApiProperty({
    nullable: true,
    description: "ISO timestamp of the cached/fetched value.",
  })
  fetchedAt!: string | null;

  @ApiProperty({
    description:
      "True when this is a retained cached value because the live fetch just failed.",
  })
  stale!: boolean;
}
