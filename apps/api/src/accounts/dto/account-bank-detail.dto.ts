import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  AccountOwnershipForm,
  AccountStatus,
  BankInstitutionKind,
  BankProductKind,
  DepositInterestPayout,
  DepositMaturityInstruction,
  ShariaContract,
} from "@prisma/client";
import { BANK_COUNTRIES } from "@wealthme/contracts";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from "class-validator";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
// SWIFT/BIC: 4 bank + 2 country + 2 location (+ 3 branch), ISO 9362.
const SWIFT = /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/;
const COUNTRY_CODES = BANK_COUNTRIES.map((c) => c.code);
const ROUTING_KINDS = ["bank_code", "iban", "aba", "bsb"] as const;

/** Applies a validator only when the value is present (not undefined/null). */
const present = (_: object, v: unknown) => v !== undefined && v !== null;

export class AccountShareDto {
  // NOT `@IsUUID()` — better-auth issues non-UUID user ids (see
  // CreateAccountDto.ownerUserId).
  @ApiPropertyOptional({ type: String })
  @IsString()
  @MinLength(1)
  userId!: string;

  @ApiPropertyOptional({ type: Boolean })
  @IsBoolean()
  canPost!: boolean;
}

/**
 * Rekening v3 — the banking detail of an account, shared by create and
 * update. Every field is optional; `null` clears a stored value on update.
 */
export class AccountBankDetailDto {
  @ApiPropertyOptional({ type: String, description: "ISO 3166-1 alpha-2" })
  @ValidateIf(present)
  @IsIn(COUNTRY_CODES)
  country?: string;

  @ApiPropertyOptional({ enum: BankInstitutionKind, nullable: true })
  @ValidateIf(present)
  @IsEnum(BankInstitutionKind)
  institutionKind?: BankInstitutionKind | null;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  isSharia?: boolean;

  @ApiPropertyOptional({ type: String, nullable: true })
  @ValidateIf(present)
  @IsString()
  @MaxLength(16)
  bankCode?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @ValidateIf(present)
  @Matches(SWIFT, { message: "swiftCode must be an 8 or 11 character BIC" })
  swiftCode?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @ValidateIf(present)
  @IsString()
  @MaxLength(64)
  routingCode?: string | null;

  @ApiPropertyOptional({ enum: ROUTING_KINDS, nullable: true })
  @ValidateIf(present)
  @IsIn(ROUTING_KINDS)
  routingCodeKind?: string | null;

  @ApiPropertyOptional({ enum: BankProductKind, nullable: true })
  @ValidateIf(present)
  @IsEnum(BankProductKind)
  productKind?: BankProductKind | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @ValidateIf(present)
  @IsString()
  @MaxLength(120)
  productName?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: "Member user id named on the passbook (same family group)",
  })
  @ValidateIf(present)
  @IsString()
  @MinLength(1)
  holderUserId?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: "Passbook name when the holder has no login",
  })
  @ValidateIf(present)
  @IsString()
  @MaxLength(120)
  holderName?: string | null;

  @ApiPropertyOptional({ enum: AccountOwnershipForm })
  @IsOptional()
  @IsEnum(AccountOwnershipForm)
  ownershipForm?: AccountOwnershipForm;

  @ApiPropertyOptional({ enum: AccountStatus })
  @IsOptional()
  @IsEnum(AccountStatus)
  status?: AccountStatus;

  @ApiPropertyOptional({ type: String, nullable: true, example: "2026-10-01" })
  @ValidateIf(present)
  @Matches(ISO_DATE, { message: "openingBalanceDate must be yyyy-mm-dd" })
  openingBalanceDate?: string | null;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description: "% p.a., or the customer's nisbah % for mudharabah",
  })
  @ValidateIf(present)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(100)
  interestRate?: number | null;

  @ApiPropertyOptional({ enum: ShariaContract, nullable: true })
  @ValidateIf(present)
  @IsEnum(ShariaContract)
  shariaContract?: ShariaContract | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @ValidateIf(present)
  @IsString()
  @MaxLength(120)
  branch?: string | null;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional({ type: String, nullable: true })
  @ValidateIf(present)
  @IsString()
  @MaxLength(1000)
  notes?: string | null;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  reportInTaxReturn?: boolean;

  @ApiPropertyOptional({ type: String, nullable: true })
  @ValidateIf(present)
  @IsString()
  @MinLength(1)
  beneficiaryUserId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @ValidateIf(present)
  @IsString()
  @MaxLength(120)
  beneficiaryName?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @ValidateIf(present)
  @IsString()
  @MaxLength(50)
  depositNumber?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: "2026-09-15" })
  @ValidateIf(present)
  @Matches(ISO_DATE, { message: "placementDate must be yyyy-mm-dd" })
  placementDate?: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @ValidateIf(present)
  @IsInt()
  @Min(1)
  @Max(120)
  tenorMonths?: number | null;

  @ApiPropertyOptional({ enum: DepositInterestPayout, nullable: true })
  @ValidateIf(present)
  @IsEnum(DepositInterestPayout)
  interestPayout?: DepositInterestPayout | null;

  @ApiPropertyOptional({ enum: DepositMaturityInstruction, nullable: true })
  @ValidateIf(present)
  @IsEnum(DepositMaturityInstruction)
  maturityInstruction?: DepositMaturityInstruction | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: "Account (same family) that receives interest / proceeds",
  })
  @ValidateIf(present)
  @IsString()
  @MinLength(1)
  payoutAccountId?: string | null;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  maturityReminder?: boolean;

  @ApiPropertyOptional({
    type: [AccountShareDto],
    description:
      "Replaces the account's share list (Master/Co-Master only). Omit to leave unchanged.",
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => AccountShareDto)
  shares?: AccountShareDto[];
}
