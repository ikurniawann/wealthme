// src/auth/index.ts
import { z } from "zod";
var LoginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});
var AuthUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email()
});

// src/common/index.ts
import { z as z2 } from "zod";
var RupiahSchema = z2.number().int().nonnegative();
var CONTRACTS_VERSION = "0.0.0";
export {
  AuthUserSchema,
  CONTRACTS_VERSION,
  LoginInputSchema,
  RupiahSchema
};
