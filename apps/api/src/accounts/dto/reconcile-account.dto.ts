import { ApiProperty } from "@nestjs/swagger";
import { IsInt } from "class-validator";

import { FxInputsProperty, type FxInputDto } from "../../fx/fx-input.dto";

/**
 * "Cocokkan saldo" — the balance the person actually counted or saw in the
 * wallet app, in IDR (or via fxInputs for a foreign wallet). A difference is
 * booked as one adjustment transaction so the history explains the jump.
 */
export class ReconcileAccountDto {
  @ApiProperty({
    type: Number,
    description:
      "Counted balance, smallest IDR unit (may be negative for cash)",
  })
  @IsInt()
  actualBalance!: number;

  @FxInputsProperty()
  fxInputs?: FxInputDto[];
}
