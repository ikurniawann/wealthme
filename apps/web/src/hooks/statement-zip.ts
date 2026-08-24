/**
 * EPIC-029 group 4 (E4c) — pulls the CSV/XLSX statement out of a
 * password-protected ZIP, in the browser, so the inner plaintext file can be
 * uploaded to the UNCHANGED server parser (E8: the password never leaves the
 * tab).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Bounding, and why the server's guard does not cover this
 * ─────────────────────────────────────────────────────────────────────────
 *
 * `apps/api/src/reconciliation/zip-bounds.util.ts` bounds the expansion of an
 * uploaded `.xlsx`. It does NOT protect this path: the extraction happens
 * here, in the user's own tab, before anything is uploaded. A
 * password-protected zip bomb is still a zip bomb — it just detonates on the
 * client instead of the server.
 *
 * That file's header records how its predecessor was defeated twice, and
 * both lessons apply verbatim:
 *
 *   A. **Declared sizes are decorative.** A central-directory
 *      `uncompressedSize` is whatever the author typed; the decompressor
 *      inflates the real payload regardless. So the declared size is used
 *      only as a cheap EARLY refusal, and the real output bytes are counted
 *      as they arrive, aborting the stream the moment the total is exceeded.
 *   B. **The output is never buffered before it is measured.** Extraction
 *      writes through a counting `WritableStream` that throws at the cap, so
 *      the allocation the bound exists to prevent never happens.
 *
 * The cap mirrors the server's `MAX_XLSX_UNCOMPRESSED_BYTES` intent, sized
 * to the same 20 MB upload ceiling the extracted file must still clear.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Multiple entries: refused, never guessed
 * ─────────────────────────────────────────────────────────────────────────
 *
 * A bank ZIP holds one statement. If it holds two, picking the first one
 * silently is exactly the class of bug this epic exists to avoid — the user
 * would reconcile the wrong month and never know. Two or more candidate
 * entries is therefore its own refusal with its own message.
 */

/** Total real (measured) bytes an extracted entry may expand to. */
export const STATEMENT_ZIP_MAX_ENTRY_BYTES = 64 * 1024 * 1024;

/** Extensions the server's `uploadFile` can actually parse. */
const STATEMENT_EXTENSIONS = ["csv", "xlsx"] as const;

export type StatementZipFailure =
  /** Entries are encrypted and no password was supplied yet. */
  | "password-required"
  /** The password did not decrypt the entry. */
  | "wrong-password"
  /** No `.csv`/`.xlsx` inside. */
  | "no-statement"
  /** More than one candidate — refused rather than guessed. */
  | "multiple-statements"
  /** The entry expands past `STATEMENT_ZIP_MAX_ENTRY_BYTES`. */
  | "entry-too-large"
  /** The archive itself is unreadable. */
  | "corrupt-file";

export class StatementZipError extends Error {
  constructor(readonly reason: StatementZipFailure) {
    // Reason-only: never the password, never the entry's contents.
    super(`statement zip rejected: ${reason}`);
    this.name = "StatementZipError";
  }
}

/**
 * The seam. Everything above it (entry selection, bounding, the failure
 * taxonomy) is plain logic and is unit-tested directly; `zip.js` sits below
 * it and is dynamically imported so it costs nothing on first paint (E4e).
 */
export type ZipEntryHandle = {
  filename: string;
  directory: boolean;
  encrypted: boolean;
  /** The archive's own claim. Never trusted — used only for early refusal. */
  declaredUncompressedSize: number;
  /**
   * Streams the entry's real bytes into `sink`. Must reject with
   * `StatementZipError("wrong-password")` when the password is invalid, and
   * must propagate whatever `sink` throws.
   */
  extractTo: (sink: WritableStream<Uint8Array>) => Promise<void>;
};

export type ZipArchiveOpener = (
  file: File,
  password: string | undefined,
) => Promise<{ entries: ZipEntryHandle[]; close: () => Promise<void> }>;

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

/**
 * The entries that could plausibly BE the statement. Directories, macOS
 * resource forks and dotfiles are dropped first — a `__MACOSX/._mutasi.csv`
 * beside `mutasi.csv` would otherwise read as "two statements" and refuse a
 * perfectly good archive.
 */
export function selectStatementEntries<T extends ZipEntryHandle>(
  entries: readonly T[],
): T[] {
  return entries.filter((entry) => {
    if (entry.directory) return false;
    const segments = entry.filename.split("/");
    const base = segments[segments.length - 1];
    if (!base || base.startsWith(".")) return false;
    if (segments.some((s) => s === "__MACOSX")) return false;
    return STATEMENT_EXTENSIONS.includes(
      extensionOf(base) as (typeof STATEMENT_EXTENSIONS)[number],
    );
  });
}

/**
 * A sink that counts what actually passes through it and aborts the stream
 * once `maxBytes` is exceeded — lesson (A) above, applied. Chunks are
 * collected only while the running total is inside the budget.
 */
