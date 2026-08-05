import { inflateRawSync } from "node:zlib";

/**
 * EPIC-023 G2 — decompression-amplification bound for uploaded `.xlsx` files.
 *
 * An `.xlsx` is a zip archive, and `exceljs` reads several of its parts in
 * full before yielding a single worksheet row. Every bound placed *inside* the
 * parser was defeated by moving to whichever part was still being read:
 *
 *   - `workbook.xlsx.load()` materialised the whole sheet up front:
 *     3.6 MiB file  → 774 MiB peak RSS, before any cap ran.
 *   - the streaming reader fixed that; `styles: "cache"` reopened it:
 *     18.6 MiB file (a THREE-cell worksheet, ~2.5M numFmt entries) → 696 MiB.
 *   - `styles: "ignore"` fixed that; `sharedStrings: "cache"` reopened it:
 *     19.2 MiB file (a THREE-cell worksheet, 8M strings) → 969 MiB.
 *
 * `sharedStrings` cannot simply be ignored — it holds the actual cell text,
 * not formatting. So this stops guessing which part is dangerous and bounds
 * the archive itself, before exceljs is handed a byte.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Why this measures instead of reading the declared sizes
 * ─────────────────────────────────────────────────────────────────────────
 *
 * A previous revision summed the *declared* uncompressed sizes from the
 * central directory. A security review defeated it end to end, twice:
 *
 *   A. Under-declare. `unzipper` (which exceljs streams through) inflates the
 *      real DEFLATE payload regardless of what any header claims — a declared
 *      size is decorative to the decompression path. An archive declaring 500
 *      bytes for a part that truly inflates to 412 MiB consumed 956 MiB and
 *      **returned successfully**, leaving no error to alert on.
 *
 *   B. Append a second, empty 22-byte EOCD. A backward scan finds the
 *      attacker's trailer first, reads "0 entries", and returns silently while
 *      exceljs ignores the trailer and parses the real content. 344 MiB, no
 *      lie required, a fixed suffix appliable to any file.
 *
 * Both are closed here by construction:
 *
 *   - **Nothing is trusted.** Every DEFLATE entry is really inflated and its
 *     output bytes counted, so under-declaring changes nothing.
 *   - **The central directory and EOCD are never consulted.** Entries are
 *     found by scanning forward for local-file-header signatures, the way a
 *     streaming unzipper meets them, so an appended trailer is irrelevant.
 *
 * The guard is bounded by its own cap — `maxOutputLength` makes zlib abort
 * inside the call rather than allocating the full expansion first — so it can
 * never become the attack it prevents. It costs one extra decompression of an
 * already size-limited (≤20 MiB) upload, cheap next to the parse that follows.
 */

/** Total real uncompressed bytes an uploaded workbook may expand to.
 *
 * Sized against genuine use, not the attack: the row cap allows 20,000 rows,
 * and a 20,000-row statement with three text columns is a few MiB of XML.
 * 64 MiB is ~13x the 20 MiB upload ceiling and far beyond any real bank
 * export, while refusing every measured bomb by an order of magnitude. */
export const MAX_XLSX_UNCOMPRESSED_BYTES = 64 * 1024 * 1024;

/** Thrown when an archive really does expand past the bound. Kept distinct
 * from a generic unreadable-file error so the caller can explain it. */
export class ZipExpansionExceededError extends Error {}

const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const LOCAL_HEADER_FIXED_SIZE = 30;
const METHOD_STORED = 0;
const METHOD_DEFLATE = 8;

function tooBig(): ZipExpansionExceededError {
  return new ZipExpansionExceededError(
    `Isi file Excel ini terlalu besar setelah diekstrak (melebihi ${Math.floor(
      MAX_XLSX_UNCOMPRESSED_BYTES / (1024 * 1024),
    )} MB) — pisahkan menjadi beberapa file yang lebih kecil, atau gunakan CSV.`,
  );
}

/**
 * Inflates one DEFLATE stream starting at `start`, refusing once it would push
 * the running total past the cap.
 *
 * `maxOutputLength` is what keeps this safe: without it, zlib would allocate
 * the entire expansion before returning — precisely the behaviour being
 * defended against. The caller's remaining headroom is passed in, so the
 * *cumulative* total is what binds; ten 8 MiB parts must still trip a 64 MiB
 * cap, not pass individually.
 */
function inflatedSize(
  buffer: Buffer,
  start: number,
  remainingBudget: number,
): number {
  try {
    return inflateRawSync(buffer.subarray(start), {
      maxOutputLength: remainingBudget + 1,
    }).length;
  } catch (err) {
    // zlib raises ERR_BUFFER_TOO_LARGE the moment maxOutputLength is passed —
    // that is this function's refusal, not a malformed-file symptom.
    if (
      (err as NodeJS.ErrnoException | undefined)?.code ===
      "ERR_BUFFER_TOO_LARGE"
    ) {
      throw tooBig();
    }
    // A truncated or corrupt stream is not this function's to report: the
    // parser gives a far better message for "this is not a spreadsheet".
    return 0;
  }
}

/**
 * Refuses an archive that genuinely expands past
 * `MAX_XLSX_UNCOMPRESSED_BYTES`.
 *
 * Deliberately silent when the buffer is not a readable zip — reporting "this
 * is not a spreadsheet" belongs to the parser, which already does it well.
 * This function's only responsibility is the size bound.
 */
export function assertZipExpansionWithinBounds(buffer: Buffer): void {
  let total = 0;
  let offset = 0;

  while (offset + LOCAL_HEADER_FIXED_SIZE <= buffer.length) {
    if (buffer.readUInt32LE(offset) !== LOCAL_FILE_HEADER_SIGNATURE) {
      // Advance by signature, never by arithmetic on declared lengths — those
      // are exactly what an attacker controls.
      offset++;
      continue;
    }

    const method = buffer.readUInt16LE(offset + 8);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const dataStart =
      offset + LOCAL_HEADER_FIXED_SIZE + nameLength + extraLength;
    if (dataStart >= buffer.length) break;

    if (method === METHOD_DEFLATE) {
      total += inflatedSize(
        buffer,
        dataStart,
        MAX_XLSX_UNCOMPRESSED_BYTES - total,
      );
    } else if (method === METHOD_STORED) {
      // Stored data cannot amplify — it is already its own size — but it still
      // counts, so a pile of stored parts cannot slip past the total.
      const declared = buffer.readUInt32LE(offset + 22);
      total += Math.min(declared, buffer.length - dataStart);
    }

    if (total > MAX_XLSX_UNCOMPRESSED_BYTES) throw tooBig();

    offset = dataStart;
  }
}
