import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";

// EPIC-031 — the "kode keluarga" in `<username>@<kode>`. Pattern is enforced
// by FamilyGroupsService#updateLoginHandle (FAMILY_HANDLE_PATTERN).
export class UpdateLoginHandleDto {
  @ApiProperty({ example: "arsandi", minLength: 3, maxLength: 24 })
  @IsString()
  @MinLength(3)
  @MaxLength(24)
  handle!: string;
}
