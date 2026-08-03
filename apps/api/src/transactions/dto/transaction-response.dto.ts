import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { TransactionType } from "@prisma/client";

export class TransactionResponseDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  familyGroupId!: string;

  @ApiProperty({ type: String })
  accountId!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      "Destination account UUID (transfer only) — EPIC-021 Group B. Null on income/expense and on legacy one-sided transfer rows.",
  })
  toAccountId!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  categoryId!: string | null;

  @ApiProperty({
    type: String,
    description: "Amount as string to preserve BigInt precision",
  })
  amount!: string;

  @ApiProperty({ enum: TransactionType })
  type!: TransactionType;

  @ApiPropertyOptional({ type: String, nullable: true })
  description!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  categoryName!: string | null;

  @ApiProperty({ type: String })
  accountName!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  toAccountName!: string | null;

  @ApiProperty({ type: String, format: "date-time" })
  occurredAt!: string;

  @ApiProperty({ type: String, format: "date-time" })
  createdAt!: string;
}

export class TransactionSummaryDto {
  @ApiProperty({ type: String })
  totalIncome!: string;

  @ApiProperty({ type: String })
  totalExpense!: string;

  @ApiProperty({ type: String })
  netBalance!: string;

  @ApiProperty()
  period!: { from: string | null; to: string | null };
}

export class TransactionListMetaDto {
  @ApiProperty({ type: Number })
  total!: number;

  @ApiProperty({ type: Number })
  page!: number;

  @ApiProperty({ type: Number })
  limit!: number;
}

export class TransactionListResponseDto {
  @ApiProperty({ type: [TransactionResponseDto] })
  data!: TransactionResponseDto[];

  @ApiProperty({ type: TransactionListMetaDto })
  meta!: TransactionListMetaDto;

  @ApiProperty({ type: TransactionSummaryDto })
  summary!: TransactionSummaryDto;
}
