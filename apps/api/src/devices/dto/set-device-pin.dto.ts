import { ApiProperty } from "@nestjs/swagger";
import { Matches } from "class-validator";

// EPIC-023 D2 (US-FAM-13, D7) — POST /auth/devices/:deviceId/pin. Exactly 6
// digits, enforced ONCE here via `@Matches` + the global `ValidationPipe`
// (see apps/api/src/main.ts) — a 400 is returned before this ever reaches
// DevicesService#setPin, which performs no redundant re-check. (Fixed
// stale comment — typescript-reviewer flagged the previous wording as
// claiming a service-layer re-check that does not exist; a single
// enforcement point at the DTO/pipe boundary is sufficient here, so no
// re-check was added.)
export class SetDevicePinDto {
  @ApiProperty({
    type: String,
    example: "482913",
    description: "Exactly 6 digits",
  })
  @Matches(/^\d{6}$/, { message: "pin must be exactly 6 digits" })
  pin!: string;
}
