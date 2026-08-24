/**
 * EPIC-029 group 4 — the client-side unlock pipeline.
 *
 * Two things are being protected here, and they need different kinds of test:
 *
 *  1. **The taxonomy.** A locked file, a wrong password, a legacy encryption
 *     scheme, an empty ZIP, a ZIP with two statements and a zip bomb are six
 *     different problems with six different fixes. Collapsing any of them
 *     into "file rusak" is the failure this group exists to prevent, so every
 *     reason is asserted to produce its own message.
 *
 *  2. **E4d — the password never leaves the tab.** That is asserted
 *     adversarially: `fetch`, `XMLHttpRequest`, `sendBeacon`, `console.*`,
 *     `localStorage`/`sessionStorage` are all instrumented, and every thrown
 *     error is serialised (message + stack + own properties) and searched for
 *     the password. A future change that passed the password to the server,
 *     logged it, or interpolated it into an error message fails this test.
 *
 * The decryptors are injected at their seams, exactly as
 * `receipt-file.test.ts` injects a decoder — jsdom has no `crypto.subtle`
 * and no `DecompressionStream`. The REAL agile-encryption implementation is
 * exercised end to end against a genuine generated fixture in
 * `statement-ooxml-crypto.test.ts`; nothing here implies coverage of it.
 */

import { WritableStream as NodeWritableStream } from "node:stream/web";
import { TextDecoder as NodeTextDecoder } from "node:util";

// jsdom implements none of `WritableStream`, `TextDecoder`, or
// `Blob.arrayBuffer()`/`.text()`, all of which every supported browser has had
// for years. Polyfilled HERE rather than worked around in the source: the
// production code should use the platform API, and a test-environment gap is
// not a reason to change it.
const globals = globalThis as unknown as Record<string, unknown>;
if (typeof globalThis.WritableStream === "undefined") {
  globals.WritableStream = NodeWritableStream;
}
if (typeof globalThis.TextDecoder === "undefined") {
  globals.TextDecoder = NodeTextDecoder;
}

import { id as dictionary } from "../i18n/id";
import { en as enDictionary } from "../i18n/en";
import {
  STATEMENT_MAX_FILE_BYTES,
  StatementFileError,
  classifyStatementBytes,
  inspectStatementFile,
  needsPassword,
  prepareStatementFile,
  readBlobBytes,
  statementFileErrorMessage,
  type StatementFileFailure,
} from "./statement-file";
import {
  StatementZipError,
  boundedCollector,
  extractStatementFromZip,
  selectStatementEntries,
  type ZipArchiveOpener,
  type ZipEntryHandle,
} from "./statement-zip";

/* ───────────────────────── fixtures ───────────────────────── */

const CFB_HEADER = new Uint8Array([
  0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
]);

function ascii(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i);
  return out;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** A ZIP local file header for `name`, with the encryption (bit 0) and
 * data-descriptor (bit 3) general-purpose flags optionally set. */
function zipLocalHeader(
  name: string,
  encrypted: boolean,
  dataDescriptor = false,
): Uint8Array {
  const header = new Uint8Array(30 + name.length);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(
    6,
    (encrypted ? 0x0001 : 0) | (dataDescriptor ? 0x0008 : 0),
    true,
  );
  view.setUint16(26, name.length, true);
  header.set(ascii(name), 30);
  return header;
}

/** The head of a workbook written in streaming mode — the shape a real
 * Mandiri e-statement has, which the server's parser cannot read. */
function streamedWorkbook(): Uint8Array {
  return concat(
    zipLocalHeader("[Content_Types].xml", false, true),
    ascii("<Types/>"),
  );
}

function fileFrom(bytes: Uint8Array, name: string): File {
  // Copied through the `Uint8Array` constructor so the view is known to be
  // backed by an `ArrayBuffer` (not a `SharedArrayBuffer`), which is what
  // `BlobPart` requires.
  return new File([new Uint8Array(bytes)], name);
}

/** `Blob.text()` equivalent that works in jsdom. */
async function textOf(file: File): Promise<string> {
  return new TextDecoder().decode(await readBlobBytes(file));
}

