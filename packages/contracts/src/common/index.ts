import { z } from "zod";

/** Rupiah amounts are stored as whole-rupiah integers (no minor unit). */
export const RupiahSchema = z.number().int().nonnegative();
export type Rupiah = z.infer<typeof RupiahSchema>;

export const CONTRACTS_VERSION = "0.0.0" as const;
