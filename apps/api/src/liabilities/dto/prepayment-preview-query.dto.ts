import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, Matches } from "class-validator";

import type { PrepaymentMode } from "../prepayment.util";

const MODES: PrepaymentMode[] = ["full", "reduce_tenor", "reduce_installment"];

export class PrepaymentPreviewQueryDto {
  @ApiProperty({ enum: MODES })
  @IsIn(MODES)
  mode!: PrepaymentMode;

  @ApiPropertyOptional({
    description:
      "Principal to prepay, whole rupiah (IDR only); required unless mode=full",
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
}
