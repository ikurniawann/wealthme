/**
 * EPIC-023 G2 — the decompression-amplification bound.
 *
 * The archives here are assembled from raw zip bytes rather than with a zip
 * library. That is deliberate: the bound reads the central directory itself,
 * so the test should hand it bytes we control exactly — and it avoids pulling
 * a new dependency into the API purely to write a test.
 *
 * The bomb shape mirrors the one a reviewer measured at 969 MiB peak RSS: a
 * near-empty worksheet whose auxiliary table declares an enormous expansion.
 */
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
 * Builds a structurally valid single-entry zip whose central directory
 * declares `declaredUncompressed` bytes while carrying a tiny stored payload.
 * This is exactly the asymmetry the bound exists to catch — the archive is
 * small on the wire and enormous once expanded.
 */
function zipDeclaringExpansion(
  name: string,
  declaredUncompressed: number,
): Buffer {
  const nameBytes = Buffer.from(name, "utf8");
  const payload = Buffer.from("a", "utf8");

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); // local file header signature
  local.writeUInt16LE(20, 4); // version needed
  local.writeUInt16LE(0, 6); // flags
  local.writeUInt16LE(0, 8); // method: stored
  local.writeUInt32LE(0, 14); // crc32 (not validated by the bound)
  local.writeUInt32LE(payload.length, 18); // compressed size
  local.writeUInt32LE(declaredUncompressed, 22); // uncompressed size
  local.writeUInt16LE(nameBytes.length, 26);
  local.writeUInt16LE(0, 28); // extra length

  const localRecord = Buffer.concat([local, nameBytes, payload]);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0); // central file header signature
  central.writeUInt16LE(20, 4); // version made by
  central.writeUInt16LE(20, 6); // version needed
  central.writeUInt16LE(0, 8); // flags
  central.writeUInt16LE(0, 10); // method: stored
  central.writeUInt32LE(0, 16); // crc32
  central.writeUInt32LE(payload.length, 20); // compressed size
  central.writeUInt32LE(declaredUncompressed, 24); // uncompressed size
  central.writeUInt16LE(nameBytes.length, 28);
  central.writeUInt16LE(0, 30); // extra length
  central.writeUInt16LE(0, 32); // comment length
  central.writeUInt32LE(0, 42); // local header offset

  const centralRecord = Buffer.concat([central, nameBytes]);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // EOCD signature
  eocd.writeUInt16LE(1, 8); // entries on this disk
  eocd.writeUInt16LE(1, 10); // entries total
  eocd.writeUInt32LE(centralRecord.length, 12); // central directory size
  eocd.writeUInt32LE(localRecord.length, 16); // central directory offset
  eocd.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([localRecord, centralRecord, eocd]);
}

describe("assertZipExpansionWithinBounds", () => {
  it("passes a real, ordinary workbook", async () => {
    const buffer = await realWorkbookBuffer();
    expect(() => assertZipExpansionWithinBounds(buffer)).not.toThrow();
  });

  it("stays silent on a buffer that is not a zip at all", () => {
    // Reporting "not a spreadsheet" belongs to the parser, which already does
    // it well; this function's only job is the size bound.
    const notAZip = Buffer.from("this is plainly not a spreadsheet", "utf8");
    expect(() => assertZipExpansionWithinBounds(notAZip)).not.toThrow();
  });

  it("allows an archive that sits just under the bound", () => {
    const ok = zipDeclaringExpansion(
      "xl/sharedStrings.xml",
      MAX_XLSX_UNCOMPRESSED_BYTES - 1,
    );
    expect(() => assertZipExpansionWithinBounds(ok)).not.toThrow();
  });

  it("refuses an archive declaring more expansion than the bound", () => {
    const bomb = zipDeclaringExpansion(
      "xl/sharedStrings.xml",
      MAX_XLSX_UNCOMPRESSED_BYTES + 1,
    );
    expect(() => assertZipExpansionWithinBounds(bomb)).toThrow(
      ZipExpansionExceededError,
    );
  });

  it("refuses a shared-string bomb — the vector that escaped every in-parser cap", async () => {
    // 8M distinct strings against a three-cell worksheet was measured at
    // 969 MiB peak RSS. Row and cell caps cannot see it: they count data
    // actually iterated, while this table loads in full beforehand.
    const bomb = zipDeclaringExpansion(
      "xl/sharedStrings.xml",
      800 * 1024 * 1024,
    );
    await expect(parseExcelBuffer(bomb)).rejects.toThrow(
      ZipExpansionExceededError,
    );
  });

  it("refuses a styles bomb by the same bound, without needing to know about styles", async () => {
    // The point of bounding the archive rather than each cache: this vector
    // is closed by the same check, and so is the next one nobody has found.
    const bomb = zipDeclaringExpansion("xl/styles.xml", 700 * 1024 * 1024);
    await expect(parseExcelBuffer(bomb)).rejects.toThrow(
      ZipExpansionExceededError,
    );
  });

  it("fires before exceljs is handed the buffer", async () => {
    // If the bound ran inside the parse, the memory would already be
    // committed by the time it tripped. The archive below is not a valid
    // workbook at all, so reaching exceljs would raise an unreadable-file
    // error instead — getting the expansion error proves the ordering.
    const bomb = zipDeclaringExpansion(
      "xl/sharedStrings.xml",
      900 * 1024 * 1024,
    );
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
