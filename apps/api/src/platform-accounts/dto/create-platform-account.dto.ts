import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";

import { IsTrimmedNotEmpty } from "../../common/decorators/is-trimmed-not-empty.decorator";
import { FxInputsProperty, type FxInputDto } from "../../fx/fx-input.dto";

import { PlatformPocketItemDto } from "./create-pocket.dto";

export const MAX_POCKETS_PER_CREATE = 4;

export class CreatePlatformAccountDto {
  @ApiProperty({
    description: 'INVESTMENT_PLATFORMS key ("ajaib", "gotrade", …) or "custom"',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  platformKey!: string;

  @ApiPropertyOptional({ description: 'Required when platformKey = "custom"' })
  @IsOptional()
  @IsString()
  @IsTrimmedNotEmpty()
  @MaxLength(120)
  customName?: string;

  @ApiPropertyOptional({
    description:
      "Owning member's user id; omit for family-shared (non-Master roles are pinned to themselves).",
  })
  @IsOptional()
  // Not @IsUUID(): better-auth user ids are not UUIDs (see CreateAccountDto).
  @IsString()
  @MinLength(1)
  ownerUserId?: string;

  @ApiPropertyOptional({ description: 'e.g. "Akun utama", "Akun anak"' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @ApiPropertyOptional({
    description: "SID / client code at the platform. Stored encrypted.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  accountRef?: string;

  @ApiPropertyOptional({ type: [PlatformPocketItemDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_POCKETS_PER_CREATE)
  @ValidateNested({ each: true })
  @Type(() => PlatformPocketItemDto)
  pockets?: PlatformPocketItemDto[];

  /** Foreign opening balances as `pockets.<i>.balance`. */
  @FxInputsProperty()
  fxInputs?: FxInputDto[];
}
