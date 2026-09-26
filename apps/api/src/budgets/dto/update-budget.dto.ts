import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsInt, IsOptional, IsPositive, Max } from "class-validator";

import { FxInputsProperty, type FxInputDto } from "../../fx/fx-input.dto";

enum BudgetPeriodEnum {
  monthly = "monthly",
  weekly = "weekly",
  yearly = "yearly",
}

const MAX_BUDGET_AMOUNT = 999_999_999_999;

export class UpdateBudgetDto {
  @ApiPropertyOptional({
    type: Number,
    description: "New budget limit in IDR",
    example: 6000000,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  @Max(MAX_BUDGET_AMOUNT)
  limitAmount?: number;

  @ApiPropertyOptional({
    enum: BudgetPeriodEnum,
    description: "New recurrence period",
  })
  @IsOptional()
  @IsEnum(BudgetPeriodEnum)
  period?: BudgetPeriodEnum;

  @FxInputsProperty()
  fxInputs?: FxInputDto[];
}
