import { ApiProperty } from "@nestjs/swagger";

export class BudgetResponseDto {
  @ApiProperty({ type: String, description: "Budget UUID" })
  id!: string;

  @ApiProperty({ type: String, description: "Category UUID" })
  categoryId!: string;

  @ApiProperty({ type: String, description: "Category name" })
  categoryName!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: "Category icon emoji",
  })
  categoryIcon!: string | null;

  @ApiProperty({
    enum: ["monthly", "weekly", "yearly"],
    description: "Budget period",
  })
  period!: string;

  @ApiProperty({
    type: Number,
    description: "Budget limit in IDR (smallest unit)",
  })
  limitAmount!: number;

  @ApiProperty({ type: Number, description: "Amount spent in current period" })
  spentAmount!: number;

  @ApiProperty({
    type: Number,
    description: "Remaining budget (clamped to 0 minimum)",
  })
  remainingAmount!: number;

  @ApiProperty({ type: Number, description: "Usage percentage (0–100+)" })
  usagePercent!: number;

  @ApiProperty({
    type: Boolean,
    description: "True when spending exceeds limit",
  })
  isOverBudget!: boolean;

  @ApiProperty({
    type: Boolean,
    description: "True when usage >= 80% but not yet over",
  })
  isNearLimit!: boolean;
}
