import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { AccountType, PocketKind } from "@prisma/client";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from "class-validator";

import { IsTrimmedNotEmpty } from "../../common/decorators/is-trimmed-not-empty.decorator";
import { FxInputsProperty, type FxInputDto } from "../../fx/fx-input.dto";

import { AccountBankDetailDto } from "./account-bank-detail.dto";

// Hardening audit (validation, MEDIUM) — `balance` had no `@Max`, matching
// the bound already used on transactions/budgets/goals.
const MAX_ACCOUNT_BALANCE = 999_999_999_999;

// Rekening v3 — the banking detail (product, holder, deposit terms, shares)
// lives in AccountBankDetailDto so create and update validate it identically.
export class CreateAccountDto extends AccountBankDetailDto {
  @ApiProperty({ enum: AccountType, description: "Account type" })
  @IsEnum(AccountType)
  type!: AccountType;

  // E2E round 1, bug 1 — `@MinLength(1)` counts characters, so a
  // whitespace-only name ("   ") passed untrimmed; `@IsTrimmedNotEmpty()`
  // trims first and rejects the empty result.
  @ApiProperty({ description: "Account display name" })
  @IsString()
  @IsTrimmedNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiProperty({
    required: false,
    description: "Bank or e-wallet institution name",
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  institution?: string;

  @ApiProperty({
    required: false,
    description: "Masked account or card number",
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  maskedNumber?: string;

  @ApiProperty({
    description:
      "Initial balance in smallest currency unit (e.g. rupiah, no decimals). " +
      "EPIC-021 #21/#22 — only `cash` accounts may go negative (physical cash " +
      "can run short without an external floor); bank/e-wallet/investment/" +
      "property accounts must stay >= 0 here. The bank-specific overdraft " +
      "guard for transaction-driven debits lives in transactions.service.ts.",
  })
  @IsInt()
  @Max(MAX_ACCOUNT_BALANCE)
  @Min(-MAX_ACCOUNT_BALANCE)
  @ValidateIf((o: CreateAccountDto) => o.type !== AccountType.cash)
  @Min(0)
  balance!: number;

  @ApiProperty({
    required: false,
    default: "IDR",
    description: "ISO 4217 currency code",
  })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({
    type: Boolean,
    default: false,
    description:
      "Hide this account (and its transactions) from `member` viewers in shared family views",
  })
  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;

  @ApiPropertyOptional({
    type: String,
    description:
      "EPIC-019 Task A — owning member's user id (must be a Member of the same family group). Omit or leave unset for a family-shared account.",
  })
  @IsOptional()
  // NOT `@IsUUID()`. `User.id` is only a UUID for rows created by the Prisma
  // seed (`@default(uuid())`); better-auth generates its own 32-char id for
  // every user who registers through the app, so `@IsUUID()` rejected every
  // real account owner with "ownerUserId must be a UUID" and only ever passed
  // for the seeded demo user — which is why it survived every test.
  // `create-heir.dto.ts` and `create-insurance-beneficiary.dto.ts` already
  // model member user ids this way. Membership and tenant scope are enforced
  // by `assertOwnerIsFamilyMember`, not by the id's shape.
  @IsString()
  @MinLength(1)
  ownerUserId?: string;

  @ApiPropertyOptional({
    type: String,
    description:
      "Investasi R2 — link this `investment` account as a cash pocket of a platform account of the same family.",
  })
  @IsOptional()
  @IsUUID()
  platformAccountId?: string;

  @ApiPropertyOptional({
    enum: PocketKind,
    description:
      "Investasi R2 — pocket kind (rdn | crypto | usd | general). Requires platformAccountId; defaults to general.",
  })
  @IsOptional()
  @IsEnum(PocketKind)
  pocketKind?: PocketKind;

  @FxInputsProperty()
  fxInputs?: FxInputDto[];
}
