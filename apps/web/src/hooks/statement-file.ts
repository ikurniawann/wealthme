/**
 * EPIC-029 group 4 — turns whatever the user picked on `/rekonsiliasi` into a
 * PLAINTEXT file the existing server parser already understands, decrypting
 * in the browser when it has to.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * The governing constraint (E8 / E10)
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Indonesian bank e-statement passwords are derived from personal data — date
 * of birth, card or account number, KTP digits — and are reused across
 * services. Treating one as a transportable form field would put PII into
 * request handling, server logs and crash reports. So the password never
 * leaves the tab: it is a function argument here, and what travels to
 * `POST …/reconciliation/upload-file` is the DECRYPTED bytes. The server is
 * unchanged and needs no knowledge that any of this happened.
 *
 * Consequences enforced by this module and asserted in its tests:
 *   - the password is never returned, never persisted, never logged;
 *   - no thrown error carries it — every failure is a bare reason code;
 *   - the produced `File` contains only the decrypted document.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Detect first, prompt second
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Most uploads are not encrypted, and training users to type a secret they do
 * not need is its own harm. `inspectStatementFile` reads the first few KB and
 * decides from the file's own magic bytes — an encrypted OOXML workbook is an
 * OLE/CFB container (`D0 CF 11 E0 A1 B1 1A E1`), a ZIP starts `PK\x03\x04` —
 * rather than by attempting a parse and failing. A plain `.xlsx` is ITSELF a
 * ZIP, so the two are told apart by looking inside: an OOXML package always
 * carries `[Content_Types].xml`.
 *
 * Anything not recognised as encrypted is passed straight through untouched,
 * which is why the existing CSV/XLSX (and the PDF refusal) paths behave
 * exactly as before.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * E4e — cost on first paint
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Neither decryptor is imported statically. `statement-ooxml-crypto` and the
 * `zip.js` adapter are reached only through `await import(...)`, on the click
 * that actually needs them, so `/rekonsiliasi` pays nothing for them until a
 * genuinely encrypted file arrives.
 */

import type { I18nDictionary } from "@/i18n/types";
import type { ExtractedStatement, ZipArchiveOpener } from "./statement-zip";

/**
 * The server's own ceiling (`reconciliation.controller.ts:54`). Applied here
 * to the PICKED file and, separately, to the DECRYPTED result — a 3 MB
 * encrypted archive can expand well past the limit the API will accept, and
 * finding that out after a 20 MB upload round-trip is the worse experience.
 */
export const STATEMENT_MAX_FILE_BYTES = 20 * 1024 * 1024;

/** How much of the file is read to classify it. Local file headers and the
 * OOXML content-types entry all live at the very front. */
const HEAD_BYTES = 64 * 1024;

const CFB_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] as const;
const ZIP_LOCAL_HEADER = [0x50, 0x4b, 0x03, 0x04] as const;
const OOXML_CONTENT_TYPES = "[Content_Types].xml";

export type StatementFileKind =
  /** Upload as picked — not encrypted, not a container. */
  | "plain"
  /** An OLE/CFB-wrapped, password-protected OOXML workbook. */
  | "encrypted-xlsx"
  /** A ZIP whose entries are encrypted. */
  | "encrypted-zip"
  /** A ZIP that is a container (not an OOXML package) but is not encrypted. */
  | "zip";

/** True when the kind cannot proceed without the user typing something. */
export function needsPassword(kind: StatementFileKind): boolean {
  return kind === "encrypted-xlsx" || kind === "encrypted-zip";
}

export type StatementFileFailure =
  /** Zero bytes — a failed share, or a file still syncing from cloud storage. */
  | "empty-file"
  /** The picked file is over the API's 20 MB ceiling; nothing is read. */
  | "file-too-large"
  /** Encrypted, and no password has been given yet. */
  | "password-required"
  /** A password was given and it does not open the file. Retryable. */
  | "wrong-password"
  /** A real encryption scheme this browser path cannot open (legacy Office). */
  | "unsupported-encryption"
  /** `crypto.subtle` is absent — an insecure (plain-HTTP) origin. */
  | "crypto-unavailable"
  /** Structurally unreadable. Explicitly NOT the answer for a bad password. */
  | "corrupt-file"
  /**
   * The password was right and the file opened, but its contents do not match
   * the integrity signature it carries: the package was altered after the
   * bank produced it. Kept far away from `corrupt-file` — this is the one
   * failure that may mean somebody changed the numbers.
   */
  | "integrity-failure"
  /**
   * The file carries no integrity signature at all, so there is nothing to
   * check it against. Refused; see `verifyDataIntegrity` for why.
   */
  | "integrity-missing"
  /** The archive holds no `.csv`/`.xlsx`. */
  | "zip-no-statement"
  /** The archive holds more than one — refused rather than guessed. */
  | "zip-multiple-statements"
  /** An entry expands past the extraction budget: a zip bomb. */
  | "zip-entry-too-large"
  /** Decryption succeeded but the result is over the API's 20 MB ceiling. */
  | "decrypted-too-large";

