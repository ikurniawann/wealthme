import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";

// EPIC-023 D2 (US-FAM-13, D7) — POST /auth/devices. `label` is best-effort
// display only (e.g. "iPhone browser") — never load-bearing for security.
export class RegisterDeviceDto {
  @ApiPropertyOptional({
    type: String,
    maxLength: 100,
    description: "Best-effort display label (e.g. 'iPhone browser')",
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;
}
