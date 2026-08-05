/**
 * EPIC-023 G2 — the decompression-amplification bound.
 *
 * The archives here are assembled from raw zip bytes rather than with a zip
 * library, deliberately: the guard reads the container itself, so the tests
 * should hand it bytes we control exactly — and it avoids pulling a new
 * dependency into the API purely to write a test.
 *
 * The two BYPASS cases are the ones that matter. They are the exact techniques
 * a security review used to defeat an earlier, declaration-trusting version of
 * this guard end to end, at ~956 MiB and ~344 MiB. If either stops throwing,
 * the vulnerability is back.
 */
import { deflateRawSync } from "node:zlib";

import ExcelJS from "exceljs";

import { parseExcelBuffer } from "./reconciliation-parsers";
import {
  assertZipExpansionWithinBounds,
  MAX_XLSX_UNCOMPRESSED_BYTES,
  ZipExpansionExceededError,
} from "./zip-bounds.util";

/** A minimal but genuine .xlsx, built by exceljs itself. */
async function realWorkbookBuffer(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Sheet1");
  sheet.addRow(["Tanggal", "Keterangan", "Jumlah"]);
  sheet.addRow(["2026-08-01", "Belanja, Toko A", 150000]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/**
 * One local zip entry holding a REAL deflate stream, whose header may declare
 * any uncompressed size we like — including a lie.
 */
function deflateEntry(
  name: string,
  raw: Buffer,
  declaredUncompressed = raw.length,
): Buffer {
  const nameBytes = Buffer.from(name, "utf8");
  const compressed = deflateRawSync(raw, { level: 9 });
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0); // local file header signature
  header.writeUInt16LE(20, 4); // version needed
  header.writeUInt16LE(8, 8); // method: DEFLATE
  header.writeUInt32LE(compressed.length, 18); // compressed size
  header.writeUInt32LE(declaredUncompressed, 22); // uncompressed size
  header.writeUInt16LE(nameBytes.length, 26);
  header.writeUInt16LE(0, 28); // extra length
  return Buffer.concat([header, nameBytes, compressed]);
}

/** An End Of Central Directory record. `entries: 0` makes a decoy trailer. */
function eocd(entries: number): Buffer {
  const rec = Buffer.alloc(22);
  rec.writeUInt32LE(0x06054b50, 0);
  rec.writeUInt16LE(entries, 8);
  rec.writeUInt16LE(entries, 10);
  return rec;
}

/** Highly compressible filler — small on the wire, large once inflated. */
function filler(bytes: number): Buffer {
  return Buffer.alloc(bytes, 0x61);
}

describe("assertZipExpansionWithinBounds", () => {
  it("passes a real, ordinary workbook", async () => {
    const buffer = await realWorkbookBuffer();
    expect(() => assertZipExpansionWithinBounds(buffer)).not.toThrow();
  });

  it("stays silent on a buffer that is not a zip at all", () => {
    // Reporting "this is not a spreadsheet" belongs to the parser, which
    // already does it well; this guard's only job is the size bound.
    const notAZip = Buffer.from("this is plainly not a spreadsheet", "utf8");
    expect(() => assertZipExpansionWithinBounds(notAZip)).not.toThrow();
  });

  it("allows an archive that really expands to well under the bound", () => {
    const ok = Buffer.concat([
      deflateEntry("xl/sharedStrings.xml", filler(8 * 1024 * 1024)),
      eocd(1),
    ]);
    expect(() => assertZipExpansionWithinBounds(ok)).not.toThrow();
  });

  it("refuses an archive that really expands past the bound", () => {
    const bomb = Buffer.concat([
      deflateEntry(
        "xl/sharedStrings.xml",
        filler(MAX_XLSX_UNCOMPRESSED_BYTES + 1024 * 1024),
      ),
      eocd(1),
    ]);
    expect(() => assertZipExpansionWithinBounds(bomb)).toThrow(
      ZipExpansionExceededError,
    );
  });

  it("sums across entries, so many medium parts cannot pass individually", () => {
    // Each part is comfortably under the cap alone; together they are not.
    const parts = Array.from({ length: 10 }, (_, i) =>
      deflateEntry(`xl/part${i}.xml`, filler(8 * 1024 * 1024)),
    );
    const bomb = Buffer.concat([...parts, eocd(parts.length)]);
    expect(() => assertZipExpansionWithinBounds(bomb)).toThrow(
      ZipExpansionExceededError,
    );
  });

  // ── The two verified bypasses of the previous, declaration-trusting guard ──

  it("BYPASS A: refuses a part that under-declares its real expansion", () => {
    // The defeated version summed DECLARED sizes. unzipper inflates the real
    // payload whatever the header claims, so declaring 500 bytes for a part
    // that truly inflates far past the cap sailed through and cost ~956 MiB.
    // Nothing is trusted now — the entry is actually inflated and counted.
    const bomb = Buffer.concat([
      deflateEntry(
        "xl/sharedStrings.xml",
        filler(MAX_XLSX_UNCOMPRESSED_BYTES + 16 * 1024 * 1024),
        500, // the lie
      ),
      eocd(1),
    ]);
    expect(() => assertZipExpansionWithinBounds(bomb)).toThrow(
      ZipExpansionExceededError,
    );
  });

  it("BYPASS B: refuses despite an appended decoy EOCD claiming zero entries", () => {
    // The defeated version scanned backwards for the EOCD and believed the
    // attacker's 22-byte trailer, summing nothing. This guard never consults
    // the central directory or EOCD at all — it walks local file headers
    // forward, the way a streaming unzipper meets them.
    const bomb = Buffer.concat([
      deflateEntry(
        "xl/sharedStrings.xml",
        filler(MAX_XLSX_UNCOMPRESSED_BYTES + 16 * 1024 * 1024),
      ),
      eocd(1),
      eocd(0), // decoy, found first by a backward scan
    ]);
    expect(() => assertZipExpansionWithinBounds(bomb)).toThrow(
      ZipExpansionExceededError,
    );
  });

  it("keeps its own memory bounded while refusing — the guard is not the attack", () => {
    // zlib's maxOutputLength aborts inside the call rather than allocating the
    // whole expansion first. Without it, this check would itself be the bomb.
    const bomb = Buffer.concat([
      deflateEntry("xl/sharedStrings.xml", filler(400 * 1024 * 1024)),
      eocd(1),
    ]);
    const before = process.memoryUsage().rss;
    expect(() => assertZipExpansionWithinBounds(bomb)).toThrow(
      ZipExpansionExceededError,
    );
    const grownMiB = (process.memoryUsage().rss - before) / (1024 * 1024);
    expect(grownMiB).toBeLessThan(200);
  });

  it("fires before exceljs is handed the buffer", async () => {
    // If the bound ran inside the parse, the memory would already be committed
    // by the time it tripped. This archive is not a valid workbook, so
    // reaching exceljs would raise an unreadable-file error instead — getting
    // the expansion error proves the ordering.
    const bomb = Buffer.concat([
      deflateEntry(
        "xl/sharedStrings.xml",
        filler(MAX_XLSX_UNCOMPRESSED_BYTES + 8 * 1024 * 1024),
      ),
      eocd(1),
    ]);
    await expect(parseExcelBuffer(bomb)).rejects.toThrow(
      ZipExpansionExceededError,
    );
  });

  it("still lets a legitimate workbook through end to end", async () => {
    const buffer = await realWorkbookBuffer();
    const table = await parseExcelBuffer(buffer);
    expect(table[0]).toEqual(["Tanggal", "Keterangan", "Jumlah"]);
    expect(table[1]?.[1]).toBe("Belanja, Toko A");
  });
});
