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
  // EPIC-023 E3 (D12) — null for a credit-card purchase (it touches no
  // account); see liabilityId instead.
  accountId: z.string().uuid().nullable(),
  toAccountId: z.string().uuid().nullable(),
  categoryId: z.string().uuid().nullable(),
  // EPIC-023 E1/E3 — set for a liability payment or a credit-card purchase.
  liabilityId: z.string().uuid().nullable(),
  // EPIC-023 E1 / group E retry (MEDIUM 6) — set for an insurance premium
  // payment, symmetric with liabilityId above.
  insuranceId: z.string().uuid().nullable(),
  amount: z.string(),
  type: TransactionTypeSchema,
  description: z.string().nullable(),
  categoryName: z.string().nullable(),
  // EPIC-023 Task E retry (MEDIUM 5) — was `z.string()` even though
  // `accountId` beside it went nullable for a card purchase (E3): a
  // service-layer `?? ""` laundered the "no account" case into an empty
  // string, which reads as blank data everywhere the DTO is displayed. Now
  // consistently `null` — see the service-layer `toDto`/mapper functions
  // this schema documents.
  accountName: z.string().nullable(),
  toAccountName: z.string().nullable(),
  occurredAt: z.string(),
  createdAt: z.string(),
  // Edit-rights decision 2026-09-28 ("Pembuat + pemilik rekening") — whether
  // the CURRENT viewer may PATCH/DELETE this row: its creator, or the owner
  // of a private account on either leg. Everyone else (incl. Master/
  // Co-Master) is read-only.
  canModify: z.boolean(),
  // Owner of the account leg(s), for the "Pemilik" filter/column. Absent on
  // responses from before these fields existed.
  accountOwnerUserId: z.string().nullable().optional(),
  accountOwnerName: z.string().nullable().optional(),
  toAccountOwnerName: z.string().nullable().optional(),
  // Cash leg of an investment buy/sell: the ledger row it settles. Decimal
  // fields are strings; `fee` includes tax. Null/absent for every other row.
  investment: z
    .object({
      id: z.string().uuid(),
      ticker: z.string(),
      name: z.string(),
      side: z.enum(["buy", "sell"]),
      quantity: z.string(),
      unitPrice: z.string(),
      gross: z.string(),
      fee: z.string(),
      net: z.string(),
      currency: z.string(),
    })
    .nullable()
    .optional(),
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
