import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsInt, IsPositive, IsUUID, Max } from "class-validator";

enum BudgetPeriodEnum {
  monthly = "monthly",
  weekly = "weekly",
  yearly = "yearly",
}

const MAX_BUDGET_AMOUNT = 999_999_999_999;

export class CreateBudgetDto {
  @ApiProperty({ type: String, description: "Category UUID to budget for" })
  @IsUUID("4")
  categoryId!: string;

  @ApiProperty({
    enum: BudgetPeriodEnum,
    description: "Budget recurrence period",
    example: "monthly",
  })
  @IsEnum(BudgetPeriodEnum)
  period!: BudgetPeriodEnum;

  @ApiProperty({
    type: Number,
    description: "Budget limit in IDR (integer, no decimals)",
    example: 5000000,
  })
  @IsInt()
  @IsPositive()
  @Max(MAX_BUDGET_AMOUNT)
  limitAmount!: number;
}
