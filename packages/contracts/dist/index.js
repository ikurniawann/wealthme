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
export {
  AccountDtoSchema,
  AccountTypeSchema,
  AuthUserSchema,
  CONTRACTS_VERSION,
  CreateAccountInputSchema,
  LoginInputSchema,
  RupiahSchema,
  UpdateAccountInputSchema
};
