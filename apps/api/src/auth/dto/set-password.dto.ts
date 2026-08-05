import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

// EPIC-023 D1/D6 (US-FAM-12, US-AUTH-9) — used by POST /auth/set-password,
// the forced first-login password change for a head-created dependant/
// operational member. Requiring `currentPassword` (the initial password the
// head handed them) — not just a valid session — is defense-in-depth: a
// stolen bearer token alone cannot silently take over the account.
export class SetPasswordDto {
  @ApiProperty()
  @IsString()
  currentPassword!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}
