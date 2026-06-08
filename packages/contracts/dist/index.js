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
export {
  AuthUserSchema,
  CONTRACTS_VERSION,
  LoginInputSchema,
  RupiahSchema
};
