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

export const CreateAllowanceRequestInputSchema = z.object({
  targetAccountId: z.string().uuid(),
  amount: z.number().int().positive(),
  note: z.string().optional(),
});
export type CreateAllowanceRequestInput = z.infer<
  typeof CreateAllowanceRequestInputSchema
>;

export const ApproveAllowanceRequestInputSchema = z.object({
  fromAccountId: z.string().uuid(),
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
  familyGroupId: z.string(),
  requesterUserId: z.string(),
  requesterName: z.string(),
  targetAccountId: z.string(),
  targetAccountName: z.string(),
  fromAccountId: z.string().nullable(),
  fromAccountName: z.string().nullable(),
  amount: z.string(),
  note: z.string().nullable(),
  status: AllowanceRequestStatusSchema,
  createdAt: z.string(),
  decidedAt: z.string().nullable(),
  decidedByUserId: z.string().nullable(),
  decidedByName: z.string().nullable(),
});
export type AllowanceRequestDto = z.infer<typeof AllowanceRequestDtoSchema>;
