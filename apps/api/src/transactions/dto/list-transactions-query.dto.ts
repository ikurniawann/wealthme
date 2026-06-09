import { ApiPropertyOptional } from "@nestjs/swagger";
import { TransactionType } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from "class-validator";

export class ListTransactionsQueryDto {
  @ApiPropertyOptional({ enum: TransactionType })
  @IsEnum(TransactionType)
  @IsOptional()
  type?: TransactionType;

  @ApiPropertyOptional({ type: String })
  @IsUUID()
  @IsOptional()
  accountId?: string;

  @ApiPropertyOptional({ type: String })
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({ type: String, description: "ISO date string (from)" })
  @IsDateString()
  @IsOptional()
  from?: string;

  @ApiPropertyOptional({ type: String, description: "ISO date string (to)" })
  @IsDateString()
  @IsOptional()
  to?: string;

  @ApiPropertyOptional({ type: Number, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ type: Number, default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;
}