export class StatementFileError extends Error {
  constructor(readonly reason: StatementFileFailure) {
    // Reason only. A password must never be reachable from a stack trace,
    // a console, a toast, or an error-reporting SDK (E10).
    super(`statement file rejected: ${reason}`);
    this.name = "StatementFileError";
  }
}

function startsWith(bytes: Uint8Array, magic: readonly number[]): boolean {
  if (bytes.length < magic.length) return false;
  return magic.every((b, i) => bytes[i] === b);
}

function indexOfAscii(haystack: Uint8Array, needle: string): number {
  const first = needle.charCodeAt(0);
  outer: for (let i = 0; i + needle.length <= haystack.length; i++) {
    if (haystack[i] !== first) continue;
    for (let j = 1; j < needle.length; j++) {
      if (haystack[i + j] !== needle.charCodeAt(j)) continue outer;
    }
    return i;
  }
  return -1;
}

/**
 * Reads a blob's bytes, preferring `Blob.arrayBuffer()` and falling back to
 * `FileReader`.
 *
 * The fallback is not decoration: Safari only gained `Blob.arrayBuffer` in
 * 14.1, and jsdom (this suite's environment) still has no implementation at
 * all — so without it the whole pipeline is untestable AND broken on a
 * browser share that is small but real.
 */
export function readBlobBytes(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === "function") {
    return blob.arrayBuffer().then((buf) => new Uint8Array(buf));
  }
  return new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(new StatementFileError("corrupt-file"));
    reader.readAsArrayBuffer(blob);
  });
}

/**
 * Classifies the head of a file. Exported separately from
 * `inspectStatementFile` so the byte-level decisions are unit-testable
 * without constructing a `File` or a `FileReader`.
 */
export function classifyStatementBytes(head: Uint8Array): StatementFileKind {
  if (startsWith(head, CFB_MAGIC)) return "encrypted-xlsx";
  if (!startsWith(head, ZIP_LOCAL_HEADER)) return "plain";

  // Local file header: bit 0 of the general-purpose flags means "this entry
  // is encrypted". Checked before anything else, because an encrypted
  // archive's entry NAMES may still be readable and would otherwise let a
  // crafted `[Content_Types].xml` name masquerade as a plain workbook.
  const flags = head.length >= 8 ? head[6] | (head[7] << 8) : 0;
  if ((flags & 0x0001) !== 0) return "encrypted-zip";

  // An unencrypted `.xlsx` is a ZIP too. The thing that distinguishes an
  // OOXML package from an archive that merely CONTAINS a statement is the
  // mandatory `[Content_Types].xml` part, so look for it rather than
  // trusting the extension.
  return indexOfAscii(head, OOXML_CONTENT_TYPES) === -1 ? "zip" : "plain";
}

/**
 * Reads only the head of the picked file and reports what it is. Cheap
 * enough to run on every pick, which is the point — the user is prompted for
 * a password only when one is genuinely required.
 */
export async function inspectStatementFile(
  file: File,
): Promise<StatementFileKind> {
  if (file.size === 0) throw new StatementFileError("empty-file");
  if (file.size > STATEMENT_MAX_FILE_BYTES) {
    throw new StatementFileError("file-too-large");
  }
  const head = await readBlobBytes(
    file.slice(0, Math.min(HEAD_BYTES, file.size)),
  );
  return classifyStatementBytes(head);
}

function replaceExtension(name: string, extension: string): string {
  const dot = name.lastIndexOf(".");
  const stem = dot === -1 ? name : name.slice(0, dot);
  return `${stem || "statement"}.${extension}`;
}

