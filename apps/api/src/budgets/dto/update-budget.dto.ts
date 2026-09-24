import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  Max,
  Min,
} from "class-validator";

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

  @ApiPropertyOptional({
    description: "EPIC-033 group 5 — day of month (1-28) the auto-debit runs",
    example: 25,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(28)
  autoDebitDay?: number;
}
