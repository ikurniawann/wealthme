import { ApiProperty } from "@nestjs/swagger";
import { IsString, Matches } from "class-validator";

// EPIC-023 D2 (US-FAM-13, D7) — POST /auth/devices/:deviceId/unlock
// (UNauthenticated — there is no session yet). Two factors, not one:
// possession of `deviceSecret` (bound to this device at a real password
// login) AND the `pin`. Neither alone unlocks anything — see
// DevicesService#unlock.
export class UnlockDeviceDto {
  @ApiProperty({
    type: String,
    description: "The raw device secret persisted client-side at registration",
  })
  @IsString()
  deviceSecret!: string;

  @ApiProperty({ type: String, example: "482913" })
  @Matches(/^\d{6}$/, { message: "pin must be exactly 6 digits" })
  pin!: string;
}