export function boundedCollector(maxBytes: number): {
  stream: WritableStream<Uint8Array>;
  take: () => Uint8Array;
} {
  const chunks: Uint8Array[] = [];
  let total = 0;
  const stream = new WritableStream<Uint8Array>({
    write(chunk) {
      total += chunk.length;
      if (total > maxBytes) {
        // Thrown INSIDE the sink so the pipe is torn down and the
        // decompressor stops producing, rather than after the fact.
        throw new StatementZipError("entry-too-large");
      }
      chunks.push(chunk);
    },
  });
  return {
    stream,
    take: () => {
      const out = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        out.set(chunk, offset);
        offset += chunk.length;
      }
      return out;
    },
  };
}

export type ExtractedStatement = {
  filename: string;
  bytes: Uint8Array;
};

/**
 * Opens the archive, picks the single statement entry, and extracts it
 * within budget.
 *
 * `password` is passed straight through to the opener and is never stored,
 * logged, or attached to any error raised here.
 */
export async function extractStatementFromZip(
  file: File,
  password: string | undefined,
  options: {
    open: ZipArchiveOpener;
    maxEntryBytes?: number;
  },
): Promise<ExtractedStatement> {
  const maxEntryBytes = options.maxEntryBytes ?? STATEMENT_ZIP_MAX_ENTRY_BYTES;

  let archive: Awaited<ReturnType<ZipArchiveOpener>>;
  try {
    archive = await options.open(file, password);
  } catch (err) {
    if (err instanceof StatementZipError) throw err;
    throw new StatementZipError("corrupt-file");
  }

  try {
    const candidates = selectStatementEntries(archive.entries);
    if (candidates.length === 0) throw new StatementZipError("no-statement");
    if (candidates.length > 1) {
      throw new StatementZipError("multiple-statements");
    }

    const entry = candidates[0];
    if (entry.encrypted && !password) {
      throw new StatementZipError("password-required");
    }
    // Lesson (A): the declared size is a cheap early NO, not the real bound.
    if (entry.declaredUncompressedSize > maxEntryBytes) {
      throw new StatementZipError("entry-too-large");
    }

    const collector = boundedCollector(maxEntryBytes);
    try {
      await entry.extractTo(collector.stream);
    } catch (err) {
      if (err instanceof StatementZipError) throw err;
      throw new StatementZipError("corrupt-file");
    }
    return { filename: entry.filename, bytes: collector.take() };
  } finally {
    await archive.close().catch(() => undefined);
  }
}

/**
 * The `zip.js` adapter, loaded on demand (E4e).
 *
 * `index-native.js` rather than the default entry on purpose: the default
 * pulls the WASM inflate module (`dist/zip-module.wasm`), which needs
 * bundler-specific asset handling, while the native entry uses the
 * platform's own `DecompressionStream`. Both handle ZipCrypto and AES —
 * encryption lives in the core, not the codec.
 */
export const openZipWithZipJs: ZipArchiveOpener = async (file, password) => {
  const {
    ZipReader,
    BlobReader,
    ERR_INVALID_PASSWORD,
    ERR_ENCRYPTED,
    configure,
  } = await import("@zip.js/zip.js/index-native.js");

  // Workers would need a separately-served script URL; this runs once per
  // upload on a ≤20 MB file, so the main thread is fine and the bundle stays
  // one module.
  configure({ useWebWorkers: false });

  const reader = new ZipReader(new BlobReader(file), {
    password,
    // A wrong ZipCrypto password passes the 1-byte check ~1/256 of the time;
    // the CRC then catches it. Without this, that case would surface as
    // garbled CSV rather than "wrong password".
    checkSignature: true,
  });

  let rawEntries;
  try {
    rawEntries = await reader.getEntries();
  } catch (err) {
    await reader.close().catch(() => undefined);
    throw mapZipJsError(err, ERR_INVALID_PASSWORD, ERR_ENCRYPTED);
  }

  const entries: ZipEntryHandle[] = rawEntries.map((entry) => {
    // `Entry` is a union: a `DirectoryEntry` has no `getData`. Directories
    // are dropped by `selectStatementEntries` anyway, so the handle for one
    // simply refuses rather than pretending to stream.
    const getData = "getData" in entry ? entry.getData.bind(entry) : null;
    return {
      filename: entry.filename,
      directory: Boolean(entry.directory),
      encrypted: Boolean(entry.encrypted),
      declaredUncompressedSize: entry.uncompressedSize ?? 0,
      extractTo: async (sink: WritableStream<Uint8Array>) => {
        if (!getData) throw new StatementZipError("corrupt-file");
        try {
          await getData(sink, { password, checkSignature: true });
        } catch (err) {
          throw mapZipJsError(err, ERR_INVALID_PASSWORD, ERR_ENCRYPTED);
        }
      },
    };
  });

  return { entries, close: () => reader.close() };
};

/**
 * `zip.js` reports failures as `Error`s whose `message` is one of its
 * exported constants. Only the two that mean something specific to the user
 * are translated; everything else becomes the generic corrupt-file reason
 * rather than leaking a library string into the UI.
 */
function mapZipJsError(
  err: unknown,
  invalidPassword: string,
  encrypted: string,
): Error {
  if (err instanceof StatementZipError) return err;
  const message = err instanceof Error ? err.message : "";
  if (message === invalidPassword)
    return new StatementZipError("wrong-password");
  if (message === encrypted) return new StatementZipError("password-required");
  return new StatementZipError("corrupt-file");
}
