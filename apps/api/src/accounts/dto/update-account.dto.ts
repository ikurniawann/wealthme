import { ApiPropertyOptional, OmitType, PartialType } from "@nestjs/swagger";
import { IsOptional, IsString, MinLength, ValidateIf } from "class-validator";

import { CreateAccountDto } from "./create-account.dto";

// `ownerUserId` is omitted from the base then re-declared below as nullable —
// a class member's type can't be widened (to include `null`) when overriding
// an inherited property, so PartialType(CreateAccountDto) alone can't express
// "explicitly clear back to family-shared".
//
// `balance` (and the `fxInputs` that only ever converted it) are omitted on
// purpose: after creation an account's balance is the running sum of its
// transactions. Letting the edit form overwrite it silently erased every
// transaction recorded before the overwrite (staging, 2026-10-13: a
// Rp 212.000 expense vanished from a card after its balance was retyped).
// The global ValidationPipe runs with `whitelist: true`, so an older client
// that still sends `balance` has it stripped instead of failing the edit.
class UpdateAccountBaseDto extends PartialType(
  OmitType(CreateAccountDto, ["ownerUserId", "balance", "fxInputs"] as const),
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
  // NOT `@IsUUID()` — see the note on `CreateAccountDto.ownerUserId`:
  // better-auth issues non-UUID ids to every user who registers, so this
  // rejected every real owner and only accepted the seeded demo user.
  @IsString()
  @MinLength(1)
  ownerUserId?: string | null;
}
