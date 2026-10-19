import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";

/**
 * `undefined` leaves a field unchanged; `null` clears it. `platformKey` is
 * fixed after creation (holdings and pockets were chosen for that platform).
 */
export class UpdatePlatformAccountDto {
  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  customName?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(120)
  label?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(64)
  accountRef?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      "Reassign (Member user id) or null for family-shared. The pockets follow the new owner.",
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MinLength(1)
  ownerUserId?: string | null;
}
