import { z } from "zod";

import {
  AccountOwnershipFormSchema,
  AccountStatusSchema,
  BankInstitutionKindSchema,
  BankProductKindSchema,
  DepositInterestPayoutSchema,
  DepositMaturityInstructionSchema,
  RoutingCodeKindSchema,
  ShariaContractSchema,
} from "./banking.js";

export * from "./banking.js";

export const AccountTypeSchema = z.enum([
  "bank",
  "ewallet",
  "cash",
  "investment",
  "property",
]);
export type AccountType = z.infer<typeof AccountTypeSchema>;

export const CreateAccountInputSchema = z.object({
  name: z.string().min(1),
  type: AccountTypeSchema,
  institution: z.string().optional(),
  maskedNumber: z.string().optional(),
  balance: z.number().int(),
  currency: z.string().default("IDR"),
  isPrivate: z.boolean().optional(),
  // EPIC-019 Task A — owning member's user id; omit for family-shared.
  ownerUserId: z.string().uuid().optional(),
});
export type CreateAccountInput = z.infer<typeof CreateAccountInputSchema>;

export const UpdateAccountInputSchema =
  CreateAccountInputSchema.partial().extend({
    // Overrides the inherited (non-nullable) optional field: `null` explicitly
    // clears ownership back to family-shared; `undefined` (omitted) leaves it
    // unchanged.
    ownerUserId: z.string().uuid().nullable().optional(),
  });
export type UpdateAccountInput = z.infer<typeof UpdateAccountInputSchema>;

// EPIC-019 Task A — the accounts list "mine vs family" lens.
export const AccountOwnerFilterSchema = z.enum(["me", "family", "all"]);
export type AccountOwnerFilter = z.infer<typeof AccountOwnerFilterSchema>;

export const AccountDtoSchema = z.object({
  id: z.string(),
  familyGroupId: z.string(),
  name: z.string(),
  type: AccountTypeSchema,
  institution: z.string().nullable(),
  maskedNumber: z.string().nullable(),
  /** null when the viewer's "Lihat saldo" is off (see balancesHidden). */
  balance: z.string().nullable(),
  currency: z.string(),
  isPrivate: z.boolean(),
  ownerUserId: z.string().nullable(),
  ownerName: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  balancesHidden: z.boolean().optional(),
  // ── Rekening v3 — optional so older fixtures/callers still type-check ──
  country: z.string().optional(),
  institutionKind: BankInstitutionKindSchema.nullable().optional(),
  isSharia: z.boolean().optional(),
  bankCode: z.string().nullable().optional(),
  swiftCode: z.string().nullable().optional(),
  routingCode: z.string().nullable().optional(),
  routingCodeKind: RoutingCodeKindSchema.nullable().optional(),
  productKind: BankProductKindSchema.nullable().optional(),
  productName: z.string().nullable().optional(),
  holderUserId: z.string().nullable().optional(),
  /** Display name for "Atas nama": the holder member's name, else the typed name. */
  holderName: z.string().nullable().optional(),
  ownershipForm: AccountOwnershipFormSchema.optional(),
  status: AccountStatusSchema.optional(),
  openingBalance: z.string().nullable().optional(),
  openingBalanceDate: z.string().nullable().optional(),
  interestRate: z.number().nullable().optional(),
  shariaContract: ShariaContractSchema.nullable().optional(),
  branch: z.string().nullable().optional(),
  isPrimary: z.boolean().optional(),
  notes: z.string().nullable().optional(),
  reportInTaxReturn: z.boolean().optional(),
  beneficiaryUserId: z.string().nullable().optional(),
  beneficiaryName: z.string().nullable().optional(),
  depositNumber: z.string().nullable().optional(),
  placementDate: z.string().nullable().optional(),
  tenorMonths: z.number().nullable().optional(),
  interestPayout: DepositInterestPayoutSchema.nullable().optional(),
  maturityInstruction: DepositMaturityInstructionSchema.nullable().optional(),
  payoutAccountId: z.string().nullable().optional(),
  maturityReminder: z.boolean().optional(),
  shares: z
    .array(
      z.object({
        userId: z.string(),
        name: z.string(),
        canPost: z.boolean(),
      }),
    )
    .optional(),
  /** Date (yyyy-mm-dd) of the latest transaction on either leg, or null. */
  lastActivityAt: z.string().nullable().optional(),
});
export type AccountDto = z.infer<typeof AccountDtoSchema>;

export const AccountShareInputSchema = z.object({
  userId: z.string().min(1),
  canPost: z.boolean(),
});
export type AccountShareInput = z.infer<typeof AccountShareInputSchema>;
