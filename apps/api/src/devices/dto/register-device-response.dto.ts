import { ApiProperty } from "@nestjs/swagger";

// EPIC-023 D2 (US-FAM-13, D7) — POST /auth/devices response. `deviceSecret`
// is returned ONCE here and never again in recoverable form — the server
// only ever stores `deviceSecretHash` (argon2) from this point on. The
// client persists both fields in localStorage.
export class RegisterDeviceResponseDto {
  @ApiProperty({ type: String })
  deviceId!: string;

  @ApiProperty({
    type: String,
    description:
      "Raw device secret — shown ONCE, never recoverable again. The client must persist it.",
  })
  deviceSecret!: string;
}
