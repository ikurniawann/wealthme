import { ApiProperty } from "@nestjs/swagger";

// EPIC-023 D1/D6 — read by the frontend on every (app) route mount to decide
// whether to redirect into the forced-password-change screen.
export class PasswordStatusResponseDto {
  @ApiProperty({ type: Boolean })
  mustChangePassword!: boolean;
}
