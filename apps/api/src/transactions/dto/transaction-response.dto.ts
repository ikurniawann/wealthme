import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { TransactionType } from "@prisma/client";

export class TransactionResponseDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  familyGroupId!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      "Source account UUID. Null for a credit-card purchase (EPIC-023 E3, D12) — it touches no account; see liabilityId instead.",
  })
  accountId!: string | null;

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

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      "Source account name. Null for a credit-card purchase (EPIC-023 E3, D12) — it touches no account. Was incorrectly '' before this field's contract went nullable (Group E retry, MEDIUM 5).",
  })
  accountName!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  toAccountName!: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      "Liability UUID this transaction is linked to (EPIC-023 E1/E3) — set for a payment or a credit-card purchase, null otherwise.",
  })
  liabilityId!: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      "Insurance policy UUID this transaction is linked to (EPIC-023 E1) — set for a premium payment, null otherwise.",
  })
  insuranceId!: string | null;

  @ApiProperty({ type: String, format: "date-time" })
  occurredAt!: string;

  @ApiProperty({ type: String, format: "date-time" })
  createdAt!: string;

  @ApiProperty({
    type: Boolean,
    description:
      "Whether the CURRENT viewer may PATCH/DELETE this row — its creator or the owner of a private account on either leg. Everyone else (including Master/Co-Master) is read-only; see transaction-edit-rights.util.ts.",
  })
  canModify!: boolean;
}

// EPIC-023 Task D (D3/D9, US-FAM-14) — the honest "did NOT create a
// transaction" response for a row-scoped member's over-threshold expense.
// `held: true` is a literal discriminator so a caller (controller, web
// dialog) can branch on `"held" in response` instead of guessing from an
// absent field — see TransactionsService.create.
export class HeldExpenseResponseDto {
  @ApiProperty({
    type: Boolean,
    enum: [true],
    description:
      "Always true — discriminates this shape from TransactionResponseDto",
  })
  held!: true;

  @ApiProperty({
    type: String,
    description:
      "The AllowanceRequest (kind = held_expense) created to track this hold",
  })
  allowanceRequestId!: string;

  @ApiProperty({
    type: String,
    description: "The held amount, as string (BigInt-safe)",
  })
  amount!: string;
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
