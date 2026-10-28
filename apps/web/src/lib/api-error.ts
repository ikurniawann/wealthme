// The one place an API failure becomes toast copy. Thirteen pages used to
// carry their own `extractApiErrorMessage`, each showing `err.message`
// verbatim, which is how "Internal server error",
// "rateBpsOverride must not be greater than 10000" and English 409s reached
// people. A server message is shown only when it is plain Indonesian copy
// written for users (e.g. the "already paid this period" conflict); known
// English messages are translated; everything else gets the caller's
// localized fallback. The raw error still goes to the console.

/** Server English the API still emits, with the Indonesian copy to show instead. */
const KNOWN_MESSAGES: ReadonlyArray<
  [RegExp, string | ((match: RegExpExecArray) => string)]
> = [
  [
    /budget already exists for this category/i,
    "Kategori ini sudah punya anggaran. Ubah anggaran yang ada.",
  ],
  [/COA code .*must be exactly 5 digits/i, "Kode COA harus 5 digit angka."],
  [
    /COA code .*must start with group number (\d)/i,
    (m) =>
      `Kode COA untuk grup ini harus diawali angka ${m[1]} (mis. ${m[1]}0001).`,
  ],
  [
    /username may only contain/i,
    "Username hanya boleh berisi huruf kecil, angka, titik, dan garis bawah.",
  ],
];

/** Technical or class-validator text: never shown. */
const TECHNICAL =
  /HTTP\s?\d{3}|status\s?\d{3}|exception|prisma|stack|request ?id|trace|undefined|null|regular expression|must (not )?(be|match|contain)|should not|is not allowed|may only|property |\bat \w+ \(|\b[a-z]+[A-Z]\w*\b/;

/** English sentence markers; Indonesian user copy never contains these. */
const ENGLISH =
  /\b(the|a|an|is|are|must|may|should|already|exists?|cannot|invalid|not found|required|only|please|failed|error)\b/i;

/** The bare HTTP reason phrase fetch falls back to when the body has no message. */
const STATUS_TEXT =
  /^(bad request|unauthorized|forbidden|not found|conflict|gone|payload too large|unprocessable entity|too many requests|internal server error|bad gateway|service unavailable|gateway timeout)\.?$/i;

const MAX_LENGTH = 200;

export function apiErrorMessage(err: unknown, fallback: string): string {
  if (!err || typeof err !== "object" || !("status" in err)) return fallback;
  const { status, message } = err as { status: unknown; message?: unknown };
  if (typeof status !== "number" || typeof message !== "string")
    return fallback;
  const text = message.trim();
  if (!text) return fallback;
  for (const [pattern, copy] of KNOWN_MESSAGES) {
    const match = pattern.exec(text);
    if (match) return typeof copy === "string" ? copy : copy(match);
  }
  if (status < 400 || status >= 500) return fallback;
  if (
    text.length > MAX_LENGTH ||
    STATUS_TEXT.test(text) ||
    TECHNICAL.test(text) ||
    ENGLISH.test(text)
  )
    return fallback;
  return text;
}

export interface ApiErrorCopy {
  sessionExpired: string;
  accessDenied: string;
  generic: string;
  timeout: string;
  validation: string;
  notFound: string;
  conflict: string;
  rateLimited: string;
  server: string;
  network: string;
}

/**
 * The reason an API call failed, in the user's language: a server message
 * only when it is plain user copy, otherwise copy chosen by failure kind
 * (validation / not found / conflict / rate limit / server / offline). Never
 * a status code, request id or class-validator English.
 */
export function describeApiError(err: unknown, copy: ApiErrorCopy): string {
  if (!err || typeof err !== "object") return copy.generic;
  const { status, code } = err as { status?: unknown; code?: unknown };
  if (typeof status !== "number") {
    // fetch() rejects with a TypeError when no response arrived at all.
    return err instanceof TypeError ? copy.network : copy.generic;
  }
  if (code === "TIMEOUT") return copy.timeout;
  if (status === 401) return copy.sessionExpired;
  if (status === 403) return copy.accessDenied;
  if (status === 404) return copy.notFound;
  if (status === 429) return copy.rateLimited;
  if (status >= 500) return copy.server;
  const kindFallback =
    status === 409
      ? copy.conflict
      : status === 400 || status === 422
        ? copy.validation
        : copy.generic;
  return apiErrorMessage(err, kindFallback);
}
