import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from "class-validator";

/**
 * EPIC-021 Group C (#29) — split a bank-statement reconciliation line (bank
 * shows one combined amount) into a real principal transfer + a standalone
 * admin-fee expense. Mirrors `CreateTransactionDto`'s transfer/adminFee
 * shape (`../../transactions/dto/create-transaction.dto.ts`) since the
 * service delegates the actual Transaction creation to
 * `TransactionsService.create`.
 */
export class SplitEntryDto {
  @ApiProperty({
    type: String,
    description: "Source account UUID — the bank account being reconciled",
  })
  @IsUUID()
  accountId!: string;

  @ApiProperty({
    type: String,
    description:
      "Destination account UUID (e.g. the e-wallet receiving the top-up)",
  })
  @IsUUID()
  toAccountId!: string;

  @ApiProperty({
    type: Number,
    description:
      "Principal amount in smallest currency unit (integer, > 0). Must sum with adminFee to the entry's absolute amount.",
  })
  @IsInt()
  @IsPositive()
  principalAmount!: number;

  @ApiProperty({
    type: Number,
    description:
      "Admin fee in smallest currency unit (integer, >= 0), charged to the DESTINATION account per EPIC-021 Decision #10/#28.",
  })
  @IsInt()
  @Min(0)
  adminFee!: number;

  @ApiPropertyOptional({
    type: String,
    description: "Optional reference/description note for the transfer",
  })
  @IsString()
  @MaxLength(500)
  @IsOptional()
  description?: string;
}
