import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";

// POST /family-groups/:id/members/:memberId/password — a Master sets a new
// password for a head-created (managed) login. The field is named
// `newPassword` so AuditInterceptor's SENSITIVE_KEYS strips it from the
// audit row.
export class ResetMemberPasswordDto {
  @ApiProperty({ minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}
