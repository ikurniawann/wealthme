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
  CreateAccountInputSchema: () => CreateAccountInputSchema,
  LoginInputSchema: () => LoginInputSchema,
  RupiahSchema: () => RupiahSchema,
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AccountDtoSchema,
  AccountTypeSchema,
  AuthUserSchema,
  CONTRACTS_VERSION,
  CreateAccountInputSchema,
  LoginInputSchema,
  RupiahSchema,
  UpdateAccountInputSchema
});
