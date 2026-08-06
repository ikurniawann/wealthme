import { ApiPropertyOptional, ApiProperty } from "@nestjs/swagger";
import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from "class-validator";

// EPIC-023 Task E3 (D12, US-LIAB-5) — a credit-card purchase. Unlike
// PayLiabilityDto (which debits a bank/cash account), this NEVER touches an
// Account: it only raises the card's own debt (Liability.remainingBalance/
// totalDebt) and creates one linked Transaction with accountId = null,
// liabilityId = this liability (see LiabilitiesService.purchase()).
export class PurchaseLiabilityDto {
  @ApiProperty({
    description: "Purchase amount as a numeric string (whole rupiah)",
  })
  @IsString()
  @Matches(/^\d+$/, { message: "amount must be a numeric string" })
  amount!: string;

  @ApiPropertyOptional({
    type: String,
    description:
      "Expense category UUID (same family group) — a card purchase still has a spending category.",
  })
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({ type: String, description: "Description" })
  @IsString()
  @MaxLength(500)
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    type: String,
    format: "date-time",
    description: "When the purchase occurred (defaults to now)",
  })
  @IsDateString()
  @IsOptional()
  occurredAt?: string;
}