function zipEntry(over: Partial<ZipEntryHandle> = {}): ZipEntryHandle {
  return {
    filename: "mutasi.csv",
    directory: false,
    encrypted: false,
    declaredUncompressedSize: 128,
    extractTo: async (sink) => {
      const writer = sink.getWriter();
      await writer.write(ascii("tanggal,keterangan,jumlah\n"));
      await writer.close();
    },
    ...over,
  };
}

function openerFor(entries: ZipEntryHandle[]): ZipArchiveOpener {
  return async () => ({ entries, close: async () => undefined });
}

/* ───────────────────────── detection ───────────────────────── */

describe("classifyStatementBytes", () => {
  it("reads an encrypted workbook from the CFB magic, not the extension", () => {
    expect(classifyStatementBytes(concat(CFB_HEADER, new Uint8Array(64)))).toBe(
      "encrypted-xlsx",
    );
  });

  it("treats a plain CSV as needing no unlocking at all", () => {
    expect(
      classifyStatementBytes(ascii("tanggal,jumlah\n2026-01-01,1000")),
    ).toBe("plain");
  });

  it("recognises an unencrypted .xlsx as a plain OOXML package, not a container", () => {
    const head = concat(
      zipLocalHeader("[Content_Types].xml", false),
      ascii("<Types/>"),
    );
    expect(classifyStatementBytes(head)).toBe("plain");
  });

  it("recognises a ZIP that merely CONTAINS a statement as a container", () => {
    const head = concat(zipLocalHeader("mutasi.csv", false), ascii("a,b,c"));
    expect(classifyStatementBytes(head)).toBe("zip");
  });

  it("reads the encryption flag before the entry name, so a crafted name cannot pose as a plain workbook", () => {
    const head = concat(
      zipLocalHeader("[Content_Types].xml", true),
      ascii("<Types/>"),
    );
    expect(classifyStatementBytes(head)).toBe("encrypted-zip");
  });

  it("recognises a streaming-written workbook as needing its container rewritten", () => {
    expect(classifyStatementBytes(streamedWorkbook())).toBe("xlsx-streamed");
  });

  it("only asks for a password for the encrypted kinds", () => {
    expect(needsPassword("xlsx-streamed")).toBe(false);
    expect(needsPassword("plain")).toBe(false);
    expect(needsPassword("zip")).toBe(false);
    expect(needsPassword("encrypted-xlsx")).toBe(true);
    expect(needsPassword("encrypted-zip")).toBe(true);
  });
});

describe("inspectStatementFile", () => {
  it("refuses a zero-byte pick with its own reason", async () => {
    await expect(
      inspectStatementFile(fileFrom(new Uint8Array(0), "a.csv")),
    ).rejects.toMatchObject({ reason: "empty-file" });
  });

  it("refuses an over-ceiling file without reading it", async () => {
    const file = fileFrom(ascii("x"), "big.csv");
    Object.defineProperty(file, "size", {
      value: STATEMENT_MAX_FILE_BYTES + 1,
    });
    const slice = jest.spyOn(file, "slice");
    await expect(inspectStatementFile(file)).rejects.toMatchObject({
      reason: "file-too-large",
    });
    expect(slice).not.toHaveBeenCalled();
  });
});

/* ───────────────────────── pass-through ───────────────────────── */

describe("prepareStatementFile — unencrypted files", () => {
  it("passes a plain CSV straight through, untouched and unprompted", async () => {
    const file = fileFrom(ascii("tanggal,jumlah\n"), "mutasi.csv");
    const decryptOoxml = jest.fn();
    const openZip = jest.fn();
    const prepared = await prepareStatementFile(file, undefined, {
      decryptOoxml,
      openZip,
    });
    expect(prepared).toBe(file);
    expect(decryptOoxml).not.toHaveBeenCalled();
    expect(openZip).not.toHaveBeenCalled();
  });

  it("passes an unencrypted .xlsx straight through", async () => {
    const file = fileFrom(
      concat(zipLocalHeader("[Content_Types].xml", false), ascii("<Types/>")),
      "mutasi.xlsx",
    );
    await expect(
      prepareStatementFile(file, undefined, { decryptOoxml: jest.fn() }),
    ).resolves.toBe(file);
  });
});

