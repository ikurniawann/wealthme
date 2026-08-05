import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { MemberRelationship, Role } from "@prisma/client";
import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

// EPIC-023 D1/D6 (US-FAM-12, US-AUTH-9) — head-created dependant/operational
// member: name + username + initial password, no email. `role` accepts any
// `Role` here (shape validation only) so an out-of-range value is rejected
// by the SERVICE with a code-carrying `INVALID_ROLE_FOR_DEPENDANT_CREATION`
// error instead of class-validator's generic 400 — see
// FamilyGroupsService#createDependantMember.
//
// `username` pattern/length mirror better-auth's OWN `username` plugin
// defaults exactly, verified against the installed version's source
// (node_modules/.../better-auth/dist/plugins/username/index.mjs):
// `defaultUsernameValidator` = /^[a-zA-Z0-9_.]+$/, minUsernameLength = 3,
// maxUsernameLength = 30. Rejecting here first gives a clean 400 before the
// value ever reaches the credential-creation transaction below.
const USERNAME_PATTERN = /^[a-zA-Z0-9_.]+$/;

export class CreateDependantMemberDto {
  @ApiProperty({ example: "Adit", description: "Display name" })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({
    example: "adit_kecil",
    minLength: 3,
    maxLength: 30,
    description:
      "Login username, 3-30 chars, letters/numbers/underscore/dot only",
  })
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(USERNAME_PATTERN, {
    message:
      "username may only contain letters, numbers, underscores, and dots",
  })
  username!: string;

  @ApiProperty({
    example: "changeMe123",
    minLength: 8,
    description:
      "Initial password (min 8 characters) — the member must change it at first login",
  })
  @IsString()
  @MinLength(8)
  initialPassword!: string;

  @ApiProperty({
    enum: Role,
    description: "Must be 'dependant' or 'operational' (enforced server-side)",
  })
  @IsEnum(Role)
  role!: Role;

  @ApiPropertyOptional({
    enum: MemberRelationship,
    description:
      "Purely descriptive kinship (EPIC-023 Task C, D1) — carries no permission of its own.",
  })
  @IsOptional()
  @IsEnum(MemberRelationship)
  relationship?: MemberRelationship;
}
