import { ApiProperty } from "@nestjs/swagger";
import { IsNumber, Min } from "class-validator";

// EPIC-023 F2 (D20, US-DON-6/7) — perpuluhan (tithe) has its OWN arithmetic
// (10% of income), not zakat relabelled: US-DON-6 objects specifically to
// treating the two as interchangeable. Its own inputs, its own result
// shape — mirrors ZakatRequestDto/ZakatResultDto's shape in spirit only.
export class PerpuluhanRequestDto {
  @ApiProperty({ description: "Gross income for the period (IDR)" })
  @IsNumber()
  @Min(0)
  income!: number;
}

export class PerpuluhanResultDto {
  @ApiProperty({ description: "The income figure the tithe was computed from" })
  income!: number;

  @ApiProperty({ description: "Perpuluhan due — 10% of income" })
  tithe!: number;
}
