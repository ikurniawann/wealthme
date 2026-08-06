import { ApiProperty } from "@nestjs/swagger";
import { FamilyReligion } from "@prisma/client";

// EPIC-023 F2 (D20, US-DON-6/7) — mirrors GoldPriceResponseDto's shape
// (the precedent for a family-level manual setting): a single field, read
// by any member, written by the owner only (see updateReligion).
export class FamilyReligionResponseDto {
  @ApiProperty({ enum: FamilyReligion })
  religion!: FamilyReligion;
}
