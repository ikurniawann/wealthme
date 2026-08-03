import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { TransactionType } from "@prisma/client";
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Min,
  MaxLength,
} from "class-validator";

export class CreateTransactionDto {
  @ApiProperty({ type: String, description: "Account UUID" })
  @IsUUID()
  accountId!: string;

  @ApiPropertyOptional({ type: String, description: "Category UUID" })
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({
    type: String,
    description:
      "Destination account UUID (transfer only) — EPIC-021 Group B. Must differ from accountId and belong to the same family group.",
  })
  @IsUUID()
  @IsOptional()
  toAccountId?: string;

  @ApiPropertyOptional({
    type: Number,
    description:
      "Admin fee in smallest currency unit (transfer only, e.g. e-wallet top-up). Deducted from the DESTINATION account as a separate linked expense — EPIC-021 #28.",
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  adminFee?: number;

  @ApiProperty({
    type: Number,
    description: "Amount in smallest currency unit (integer)",
  })
  @IsInt()
  @IsPositive()
  amount!: number;

  @ApiProperty({ enum: TransactionType, description: "Transaction type" })
  @IsEnum(TransactionType)
  type!: TransactionType;

  @ApiPropertyOptional({ type: String, description: "Description" })
  @IsString()
  @MaxLength(500)
  @IsOptional()
  description?: string;

  @ApiProperty({
    type: String,
    format: "date-time",
    description: "When the transaction occurred",
  })
  @IsDateString()
  occurredAt!: string;
}
