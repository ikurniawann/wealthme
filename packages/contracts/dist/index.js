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

// src/accounts/index.ts
import { z as z3 } from "zod";
var AccountTypeSchema = z3.enum([
  "bank",
  "ewallet",
  "cash",
  "investment",
  "property"
]);
var CreateAccountInputSchema = z3.object({
  name: z3.string().min(1),
  type: AccountTypeSchema,
  institution: z3.string().optional(),
  maskedNumber: z3.string().optional(),
  balance: z3.number().int(),
  currency: z3.string().default("IDR")
});
var UpdateAccountInputSchema = CreateAccountInputSchema.partial();
var AccountDtoSchema = z3.object({
  id: z3.string(),
  familyGroupId: z3.string(),
  name: z3.string(),
  type: AccountTypeSchema,
  institution: z3.string().nullable(),
  maskedNumber: z3.string().nullable(),
  balance: z3.string(),
  currency: z3.string(),
  createdAt: z3.string(),
  updatedAt: z3.string()
});

// src/categories/index.ts
import { z as z4 } from "zod";
var CategoryKindSchema = z4.enum(["income", "expense"]);
var CategoryDtoSchema = z4.object({
  id: z4.string().uuid(),
  familyGroupId: z4.string().uuid(),
  name: z4.string(),
  kind: CategoryKindSchema,
  color: z4.string().nullable(),
  icon: z4.string().nullable(),
  createdAt: z4.string()
});

// src/transactions/index.ts
import { z as z5 } from "zod";
var TransactionTypeSchema = z5.enum(["income", "expense", "transfer"]);
var CreateTransactionInputSchema = z5.object({
  accountId: z5.string().uuid(),
  categoryId: z5.string().uuid().optional(),
  amount: z5.number().int().positive(),
  type: TransactionTypeSchema,
  description: z5.string().optional(),
  occurredAt: z5.string(),
  toAccountId: z5.string().uuid().optional()
});
var TransactionDtoSchema = z5.object({
  id: z5.string().uuid(),
  familyGroupId: z5.string().uuid(),
  accountId: z5.string().uuid(),
  categoryId: z5.string().uuid().nullable(),
  amount: z5.string(),
  type: TransactionTypeSchema,
  description: z5.string().nullable(),
  categoryName: z5.string().nullable(),
  accountName: z5.string(),
  occurredAt: z5.string(),
  createdAt: z5.string()
});
var TransactionSummarySchema = z5.object({
  totalIncome: z5.string(),
  totalExpense: z5.string(),
  netBalance: z5.string(),
  period: z5.object({
    from: z5.string().nullable(),
    to: z5.string().nullable()
  })
});
var TransactionListResponseSchema = z5.object({
  data: z5.array(TransactionDtoSchema),
  meta: z5.object({
    total: z5.number(),
    page: z5.number(),
    limit: z5.number()
  }),
  summary: TransactionSummarySchema
});
export {
  AccountDtoSchema,
  AccountTypeSchema,
  AuthUserSchema,
  CONTRACTS_VERSION,
  CategoryDtoSchema,
  CategoryKindSchema,
  CreateAccountInputSchema,
  CreateTransactionInputSchema,
  LoginInputSchema,
  RupiahSchema,
  TransactionDtoSchema,
  TransactionListResponseSchema,
  TransactionSummarySchema,
  TransactionTypeSchema,
  UpdateAccountInputSchema
};
