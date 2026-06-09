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
});
export type CreateAccountInput = z.infer<typeof CreateAccountInputSchema>;

export const UpdateAccountInputSchema = CreateAccountInputSchema.partial();
export type UpdateAccountInput = z.infer<typeof UpdateAccountInputSchema>;

export const AccountDtoSchema = z.object({
  id: z.string(),
  familyGroupId: z.string(),
  name: z.string(),
  type: AccountTypeSchema,
  institution: z.string().nullable(),
  maskedNumber: z.string().nullable(),
  balance: z.string(),
  currency: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AccountDto = z.infer<typeof AccountDtoSchema>;
