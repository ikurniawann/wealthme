// src/common/index.ts
import { z } from "zod";
var RupiahSchema = z.number().int().nonnegative();
var CONTRACTS_VERSION = "0.0.0";

// src/auth/index.ts
import { z as z2 } from "zod";
var LoginInputSchema = z2.object({
  email: z2.string().email(),
  password: z2.string().min(8)
});
var AuthUserSchema = z2.object({
  id: z2.string(),
  name: z2.string(),
  email: z2.string().email()
});

// src/categories/index.ts
import { z as z3 } from "zod";
var CategoryKindSchema = z3.enum(["income", "expense"]);
var CategoryDtoSchema = z3.object({
  id: z3.string().uuid(),
  familyGroupId: z3.string().uuid(),
  name: z3.string(),
  kind: CategoryKindSchema,
  color: z3.string().nullable(),
  icon: z3.string().nullable(),
  createdAt: z3.string()
});

// src/transactions/index.ts
import { z as z4 } from "zod";
var TransactionTypeSchema = z4.enum(["income", "expense", "transfer"]);
var CreateTransactionInputSchema = z4.object({
  accountId: z4.string().uuid(),
  categoryId: z4.string().uuid().optional(),
  amount: z4.number().int().positive(),
  type: TransactionTypeSchema,
  description: z4.string().optional(),
  occurredAt: z4.string(),
  toAccountId: z4.string().uuid().optional()
});
var TransactionDtoSchema = z4.object({
  id: z4.string().uuid(),
  familyGroupId: z4.string().uuid(),
  accountId: z4.string().uuid(),
  categoryId: z4.string().uuid().nullable(),
  amount: z4.string(),
  type: TransactionTypeSchema,
  description: z4.string().nullable(),
  occurredAt: z4.string(),
  createdAt: z4.string()
});
var TransactionSummarySchema = z4.object({
  totalIncome: z4.string(),
  totalExpense: z4.string(),
  netBalance: z4.string(),
  period: z4.object({
    from: z4.string().nullable(),
    to: z4.string().nullable()
  })
});
var TransactionListResponseSchema = z4.object({
  data: z4.array(TransactionDtoSchema),
  meta: z4.object({
    total: z4.number(),
    page: z4.number(),
    limit: z4.number()
  }),
  summary: TransactionSummarySchema
});
export {
  AuthUserSchema,
  CONTRACTS_VERSION,
  CategoryDtoSchema,
  CategoryKindSchema,
  CreateTransactionInputSchema,
  LoginInputSchema,
  RupiahSchema,
  TransactionDtoSchema,
  TransactionListResponseSchema,
  TransactionSummarySchema,
  TransactionTypeSchema
};
