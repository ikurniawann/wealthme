import { ApiProperty } from "@nestjs/swagger";

export class TokenPairDto {
  @ApiProperty({
    type: String,
    description: "Short-lived JWT access token",
    example: "eyJhbGci...",
  })
  accessToken!: string;

  @ApiProperty({
    type: String,
    description: "Long-lived refresh token (rotate on each use)",
    example: "eyJhbGci...",
  })
  refreshToken!: string;
}
