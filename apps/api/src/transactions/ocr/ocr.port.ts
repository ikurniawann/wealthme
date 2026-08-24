import { z } from "zod";

/**
 * EPIC-027 D12 — ONE result schema shared by every vision adapter (claude /
 * openai / gemini). Each provider used to be free to hand back its own
 * shape; keeping the schema here (and the prompt in `ocr-prompt.util.ts`)
 * is what stops the three from drifting apart.
 *
 * `amount` is IDR, which has no minor unit: a fractional or negative amount
 * is never a real receipt total, so it is rejected/normalised at this
 * boundary rather than downstream in the transaction form.
 */
export const ocrResultSchema = z.object({
  amount: z
    .number()
    .finite()
    .nonnegative()
    // Rupiah is quoted in whole units — a model that emits `45000.4` is
    // guessing at a cent that does not exist, so it is rounded away here
    // instead of being carried into a money field.
    .transform((value) => Math.round(value)),
  description: z.string().max(500),
  occurredAt: z.string().min(1),
  categoryHint: z.string().max(100),
});

export type OcrResult = z.infer<typeof ocrResultSchema>;

export interface OcrPort {
  extractTransaction(imageBase64: string): Promise<OcrResult>;
}
