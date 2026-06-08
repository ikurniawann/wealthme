import { z } from "zod";

/**
 * @wealthme/contracts — single source of truth for DTOs/validation shared by
 * the web app, the API, and (later) mobile. Add per-domain schemas here as the
 * backend grows (auth, transactions, accounts, …) and import them on both ends.
 */

/** Rupiah amounts are stored as whole-rupiah integers (no minor unit). */
export const RupiahSchema = z.number().int().nonnegative();
export type Rupiah = z.infer<typeof RupiahSchema>;

// ── Auth (seed example) ──────────────────────────────────────────────
export const LoginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export const AuthUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
});
export type AuthUser = z.infer<typeof AuthUserSchema>;

export const CONTRACTS_VERSION = "0.0.0" as const;
