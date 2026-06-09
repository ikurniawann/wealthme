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
  MaxLength,
} from "class-validator";

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
    type: Number,
    description: "Amount in smallest currency unit",
  })
  @IsInt()
  @IsPositive()
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
}
