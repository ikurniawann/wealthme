/**
 * EPIC-027 B8 — the provider answered, but not with the JSON contract the
 * prompt asked for (prose instead of JSON, truncated output, a field of the
 * wrong type). Distinguished from an auth/rate-limit/timeout failure so the
 * scan endpoint can say "the receipt could not be read, try a clearer
 * photo" instead of a generic upstream error.
 *
 * The provider's raw output is deliberately NOT carried in the message: it
 * is echoed back to the client and may contain arbitrary model text.
 */
export class OcrParseError extends Error {
  constructor(detail?: string) {
    super(
      detail
        ? `OCR response did not match the expected shape (${detail})`
        : "OCR response did not match the expected shape",
    );
    this.name = "OcrParseError";
  }
}
