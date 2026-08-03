import { ApiPropertyOptional, OmitType, PartialType } from "@nestjs/swagger";
import { IsOptional, IsUUID, ValidateIf } from "class-validator";

import { CreateAccountDto } from "./create-account.dto";

// `ownerUserId` is omitted from the base then re-declared below as nullable —
// a class member's type can't be widened (to include `null`) when overriding
// an inherited property, so PartialType(CreateAccountDto) alone can't express
// "explicitly clear back to family-shared".
class UpdateAccountBaseDto extends PartialType(
  OmitType(CreateAccountDto, ["ownerUserId"] as const),
) {}

export class UpdateAccountDto extends UpdateAccountBaseDto {
  // `undefined` (omitted) = leave ownership unchanged; `null` = explicit
  // clear back to family-shared; a string = reassign (validated in
  // accounts.service.ts against Member of the same family group).
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      "EPIC-019 Task A — reassign (Member user id, same family group) or pass null to revert to family-shared. Omit to leave unchanged.",
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  ownerUserId?: string | null;
}