/* ───────────────────────── encrypted XLSX ───────────────────────── */

describe("prepareStatementFile — encrypted XLSX", () => {
  const encrypted = () =>
    fileFrom(concat(CFB_HEADER, new Uint8Array(64)), "e.xlsx");

  it("uploads the DECRYPTED bytes, not the encrypted container", async () => {
    const plaintext = concat(
      zipLocalHeader("[Content_Types].xml", false),
      ascii("<Types/>plaintext-workbook"),
    );
    const prepared = await prepareStatementFile(encrypted(), "rahasia", {
      decryptOoxml: async () => plaintext,
    });
    const got = await readBlobBytes(prepared);
    expect(Array.from(got)).toEqual(Array.from(plaintext));
    expect(prepared.name).toBe("e.xlsx");
  });

  it("refuses before decrypting when no password has been given yet", async () => {
    const decryptOoxml = jest.fn();
    await expect(
      prepareStatementFile(encrypted(), undefined, { decryptOoxml }),
    ).rejects.toMatchObject({ reason: "password-required" });
    expect(decryptOoxml).not.toHaveBeenCalled();
  });

  it("says the password is WRONG — never that the file is corrupt", async () => {
    const err = await prepareStatementFile(encrypted(), "salah", {
      decryptOoxml: async () => {
        throw Object.assign(new Error("ooxml decrypt failed"), {
          reason: "wrong-password",
        });
      },
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(StatementFileError);
    expect((err as StatementFileError).reason).toBe("wrong-password");
    expect(statementFileErrorMessage(err, dictionary)).toBe(
      dictionary.rekonsiliasi.protectedErrorWrongPassword,
    );
    expect(statementFileErrorMessage(err, dictionary)).not.toBe(
      dictionary.rekonsiliasi.protectedErrorCorruptFile,
    );
  });

  it("keeps a legacy encryption scheme distinct from a wrong password", async () => {
    await expect(
      prepareStatementFile(encrypted(), "apa pun", {
        decryptOoxml: async () => {
          throw Object.assign(new Error("nope"), {
            reason: "unsupported-encryption",
          });
        },
      }),
    ).rejects.toMatchObject({ reason: "unsupported-encryption" });
  });

  it("refuses a decrypted workbook that blows past the API's own ceiling", async () => {
    await expect(
      prepareStatementFile(encrypted(), "rahasia", {
        maxFileBytes: 16,
        decryptOoxml: async () => new Uint8Array(64),
      }),
    ).rejects.toMatchObject({ reason: "decrypted-too-large" });
  });

  it("never lets a library's own error text through as the reason", async () => {
    // Muted only to keep the run quiet: an unmapped error legitimately warns
    // (see "logs only the error CLASS" below). The assertion is unchanged.
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await expect(
        prepareStatementFile(encrypted(), "rahasia", {
          decryptOoxml: async () => {
            throw new Error("RangeError at offset 0x1f in EncryptionInfo");
          },
        }),
      ).rejects.toMatchObject({ reason: "corrupt-file" });
    } finally {
      warn.mockRestore();
    }
  });
});

/* ───────────────────────── ZIP ───────────────────────── */

describe("selectStatementEntries", () => {
  it("keeps only parseable statement files", () => {
    const picked = selectStatementEntries([
      zipEntry({ filename: "mutasi.csv" }),
      zipEntry({ filename: "readme.txt" }),
      zipEntry({ filename: "folder/", directory: true }),
    ]);
    expect(picked.map((e) => e.filename)).toEqual(["mutasi.csv"]);
  });

  it("drops macOS resource forks so a legitimate archive is not called ambiguous", () => {
    const picked = selectStatementEntries([
      zipEntry({ filename: "mutasi.csv" }),
      zipEntry({ filename: "__MACOSX/._mutasi.csv" }),
      zipEntry({ filename: ".hidden.csv" }),
    ]);
    expect(picked.map((e) => e.filename)).toEqual(["mutasi.csv"]);
  });
});

describe("extractStatementFromZip", () => {
  it("returns the single inner statement", async () => {
    const result = await extractStatementFromZip(
      fileFrom(ascii("PK"), "a.zip"),
      "rahasia",
      { open: openerFor([zipEntry(), zipEntry({ filename: "notes.txt" })]) },
    );
    expect(result.filename).toBe("mutasi.csv");
    expect(new TextDecoder().decode(result.bytes)).toContain("tanggal");
  });

  it("REFUSES two statements rather than silently picking the first", async () => {
    await expect(
      extractStatementFromZip(fileFrom(ascii("PK"), "a.zip"), undefined, {
        open: openerFor([
          zipEntry({ filename: "januari.csv" }),
          zipEntry({ filename: "februari.csv" }),
        ]),
      }),
    ).rejects.toMatchObject({ reason: "multiple-statements" });
  });

  it("reports an archive with nothing parseable in it", async () => {
    await expect(
      extractStatementFromZip(fileFrom(ascii("PK"), "a.zip"), undefined, {
        open: openerFor([zipEntry({ filename: "statement.pdf" })]),
      }),
    ).rejects.toMatchObject({ reason: "no-statement" });
  });

  it("asks for a password when the entry is encrypted and none was given", async () => {
    await expect(
      extractStatementFromZip(fileFrom(ascii("PK"), "a.zip"), undefined, {
        open: openerFor([zipEntry({ encrypted: true })]),
      }),
    ).rejects.toMatchObject({ reason: "password-required" });
  });

  it("refuses an over-declared entry BEFORE any extraction is attempted", async () => {
    const extractTo = jest.fn();
    await expect(
      extractStatementFromZip(fileFrom(ascii("PK"), "a.zip"), undefined, {
        maxEntryBytes: 1024,
        open: openerFor([
          zipEntry({ declaredUncompressedSize: 4096, extractTo }),
        ]),
      }),
    ).rejects.toMatchObject({ reason: "entry-too-large" });
    expect(extractTo).not.toHaveBeenCalled();
  });

  it("stops an UNDER-declared bomb mid-stream — the declared size is never trusted", async () => {
    // The `zip-bounds.util.ts` lesson: a lying header changes nothing,
    // because the real output bytes are what get counted.
    let chunksWritten = 0;
    const entry = zipEntry({
      declaredUncompressedSize: 4, // the lie
      extractTo: async (sink) => {
        const writer = sink.getWriter();
        for (let i = 0; i < 100; i++) {
          chunksWritten++;
          await writer.write(new Uint8Array(256));
        }
        await writer.close();
      },
    });
    await expect(
      extractStatementFromZip(fileFrom(ascii("PK"), "a.zip"), undefined, {
        maxEntryBytes: 1024,
        open: openerFor([entry]),
      }),
    ).rejects.toMatchObject({ reason: "entry-too-large" });
    // Aborted early: nowhere near the 100 chunks the "bomb" wanted to write.
    expect(chunksWritten).toBeLessThan(20);
  });

  it("finds a statement nested in a directory and names it by its basename", async () => {
    const result = await extractStatementFromZip(
      fileFrom(ascii("PK"), "a.zip"),
      undefined,
      {
        open: openerFor([
          zipEntry({ filename: "e-statement/2026/mutasi-januari.csv" }),
          zipEntry({ filename: "e-statement/", directory: true }),
          zipEntry({ filename: "e-statement/2026/", directory: true }),
        ]),
      },
    );
    expect(result.filename).toBe("e-statement/2026/mutasi-januari.csv");
  });

  it("refuses two statements even when they sit in different directories", async () => {
    await expect(
      extractStatementFromZip(fileFrom(ascii("PK"), "a.zip"), undefined, {
        open: openerFor([
          zipEntry({ filename: "2025/mutasi.csv" }),
          zipEntry({ filename: "2026/mutasi.csv" }),
        ]),
      }),
    ).rejects.toMatchObject({ reason: "multiple-statements" });
  });

  it("always closes the archive, including on refusal", async () => {
    const close = jest.fn(async () => undefined);
    await extractStatementFromZip(fileFrom(ascii("PK"), "a.zip"), undefined, {
      open: async () => ({ entries: [], close }),
    }).catch(() => undefined);
    expect(close).toHaveBeenCalled();
  });
});

describe("boundedCollector", () => {
  it("reassembles chunks in order when inside the budget", async () => {
    const collector = boundedCollector(64);
    const writer = collector.stream.getWriter();
    await writer.write(ascii("abc"));
    await writer.write(ascii("def"));
    await writer.close();
    expect(new TextDecoder().decode(collector.take())).toBe("abcdef");
  });

  it("throws inside the sink the moment the cap is passed", async () => {
    const collector = boundedCollector(4);
    const writer = collector.stream.getWriter();
    await expect(writer.write(ascii("abcdefgh"))).rejects.toBeInstanceOf(
      StatementZipError,
    );
  });
});

describe("prepareStatementFile — password-protected ZIP", () => {
  const archive = () =>
    fileFrom(concat(zipLocalHeader("mutasi.csv", true), ascii("xx")), "e.zip");

  it("uploads the inner CSV under its own name and type", async () => {
    const prepared = await prepareStatementFile(archive(), "rahasia", {
      openZip: openerFor([zipEntry({ encrypted: true })]),
    });
    expect(prepared.name).toBe("mutasi.csv");
    expect(prepared.type).toBe("text/csv");
    expect(await textOf(prepared)).toContain("tanggal");
  });

  it("maps a rejected password to the retryable wrong-password reason", async () => {
    await expect(
      prepareStatementFile(archive(), "salah", {
        openZip: openerFor([
          zipEntry({
            encrypted: true,
            extractTo: async () => {
              throw new StatementZipError("wrong-password");
            },
          }),
        ]),
      }),
    ).rejects.toMatchObject({ reason: "wrong-password" });
  });

  it("surfaces a multi-statement archive with its own reason", async () => {
    await expect(
      prepareStatementFile(archive(), "rahasia", {
        openZip: openerFor([
          zipEntry({ filename: "januari.csv", encrypted: true }),
          zipEntry({ filename: "februari.csv", encrypted: true }),
        ]),
      }),
    ).rejects.toMatchObject({ reason: "zip-multiple-statements" });
  });

  it("cannot be made to write outside its own name by a traversal entry", async () => {
    // Nothing here touches a filesystem, but the entry name becomes the
    // uploaded `File`'s name and is attacker-controlled. Only the last path
    // segment is ever used, so `../../` is inert rather than merely unlikely.
    const prepared = await prepareStatementFile(archive(), "rahasia", {
      openZip: openerFor([
        zipEntry({ filename: "../../../../etc/mutasi.csv", encrypted: true }),
      ]),
    });
    expect(prepared.name).toBe("mutasi.csv");
  });

  it("extracts an UNencrypted container without ever prompting", async () => {
    const file = fileFrom(
      concat(zipLocalHeader("mutasi.csv", false), ascii("xx")),
      "plain.zip",
    );
    const prepared = await prepareStatementFile(file, undefined, {
      openZip: openerFor([zipEntry()]),
    });
    expect(prepared.name).toBe("mutasi.csv");
  });
});

/* ───────────────────── E4d — the password stays here ───────────────────── */

describe("E4d — the password never leaves the browser", () => {
  const PASSWORD = "0812!Rahasia-KTP-3174";

  type Probe = {
    restore: () => void;
    /** Everything any instrumented sink was handed, flattened to strings. */
    seen: () => string[];
  };

  function installProbes(): Probe {
    const seen: string[] = [];
    const record = (...args: unknown[]) => {
      for (const a of args) {
        try {
          seen.push(
            typeof a === "string" ? a : (JSON.stringify(a) ?? String(a)),
          );
        } catch {
          seen.push(String(a));
        }
      }
    };

    const g = globalThis as unknown as Record<string, unknown>;
    const originals = {
      fetch: g.fetch,
      sendBeacon: (globalThis.navigator as { sendBeacon?: unknown } | undefined)
        ?.sendBeacon,
      xhrOpen: globalThis.XMLHttpRequest?.prototype?.open,
      xhrSend: globalThis.XMLHttpRequest?.prototype?.send,
    };
    const consoleSpies = (
      ["log", "info", "warn", "error", "debug"] as const
    ).map((level) =>
      jest.spyOn(console, level).mockImplementation((...args: unknown[]) => {
        record(...args);
      }),
    );
    const storageSpies = [
      jest.spyOn(Storage.prototype, "setItem").mockImplementation(function (
        ...args: unknown[]
      ) {
        record(...args);
      }),
    ];

    g.fetch = jest.fn(async (...args: unknown[]) => {
      record(...args);
      throw new Error("no request may be made while unlocking");
    });
    if (globalThis.XMLHttpRequest?.prototype) {
      globalThis.XMLHttpRequest.prototype.open = function (...args: unknown[]) {
        record(...args);
      } as never;
      globalThis.XMLHttpRequest.prototype.send = function (...args: unknown[]) {
        record(...args);
      } as never;
    }

    return {
      seen: () => seen,
      restore: () => {
        g.fetch = originals.fetch;
        if (globalThis.XMLHttpRequest?.prototype) {
          globalThis.XMLHttpRequest.prototype.open =
            originals.xhrOpen as typeof XMLHttpRequest.prototype.open;
          globalThis.XMLHttpRequest.prototype.send =
            originals.xhrSend as typeof XMLHttpRequest.prototype.send;
        }
        consoleSpies.forEach((s) => s.mockRestore());
        storageSpies.forEach((s) => s.mockRestore());
      },
    };
  }

  /** Message + stack + every own enumerable property of a thrown value. */
  function serialiseThrown(err: unknown): string {
    if (!(err instanceof Error)) return String(err);
    const own = Object.getOwnPropertyNames(err)
      .map(
        (key) =>
          `${key}=${String((err as unknown as Record<string, unknown>)[key])}`,
      )
      .join("|");
    return `${err.name}|${err.message}|${err.stack ?? ""}|${own}`;
  }

  it("makes no request, writes no storage, logs nothing, and puts it in no error", async () => {
    const probe = installProbes();
    const thrown: string[] = [];
    try {
      // Every branch the password can travel through: a successful XLSX
      // decrypt, a rejected one, a successful ZIP extract, a rejected one.
      const encryptedXlsx = fileFrom(
        concat(CFB_HEADER, new Uint8Array(64)),
        "e.xlsx",
      );
      const encryptedZip = fileFrom(
        concat(zipLocalHeader("mutasi.csv", true), ascii("xx")),
        "e.zip",
      );

      const okXlsx = await prepareStatementFile(encryptedXlsx, PASSWORD, {
        decryptOoxml: async () => ascii("PKdecrypted"),
      });
      thrown.push(await textOf(okXlsx));

      await prepareStatementFile(encryptedXlsx, PASSWORD, {
        decryptOoxml: async () => {
          throw new StatementFileError("wrong-password");
        },
      }).catch((e) => thrown.push(serialiseThrown(e)));

      const okZip = await prepareStatementFile(encryptedZip, PASSWORD, {
        openZip: openerFor([zipEntry({ encrypted: true })]),
      });
      thrown.push(await textOf(okZip));

      await prepareStatementFile(encryptedZip, PASSWORD, {
        openZip: openerFor([
          zipEntry({
            encrypted: true,
            extractTo: async () => {
              throw new StatementZipError("wrong-password");
            },
          }),
        ]),
      }).catch((e) => thrown.push(serialiseThrown(e)));
    } finally {
      probe.restore();
    }

    // Nothing was sent anywhere…
    expect(probe.seen()).toEqual([]);
    // …and nothing that IS observable to the caller carries the secret:
    // not the uploaded bytes, not a message, not a stack, not a property.
    for (const text of thrown) {
      expect(text).not.toContain(PASSWORD);
    }
  });

  it("keeps the password out of the message the UI is about to render", () => {
    const err = new StatementFileError("wrong-password");
    expect(statementFileErrorMessage(err, dictionary)).not.toContain(PASSWORD);
    expect(err.message).not.toContain(PASSWORD);
  });
});

/* ───────────────────────── messages ───────────────────────── */

describe("statementFileErrorMessage", () => {
  /**
   * Declared as a `Record` keyed by the union rather than a plain array, so
   * TypeScript FAILS THE BUILD when a new `StatementFileFailure` is added
   * without being listed here. An array would silently have gone on testing
   * only the old reasons — the same class of hole the `never` exhaustiveness
   * check closes on the message side. (It caught exactly that when
   * `integrity-failure`/`integrity-missing` were added.)
   */
  const ALL_REASONS = Object.keys({
    "empty-file": true,
    "file-too-large": true,
    "password-required": true,
    "wrong-password": true,
    "unsupported-encryption": true,
    "crypto-unavailable": true,
    "corrupt-file": true,
    "integrity-failure": true,
    "integrity-missing": true,
    "zip-no-statement": true,
    "zip-multiple-statements": true,
    "zip-entry-too-large": true,
    "decrypted-too-large": true,
    "xlsx-repackage-failed": true,
    "xlsx-expansion-too-large": true,
    "pdf-not-a-file-upload": true,
  } satisfies Record<StatementFileFailure, true>) as StatementFileFailure[];

  it("gives every reason its own distinct, non-empty message in both locales", () => {
    for (const dict of [dictionary, enDictionary]) {
      const messages = ALL_REASONS.map((reason) =>
        statementFileErrorMessage(new StatementFileError(reason), dict),
      );
      messages.forEach((m) => expect(m.length).toBeGreaterThan(0));
      expect(new Set(messages).size).toBe(ALL_REASONS.length);
    }
  });

  it("logs only the error CLASS for an unmapped failure, never its message", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await prepareStatementFile(
        fileFrom(concat(CFB_HEADER, new Uint8Array(64)), "e.xlsx"),
        "rahasia-sekali",
        {
          decryptOoxml: async () => {
            throw new TypeError("offset 0x1f: password rahasia-sekali failed");
          },
        },
      ).catch(() => undefined);

      expect(warn).toHaveBeenCalledTimes(1);
      const logged = warn.mock.calls[0].join(" ");
      // The class label is there, so a real defect in this group is
      // diagnosable instead of presenting as "file rusak" forever...
      expect(logged).toContain("TypeError");
      // ...and nothing else is. Even a library that put the password into
      // its own message cannot get it into our log.
      expect(logged).not.toContain("rahasia-sekali");
      expect(logged).not.toContain("0x1f");
      expect(logged).not.toContain("e.xlsx");
    } finally {
      warn.mockRestore();
    }
  });

  it("does not log at all for a failure it recognises", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await prepareStatementFile(
        fileFrom(concat(CFB_HEADER, new Uint8Array(64)), "e.xlsx"),
        "salah",
        {
          decryptOoxml: async () => {
            throw new StatementFileError("wrong-password");
          },
        },
      ).catch(() => undefined);
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it("falls back to the corrupt-file message for a non-StatementFileError", () => {
    expect(statementFileErrorMessage(new Error("boom"), dictionary)).toBe(
      dictionary.rekonsiliasi.protectedErrorCorruptFile,
    );
  });
});

