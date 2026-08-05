/**
 * EPIC-023 G2 — decompression-amplification bound for uploaded `.xlsx` files.
 *
 * An `.xlsx` is a zip archive. Every cap that lives *inside* the parser has
 * turned out to be too late or too narrow, because each of exceljs's auxiliary
 * caches is loaded in full before the first worksheet row is yielded, and none
 * of them is counted by a row or cell limit:
 *
 *   - `workbook.xlsx.load()` materialised the whole sheet up front:
 *     3.6 MiB file  → 774 MiB peak RSS, before any cap ran.
 *   - streaming reader fixed that, then `styles: "cache"` reopened it:
 *     18.6 MiB file (a THREE-cell worksheet, ~2.5M numFmt entries)
 *                   → 696 MiB peak RSS.
 *   - `styles: "ignore"` fixed that, then `sharedStrings: "cache"` reopened it:
 *     19.2 MiB file (a THREE-cell worksheet, 8M distinct strings)
 *                   → 969 MiB peak RSS.
 *
 * Three rounds, three doors, one room. `sharedStrings` cannot simply be
 * disabled the way `styles` could — it holds the actual cell text, not
 * formatting — so the durable fix is to stop guessing which cache is
 * dangerous and instead bound what the archive can expand to *at all*,
 * before exceljs is handed a single byte.
 *
 * This reads the zip central directory (a small, fixed-layout index at the end
 * of the file) and sums the declared uncompressed sizes. It never decompresses
 * anything, so the check itself cannot be turned into the attack.
 *
 * A declared size is attacker-controlled, so it is not trusted as *truth* —
 * only as a refusal trigger. A liar can only under-declare, and an archive
 * that under-declares still has to get past the row and cell caps that remain
 * in `parseExcelBuffer` as defence in depth.
 */

/** Total declared uncompressed bytes an uploaded workbook may expand to.
 *
 * Sized against real use, not the attack: the row cap allows 20,000 rows, and
 * a 20,000-row statement with three text columns is a few MiB of XML. 64 MiB
 * is ~13x the 20 MiB upload ceiling and far beyond any genuine bank export,
 * while refusing every measured bomb above by an order of magnitude. */
export const MAX_XLSX_UNCOMPRESSED_BYTES = 64 * 1024 * 1024;

/** Thrown when an archive declares more expansion than we will process. Kept
 * distinct from a generic unreadable-file error so the caller can explain
 * what to do about it. */
export class ZipExpansionExceededError extends Error {}

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_FILE_HEADER_SIGNATURE = 0x02014b50;
const ZIP64_EXTRA_HEADER_ID = 0x0001;
const EOCD_MIN_SIZE = 22;
/** A zip comment is a 16-bit length, so the EOCD starts at most 0xFFFF + 22
 * bytes from the end. */
const EOCD_MAX_SEARCH = 0xffff + EOCD_MIN_SIZE;
/** Sentinel meaning "the real value is in the ZIP64 extra field". */
const ZIP64_SENTINEL_32 = 0xffffffff;

/** Finds the End Of Central Directory record, scanning backwards from the end
 * so a trailing comment does not hide it. Returns -1 when absent (i.e. this is
 * not a zip at all — left to the caller to report). */
function findEocdOffset(buffer: Buffer): number {
  const searchFrom = Math.max(0, buffer.length - EOCD_MAX_SEARCH);
  for (let i = buffer.length - EOCD_MIN_SIZE; i >= searchFrom; i--) {
    if (buffer.readUInt32LE(i) === EOCD_SIGNATURE) return i;
  }
  return -1;
}

/** Reads the 64-bit uncompressed size out of a central-directory entry's
 * ZIP64 extra field. The extra field is a sequence of (id, size, payload)
 * blocks; within the ZIP64 block the uncompressed size comes first, so it is
 * only present when the 32-bit field was the sentinel. */
function readZip64UncompressedSize(
  extra: Buffer,
  compressedWasSentinel: boolean,
): number | null {
  let offset = 0;
  while (offset + 4 <= extra.length) {
    const headerId = extra.readUInt16LE(offset);
    const blockSize = extra.readUInt16LE(offset + 2);
    const body = offset + 4;
    if (headerId === ZIP64_EXTRA_HEADER_ID) {
      if (body + 8 > extra.length) return null;
      // Ordering within the ZIP64 block is uncompressed, then compressed —
      // and each is present only if its 32-bit counterpart was the sentinel.
      // We are here because uncompressed was, so it is the first 8 bytes.
      void compressedWasSentinel;
      return Number(extra.readBigUInt64LE(body));
    }
    offset = body + blockSize;
  }
  return null;
}

/**
 * Refuses an archive whose central directory declares more total expansion
 * than `MAX_XLSX_UNCOMPRESSED_BYTES`.
 *
 * Deliberately silent when the buffer is not a readable zip: reporting "this
 * is not a spreadsheet" is the parser's job and it already does it well. This
 * function's only responsibility is the size bound.
 */
export function assertZipExpansionWithinBounds(buffer: Buffer): void {
  const eocd = findEocdOffset(buffer);
  if (eocd < 0) return; // not a zip — the parser will report it

  const entryCount = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);

  let total = 0;
  for (let i = 0; i < entryCount; i++) {
    if (offset + 46 > buffer.length) return; // truncated index — parser reports
    if (buffer.readUInt32LE(offset) !== CENTRAL_FILE_HEADER_SIGNATURE) return;

    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);

    let entrySize: number = uncompressedSize;
    if (uncompressedSize === ZIP64_SENTINEL_32) {
      const extraStart = offset + 46 + nameLength;
      const extra = buffer.subarray(extraStart, extraStart + extraLength);
      const zip64Size = readZip64UncompressedSize(
        extra,
        compressedSize === ZIP64_SENTINEL_32,
      );
      // A ZIP64 entry we cannot read is refused rather than waved through:
      // an unreadable size is exactly what an attacker would arrange.
      if (zip64Size === null) {
        throw new ZipExpansionExceededError(
          "Ukuran isi file Excel tidak bisa dibaca — file kemungkinan rusak atau tidak wajar. Ekspor ulang dari bank Anda, atau gunakan CSV.",
        );
      }
      entrySize = zip64Size;
    }

    total += entrySize;
    if (total > MAX_XLSX_UNCOMPRESSED_BYTES) {
      throw new ZipExpansionExceededError(
        `Isi file Excel ini terlalu besar setelah diekstrak (melebihi ${Math.floor(
          MAX_XLSX_UNCOMPRESSED_BYTES / (1024 * 1024),
        )} MB) — pisahkan menjadi beberapa file yang lebih kecil, atau gunakan CSV.`,
      );
    }

    offset += 46 + nameLength + extraLength + commentLength;
  }
}
