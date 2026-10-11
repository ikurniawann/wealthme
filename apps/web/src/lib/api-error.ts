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
  if (text.length > MAX_LENGTH || TECHNICAL.test(text) || ENGLISH.test(text))
    return fallback;
  return text;
}
