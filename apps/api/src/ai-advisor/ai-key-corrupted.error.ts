/**
 * EPIC-023 Task G retry (HIGH five-reviewer finding) — thrown by
 * `AiKeyService.resolveDecryptedKey` when the stored key cannot be
 * decrypted (corrupted row, or `ENCRYPTION_KEY` was rotated after the key
 * was stored). Distinguished from `AiAdvisorNotConfiguredError` (no key at
 * all) so the controller/web app can tell the family "your stored key
 * could not be read, please re-enter it" instead of a generic provider
 * auth failure — rotating `ENCRYPTION_KEY` is a real operational action and
 * must not silently break every family's key with no actionable message.
 */
export class AiKeyCorruptedError extends Error {
  constructor() {
    super(
      "Kunci AI yang tersimpan tidak bisa dibaca — mungkin rusak atau kunci enkripsi server telah diganti. Masukkan ulang API key Anda di Pengaturan.",
    );
    this.name = "AiKeyCorruptedError";
  }
}
