"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  AccountDtoSchema: () => AccountDtoSchema,
  AccountTypeSchema: () => AccountTypeSchema,
  AuthUserSchema: () => AuthUserSchema,
  CONTRACTS_VERSION: () => CONTRACTS_VERSION,
  CategoryDtoSchema: () => CategoryDtoSchema,
  CategoryKindSchema: () => CategoryKindSchema,
  CreateAccountInputSchema: () => CreateAccountInputSchema,
  CreateTransactionInputSchema: () => CreateTransactionInputSchema,
  LoginInputSchema: () => LoginInputSchema,
  RupiahSchema: () => RupiahSchema,
  TransactionDtoSchema: () => TransactionDtoSchema,
  TransactionListResponseSchema: () => TransactionListResponseSchema,
  TransactionSummarySchema: () => TransactionSummarySchema,
  TransactionTypeSchema: () => TransactionTypeSchema,
  UpdateAccountInputSchema: () => UpdateAccountInputSchema
});
module.exports = __toCommonJS(index_exports);

// src/common/index.ts
var import_zod = require("zod");
var RupiahSchema = import_zod.z.number().int().nonnegative();
var CONTRACTS_VERSION = "0.0.0";

// src/auth/index.ts
var import_zod2 = require("zod");
var LoginInputSchema = import_zod2.z.object({
  email: import_zod2.z.string().email(),
  password: import_zod2.z.string().min(8)
});
var AuthUserSchema = import_zod2.z.object({
  id: import_zod2.z.string(),
  name: import_zod2.z.string(),
  email: import_zod2.z.string().email()
});

// src/accounts/index.ts
var import_zod3 = require("zod");
var AccountTypeSchema = import_zod3.z.enum([
  "bank",
  "ewallet",
  "cash",
  "investment",
  "property"
]);
var CreateAccountInputSchema = import_zod3.z.object({
  name: import_zod3.z.string().min(1),
  type: AccountTypeSchema,
  institution: import_zod3.z.string().optional(),
  maskedNumber: import_zod3.z.string().optional(),
  balance: import_zod3.z.number().int(),
  currency: import_zod3.z.string().default("IDR")
});
var UpdateAccountInputSchema = CreateAccountInputSchema.partial();
var AccountDtoSchema = import_zod3.z.object({
  id: import_zod3.z.string(),
  familyGroupId: import_zod3.z.string(),
  name: import_zod3.z.string(),
  type: AccountTypeSchema,
  institution: import_zod3.z.string().nullable(),
  maskedNumber: import_zod3.z.string().nullable(),
  balance: import_zod3.z.string(),
  currency: import_zod3.z.string(),
  createdAt: import_zod3.z.string(),
  updatedAt: import_zod3.z.string()
});

// src/categories/index.ts
var import_zod4 = require("zod");
var CategoryKindSchema = import_zod4.z.enum(["income", "expense"]);
var CategoryDtoSchema = import_zod4.z.object({
  id: import_zod4.z.string().uuid(),
  familyGroupId: import_zod4.z.string().uuid(),
  name: import_zod4.z.string(),
  kind: CategoryKindSchema,
  color: import_zod4.z.string().nullable(),
  icon: import_zod4.z.string().nullable(),
  createdAt: import_zod4.z.string()
});

// src/transactions/index.ts
var import_zod5 = require("zod");
var TransactionTypeSchema = import_zod5.z.enum(["income", "expense", "transfer"]);
var CreateTransactionInputSchema = import_zod5.z.object({
  accountId: import_zod5.z.string().uuid(),
  categoryId: import_zod5.z.string().uuid().optional(),
  amount: import_zod5.z.number().int().positive(),
  type: TransactionTypeSchema,
  description: import_zod5.z.string().optional(),
  occurredAt: import_zod5.z.string(),
  toAccountId: import_zod5.z.string().uuid().optional()
});
var TransactionDtoSchema = import_zod5.z.object({
  id: import_zod5.z.string().uuid(),
  familyGroupId: import_zod5.z.string().uuid(),
  accountId: import_zod5.z.string().uuid(),
  categoryId: import_zod5.z.string().uuid().nullable(),
  amount: import_zod5.z.string(),
  type: TransactionTypeSchema,
  description: import_zod5.z.string().nullable(),
  categoryName: import_zod5.z.string().nullable(),
  accountName: import_zod5.z.string(),
  occurredAt: import_zod5.z.string(),
  createdAt: import_zod5.z.string()
});
var TransactionSummarySchema = import_zod5.z.object({
  totalIncome: import_zod5.z.string(),
  totalExpense: import_zod5.z.string(),
  netBalance: import_zod5.z.string(),
  period: import_zod5.z.object({
    from: import_zod5.z.string().nullable(),
    to: import_zod5.z.string().nullable()
  })
});
var TransactionListResponseSchema = import_zod5.z.object({
  data: import_zod5.z.array(TransactionDtoSchema),
  meta: import_zod5.z.object({
    total: import_zod5.z.number(),
    page: import_zod5.z.number(),
    limit: import_zod5.z.number()
  }),
  summary: TransactionSummarySchema
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
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
});
