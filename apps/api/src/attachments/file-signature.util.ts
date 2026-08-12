// EPIC-024 Task L2 (US-TXN-9) — MIME-spoofing defense: the client-supplied
// `Content-Type` header (and any filename extension) is never trusted for
// what actually gets stored/served. This sniffs the first bytes of the
// uploaded buffer against the real magic-byte signatures for the four
// allowed attachment types.

export type AllowedAttachmentMime =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "application/pdf";

const EXTENSION_BY_MIME: Record<AllowedAttachmentMime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/** Safe, server-derived extension for a detected mime type — never derived
 * from the client-supplied filename. */
export function extensionForMime(mimeType: AllowedAttachmentMime): string {
  return EXTENSION_BY_MIME[mimeType];
}

/**
 * Detects the real file type from content, or returns `null` when the
 * buffer matches none of the four allowed signatures (JPEG, PNG, WEBP,
 * PDF). Callers must reject the upload on `null`, regardless of what the
 * client's `Content-Type`/filename claimed.
 */
export function detectAllowedMime(
  buffer: Buffer,
): AllowedAttachmentMime | null {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  if (buffer.length >= 5 && buffer.toString("ascii", 0, 5) === "%PDF-") {
    return "application/pdf";
  }
  return null;
}
