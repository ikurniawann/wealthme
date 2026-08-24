/**
 * EPIC-029 E5 — thrown when a family uploads a statement PDF without an AI
 * provider key configured. Reading a PDF runs on the family's OWN AI Advisor
 * key, through the same `AiKeyService` receipt OCR uses; there is
 * deliberately no server-wide key and no mock, so "no key" is a real,
 * actionable state rather than a plausible-looking table of invented rows.
 */
export class StatementReaderNotConfiguredError extends Error {
  constructor() {
    super(
      "Statement PDF belum bisa dibaca — tambahkan API key penyedia AI keluarga di Pengaturan terlebih dahulu. PDF dibaca memakai key AI keluarga Anda sendiri.",
    );
    this.name = "StatementReaderNotConfiguredError";
  }
}
