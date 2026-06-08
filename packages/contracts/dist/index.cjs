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
  AuthUserSchema: () => AuthUserSchema,
  CONTRACTS_VERSION: () => CONTRACTS_VERSION,
  LoginInputSchema: () => LoginInputSchema,
  RupiahSchema: () => RupiahSchema
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AuthUserSchema,
  CONTRACTS_VERSION,
  LoginInputSchema,
  RupiahSchema
});
