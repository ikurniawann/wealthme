import { ApiProperty } from "@nestjs/swagger";
import { FamilyReligion } from "@prisma/client";

// EPIC-023 F2 (D20, US-DON-6/7) — mirrors GoldPriceResponseDto's shape
// (the precedent for a family-level manual setting): a single field, read
// by any member, written by the owner only (see updateReligion).
// EPIC-023 Group F fix round (MEDIUM 9) — nullable: `null` is the honest
// "not yet chosen" state for a family that has never had an owner set this,
// distinct from the three real choices in `FamilyReligion`.
export class FamilyReligionResponseDto {
  @ApiProperty({ enum: FamilyReligion, nullable: true })
  religion!: FamilyReligion | null;
}
