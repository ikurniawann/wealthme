import { z } from "zod";

export const TransactionTypeSchema = z.enum(["income", "expense", "transfer"]);
export type TransactionType = z.infer<typeof TransactionTypeSchema>;

export const CreateTransactionInputSchema = z.object({
  accountId: z.string().uuid(),
  categoryId: z.string().uuid().optional(),
  amount: z.number().int().positive(),
  type: TransactionTypeSchema,
  description: z.string().optional(),
  occurredAt: z.string(),
  toAccountId: z.string().uuid().optional(),
  // EPIC-021 Group B #28 — e-wallet top-up admin fee. Only meaningful when
  // type = transfer with a toAccountId; deducted from the DESTINATION
  // account as a separate linked expense (see transactions.service.ts).
  adminFee: z.number().int().min(0).optional(),
});
export type CreateTransactionInput = z.infer<
  typeof CreateTransactionInputSchema
>;

export const TransactionDtoSchema = z.object({
  id: z.string().uuid(),
  familyGroupId: z.string().uuid(),
  accountId: z.string().uuid(),
  toAccountId: z.string().uuid().nullable(),
  categoryId: z.string().uuid().nullable(),
  amount: z.string(),
  type: TransactionTypeSchema,
  description: z.string().nullable(),
  categoryName: z.string().nullable(),
  accountName: z.string(),
  toAccountName: z.string().nullable(),
  occurredAt: z.string(),
  createdAt: z.string(),
});
export type TransactionDto = z.infer<typeof TransactionDtoSchema>;

export const TransactionSummarySchema = z.object({
  totalIncome: z.string(),
  totalExpense: z.string(),
  netBalance: z.string(),
  period: z.object({
    from: z.string().nullable(),
    to: z.string().nullable(),
  }),
});
export type TransactionSummary = z.infer<typeof TransactionSummarySchema>;

export const TransactionListResponseSchema = z.object({
  data: z.array(TransactionDtoSchema),
  meta: z.object({
    total: z.number(),
    page: z.number(),
    limit: z.number(),
  }),
  summary: TransactionSummarySchema,
});
export type TransactionListResponse = z.infer<
  typeof TransactionListResponseSchema
>;