/* ─────────────────── container normalisation (group A) ─────────────────── */

describe("prepareStatementFile — streaming-written workbooks", () => {
  it("rewrites the container of a workbook that needs it, and prompts for nothing", async () => {
    const normalizeOoxmlPackage = jest
      .fn()
      .mockResolvedValue(ascii("NORMALISED"));
    const prepared = await prepareStatementFile(
      fileFrom(streamedWorkbook(), "mutasi.xlsx"),
      undefined,
      { normalizeOoxmlPackage, decryptOoxml: jest.fn(), openZip: jest.fn() },
    );
    expect(normalizeOoxmlPackage).toHaveBeenCalledTimes(1);
    expect(await textOf(prepared)).toBe("NORMALISED");
    expect(prepared.name).toBe("mutasi.xlsx");
  });

  it("leaves a conventional workbook completely alone", async () => {
    const normalizeOoxmlPackage = jest.fn();
    const file = fileFrom(
      concat(zipLocalHeader("[Content_Types].xml", false), ascii("<Types/>")),
      "mutasi.xlsx",
    );
    const prepared = await prepareStatementFile(file, undefined, {
      normalizeOoxmlPackage,
    });
    expect(normalizeOoxmlPackage).not.toHaveBeenCalled();
    expect(prepared).toBe(file);
  });

  it("rewrites the container of a DECRYPTED workbook too", async () => {
    // The real file is both: encrypted, and streaming-written inside. Fixing
    // only the unencrypted path would leave the actual statement broken.
    const decryptOoxml = jest.fn().mockResolvedValue(streamedWorkbook());
    const normalizeOoxmlPackage = jest
      .fn()
      .mockResolvedValue(ascii("NORMALISED"));
    const prepared = await prepareStatementFile(
      fileFrom(concat(CFB_HEADER, new Uint8Array(64)), "e.xlsx"),
      "rahasia",
      { decryptOoxml, normalizeOoxmlPackage },
    );
    expect(normalizeOoxmlPackage).toHaveBeenCalledTimes(1);
    expect(await textOf(prepared)).toBe("NORMALISED");
  });

  it("rewrites the container of a workbook extracted from a ZIP too", async () => {
    const normalizeOoxmlPackage = jest
      .fn()
      .mockResolvedValue(ascii("NORMALISED"));
    const prepared = await prepareStatementFile(
      fileFrom(
        concat(zipLocalHeader("mutasi.xlsx", true), ascii("x")),
        "a.zip",
      ),
      "rahasia",
      {
        openZip: openerFor([
          zipEntry({
            filename: "mutasi.xlsx",
            encrypted: true,
            extractTo: async (sink) => {
              const writer = sink.getWriter();
              await writer.write(streamedWorkbook());
              await writer.close();
            },
          }),
        ]),
        normalizeOoxmlPackage,
      },
    );
    expect(normalizeOoxmlPackage).toHaveBeenCalledTimes(1);
    expect(await textOf(prepared)).toBe("NORMALISED");
  });

  it("does not touch a CSV extracted from a ZIP", async () => {
    const normalizeOoxmlPackage = jest.fn();
    await prepareStatementFile(
      fileFrom(concat(zipLocalHeader("mutasi.csv", true), ascii("x")), "a.zip"),
      "rahasia",
      {
        openZip: openerFor([zipEntry({ encrypted: true })]),
        normalizeOoxmlPackage,
      },
    );
    expect(normalizeOoxmlPackage).not.toHaveBeenCalled();
  });

  it("gives a failed rewrite its own actionable reason, not corrupt-file", async () => {
    const err = await prepareStatementFile(
      fileFrom(streamedWorkbook(), "mutasi.xlsx"),
      undefined,
      {
        normalizeOoxmlPackage: jest
          .fn()
          .mockRejectedValue({ reason: "repackage-failed" }),
      },
    ).catch((e) => e);
    expect(err).toMatchObject({ reason: "xlsx-repackage-failed" });
    expect(statementFileErrorMessage(err, dictionary)).not.toBe(
      dictionary.rekonsiliasi.protectedErrorCorruptFile,
    );
  });

  it("maps an over-budget rewrite to its own reason", async () => {
    const err = await prepareStatementFile(
      fileFrom(streamedWorkbook(), "mutasi.xlsx"),
      undefined,
      {
        normalizeOoxmlPackage: jest
          .fn()
          .mockRejectedValue({ reason: "package-too-large" }),
      },
    ).catch((e) => e);
    expect(err).toMatchObject({ reason: "xlsx-expansion-too-large" });
  });
});
