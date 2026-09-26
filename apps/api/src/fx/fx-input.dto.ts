import { applyDecorators } from "@nestjs/common";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  FOREIGN_FX_CURRENCY_CODES,
  type ForeignFxCurrencyCode,
} from "@wealthme/contracts";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from "class-validator";

export const FX_INPUTS_MAX = 64;

export class FxInputDto {
  @ApiProperty({
    example: "balance",
    description:
      "DTO property this replaces; array items as participants.0.amountOwed",
  })
  @IsString()
  @MaxLength(96)
  @Matches(/^[A-Za-z]+(\.(0|[1-9]\d{0,2})\.[A-Za-z]+)?$/)
  field!: string;

  @ApiProperty({ enum: FOREIGN_FX_CURRENCY_CODES })
  @IsIn(FOREIGN_FX_CURRENCY_CODES)
  currency!: ForeignFxCurrencyCode;

  @ApiProperty({
    example: "1250.50",
    description:
      "Canonical decimal, '.' separator, at most the currency's minor digits",
  })
  @IsString()
  @Matches(/^-?\d{1,13}(\.\d{1,2})?$/)
  amount!: string;
}

/** Revisi I — optional foreign-currency originals; the server converts them and overwrites the named IDR fields. */
export function FxInputsProperty(): PropertyDecorator {
  return applyDecorators(
    ApiPropertyOptional({
      type: [FxInputDto],
      description:
        "Foreign-currency inputs. Omit entirely for IDR. The server converts each to IDR and overwrites `field`.",
    }),
    IsOptional(),
    IsArray(),
    ArrayMaxSize(FX_INPUTS_MAX),
    ValidateNested({ each: true }),
    Type(() => FxInputDto),
  );
}
