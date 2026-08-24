/**
 * EPIC-029 group A — rewrites a streaming-written `.xlsx` container into a
 * conventional one, in the browser, so the UNCHANGED server parser can read
 * it.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * The failure this exists for
 * ─────────────────────────────────────────────────────────────────────────
 *
 * A real Mandiri e-statement was traced end to end against the running code.
 * Decryption works; the parse does not. Every entry of the workbook inside is
 * written in STREAMING mode: general-purpose bit 3 set, CRC and both sizes
 * zeroed in the local file header, with the true values in a ZIP64-form data
 * descriptor (8-byte sizes) after the payload.
 *
 * `unzipper@0.10.14` — which `exceljs`'s `stream.xlsx.WorkbookReader` sits on
 * — walks FORWARD from the local headers and reads that descriptor as the
 * 4-byte form. It lands 8 bytes short and dies with `invalid signature:
 * 0x594` (0x594 = 1428 = the uncompressed length of the file's
 * `[Content_Types].xml`, read as if it were a signature).
 *
 * Nothing is wrong with the archive. Python's `zipfile`, `zip.js` and Excel
 * all read it, because they go through the central directory, which carries
 * the true sizes. Re-packaging the identical entries into a conventional
 * archive and handing THAT to the real `parseExcelBuffer` yields all 101 rows
 * — verified. So this is a container rewrite, never a content rewrite.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Why the browser, and why every xlsx rather than only decrypted ones
 * ─────────────────────────────────────────────────────────────────────────
 *
 * The same bank's UNENCRYPTED export hits the identical failure and never
 * goes near the decrypt path, so the fix cannot live there. Doing it here
 * also leaves `apps/api/src/reconciliation/zip-bounds.util.ts` — whose
 * memory bounds were defeated twice in review — untouched and still guarding
 * direct API callers.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Bounding, because this inflates an archive in the user's own tab
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Both lessons recorded in `zip-bounds.util.ts` apply verbatim and are
 * applied here:
 *
 *   A. **Declared sizes are decorative.** A header's `uncompressedSize` is
 *      whatever the author typed — and on THIS file shape it is literally
 *      zero. It is therefore used only as a cheap early refusal; the real
 *      output bytes are counted as they arrive.
 *   B. **The output is never buffered before it is measured.** Extraction
 *      writes through a counting sink that throws at the cap, so the
 *      allocation the bound exists to prevent never happens.
 *
 * The budget is shared across ALL entries, not applied per entry: a thousand
 * entries each just under a per-entry cap would otherwise sum to a bomb.
 */

/**
 * Total real (measured) bytes every entry of the package may expand to,
 * combined. Mirrors the server's `MAX_XLSX_UNCOMPRESSED_BYTES`: whatever we
 * produce has to clear that bound anyway, so refusing here saves the user an
 * upload round-trip and refuses the bomb before it detonates in their tab.
 */
export const STATEMENT_PACKAGE_MAX_TOTAL_BYTES = 64 * 1024 * 1024;

/**
 * How many parts a workbook may hold. An OOXML package is a handful of XML
 * parts plus one per sheet, per image, and per relationship file; the real
 * statement has 14. 1024 leaves room for a large multi-sheet workbook with
 * embedded media while refusing an archive whose only purpose is to make us
 * loop.
 */
export const STATEMENT_PACKAGE_MAX_ENTRIES = 1024;

export type OoxmlZipFailure =
  /** The package expands past the byte/entry budget. */
  | "package-too-large"
  /** The archive could not be read back or written out. */
  | "repackage-failed";

export class OoxmlZipError extends Error {
  constructor(readonly reason: OoxmlZipFailure) {
    // Reason only — this runs on a file the user may have unlocked with a
    // password, and no message here may carry anything from the file.
    super(`ooxml package rejected: ${reason}`);
    this.name = "OoxmlZipError";
  }
}

/** One part of the package, held as its real decompressed bytes. */
export type OoxmlPackagePart = {
  filename: string;
  bytes: Uint8Array;
  lastModDate?: Date;
};

/**
 * The seam. Everything above it — the budget, the entry cap, the ordering
 * guarantee — is plain logic and unit-tested directly; `zip.js` sits below it
 * and is dynamically imported so it stays out of first paint (E4e).
 */
export type OoxmlZipEntryHandle = {
  filename: string;
  directory: boolean;
  /** The archive's own claim. Never trusted; used only for early refusal —
   * and on a streaming-written file it is zero, which is exactly the point. */
  declaredUncompressedSize: number;
  lastModDate?: Date;
  extractTo: (sink: WritableStream<Uint8Array>) => Promise<void>;
};

export type OoxmlPackageReader = (
  bytes: Uint8Array,
) => Promise<{ entries: OoxmlZipEntryHandle[]; close: () => Promise<void> }>;

export type OoxmlPackageWriter = (
  parts: readonly OoxmlPackagePart[],
) => Promise<Uint8Array>;

/**
 * A shared, cross-entry byte budget. `spend` throws the moment the running
 * total passes the cap — called from inside the sink so the pipe is torn
 * down and the decompressor stops producing (lesson B), rather than after an
 * oversized buffer has already been allocated.
 */
export function createByteBudget(maxBytes: number): {
  spend: (n: number) => void;
} {
  let total = 0;
  return {
    spend(n: number) {
      total += n;
      if (total > maxBytes) throw new OoxmlZipError("package-too-large");
    },
  };
}

