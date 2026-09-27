import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsUUID, Matches } from "class-validator";

import { FxInputsProperty, type FxInputDto } from "../../fx/fx-input.dto";

export class PayLiabilityDto {
  @ApiProperty({
    description: "Account the payment is debited from (same family group)",
  })
  @IsUUID()
  sourceAccountId!: string;

  @ApiProperty({
    description: "Payment amount as a numeric string (whole rupiah)",
  })
  @IsString()
  @Matches(/^\d+$/, { message: "amount must be a numeric string" })
  amount!: string;

  @FxInputsProperty()
  fxInputs?: FxInputDto[];
}
