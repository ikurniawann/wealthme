import { ApiProperty, ApiPropertyOptional, OmitType } from "@nestjs/swagger";
import { PocketKind } from "@prisma/client";
import { FX_CURRENCY_CODES } from "@wealthme/contracts";
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

import { IsTrimmedNotEmpty } from "../../common/decorators/is-trimmed-not-empty.decorator";
import { FxInputsProperty, type FxInputDto } from "../../fx/fx-input.dto";

const MAX_BALANCE = 999_999_999_999;

/**
 * Investasi R2 — a cash pocket ("kantong dana") at a platform account. It is
 * stored as an `Account` of type `investment`; the balance is IDR like every
 * account.
 */
export class CreatePocketDto {
  @ApiProperty({ enum: PocketKind })
  @IsEnum(PocketKind)
  pocketKind!: PocketKind;

  @ApiPropertyOptional({
    enum: FX_CURRENCY_CODES,
    description:
      "Native currency. usd → USD; rdn/crypto → IDR; general → any (default IDR).",
  })
  @IsOptional()
  @IsIn(FX_CURRENCY_CODES)
  currency?: string;

  @ApiPropertyOptional({
    description: 'Display name; default "<platform> · <kind>"',
  })
  @IsOptional()
  @IsString()
  @IsTrimmedNotEmpty()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    description:
      "Opening balance, IDR integer (send fxInputs for a foreign amount). Default 0.",
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_BALANCE)
  balance?: number;

  @ApiPropertyOptional({ type: Boolean, default: false })
  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;

  @FxInputsProperty()
  fxInputs?: FxInputDto[];
}

/** A pocket inside POST /platform-accounts (fxInputs live on the parent). */
export class PlatformPocketItemDto extends OmitType(CreatePocketDto, [
  "fxInputs",
] as const) {}
