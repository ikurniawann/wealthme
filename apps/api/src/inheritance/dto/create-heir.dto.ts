import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class CreateHeirDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  relationship!: string;

  @ApiProperty({ minimum: 0, maximum: 100 })
  @IsNumber()
  @Min(0)
  @Max(100)
  sharePercent!: number;

  // Decision #9 — optional link to a family-group member (User.id) alongside
  // the free-text name/relationship above. EPIC-023 F1 (D14) — `User.id` is
  // always a uuid (`@default(uuid())`); validating the shape here rejects
  // garbage before it ever reaches the tenant-scope lookup in
  // InheritanceService.
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  memberUserId?: string;
}
