import { ApiPropertyOptional } from "@nestjs/swagger";
import { TransactionType } from "@prisma/client";
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
} from "class-validator";

import { FxInputsProperty, type FxInputDto } from "../../fx/fx-input.dto";

// Hardening audit (validation, MEDIUM) — mirrors create-transaction.dto.ts.
const MAX_TRANSACTION_AMOUNT = 999_999_999_999;

export class UpdateTransactionDto {
  @ApiPropertyOptional({ type: String, description: "Account UUID" })
  @IsUUID()
  @IsOptional()
  accountId?: string;

  @ApiPropertyOptional({ type: String, description: "Category UUID" })
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      "Destination account UUID (transfer only) — EPIC-021 Group B. Pass null to clear it (e.g. when changing the type away from transfer); must differ from accountId.",
  })
  @IsUUID()
  @IsOptional()
  toAccountId?: string | null;

  @ApiPropertyOptional({
    type: Number,
    description: "Amount in smallest currency unit",
  })
  @IsInt()
  @IsPositive()
  @Max(MAX_TRANSACTION_AMOUNT)
  @IsOptional()
  amount?: number;

  @ApiPropertyOptional({
    enum: TransactionType,
    description: "Transaction type",
  })
  @IsEnum(TransactionType)
  @IsOptional()
  type?: TransactionType;

  @ApiPropertyOptional({ type: String, description: "Description" })
  @IsString()
  @MaxLength(500)
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ type: String, format: "date-time" })
  @IsDateString()
  @IsOptional()
  occurredAt?: string;

  @FxInputsProperty()
  fxInputs?: FxInputDto[];
}
