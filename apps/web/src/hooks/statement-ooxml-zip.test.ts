/**
 * EPIC-029 group A — the REAL container rewrite, against a synthetic archive
 * built to the exact shape that broke the server parser.
 *
 * `statement-file.test.ts` injects the normaliser at its seam, which proves
 * the pipeline and the failure taxonomy but proves nothing about the zip
 * work. This file closes that gap: it writes a streaming-mode archive byte by
 * byte — general-purpose bit 3, zeroed sizes in the local headers, ZIP64-form
 * data descriptors — hands it to the production `normalizeOoxmlPackage`, and
 * checks the result is the SAME parts in the SAME order in a container a
 * forward-streaming reader can walk.
 *
 * Nothing here comes from the user's real statement. The matching proof on
 * the server side — that `parseExcelBuffer` refuses this framing and accepts
 * the rewritten one — lives in
 * `apps/api/src/reconciliation/reconciliation-parsers.bank-export.spec.ts`.
 * The real bank file itself is verified by hand; see the epic's Automation
 * Log.
 */

import { deflateRawSync, crc32 } from "node:zlib";
import {
  ReadableStream as NodeReadableStream,
  WritableStream as NodeWritableStream,
  TransformStream as NodeTransformStream,
} from "node:stream/web";
import {
  TextDecoder as NodeTextDecoder,
  TextEncoder as NodeTextEncoder,
} from "node:util";

const globals = globalThis as unknown as Record<string, unknown>;
// jsdom implements none of the WHATWG stream/compression globals that `zip.js`
// (and this module's counting sink) are built on. Every browser the app
// supports has them, so they are supplied here rather than worked around in
// the source — the same posture `statement-ooxml-crypto.test.ts` takes with
// `crypto.subtle`.
for (const [name, value] of [
  ["ReadableStream", NodeReadableStream],
  ["WritableStream", NodeWritableStream],
  ["TransformStream", NodeTransformStream],
  ["TextDecoder", NodeTextDecoder],
  ["TextEncoder", NodeTextEncoder],
] as const) {
  if (typeof globals[name] === "undefined") globals[name] = value;
}

import {
  OoxmlZipError,
  normalizeOoxmlPackage,
  repackageOoxmlZip,
  readWithZipJs,
  writeWithZipJs,
  type OoxmlPackagePart,
} from "./statement-ooxml-zip";
import { classifyStatementBytes } from "./statement-file";

/* ─────────────── a zip writer that streams, deliberately ─────────────── */

const FLAG_DATA_DESCRIPTOR = 0x0008;

type Part = { name: string; content: string };

/**
 * Writes a real archive. In streaming mode it reproduces the bank
 * generator's framing: bit 3 set, CRC and both sizes zeroed in the local file
 * header, and a 24-byte ZIP64-form data descriptor (8-byte sizes) after the
 * payload, with version 45 and no zip64 extra field.
 */
function buildZip(parts: Part[], streaming: boolean): Uint8Array {
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const part of parts) {
    const data = Buffer.from(part.content, "utf8");
    const compressed = deflateRawSync(data);
    const crc = crc32(data) >>> 0;
    const name = Buffer.from(part.name, "utf8");

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(streaming ? 45 : 20, 4);
    local.writeUInt16LE(streaming ? FLAG_DATA_DESCRIPTOR : 0, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(streaming ? 0 : crc, 14);
    local.writeUInt32LE(streaming ? 0 : compressed.length, 18);
    local.writeUInt32LE(streaming ? 0 : data.length, 22);
    local.writeUInt16LE(name.length, 26);

    const localOffset = offset;
    chunks.push(local, name, compressed);
    offset += 30 + name.length + compressed.length;

    if (streaming) {
      const descriptor = Buffer.alloc(24);
      descriptor.writeUInt32LE(0x08074b50, 0);
      descriptor.writeUInt32LE(crc, 4);
      descriptor.writeBigUInt64LE(BigInt(compressed.length), 8);
      descriptor.writeBigUInt64LE(BigInt(data.length), 16);
      chunks.push(descriptor);
      offset += descriptor.length;
    }

    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(streaming ? 45 : 20, 4);
    header.writeUInt16LE(streaming ? 45 : 20, 6);
    header.writeUInt16LE(streaming ? FLAG_DATA_DESCRIPTOR : 0, 8);
    header.writeUInt16LE(8, 10);
    header.writeUInt32LE(crc, 16);
    header.writeUInt32LE(compressed.length, 20);
    header.writeUInt32LE(data.length, 24);
    header.writeUInt16LE(name.length, 28);
    header.writeUInt32LE(localOffset, 42);
    central.push(header, name);
  }

  const directory = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(parts.length, 8);
  eocd.writeUInt16LE(parts.length, 10);
  eocd.writeUInt32LE(directory.length, 12);
  eocd.writeUInt32LE(offset, 16);

  return new Uint8Array(Buffer.concat([...chunks, directory, eocd]));
}

/** Walks the local file headers of a finished archive, the way the server's
 * forward-streaming reader does, and reports what each one declares. */
