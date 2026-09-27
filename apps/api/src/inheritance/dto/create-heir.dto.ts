import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

import { IsTrimmedNotEmpty } from "../../common/decorators/is-trimmed-not-empty.decorator";
import { IsUserId } from "../../common/decorators/is-user-id.decorator";

export class CreateHeirDto {
  @ApiProperty()
  @IsString()
  @IsTrimmedNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty()
  @IsString()
  @IsTrimmedNotEmpty()
  @MaxLength(100)
  relationship!: string;

  @ApiProperty({ minimum: 0, maximum: 100 })
  @IsNumber()
  @Min(0)
  @Max(100)
  sharePercent!: number;

  // Decision #9 — optional link to a family-group member (User.id) alongside
  // the free-text name/relationship above. Bugfix (2026-09-26) — NOT
  // `@IsUUID()`: Better Auth ids aren't UUIDs (see
  // accounts/dto/create-account.dto.ts). `IsUserId()` still rejects garbage
  // before it ever reaches the tenant-scope lookup in InheritanceService.
  @ApiPropertyOptional()
  @IsOptional()
  @IsUserId()
  memberUserId?: string;
}
