import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";

import { FxInputsProperty, type FxInputDto } from "../../fx/fx-input.dto";

export class CreateAllowanceRequestDto {
  @ApiProperty({
    type: String,
    description: "The requester's OWN account to be funded",
  })
  @IsUUID()
  targetAccountId!: string;

  @ApiProperty({
    type: Number,
    description: "Requested amount in smallest currency unit",
  })
  @IsInt()
  @IsPositive()
  amount!: number;

  @ApiPropertyOptional({ type: String, description: "Optional note" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiPropertyOptional({
    type: String,
    description:
      "EPIC-033 R5 — the family-shared account the member asks to be funded FROM. " +
      "Pre-fills the source at approval; the approver may still override it.",
  })
  @IsOptional()
  @IsUUID()
  fromAccountId?: string;

  @FxInputsProperty()
  fxInputs?: FxInputDto[];
}
