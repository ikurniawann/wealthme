import { type AiProvider } from "@prisma/client";

/**
 * EPIC-027 D12 — every provider WealthMe accepts an AI key for also has a
 * vision adapter, so scanning is available for all of them. Kept in this
 * dependency-free module so `AiKeyService` can report `scanAvailable`
 * without importing the transactions/OCR graph.
 */
const VISION_CAPABLE_PROVIDERS = ["claude", "openai", "gemini"] as const;

export function supportsVisionOcr(provider: AiProvider): boolean {
  return (VISION_CAPABLE_PROVIDERS as readonly string[]).includes(provider);
}
