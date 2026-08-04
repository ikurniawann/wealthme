import { z } from "zod";

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
  balance: z.string(),
  currency: z.string(),
  isPrivate: z.boolean(),
  ownerUserId: z.string().nullable(),
  ownerName: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AccountDto = z.infer<typeof AccountDtoSchema>;
