import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

// EPIC-023 D2 (US-FAM-13, D7) — GET /auth/devices row shape. Structurally
// excludes `deviceSecretHash`/`pinHash` — this type has no field for either,
// so DevicesService#toDeviceDto cannot accidentally leak them by forgetting
// to omit a field; it can only leak by literally adding a new property here.
export class DeviceResponseDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  label!: string | null;

  @ApiProperty({ type: Boolean, description: "Whether a PIN has been set" })
  hasPinSet!: boolean;

  @ApiProperty({ type: String, format: "date-time" })
  createdAt!: string;

  @ApiProperty({ type: String, format: "date-time" })
  lastUsedAt!: string;
}
