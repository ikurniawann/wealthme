import { ApiProperty } from "@nestjs/swagger";

// EPIC-023 D2 (US-FAM-13, D7) — successful-unlock response. `token` is a
// real BaSession token, formatted exactly like the token
// `authClient.useSession()` reads from a normal better-auth login (see
// DevicesService#unlock), so the frontend can drop it into the same
// client-side session state without a second auth pathway.
export class UnlockDeviceResponseDto {
  @ApiProperty({ type: String })
  token!: string;
}
