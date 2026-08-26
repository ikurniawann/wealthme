/**
 * EPIC-029 — the two properties of a REAL Indonesian bank e-statement that
 * every unit test in `reconciliation-parsers.spec.ts` missed, because that
 * suite builds its own tidy fixtures.
 *
 * A genuine Mandiri e-statement was traced end to end against the running
 * code and failed twice:
 *
 *   A. Its `.xlsx` is written in STREAMING mode — every entry sets
 *      general-purpose bit 3 (data descriptor) and carries `csize = 0` /
 *      `usize = 0` in its local file header, with the real values in a
 *      trailing descriptor. `unzipper` (which `exceljs`'s streaming
 *      `WorkbookReader` sits on) walks forward from the local headers and
 *      dies on it. Python's `zipfile` reads the identical bytes because it
 *      goes through the central directory instead — which is why the file
 *      looks perfectly fine in every other tool.
 *
 *   B. Its header is not row 1. The account block occupies the first nine
 *      rows; the column labels sit on rows 10 (Indonesian) and 11 (English),
 *      separated by empty merged-cell placeholders, and there is no signed
 *      amount column at all — money in and money out are two columns.
 *
 * NOTHING here is derived from the user's real statement: the archive is
 * built byte by byte below, and the table reproduces the SHAPE of the real
 * one with invented values. The real file itself is verified by hand (see the
 * epic's Automation Log) and is never committed.
 */

import { deflateRawSync, crc32 } from "node:zlib";

import {
  detectTableMapping,
  mapTableToRows,
  parseExcelBuffer,
} from "./reconciliation-parsers";

/* ───────────────── a zip writer that can stream, on purpose ───────────── */

const LOCAL_HEADER_SIGNATURE = 0x04034b50;
const DATA_DESCRIPTOR_SIGNATURE = 0x08074b50;
const CENTRAL_HEADER_SIGNATURE = 0x02014b50;
const EOCD_SIGNATURE = 0x06054b50;
const FLAG_DATA_DESCRIPTOR = 0x0008;
const METHOD_DEFLATE = 8;

type ZipEntry = { name: string; content: string };

/**
 * Writes a real zip. In `"streaming"` mode it reproduces what the bank's
 * generator emits, byte for byte in shape:
 *
 *   - general-purpose bit 3 set, with CRC and both sizes zeroed in the local
 *     file header;
 *   - a ZIP64-form data descriptor after the payload — signature, CRC, then
 *     the two sizes as **8-byte** fields (24 bytes total), with version 45
 *     in the headers and NO zip64 extra field on the local header.
 *
 * That last detail is the whole failure. `unzipper` (0.10.14) copes fine with
 * a plain 16-byte descriptor; it reads the ZIP64 one as 4-byte fields,
 * lands 8 bytes short, and reports the high half of the uncompressed size as
 * a bogus signature — the exact `invalid signature: 0x594` the real file
 * produces, 0x594 being its `[Content_Types].xml` uncompressed length.
 *
 * The central directory carries the true values either way, so the archive is
 * valid and every central-directory reader (zip.js, Python's `zipfile`, Excel)
 * opens it — which is why the file looks perfectly healthy everywhere else.
 */
function buildZip(entries: ZipEntry[], mode: "normal" | "streaming"): Buffer {
  const streaming = mode === "streaming";
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const data = Buffer.from(entry.content, "utf8");
    const compressed = deflateRawSync(data);
    const crc = crc32(data) >>> 0;
    const name = Buffer.from(entry.name, "utf8");

    const local = Buffer.alloc(30);
    local.writeUInt32LE(LOCAL_HEADER_SIGNATURE, 0);
    local.writeUInt16LE(streaming ? 45 : 20, 4);
    local.writeUInt16LE(streaming ? FLAG_DATA_DESCRIPTOR : 0, 6);
    local.writeUInt16LE(METHOD_DEFLATE, 8);
    local.writeUInt32LE(streaming ? 0 : crc, 14);
    local.writeUInt32LE(streaming ? 0 : compressed.length, 18);
    local.writeUInt32LE(streaming ? 0 : data.length, 22);
    local.writeUInt16LE(name.length, 26);

    const localOffset = offset;
    parts.push(local, name, compressed);
    offset += 30 + name.length + compressed.length;

    if (streaming) {
      // 24 bytes: signature, CRC-32, then 8-byte compressed and uncompressed
      // sizes — the ZIP64 form the bank's generator writes.
      const descriptor = Buffer.alloc(24);
      descriptor.writeUInt32LE(DATA_DESCRIPTOR_SIGNATURE, 0);
      descriptor.writeUInt32LE(crc, 4);
      descriptor.writeBigUInt64LE(BigInt(compressed.length), 8);
      descriptor.writeBigUInt64LE(BigInt(data.length), 16);
      parts.push(descriptor);
      offset += descriptor.length;
    }

    const entryHeader = Buffer.alloc(46);
    entryHeader.writeUInt32LE(CENTRAL_HEADER_SIGNATURE, 0);
    entryHeader.writeUInt16LE(streaming ? 45 : 20, 4);
    entryHeader.writeUInt16LE(streaming ? 45 : 20, 6);
    entryHeader.writeUInt16LE(streaming ? FLAG_DATA_DESCRIPTOR : 0, 8);
    entryHeader.writeUInt16LE(METHOD_DEFLATE, 10);
    entryHeader.writeUInt32LE(crc, 16);
    entryHeader.writeUInt32LE(compressed.length, 20);
    entryHeader.writeUInt32LE(data.length, 24);
    entryHeader.writeUInt16LE(name.length, 28);
    entryHeader.writeUInt32LE(localOffset, 42);
    central.push(entryHeader, name);
  }

  const directory = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(EOCD_SIGNATURE, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(directory.length, 12);
  eocd.writeUInt32LE(offset, 16);

  return Buffer.concat([...parts, directory, eocd]);
}

