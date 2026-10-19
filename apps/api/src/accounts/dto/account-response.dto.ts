import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  AccountOwnershipForm,
  AccountStatus,
  AccountType,
  BankInstitutionKind,
  BankProductKind,
  DepositInterestPayout,
  DepositMaturityInstruction,
  PocketKind,
  ShariaContract,
} from "@prisma/client";

export class AccountShareResponseDto {
  @ApiProperty({ type: String }) userId!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: Boolean }) canPost!: boolean;
}

export class AccountResponseDto {
  @ApiProperty({ type: String, description: "Account UUID" })
  id!: string;

  @ApiProperty({ type: String, description: "Family group UUID" })
  familyGroupId!: string;

  @ApiProperty({ type: String, description: "Account display name" })
  name!: string;

  @ApiProperty({ enum: AccountType, description: "Account type" })
  type!: AccountType;

  @ApiProperty({
    type: String,
    nullable: true,
    description: "Institution name",
  })
  institution!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: "Masked account number",
  })
  maskedNumber!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Current balance as string to preserve BigInt precision; null when the viewer\'s "Lihat saldo" is off',
  })
  balance!: string | null;

  @ApiPropertyOptional({
    type: Boolean,
    description: "true when balance figures are withheld from this viewer",
  })
  balancesHidden?: boolean;

  @ApiProperty({ type: String, description: "ISO 4217 currency code" })
  currency!: string;

  @ApiProperty({
    type: Boolean,
    description:
      "Hidden from `member` viewers in shared family views when true",
  })
  isPrivate!: boolean;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      "EPIC-019 Task A — owning member's user id, or null for a family-shared account",
  })
  ownerUserId!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: "Owning member's display name, or null when family-shared",
  })
  ownerName!: string | null;

  @ApiProperty({ type: String, format: "date-time" })
  createdAt!: string;

  @ApiProperty({ type: String, format: "date-time" })
  updatedAt!: string;

  // ── Rekening v3 — banking detail (see AccountBankDetailDto) ───────────────
  @ApiPropertyOptional({ type: String }) country?: string;
  @ApiPropertyOptional({ enum: BankInstitutionKind, nullable: true })
  institutionKind?: BankInstitutionKind | null;
  @ApiPropertyOptional({ type: Boolean }) isSharia?: boolean;
  @ApiPropertyOptional({ type: String, nullable: true }) bankCode?:
    | string
    | null;
  @ApiPropertyOptional({ type: String, nullable: true }) swiftCode?:
    | string
    | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  routingCode?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  routingCodeKind?: string | null;
  @ApiPropertyOptional({ enum: BankProductKind, nullable: true })
  productKind?: BankProductKind | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  productName?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  holderUserId?: string | null;
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: "Holder member's name, else the typed passbook name",
  })
  holderName?: string | null;
  @ApiPropertyOptional({ enum: AccountOwnershipForm })
  ownershipForm?: AccountOwnershipForm;
  @ApiPropertyOptional({ enum: AccountStatus }) status?: AccountStatus;
  @ApiPropertyOptional({ type: String, nullable: true })
  openingBalance?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  openingBalanceDate?: string | null;
  @ApiPropertyOptional({ type: Number, nullable: true })
  interestRate?: number | null;
  @ApiPropertyOptional({ enum: ShariaContract, nullable: true })
  shariaContract?: ShariaContract | null;
  @ApiPropertyOptional({ type: String, nullable: true }) branch?: string | null;
  @ApiPropertyOptional({ type: Boolean }) isPrimary?: boolean;
  @ApiPropertyOptional({ type: String, nullable: true }) notes?: string | null;
  @ApiPropertyOptional({ type: Boolean }) reportInTaxReturn?: boolean;
  @ApiPropertyOptional({ type: String, nullable: true })
  storageLocation?: string | null;
  @ApiPropertyOptional({ type: Boolean }) includeInNetWorth?: boolean;
  @ApiPropertyOptional({ type: String, nullable: true })
  lastReconciledAt?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  platformAccountId?: string | null;
  @ApiPropertyOptional({ enum: PocketKind, nullable: true })
  pocketKind?: PocketKind | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  beneficiaryUserId?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  beneficiaryName?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  depositNumber?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  placementDate?: string | null;
  @ApiPropertyOptional({ type: Number, nullable: true })
  tenorMonths?: number | null;
  @ApiPropertyOptional({ enum: DepositInterestPayout, nullable: true })
  interestPayout?: DepositInterestPayout | null;
  @ApiPropertyOptional({ enum: DepositMaturityInstruction, nullable: true })
  maturityInstruction?: DepositMaturityInstruction | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  payoutAccountId?: string | null;
  @ApiPropertyOptional({ type: Boolean }) maturityReminder?: boolean;
  @ApiPropertyOptional({ type: [AccountShareResponseDto] })
  shares?: AccountShareResponseDto[];
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: "Date of the latest transaction on either leg",
  })
  lastActivityAt?: string | null;
}
