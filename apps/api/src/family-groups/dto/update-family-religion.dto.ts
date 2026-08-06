import { ApiProperty } from "@nestjs/swagger";
import { FamilyReligion } from "@prisma/client";
import { IsEnum } from "class-validator";

// EPIC-023 F2 (D20, US-DON-6/7) — owner-only write (see
// FamilyGroupsService.updateReligion / the "manage FamilyGroup" CASL grant).
export class UpdateFamilyReligionDto {
  @ApiProperty({ enum: FamilyReligion })
  @IsEnum(FamilyReligion)
  religion!: FamilyReligion;
}
