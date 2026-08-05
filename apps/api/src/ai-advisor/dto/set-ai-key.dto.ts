import { ApiProperty } from "@nestjs/swagger";
import { AiProvider } from "@prisma/client";
import { IsEnum, IsNotEmpty, IsString, MaxLength } from "class-validator";

/**
 * EPIC-023 G3 (D16) — bring-your-own AI key. `apiKey` is write-only: it is
 * encrypted immediately (AES-256-GCM via CryptoService) and never echoed
 * back, logged, or included in any error message — see ai-key.service.ts.
 */
export class SetAiKeyDto {
  @ApiProperty({ enum: AiProvider })
  @IsEnum(AiProvider)
  provider!: AiProvider;

  @ApiProperty({ description: "Raw provider API key — never stored plaintext" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(400)
  apiKey!: string;
}