function readLocalHeaders(
  bytes: Uint8Array,
): Array<{
  name: string;
  flags: number;
  compressed: number;
  uncompressed: number;
}> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = [];
  let offset = 0;
  while (
    offset + 30 <= bytes.length &&
    view.getUint32(offset, true) === 0x04034b50
  ) {
    const flags = view.getUint16(offset + 6, true);
    const compressed = view.getUint32(offset + 18, true);
    const uncompressed = view.getUint32(offset + 22, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const name = Buffer.from(
      bytes.subarray(offset + 30, offset + 30 + nameLength),
    ).toString("utf8");
    out.push({ name, flags, compressed, uncompressed });
    offset += 30 + nameLength + extraLength + compressed;
  }
  return out;
}

const PARTS: Part[] = [
  {
    name: "[Content_Types].xml",
    content: `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>`,
  },
  { name: "_rels/.rels", content: "<Relationships/>" },
  { name: "xl/workbook.xml", content: "<workbook/>" },
  { name: "xl/worksheets/sheet1.xml", content: "<worksheet>rows</worksheet>" },
];

describe("classifyStatementBytes — streaming workbooks", () => {
  it("tells a streaming workbook apart from a conventional one", () => {
    expect(classifyStatementBytes(buildZip(PARTS, true))).toBe("xlsx-streamed");
    expect(classifyStatementBytes(buildZip(PARTS, false))).toBe("plain");
  });
});

describe("normalizeOoxmlPackage — the real zip.js path", () => {
  it("rewrites the container so every local header carries its real sizes", async () => {
    const streamed = buildZip(PARTS, true);

    const before = readLocalHeaders(streamed);
    // The failure being fixed, asserted rather than assumed: the source's
    // very first header announces a data descriptor and declares nothing.
    expect(before[0]?.flags & FLAG_DATA_DESCRIPTOR).toBe(FLAG_DATA_DESCRIPTOR);
    expect(before[0]?.uncompressed).toBe(0);

    const normalized = await normalizeOoxmlPackage(streamed);
    const after = readLocalHeaders(normalized);

    expect(after).toHaveLength(PARTS.length);
    for (const header of after) {
      expect(header.flags & FLAG_DATA_DESCRIPTOR).toBe(0);
      expect(header.uncompressed).toBeGreaterThan(0);
      expect(header.compressed).toBeGreaterThan(0);
    }
  });

  it("preserves entry names, order and content byte for byte", async () => {
    const normalized = await normalizeOoxmlPackage(buildZip(PARTS, true));

    // `[Content_Types].xml` first — an `.xlsx` is order-sensitive in practice.
    expect(readLocalHeaders(normalized).map((h) => h.name)).toEqual(
      PARTS.map((p) => p.name),
    );

    const roundTripped: OoxmlPackagePart[] = [];
    await repackageOoxmlZip(normalized, {
      read: readWithZipJs,
      write: async (parts) => {
        roundTripped.push(...parts);
        return new Uint8Array();
      },
    }).catch(() => undefined);

    expect(roundTripped.map((p) => p.filename)).toEqual(
      PARTS.map((p) => p.name),
    );
    expect(
      roundTripped.map((p) => Buffer.from(p.bytes).toString("utf8")),
    ).toEqual(PARTS.map((p) => p.content));
  });

  it("produces an archive whose rewrite is idempotent", async () => {
    const once = await normalizeOoxmlPackage(buildZip(PARTS, true));
    // Already conventional: the pipeline above it would not call this again,
    // but doing so must not corrupt anything.
    const twice = await normalizeOoxmlPackage(once);
    expect(readLocalHeaders(twice).map((h) => h.name)).toEqual(
      PARTS.map((p) => p.name),
    );
  });

  it("refuses an archive whose parts expand past the byte budget", async () => {
    const big: Part[] = [
      { name: "[Content_Types].xml", content: "<Types/>" },
      { name: "xl/worksheets/sheet1.xml", content: "A".repeat(200_000) },
    ];
    await expect(
      repackageOoxmlZip(buildZip(big, true), {
        read: readWithZipJs,
        write: writeWithZipJs,
        maxTotalBytes: 1024,
      }),
    ).rejects.toMatchObject({ reason: "package-too-large" });
  });

  it("counts the REAL bytes, not the declared ones", async () => {
    // The declared sizes on this shape are all zero — a bound that trusted
    // them would wave a 200 KB expansion straight through.
    const bomb: Part[] = [
      { name: "[Content_Types].xml", content: "<Types/>" },
      { name: "xl/worksheets/sheet1.xml", content: "A".repeat(200_000) },
    ];
    const bytes = buildZip(bomb, true);
    expect(readLocalHeaders(bytes).every((h) => h.uncompressed === 0)).toBe(
      true,
    );
    await expect(
      repackageOoxmlZip(bytes, {
        read: readWithZipJs,
        write: writeWithZipJs,
        maxTotalBytes: 100_000,
      }),
    ).rejects.toBeInstanceOf(OoxmlZipError);
  });

  it("refuses an archive with more parts than the entry cap allows", async () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      name: `xl/worksheets/sheet${i}.xml`,
      content: "<worksheet/>",
    }));
    await expect(
      repackageOoxmlZip(buildZip(many, true), {
        read: readWithZipJs,
        write: writeWithZipJs,
        maxEntries: 4,
      }),
    ).rejects.toMatchObject({ reason: "package-too-large" });
  });

  it("reports an unreadable archive as its own reason, not as a crash", async () => {
    const rubbish = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4]);
    await expect(
      repackageOoxmlZip(rubbish, {
        read: readWithZipJs,
        write: writeWithZipJs,
      }),
    ).rejects.toMatchObject({ reason: "repackage-failed" });
  });
});
