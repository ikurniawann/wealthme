import { z } from "zod";

// EPIC-019 Task B — member-request -> owner-approve funding.
export const AllowanceRequestStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
]);
export type AllowanceRequestStatus = z.infer<
  typeof AllowanceRequestStatusSchema
>;

// EPIC-023 Task D (D3/D9, US-FAM-14) — discriminates what approving a row
// DOES. `funding` (default — every pre-existing row): a transfer.
// `held_expense`: a row-scoped member's over-threshold expense, held
// instead of posted; approval replays it. See the API's schema.prisma
// AllowanceRequest comment for the full field-meaning-per-kind mapping.
export const AllowanceRequestKindSchema = z.enum(["funding", "held_expense"]);
export type AllowanceRequestKind = z.infer<typeof AllowanceRequestKindSchema>;

export const CreateAllowanceRequestInputSchema = z.object({
  targetAccountId: z.string().uuid(),
  amount: z.number().int().positive(),
  note: z.string().optional(),
});
export type CreateAllowanceRequestInput = z.infer<
  typeof CreateAllowanceRequestInputSchema
>;

export const ApproveAllowanceRequestInputSchema = z.object({
  // EPIC-023 Task D (D3/D9) — required only to approve a `funding` request;
  // a `held_expense` request already carries its own account and needs no
  // choice at approval time.
  fromAccountId: z.string().uuid().optional(),
});
export type ApproveAllowanceRequestInput = z.infer<
  typeof ApproveAllowanceRequestInputSchema
>;

export const RejectAllowanceRequestInputSchema = z.object({
  reason: z.string().optional(),
});
export type RejectAllowanceRequestInput = z.infer<
  typeof RejectAllowanceRequestInputSchema
>;

export const AllowanceRequestDtoSchema = z.object({
  id: z.string(),
  kind: AllowanceRequestKindSchema,
  familyGroupId: z.string(),
  requesterUserId: z.string(),
  requesterName: z.string(),
  targetAccountId: z.string(),
  targetAccountName: z.string(),
  fromAccountId: z.string().nullable(),
  fromAccountName: z.string().nullable(),
  amount: z.string(),
  note: z.string().nullable(),
  // EPIC-023 Task D (D3/D9) — held_expense only; always null for funding.
  categoryId: z.string().nullable(),
  categoryName: z.string().nullable(),
  description: z.string().nullable(),
  status: AllowanceRequestStatusSchema,
  createdAt: z.string(),
  decidedAt: z.string().nullable(),
  decidedByUserId: z.string().nullable(),
  decidedByName: z.string().nullable(),
});
export type AllowanceRequestDto = z.infer<typeof AllowanceRequestDtoSchema>;

// EPIC-023 Task D (D3/D9) — the honest "did NOT create a transaction"
// response POST /transactions returns for a row-scoped member's
// over-threshold expense. `held: true` lets a caller branch on
// `"held" in response` instead of guessing from an absent field.
export const HeldExpenseResponseSchema = z.object({
  held: z.literal(true),
  allowanceRequestId: z.string(),
  amount: z.string(),
});
export type HeldExpenseResponse = z.infer<typeof HeldExpenseResponseSchema>;
