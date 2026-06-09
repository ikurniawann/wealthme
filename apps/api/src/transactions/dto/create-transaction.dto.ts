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