function toFile(bytes: Uint8Array, name: string, type: string): File {
  // `new Uint8Array(bytes)` copies into a standalone buffer: `bytes` may be a
  // subarray view over a much larger decrypted allocation, and handing that
  // view's whole underlying buffer to `Blob` would upload the surplus.
  return new File([new Uint8Array(bytes)], name, { type });
}

/**
 * The seams. Both default to the real (dynamically imported) implementations
 * and are replaced wholesale in tests — the same posture as
 * `encodeReceiptFileWithinCap`'s injected decoder in `receipt-file.ts`,
 * where the environment (jsdom) cannot run the real thing.
 */
export type StatementFileSeams = {
  decryptOoxml?: (
    bytes: Uint8Array,
    password: string,
    maxPlaintextBytes: number,
  ) => Promise<Uint8Array>;
  openZip?: ZipArchiveOpener;
  maxFileBytes?: number;
};

async function loadOoxmlDecryptor() {
  // E4e — the CFB reader + WebCrypto agile decryptor are a separate chunk,
  // fetched on the upload that needs them, not on first paint.
  const mod = await import("./statement-ooxml-crypto");
  return mod;
}

async function loadZipOpener(): Promise<ZipArchiveOpener> {
  // E4e — `zip.js` is likewise never in the initial bundle.
  const mod = await import("./statement-zip");
  return mod.openZipWithZipJs;
}

const ZIP_REASONS: Record<string, StatementFileFailure> = {
  "password-required": "password-required",
  "wrong-password": "wrong-password",
  "no-statement": "zip-no-statement",
  "multiple-statements": "zip-multiple-statements",
  "entry-too-large": "zip-entry-too-large",
  "corrupt-file": "corrupt-file",
};

const OOXML_REASONS: Record<string, StatementFileFailure> = {
  "wrong-password": "wrong-password",
  "unsupported-encryption": "unsupported-encryption",
  "corrupt-file": "corrupt-file",
  "too-large": "decrypted-too-large",
  "integrity-failure": "integrity-failure",
  "integrity-missing": "integrity-missing",
};

/**
 * The whole client-side pipeline: classify → (decrypt | extract | pass
 * through) → a plaintext `File` ready for the existing upload mutation.
 *
 * `password` is `undefined` on the first attempt. A file that needs one
 * fails with `password-required`, the UI prompts, and the same file is run
 * again WITH the password — so a wrong password is retryable without the
 * user re-picking the file.
 */
export async function prepareStatementFile(
  file: File,
  password: string | undefined,
  seams: StatementFileSeams = {},
): Promise<File> {
  const maxFileBytes = seams.maxFileBytes ?? STATEMENT_MAX_FILE_BYTES;
  const kind = await inspectStatementFile(file);
  if (kind === "plain") return file;

  if (needsPassword(kind) && !password) {
    throw new StatementFileError("password-required");
  }

  const prepared =
    kind === "encrypted-xlsx"
      ? await decryptWorkbook(file, password ?? "", maxFileBytes, seams)
      : await extractFromArchive(file, password, seams);

  if (prepared.size === 0) throw new StatementFileError("corrupt-file");
  if (prepared.size > maxFileBytes) {
    throw new StatementFileError("decrypted-too-large");
  }
  return prepared;
}