function collectingSink(budget: { spend: (n: number) => void }): {
  stream: WritableStream<Uint8Array>;
  take: () => Uint8Array;
} {
  const chunks: Uint8Array[] = [];
  let size = 0;
  const stream = new WritableStream<Uint8Array>({
    write(chunk) {
      budget.spend(chunk.length);
      size += chunk.length;
      chunks.push(chunk);
    },
  });
  return {
    stream,
    take: () => {
      const out = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        out.set(chunk, offset);
        offset += chunk.length;
      }
      return out;
    },
  };
}

export type RepackageOptions = {
  read: OoxmlPackageReader;
  write: OoxmlPackageWriter;
  maxTotalBytes?: number;
  maxEntries?: number;
};

/**
 * Reads every part of the package, in the archive's own order, within budget.
 *
 * Directory entries are dropped: they carry no content, an OOXML package does
 * not need them, and a consumer that reads parts by name never looks for one.
 */
export async function readOoxmlParts(
  bytes: Uint8Array,
  options: RepackageOptions,
): Promise<OoxmlPackagePart[]> {
  const maxTotalBytes =
    options.maxTotalBytes ?? STATEMENT_PACKAGE_MAX_TOTAL_BYTES;
  const maxEntries = options.maxEntries ?? STATEMENT_PACKAGE_MAX_ENTRIES;
  const budget = createByteBudget(maxTotalBytes);

  const archive = await options.read(bytes);
  try {
    const entries = archive.entries.filter((entry) => !entry.directory);
    if (entries.length > maxEntries) {
      throw new OoxmlZipError("package-too-large");
    }

    const parts: OoxmlPackagePart[] = [];
    for (const entry of entries) {
      // Lesson (A): a cheap early NO. It is never the real bound — on the
      // file shape this module exists for, it is always zero.
      if (entry.declaredUncompressedSize > maxTotalBytes) {
        throw new OoxmlZipError("package-too-large");
      }
      const sink = collectingSink(budget);
      await entry.extractTo(sink.stream);
      parts.push({
        filename: entry.filename,
        bytes: sink.take(),
        lastModDate: entry.lastModDate,
      });
    }
    return parts;
  } finally {
    await archive.close().catch(() => undefined);
  }
}

/**
 * Re-packages `bytes` into a conventional archive: same entry names, same
 * order, same content byte for byte — only the container framing changes.
 *
 * Order is preserved rather than sorted because an `.xlsx` is order-sensitive
 * in practice: `[Content_Types].xml` is expected first, and readers in the
 * wild depend on it.
 */
export async function repackageOoxmlZip(
  bytes: Uint8Array,
  options: RepackageOptions,
): Promise<Uint8Array> {
  let parts: OoxmlPackagePart[];
  try {
    parts = await readOoxmlParts(bytes, options);
  } catch (err) {
    if (err instanceof OoxmlZipError) throw err;
    throw new OoxmlZipError("repackage-failed");
  }
  if (parts.length === 0) throw new OoxmlZipError("repackage-failed");

  try {
    return await options.write(parts);
  } catch (err) {
    if (err instanceof OoxmlZipError) throw err;
    throw new OoxmlZipError("repackage-failed");
  }
}

/**
 * The `zip.js` adapters, loaded on demand (E4e).
 *
 * `index-native.js` rather than the default entry, for the reason recorded in
 * `statement-zip.ts`: the default pulls a WASM inflate module that needs
 * bundler-specific asset handling, while the native entry uses the platform's
 * own `CompressionStream`/`DecompressionStream`.
 */
async function loadZipJs() {
  const mod = await import("@zip.js/zip.js/index-native.js");
  // Workers would need a separately-served script URL; this runs once per
  // upload on a ≤20 MB file, so the main thread is fine and the bundle stays
  // one module.
  mod.configure({ useWebWorkers: false });
  return mod;
}

export const readWithZipJs: OoxmlPackageReader = async (bytes) => {
  const { ZipReader, Uint8ArrayReader } = await loadZipJs();
  const reader = new ZipReader(new Uint8ArrayReader(bytes), {
    checkSignature: true,
  });
  const rawEntries = await reader.getEntries();
  const entries: OoxmlZipEntryHandle[] = rawEntries.map((entry) => {
    // `Entry` is a union: a `DirectoryEntry` has no `getData`. Directories
    // are dropped by `readOoxmlParts` anyway, so the handle for one simply
    // refuses rather than pretending to stream.
    const getData = "getData" in entry ? entry.getData.bind(entry) : null;
    return {
      filename: entry.filename,
      directory: Boolean(entry.directory),
      declaredUncompressedSize: entry.uncompressedSize ?? 0,
      lastModDate: entry.lastModDate,
      extractTo: async (sink: WritableStream<Uint8Array>) => {
        if (!getData) throw new OoxmlZipError("repackage-failed");
        await getData(sink, { checkSignature: true });
      },
    };
  });
  return { entries, close: () => reader.close() };
};

export const writeWithZipJs: OoxmlPackageWriter = async (parts) => {
  const { ZipWriter, Uint8ArrayWriter, Uint8ArrayReader } = await loadZipJs();
  // `dataDescriptor: false` is the entire point of this module: it forces the
  // real CRC and sizes into each local file header, which is what a
  // forward-streaming reader needs and what the source archive withholds.
  const writer = new ZipWriter(new Uint8ArrayWriter(), {
    dataDescriptor: false,
  });
  for (const part of parts) {
    await writer.add(part.filename, new Uint8ArrayReader(part.bytes), {
      lastModDate: part.lastModDate,
    });
  }
  return writer.close();
};

/** The production pipeline: read with `zip.js`, write back with `zip.js`. */
export function normalizeOoxmlPackage(bytes: Uint8Array): Promise<Uint8Array> {
  return repackageOoxmlZip(bytes, {
    read: readWithZipJs,
    write: writeWithZipJs,
  });
}