/* ─────────────── a minimal, inline-string OOXML workbook ─────────────── */

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function columnRef(index: number): string {
  let ref = "";
  let n = index;
  do {
    ref = String.fromCharCode(65 + (n % 26)) + ref;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return ref;
}

/** Every value is an `inlineStr`, exactly as the bank's generator writes them
 * — its `sharedStrings.xml` is empty. */
function sheetXml(rows: string[][]): string {
  const body = rows
    .map((cells, rowIndex) => {
      const inner = cells
        .map((value, colIndex) =>
          value === ""
            ? ""
            : `<c r="${columnRef(colIndex)}${rowIndex + 1}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`,
        )
        .join("");
      return `<row r="${rowIndex + 1}">${inner}</row>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
}

function workbookEntries(rows: string[][]): ZipEntry[] {
  return [
    {
      // First on purpose — an OOXML package is order-sensitive in practice.
      name: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
    },
    {
      name: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      name: "xl/workbook.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    },
    { name: "xl/worksheets/sheet1.xml", content: sheetXml(rows) },
  ];
}

/* ─────────────────────── the real statement's shape ──────────────────── */

const IDN_HEADER = [
  "Tanggal",
  "",
  "Keterangan",
  "",
  "Dana Masuk (IDR)",
  "Dana Keluar (IDR)",
  "Saldo (IDR)",
];
const ENG_HEADER = [
  "Date",
  "",
  "Remarks",
  "",
  "Incoming Transactions (IDR)",
  "Outgoing Transactions (IDR)",
  "Balance (IDR)",
];

/** Nine rows of account block, then the bilingual double header, then data —
 * the layout of the real export, with invented values. */
function mandiriShapedTable(): string[][] {
  return [
    ["Rekening Koran", "", "", "", "", "", ""],
    ["Nama", "", "Nasabah Contoh", "", "", "", ""],
    ["Nomor Rekening", "", "000-00-0000000-0", "", "", "", ""],
    ["Mata Uang", "", "IDR", "", "", "", ""],
    ["Periode Tanggal", "", "01 Aug 2026 - 23 Aug 2026", "", "", "", ""],
    ["Alamat", "", "Jl. Contoh No. 1", "", "", "", ""],
    ["", "", "", "", "", "", ""],
    ["Dicetak pada", "", "24 Aug 2026", "", "", "", ""],
    ["", "", "", "", "", "", ""],
    IDN_HEADER,
    ENG_HEADER,
    ["13/08/2026", "", "TRSF E-BANKING CR", "", "1.500.000,00", "0.00", "..."],
    ["14/08/2026", "", "BIAYA ADM", "", "0.00", "15.000,00", "..."],
    ["15/08/2026", "", "PEMBAYARAN QRIS", "", "", "250.500,00", "..."],
  ];
}

describe("parseExcelBuffer — streaming (data-descriptor) archives", () => {
  const table = [
    ["Tanggal", "Keterangan", "Jumlah"],
    ["13/08/2026", "Transfer masuk", "150.000"],
  ];

  it("reads a conventionally-written workbook", async () => {
    const buffer = buildZip(workbookEntries(table), "normal");
    await expect(parseExcelBuffer(buffer)).resolves.toEqual(table);
  });

  it("REFUSES the same entries written with data descriptors", async () => {
    // The regression this whole task exists for: identical parts, identical
    // order, identical bytes per entry — only the container framing differs,
    // and the server parser cannot read it. This is what the browser-side
    // normalisation in `apps/web/src/hooks/statement-ooxml-zip.ts` removes.
    const buffer = buildZip(workbookEntries(table), "streaming");
    await expect(parseExcelBuffer(buffer)).rejects.toThrow();
  });
});

describe("detectTableMapping — real e-statement layout", () => {
  it("finds a header that is not the first row, with gapped labels", () => {
    const detected = detectTableMapping(mandiriShapedTable());
    expect(detected).not.toBeNull();
    expect(detected?.headerIndex).toBe(9);
    // Row 10 is the bilingual twin, so the DATA starts at row 11 (0-based).
    expect(detected?.dataStartIndex).toBe(11);
    expect(detected?.mapping).toEqual({
      dateColumn: "Tanggal",
      descriptionColumn: "Keterangan",
      amountColumn: "",
      dateFormat: null,
      creditColumn: "Dana Masuk (IDR)",
      debitColumn: "Dana Keluar (IDR)",
    });
  });

  it("picks the topmost of the two bilingual header rows, deterministically", () => {
    const flipped = mandiriShapedTable();
    flipped[9] = ENG_HEADER;
    flipped[10] = IDN_HEADER;
    const detected = detectTableMapping(flipped);
    expect(detected?.headerIndex).toBe(9);
    expect(detected?.mapping.dateColumn).toBe("Date");
    expect(detected?.dataStartIndex).toBe(11);
  });

  it("maps money-in and money-out to signed amounts", () => {
    const table = mandiriShapedTable();
    const detected = detectTableMapping(table);
    const { rows, skipped } = mapTableToRows(table, detected!.mapping, {
      headerIndex: detected!.headerIndex,
      dataStartIndex: detected!.dataStartIndex,
    });
    expect(skipped).toEqual([]);
    expect(rows.map((r) => r.amount)).toEqual([
      1_500_000n,
      -15_000n,
      -250_500n,
    ]);
    expect(rows[0]?.description).toBe("TRSF E-BANKING CR");
    expect(rows).toHaveLength(3);
  });

  it("survives the whole workbook path once the container is conventional", async () => {
    const buffer = buildZip(workbookEntries(mandiriShapedTable()), "normal");
    const parsed = await parseExcelBuffer(buffer);
    const detected = detectTableMapping(parsed);
    // 7, not 9: `parseExcelBuffer` drops all-empty rows, so the header moves
    // up by the two blank rows in the account block. Detection is driven by
    // the parsed table, never by the spreadsheet's own row numbers — which is
    // precisely why the header row has to be searched for rather than assumed.
    expect(detected?.headerIndex).toBe(7);
    const { rows } = mapTableToRows(parsed, detected!.mapping, {
      headerIndex: detected!.headerIndex,
      dataStartIndex: detected!.dataStartIndex,
    });
    expect(rows).toHaveLength(3);
  });

  it("reports a skipped row against its real line number", () => {
    const table = mandiriShapedTable();
    table.push(["", "", "BARIS TANPA TANGGAL", "", "", "1.000,00", "..."]);
    const detected = detectTableMapping(table);
    const { skipped } = mapTableToRows(table, detected!.mapping, {
      headerIndex: detected!.headerIndex,
      dataStartIndex: detected!.dataStartIndex,
    });
    // 0-based index 14 in the parsed table ⇒ reported line 15.
    expect(skipped).toEqual([{ line: 15, reason: "Missing date" }]);
  });

  it("refuses a row with both money-in and money-out filled", () => {
    const table = mandiriShapedTable();
    table[12] = ["14/08/2026", "", "AMBIGU", "", "10.000,00", "15.000,00", ""];
    const detected = detectTableMapping(table);
    const { rows, skipped } = mapTableToRows(table, detected!.mapping, {
      headerIndex: detected!.headerIndex,
      dataStartIndex: detected!.dataStartIndex,
    });
    expect(rows).toHaveLength(2);
    expect(skipped[0]?.reason).toMatch(/cannot tell which one/i);
  });
});

describe("detectTableMapping — refusing rather than guessing", () => {
  it("returns null when two candidate rows disagree about the columns", () => {
    const table = [
      ["Tanggal", "Keterangan", "Jumlah"],
      ["Jumlah", "Tanggal", "Keterangan"],
      ["13/08/2026", "Kopi", "25.000"],
    ];
    // Both rows score identically but resolve to different columns — a
    // genuine ambiguity, not a bilingual twin.
    expect(detectTableMapping(table)).toBeNull();
  });

  it("returns null when a required column is missing", () => {
    expect(detectTableMapping([["Tanggal", "Keterangan", "Saldo"]])).toBeNull();
  });

  it("returns null when only one half of the money-in/out pair is present", () => {
    expect(
      detectTableMapping([["Tanggal", "Keterangan", "Dana Masuk (IDR)"]]),
    ).toBeNull();
  });

  it("returns null when two columns claim the same role", () => {
    expect(
      detectTableMapping([["Tanggal", "Date", "Keterangan", "Jumlah"]]),
    ).toBeNull();
  });

  it("does not scan past the bounded preamble", () => {
    const filler = Array.from({ length: 40 }, () => ["x", "y", "z"]);
    const table = [...filler, ["Tanggal", "Keterangan", "Jumlah"]];
    expect(detectTableMapping(table)).toBeNull();
  });

  it("still prefers a single signed amount column when one exists", () => {
    const detected = detectTableMapping([
      ["Tanggal", "Keterangan", "Jumlah", "Dana Masuk", "Dana Keluar"],
      ["13/08/2026", "Kopi", "-25.000", "", ""],
    ]);
    expect(detected?.mapping.amountColumn).toBe("Jumlah");
    expect(detected?.mapping.creditColumn).toBeUndefined();
  });
});