async function decryptWorkbook(
  file: File,
  password: string,
  maxFileBytes: number,
  seams: StatementFileSeams,
): Promise<File> {
  if (!seams.decryptOoxml && !globalThis.crypto?.subtle) {
    // Plain-HTTP origins have no `crypto.subtle`. Saying so beats a generic
    // "file rusak" for a file that is perfectly fine.
    throw new StatementFileError("crypto-unavailable");
  }
  const decrypt =
    seams.decryptOoxml ?? (await loadOoxmlDecryptor()).decryptOoxml;
  const source = await readBlobBytes(file);
  try {
    const plain = await decrypt(source, password, maxFileBytes);
    return toFile(
      plain,
      replaceExtension(file.name, "xlsx"),
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  } catch (err) {
    throw new StatementFileError(reasonFrom(err, OOXML_REASONS));
  }
}

async function extractFromArchive(
  file: File,
  password: string | undefined,
  seams: StatementFileSeams,
): Promise<File> {
  const open = seams.openZip ?? (await loadZipOpener());
  const { extractStatementFromZip } = await import("./statement-zip");
  let extracted: ExtractedStatement;
  try {
    extracted = await extractStatementFromZip(file, password, { open });
  } catch (err) {
    throw new StatementFileError(reasonFrom(err, ZIP_REASONS));
  }
  const base = extracted.filename.split("/").pop() || "statement.csv";
  const isCsv = base.toLowerCase().endsWith(".csv");
  return toFile(
    extracted.bytes,
    base,
    isCsv
      ? "text/csv"
      : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
}

/**
 * Maps a lower-layer error onto this module's taxonomy. Anything unmapped
 * becomes `corrupt-file` rather than being re-thrown, so a library's own
 * message — which we do not control and cannot vouch for — never reaches the
 * UI or a log.
 */
function reasonFrom(
  err: unknown,
  table: Record<string, StatementFileFailure>,
): StatementFileFailure {
  if (err instanceof StatementFileError) return err.reason;
  // Duck-typed rather than `instanceof StatementZipError`: importing that
  // class statically would pull `statement-zip` into the first-paint chunk,
  // which is exactly what E4e forbids. Every error this can see carries a
  // string `reason`.
  const reason =
    typeof (err as { reason?: unknown } | null)?.reason === "string"
      ? (err as { reason: string }).reason
      : "";
  const mapped = table[reason];
  if (mapped) return mapped;
  reportUnexpectedFailure(err);
  return "corrupt-file";
}

/**
 * EPIC-029 group 4 review (MEDIUM) — an unmapped error becomes `corrupt-file`
 * and, before this, vanished entirely. That is right for the USER (a library
 * message is not something we can vouch for, and a decryptor's message is
 * password-adjacent by definition) but wrong for us: a genuine defect in this
 * group would present to every affected user, forever, as "file rusak",
 * indistinguishable from a genuinely bad file, with nothing anywhere to say
 * otherwise.
 *
 * So exactly one thing is recorded: the error's `name`. Never `message`,
 * never `stack`, never any other property, never the file. `name` is a class
 * label ("TypeError", "OperationError", "NotSupportedError") — enough to tell
 * "our bug" from "their file", and structurally incapable of carrying the
 * password, which exists only as a local in this module and is never
 * interpolated anywhere.
 *
 * (`err.name` rather than `err.constructor.name`: minified production builds
 * mangle class names, and `name` survives.)
 */
function reportUnexpectedFailure(err: unknown): void {
  const label =
    err instanceof Error && typeof err.name === "string"
      ? err.name
      : typeof err;
  console.warn(
    `[statement-file] unexpected ${label} while unlocking a statement`,
  );
}

/**
 * One message per reason — the same bar as `receiptFileErrorMessage`: a
 * control that fails must tell the user what to do next. In particular
 * `wrong-password` says so explicitly and invites a retry, and is never
 * collapsed into `corrupt-file`.
 */
export function statementFileErrorMessage(
  err: unknown,
  t: I18nDictionary,
): string {
  const dict = t.rekonsiliasi;
  const reason: StatementFileFailure =
    err instanceof StatementFileError ? err.reason : "corrupt-file";
  switch (reason) {
    case "empty-file":
      return dict.protectedErrorEmptyFile;
    case "file-too-large":
      return dict.protectedErrorFileTooLarge;
    case "password-required":
      return dict.protectedErrorPasswordRequired;
    case "wrong-password":
      return dict.protectedErrorWrongPassword;
    case "unsupported-encryption":
      return dict.protectedErrorUnsupportedEncryption;
    case "crypto-unavailable":
      return dict.protectedErrorCryptoUnavailable;
    case "corrupt-file":
      return dict.protectedErrorCorruptFile;
    case "integrity-failure":
      return dict.protectedErrorIntegrityFailure;
    case "integrity-missing":
      return dict.protectedErrorIntegrityMissing;
    case "zip-no-statement":
      return dict.protectedErrorZipNoStatement;
    case "zip-multiple-statements":
      return dict.protectedErrorZipMultipleStatements;
    case "zip-entry-too-large":
      return dict.protectedErrorZipEntryTooLarge;
    case "decrypted-too-large":
      return dict.protectedErrorDecryptedTooLarge;
    default: {
      // Compile-time exhaustiveness, for the reason recorded in
      // `receiptFileErrorMessage`: a `default` that silently swallows a
      // newly-added reason keeps the build green while telling the user the
      // wrong thing to do. `never` makes it a type error instead.
      const _exhaustive: never = reason;
      void _exhaustive;
      return dict.protectedErrorCorruptFile;
    }
  }
}
