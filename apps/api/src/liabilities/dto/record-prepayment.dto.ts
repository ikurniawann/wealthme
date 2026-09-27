import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, IsUUID, Matches } from "class-validator";

import { FxInputsProperty, type FxInputDto } from "../../fx/fx-input.dto";
import { PREPAYMENT_MODES, type PrepaymentMode } from "../prepayment.util";

export class RecordPrepaymentDto {
  @ApiProperty({
    description: "Account debited for principal + penalty (same family group)",
  })
  @IsUUID()
  sourceAccountId!: string;

  @ApiProperty({ enum: PREPAYMENT_MODES })
  @IsIn(PREPAYMENT_MODES)
  mode!: PrepaymentMode;

  @ApiPropertyOptional({
    description:
      "Principal to prepay, whole rupiah; required unless mode=full, refused for full",
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: "amount must be a numeric string" })
  amount?: string;

  @ApiPropertyOptional({
    description: "Penalty % of the prepaid principal (0-10), default 1.00",
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{1,2}(\.\d{1,2})?$/, {
    message: "penaltyPercent must be a decimal string",
  })
  penaltyPercent?: string;

  @ApiProperty({
    description:
      "Client-generated UUID, one per simulation; a repeat returns the first record",
  })
  @IsUUID()
  idempotencyKey!: string;

  @FxInputsProperty()
  fxInputs?: FxInputDto[];
}
