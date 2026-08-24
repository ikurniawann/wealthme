/**
 * EPIC-027 D11 — thrown when a family tries to scan a receipt without an AI
 * provider key configured. OCR runs on the family's OWN AI Advisor key
 * (same key, same `AiKeyService`); there is deliberately no server-wide
 * `ANTHROPIC_API_KEY` fallback and no mock provider, so "no key" is a real,
 * actionable state rather than a randomly generated amount.
 */
export class OcrNotConfiguredError extends Error {
  constructor() {
    super(
      "Scan struk belum bisa dipakai — tambahkan API key penyedia AI keluarga di Pengaturan terlebih dahulu.",
    );
    this.name = "OcrNotConfiguredError";
  }
}
