import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { AccountType } from "@prisma/client";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class CreateAccountDto {
  @ApiProperty({ enum: AccountType, description: "Account type" })
  @IsEnum(AccountType)
  type!: AccountType;

  @ApiProperty({ description: "Account display name" })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @ApiProperty({
    required: false,
    description: "Bank or e-wallet institution name",
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  institution?: string;

  @ApiProperty({
    required: false,
    description: "Masked account or card number",
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  maskedNumber?: string;

  @ApiProperty({
    description:
      "Initial balance in smallest currency unit (e.g. rupiah, no decimals)",
  })
  @IsInt()
  @Min(0)
  balance!: number;

  @ApiProperty({
    required: false,
    default: "IDR",
    description: "ISO 4217 currency code",
  })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({
    type: Boolean,
    default: false,
    description:
      "Hide this account (and its transactions) from `member` viewers in shared family views",
  })
  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;
}
