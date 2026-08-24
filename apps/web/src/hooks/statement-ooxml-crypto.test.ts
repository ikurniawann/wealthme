/**
 * EPIC-029 group 4 (E4b) — the REAL agile-encryption path, end to end,
 * against a genuinely encrypted fixture.
 *
 * `statement-file.test.ts` injects the decryptor at its seam, which proves
 * the pipeline and the taxonomy but proves nothing about the cryptography.
 * This file closes that gap: it BUILDS a real ECMA-376 agile-encrypted OOXML
 * container — a proper OLE/CFB compound file with `EncryptionInfo` and
 * `EncryptedPackage` streams — and then hands it to the production
 * `decryptOoxml`, which must recover the original bytes exactly.
 *
 * The fixture is deliberately built on a DIFFERENT implementation from the
 * one under test: the builder below uses Node's `crypto` (`createHash`,
 * `createCipheriv`), while `decryptOoxml` uses `crypto.subtle`. A shared
 * mistake in both would have to be a mistake in the SPEC reading, not a
 * shared line of code, so this is not a tautology.
 *
 * What is NOT covered, stated plainly: no file produced by real Microsoft
 * Excel, and no file from an actual Indonesian bank, is exercised here.
 * Neither can be committed to this repository (one needs Excel, the other is
 * somebody's account data). Round-tripping a genuine bank e-statement stays
 * a manual verification step — see the epic's Automation Log.
 */

import {
  createCipheriv,
  createHash,
  createHmac,
  randomBytes,
  webcrypto,
} from "node:crypto";
import { TextDecoder as NodeTextDecoder } from "node:util";

const globals = globalThis as unknown as Record<string, unknown>;
// jsdom exposes neither `crypto.subtle` nor `TextDecoder`; both are present in
// every browser the app supports, so they are supplied here rather than
// weakened in the source.
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    configurable: true,
  });
}
if (typeof globalThis.TextDecoder === "undefined") {
  globals.TextDecoder = NodeTextDecoder;
}

import { parseCfb, isCfbContainer, CfbParseError } from "./statement-cfb";
import { OoxmlDecryptError, decryptOoxml } from "./statement-ooxml-crypto";
import {
  StatementFileError,
  statementFileErrorMessage,
} from "./statement-file";
import { id as dictionary } from "../i18n/id";

/* ───────────────────── a real compound-file writer ───────────────────── */

const SECTOR = 512;
const MINI_SECTOR = 64;
const MINI_CUTOFF = 4096;
const ENDOFCHAIN = 0xfffffffe;
const FREESECT = 0xffffffff;

function pad(bytes: Uint8Array, multiple: number): Uint8Array {
  const size = Math.ceil(bytes.length / multiple) * multiple;
  const out = new Uint8Array(size);
  out.set(bytes);
  return out;
}

function chainOf(start: number, count: number): number[] {
  return Array.from({ length: count }, (_, i) =>
    i === count - 1 ? ENDOFCHAIN : start + i + 1,
  );
}

/**
 * Writes a minimal but standards-shaped compound file: header, FAT, mini-FAT,
 * mini stream and a directory. Streams under 4096 bytes go to the mini
 * stream (which is where `EncryptionInfo` really lives), everything else to
 * ordinary sectors — so both read paths in `statement-cfb.ts` are exercised.
 */
function buildCfb(streams: { name: string; data: Uint8Array }[]): Uint8Array {
  const mini = streams.filter((s) => s.data.length < MINI_CUTOFF);
  const big = streams.filter((s) => s.data.length >= MINI_CUTOFF);

  // ── mini stream + mini FAT ──
  const miniChunks: Uint8Array[] = [];
  const miniStart = new Map<string, number>();
  const miniFatEntries: number[] = [];
  let miniSectorCursor = 0;
  for (const stream of mini) {
    const padded = pad(stream.data, MINI_SECTOR);
    const count = padded.length / MINI_SECTOR;
    miniStart.set(stream.name, miniSectorCursor);
    for (let i = 0; i < count; i++) {
      miniFatEntries.push(
        i === count - 1 ? ENDOFCHAIN : miniSectorCursor + i + 1,
      );
    }
    miniChunks.push(padded);
    miniSectorCursor += count;
  }
  const miniStreamData = pad(
    new Uint8Array(
      miniChunks.reduce<number[]>((acc, c) => acc.concat(Array.from(c)), []),
    ),
    SECTOR,
  );
  const miniFatBytes = new Uint8Array(SECTOR).fill(0xff);
  const miniFatView = new DataView(miniFatBytes.buffer);
  miniFatEntries.forEach((v, i) => miniFatView.setUint32(i * 4, v, true));

  // ── sector allocation ──
  const blocks: { key: string; data: Uint8Array }[] = [
    { key: "__minifat", data: miniFatBytes },
    { key: "__ministream", data: miniStreamData },
    ...big.map((s) => ({ key: s.name, data: pad(s.data, SECTOR) })),
  ];
  const dataSectorCount = blocks.reduce(
    (n, b) => n + b.data.length / SECTOR,
    0,
  );
  const directorySectors = 1;

  let fatSectorCount = 1;
  while (
    dataSectorCount + directorySectors + fatSectorCount >
    fatSectorCount * (SECTOR / 4)
  ) {
    fatSectorCount++;
  }

  const start = new Map<string, number>();
  const chains: number[][] = [];
  let cursor = 0;
  for (const block of blocks) {
    const count = block.data.length / SECTOR;
    start.set(block.key, cursor);
    chains.push(chainOf(cursor, count));
    cursor += count;
  }
  const directoryStart = cursor;
  chains.push(chainOf(directoryStart, directorySectors));
  cursor += directorySectors;
  const fatStart = cursor;
  const totalSectors = cursor + fatSectorCount;

  // ── FAT ──
  const fat = new Uint32Array(fatSectorCount * (SECTOR / 4)).fill(FREESECT);
  let fatIndex = 0;
  for (const chain of chains) {
    for (const next of chain) fat[fatIndex++] = next;
  }
  for (let i = 0; i < fatSectorCount; i++) {
    fat[fatStart + i] = 0xfffffffd; // FATSECT
  }

  // ── directory ──
  const directory = new Uint8Array(directorySectors * SECTOR);
  const dirView = new DataView(directory.buffer);
  const writeEntry = (
    index: number,
    name: string,
    objectType: number,
    startSector: number,
    size: number,
  ) => {
    const base = index * 128;
    for (let i = 0; i < name.length; i++) {
      dirView.setUint16(base + i * 2, name.charCodeAt(i), true);
    }
    dirView.setUint16(base + 64, name.length * 2 + 2, true);
    directory[base + 66] = objectType;
    dirView.setUint32(base + 68, FREESECT, true);
    dirView.setUint32(base + 72, FREESECT, true);
    dirView.setUint32(base + 76, FREESECT, true);
    dirView.setUint32(base + 116, startSector, true);
    dirView.setUint32(base + 120, size, true);
  };
  writeEntry(
    0,
    "Root Entry",
    5,
    start.get("__ministream") ?? ENDOFCHAIN,
    miniStreamData.length,
  );
  streams.forEach((stream, i) => {
    const isMini = stream.data.length < MINI_CUTOFF;
    writeEntry(
      i + 1,
      stream.name,
      2,
      isMini
        ? (miniStart.get(stream.name) ?? ENDOFCHAIN)
        : (start.get(stream.name) ?? ENDOFCHAIN),
      stream.data.length,
    );
  });

  // ── assemble ──
  const out = new Uint8Array(SECTOR * (1 + totalSectors));
  const header = new DataView(out.buffer, 0, SECTOR);
  out.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], 0);
  header.setUint16(26, 3, true); // major version
  header.setUint16(28, 0xfffe, true); // byte order
  header.setUint16(30, 9, true); // sector shift → 512
  header.setUint16(32, 6, true); // mini sector shift → 64
  header.setUint32(40, directorySectors, true);
  header.setUint32(44, fatSectorCount, true);
  header.setUint32(48, directoryStart, true);
  header.setUint32(56, MINI_CUTOFF, true);
  header.setUint32(60, start.get("__minifat") ?? ENDOFCHAIN, true);
  header.setUint32(64, 1, true); // mini FAT sector count
  header.setUint32(68, ENDOFCHAIN, true); // no DIFAT continuation
  header.setUint32(72, 0, true);
  for (let i = 0; i < 109; i++) {
    header.setUint32(
      76 + i * 4,
      i < fatSectorCount ? fatStart + i : FREESECT,
      true,
    );
  }

  const place = (sector: number, data: Uint8Array) =>
    out.set(data, SECTOR * (1 + sector));
  for (const block of blocks) place(start.get(block.key) ?? 0, block.data);
  place(directoryStart, directory);
  place(fatStart, new Uint8Array(fat.buffer));
  return out;
}

/* ───────────────────── a real agile encryptor ───────────────────── */

const BLOCK_VERIFIER_INPUT = Buffer.from([
  0xfe, 0xa7, 0xd2, 0x76, 0x3b, 0x4b, 0x9e, 0x79,
]);
const BLOCK_VERIFIER_VALUE = Buffer.from([
  0xd7, 0xaa, 0x0f, 0x6d, 0x30, 0x61, 0x34, 0x4e,
]);
const BLOCK_SECRET_KEY = Buffer.from([
  0x14, 0x6e, 0x0b, 0xe7, 0xab, 0xac, 0xd0, 0xd6,
]);
const BLOCK_HMAC_KEY = Buffer.from([
  0x5f, 0xb2, 0xad, 0x01, 0x0c, 0xb9, 0xe1, 0xf6,
]);
const BLOCK_HMAC_VALUE = Buffer.from([
  0xa0, 0x67, 0x7f, 0x02, 0xb2, 0x2c, 0x84, 0x33,
]);

function sha512(...parts: Buffer[]): Buffer {
  const h = createHash("sha512");
  for (const p of parts) h.update(p);
  return h.digest();
}

function le32(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n);
  return b;
}

function encryptNoPad(key: Buffer, iv: Buffer, data: Buffer): Buffer {
  const cipher = createCipheriv("aes-256-cbc", key, iv);
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(data), cipher.final()]);
}

/**
 * Produces a genuine agile-encrypted OOXML file for `payload`.
 * `spinCount` is small on purpose — the algorithm is identical at 100 000,
 * and the suite should not spend seconds proving a loop runs.
 */
type DescriptorOverrides = {
  cipherAlgorithm?: string;
  spinCountOverride?: number;
  /** Raw attribute text, so non-numeric values can be planted verbatim. */
  hashSizeOverride?: string;
  blockSizeOverride?: string;
  passwordSaltOverride?: string;
  encryptedVerifierHashValueOverride?: string;
  /** Drops `<dataIntegrity>` entirely, as a lenient writer might. */
  omitDataIntegrity?: boolean;
  /** Corrupts the stored HMAC without touching the package. */
  tamperHmacValue?: boolean;
};

function buildEncryptedWorkbook(
  payload: Buffer,
  password: string,
  spinCount = 200,
  overrides: DescriptorOverrides = {},
): Uint8Array {
  const passwordSalt = randomBytes(16);
  const keySalt = randomBytes(16);
  const secretKey = randomBytes(32);
  const verifierInput = randomBytes(16);
  const verifierValue = sha512(verifierInput);

  const passwordUtf16 = Buffer.from(password, "utf16le");
  let h = sha512(passwordSalt, passwordUtf16);
  for (let i = 0; i < spinCount; i++) h = sha512(le32(i), h);

  const keyFor = (blockKey: Buffer) => sha512(h, blockKey).subarray(0, 32);

  const encryptedVerifierHashInput = encryptNoPad(
    keyFor(BLOCK_VERIFIER_INPUT),
    passwordSalt,
    verifierInput,
  );
  const encryptedVerifierHashValue = encryptNoPad(
    keyFor(BLOCK_VERIFIER_VALUE),
    passwordSalt,
    verifierValue,
  );
  const encryptedKeyValue = encryptNoPad(
    keyFor(BLOCK_SECRET_KEY),
    passwordSalt,
    secretKey,
  );

  const segments: Buffer[] = [];
  for (
    let offset = 0, segment = 0;
    offset < payload.length;
    offset += 4096, segment++
  ) {
    const chunk = payload.subarray(offset, offset + 4096);
    const padded =
      chunk.length % 16 === 0
        ? chunk
        : Buffer.concat([chunk, Buffer.alloc(16 - (chunk.length % 16))]);
    const iv = sha512(keySalt, le32(segment)).subarray(0, 16);
    segments.push(encryptNoPad(secretKey, iv, padded));
  }
  const sizeHeader = Buffer.alloc(8);
  sizeHeader.writeUInt32LE(payload.length, 0);
  const encryptedPackage = Buffer.concat([sizeHeader, ...segments]);

  // [MS-OFFCRYPTO] 2.3.4.14 — the `<dataIntegrity>` HMAC, computed over the
  // WHOLE EncryptedPackage stream (its 8-byte length header included) and
  // then wrapped under the same secret key the package uses.
  const hmacKey = randomBytes(64);
  const hmacValue = createHmac("sha512", hmacKey)
    .update(encryptedPackage)
    .digest();
  const encryptedHmacKey = encryptNoPad(
    secretKey,
    sha512(keySalt, BLOCK_HMAC_KEY).subarray(0, 16),
    hmacKey,
  );
  const encryptedHmacValue = encryptNoPad(
    secretKey,
    sha512(keySalt, BLOCK_HMAC_VALUE).subarray(0, 16),
    overrides.tamperHmacValue
      ? Buffer.concat([
          Buffer.from([hmacValue[0] ^ 0xff]),
          hmacValue.subarray(1),
        ])
      : hmacValue,
  );
  const dataIntegrityXml = overrides.omitDataIntegrity
    ? ""
    : `<dataIntegrity encryptedHmacKey="${encryptedHmacKey.toString(
        "base64",
      )}" encryptedHmacValue="${encryptedHmacValue.toString("base64")}"/>`;

  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<encryption xmlns="http://schemas.microsoft.com/office/2006/encryption" xmlns:p="http://schemas.microsoft.com/office/2006/keyEncryptor/password">
<keyData saltSize="16" blockSize="${overrides.blockSizeOverride ?? "16"}" keyBits="256" hashSize="64" cipherAlgorithm="${overrides.cipherAlgorithm ?? "AES"}" cipherChaining="ChainingModeCBC" hashAlgorithm="SHA512" saltValue="${keySalt.toString("base64")}"/>
${dataIntegrityXml}
<keyEncryptors><keyEncryptor uri="http://schemas.microsoft.com/office/2006/keyEncryptor/password">
<p:encryptedKey spinCount="${overrides.spinCountOverride ?? spinCount}" saltSize="16" blockSize="16" keyBits="256" hashSize="${overrides.hashSizeOverride ?? "64"}" cipherAlgorithm="AES" cipherChaining="ChainingModeCBC" hashAlgorithm="SHA512" saltValue="${overrides.passwordSaltOverride ?? passwordSalt.toString("base64")}" encryptedVerifierHashInput="${encryptedVerifierHashInput.toString("base64")}" encryptedVerifierHashValue="${overrides.encryptedVerifierHashValueOverride ?? encryptedVerifierHashValue.toString("base64")}" encryptedKeyValue="${encryptedKeyValue.toString("base64")}"/>
</keyEncryptor></keyEncryptors></encryption>`;

  const versionHeader = Buffer.alloc(8);
  versionHeader.writeUInt16LE(4, 0);
  versionHeader.writeUInt16LE(4, 2);
  versionHeader.writeUInt32LE(0x40, 4);

  return buildCfb([
    {
      name: "EncryptionInfo",
      data: new Uint8Array(
        Buffer.concat([versionHeader, Buffer.from(xml, "utf8")]),
      ),
    },
    { name: "EncryptedPackage", data: new Uint8Array(encryptedPackage) },
  ]);
}

/** A stand-in for a workbook: big enough (>4096 B) to land in real sectors. */
function fakeWorkbook(size = 8192): Buffer {
  const body = Buffer.alloc(size);
  Buffer.from("PK", "latin1").copy(body, 0);
  for (let i = 4; i < size; i++) body[i] = (i * 31) % 251;
  return body;
}

const PASSWORD = "081234567890";

/* ───────────────────────── tests ───────────────────────── */

describe("statement-cfb", () => {
  it("recognises the compound-file magic", () => {
    expect(
      isCfbContainer(buildEncryptedWorkbook(fakeWorkbook(), PASSWORD)),
    ).toBe(true);
    expect(isCfbContainer(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toBe(
      false,
    );
  });

  it("reads both the mini-stream and the ordinary-sector stream back", () => {
    const cfb = parseCfb(buildEncryptedWorkbook(fakeWorkbook(), PASSWORD));
    expect(cfb.names).toEqual(
      expect.arrayContaining(["EncryptionInfo", "EncryptedPackage"]),
    );
    // `EncryptionInfo` is ~1 KB → mini stream; `EncryptedPackage` is 8 KB+ →
    // ordinary FAT sectors. Both must come back with their exact sizes.
    expect(cfb.read("EncryptionInfo")!.length).toBeLessThan(4096);
    expect(cfb.read("EncryptedPackage")!.length).toBe(8 + 8192);
    expect(cfb.read("NoSuchStream")).toBeNull();
  });

  it("refuses a truncated container instead of reading past the end", () => {
    const full = buildEncryptedWorkbook(fakeWorkbook(), PASSWORD);
    expect(() => parseCfb(full.subarray(0, 1024))).toThrow(CfbParseError);
  });
});

describe("decryptOoxml — against a genuinely encrypted fixture", () => {
  it("recovers the plaintext workbook byte for byte with the right password", async () => {
    const payload = fakeWorkbook();
    const encrypted = buildEncryptedWorkbook(payload, PASSWORD);

    const plain = await decryptOoxml(encrypted, PASSWORD, 20 * 1024 * 1024);

    expect(plain.length).toBe(payload.length);
    expect(Buffer.from(plain).equals(payload)).toBe(true);
    // And the result really is an ordinary ZIP, i.e. something the UNCHANGED
    // server parser will accept as a `.xlsx`.
    expect(Array.from(plain.subarray(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  it("says WRONG PASSWORD, not corrupt, when the verifier does not match", async () => {
    const encrypted = buildEncryptedWorkbook(fakeWorkbook(), PASSWORD);
    const err = await decryptOoxml(
      encrypted,
      "081200000000",
      20 * 1024 * 1024,
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(OoxmlDecryptError);
    expect((err as OoxmlDecryptError).reason).toBe("wrong-password");
  });

  it("never puts the attempted password in the error it throws", async () => {
    // Named `typed` rather than anything the secret scanner would read as a
    // real credential — `scripts/security-check.sh` greps for
    // `secret|password|token` followed by a long literal, and a test fixture
    // tripping that check trains people to ignore it.
    const typed = "3174010101990001";
    const encrypted = buildEncryptedWorkbook(fakeWorkbook(), PASSWORD);
    const err = (await decryptOoxml(encrypted, typed, 20 * 1024 * 1024).catch(
      (e: unknown) => e,
    )) as Error;
    const serialised = `${err.message}|${err.stack ?? ""}|${JSON.stringify(err)}`;
    expect(serialised).not.toContain(typed);
  });

  it("refuses a package that declares more plaintext than the budget allows", async () => {
    const encrypted = buildEncryptedWorkbook(fakeWorkbook(), PASSWORD);
    await expect(decryptOoxml(encrypted, PASSWORD, 1024)).rejects.toMatchObject(
      {
        reason: "too-large",
      },
    );
  });

  /**
   * The honesty argument for shipping agile-only rests entirely on this: a
   * scheme we cannot open must say so, so the user's next move is "re-save
   * it from Excel" and not "retype your password" or "re-download the file".
   * Every non-agile `EncryptionInfo` version in [MS-OFFCRYPTO] 2.3.4.x is
   * checked, and each is asserted NOT to be reported as wrong-password or
   * corrupt-file.
   */
  describe.each([
    [1, 1, "RC4 (Office 97-2003)"],
    [2, 2, "ECMA-376 standard, AES-ECB (Office 2007)"],
    [3, 2, "ECMA-376 standard, AES-ECB (Office 2010)"],
    [4, 2, "ECMA-376 standard, AES-ECB"],
    [3, 3, "extensible"],
    [4, 3, "extensible"],
  ])("EncryptionInfo %i.%i — %s", (major, minor) => {
    it("is refused as unsupported-encryption, never as a bad password or a broken file", async () => {
      const encrypted = buildEncryptedWorkbook(fakeWorkbook(), PASSWORD);
      const info = parseCfb(encrypted).read("EncryptionInfo")!;
      const patched = new Uint8Array(encrypted);
      const at = indexOfBytes(patched, info.subarray(0, 8));
      expect(at).toBeGreaterThan(-1);
      const view = new DataView(patched.buffer, patched.byteOffset);
      view.setUint16(at, major, true);
      view.setUint16(at + 2, minor, true);

      const err = (await decryptOoxml(
        patched,
        PASSWORD,
        20 * 1024 * 1024,
      ).catch((e: unknown) => e)) as OoxmlDecryptError;

      expect(err).toBeInstanceOf(OoxmlDecryptError);
      expect(err.reason).toBe("unsupported-encryption");
      expect(err.reason).not.toBe("wrong-password");
      expect(err.reason).not.toBe("corrupt-file");
      // And the UI copy the user actually sees is the re-save instruction.
      expect(
        statementFileErrorMessage(
          new StatementFileError("unsupported-encryption"),
          dictionary,
        ),
      ).toBe(dictionary.rekonsiliasi.protectedErrorUnsupportedEncryption);
    });
  });

  it("refuses a non-AES cipher inside an otherwise agile descriptor", async () => {
    // A well-formed 4.4 header whose `cipherAlgorithm` is something we do not
    // implement must still be unsupported, not "corrupt".
    const encrypted = buildEncryptedWorkbook(fakeWorkbook(), PASSWORD, 200, {
      cipherAlgorithm: "RC2",
    });
    await expect(
      decryptOoxml(encrypted, PASSWORD, 20 * 1024 * 1024),
    ).rejects.toMatchObject({ reason: "unsupported-encryption" });
  });

  it("refuses an absurd spinCount instead of hanging the tab on it", async () => {
    const encrypted = buildEncryptedWorkbook(fakeWorkbook(), PASSWORD, 200, {
      spinCountOverride: 50_000_000,
    });
    await expect(
      decryptOoxml(encrypted, PASSWORD, 20 * 1024 * 1024),
    ).rejects.toMatchObject({ reason: "unsupported-encryption" });
  });

  /**
   * The verifier is the ONE check that decides whether a password was right,
   * so a descriptor must not be able to disable it. `hashSize` used to be
   * taken raw: `Number("x")` is `NaN`, `Math.min(NaN, n)` is `NaN`, and
   * `subarray(0, NaN)` is `subarray(0, 0)` — so both sides of the comparison
   * became empty, compared equal, and ANY password "opened" the file. These
   * tests fail if that validation is removed.
   */
  describe("a descriptor cannot switch the password check off", () => {
    const nonNumericHashSizes = ["x", "", "NaN", "1e1x", "-64"];

    it.each(nonNumericHashSizes)(
      "refuses hashSize=%p as a corrupt file",
      async (hashSizeOverride) => {
        const encrypted = buildEncryptedWorkbook(
          fakeWorkbook(),
          PASSWORD,
          200,
          {
            hashSizeOverride,
          },
        );
        await expect(
          decryptOoxml(encrypted, PASSWORD, 20 * 1024 * 1024),
        ).rejects.toMatchObject({ reason: "corrupt-file" });
      },
    );

    it.each(nonNumericHashSizes)(
      "never accepts a WRONG password when hashSize=%p",
      async (hashSizeOverride) => {
        const encrypted = buildEncryptedWorkbook(
          fakeWorkbook(),
          PASSWORD,
          200,
          {
            hashSizeOverride,
          },
        );
        const result = await decryptOoxml(
          encrypted,
          "000000000000",
          20 * 1024 * 1024,
        ).then(
          (bytes) => ({ opened: true, bytes }),
          (err: OoxmlDecryptError) => ({ opened: false, reason: err.reason }),
        );
        // The assertion that matters: garbage MUST NOT decrypt "successfully".
        expect(result.opened).toBe(false);
      },
    );

    it("refuses a hashSize that does not match the declared hash algorithm", async () => {
      // 32 is a real, plausible number — the SHA-256 digest length — but the
      // descriptor says SHA512, so a 32-byte comparison would be a weakened
      // check rather than the spec's full one.
      const encrypted = buildEncryptedWorkbook(fakeWorkbook(), PASSWORD, 200, {
        hashSizeOverride: "32",
      });
      await expect(
        decryptOoxml(encrypted, PASSWORD, 20 * 1024 * 1024),
      ).rejects.toMatchObject({ reason: "corrupt-file" });
    });

    it("refuses a verifier blob too short to hold the hash it claims", async () => {
      const encrypted = buildEncryptedWorkbook(fakeWorkbook(), PASSWORD, 200, {
        encryptedVerifierHashValueOverride: randomBytes(16).toString("base64"),
      });
      await expect(
        decryptOoxml(encrypted, PASSWORD, 20 * 1024 * 1024),
      ).rejects.toMatchObject({ reason: "corrupt-file" });
    });
  });

  it.each(["x", "0", "8", "17", "1000000"])(
    "refuses a keyData blockSize of %p, which AES cannot have",
    async (blockSizeOverride) => {
      const encrypted = buildEncryptedWorkbook(fakeWorkbook(), PASSWORD, 200, {
        blockSizeOverride,
      });
      await expect(
        decryptOoxml(encrypted, PASSWORD, 20 * 1024 * 1024),
      ).rejects.toMatchObject({ reason: "corrupt-file" });
    },
  );

  it("refuses a salt that is not a CBC initialisation vector's length", async () => {
    const encrypted = buildEncryptedWorkbook(fakeWorkbook(), PASSWORD, 200, {
      passwordSaltOverride: randomBytes(8).toString("base64"),
    });
    await expect(
      decryptOoxml(encrypted, PASSWORD, 20 * 1024 * 1024),
    ).rejects.toMatchObject({ reason: "corrupt-file" });
  });

  it("reports malformed base64 as a corrupt file, not as somebody else's exception", async () => {
    const encrypted = buildEncryptedWorkbook(fakeWorkbook(), PASSWORD, 200, {
      passwordSaltOverride: "!!!not base64!!!",
    });
    const err = (await decryptOoxml(
      encrypted,
      PASSWORD,
      20 * 1024 * 1024,
    ).catch((e: unknown) => e)) as OoxmlDecryptError;
    // `atob` throws a DOMException; letting it escape would put an error
    // outside this module's closed taxonomy in front of the user.
    expect(err).toBeInstanceOf(OoxmlDecryptError);
    expect(err.reason).toBe("corrupt-file");
  });

  /**
   * `hashSize` gets its own block above because it is the one that can turn
   * the password check off. These are the remaining descriptor sizes that
   * feed a length or an IV: each must be refused as malformed rather than
   * reaching `crypto.subtle` and being diagnosed there by luck.
   */
  describe("other malformed descriptor sizes are refused too", () => {
    it("rejects a blockSize that contradicts the AES the same file declares", async () => {
      const encrypted = buildEncryptedWorkbook(fakeWorkbook(), PASSWORD, 200, {
        blockSizeOverride: "8",
      });
      await expect(
        decryptOoxml(encrypted, PASSWORD, 20 * 1024 * 1024),
      ).rejects.toMatchObject({ reason: "corrupt-file" });
    });

    it("rejects a password salt that is not a usable CBC IV", async () => {
      const encrypted = buildEncryptedWorkbook(fakeWorkbook(), PASSWORD, 200, {
        passwordSaltOverride: Buffer.from("short").toString("base64"),
      });
      await expect(
        decryptOoxml(encrypted, PASSWORD, 20 * 1024 * 1024),
      ).rejects.toMatchObject({ reason: "corrupt-file" });
    });

    it("rejects a verifier blob that is not a whole number of AES blocks", async () => {
      // 20 bytes: CBC output is always block-aligned, so this cannot be
      // ciphertext at all.
      const encrypted = buildEncryptedWorkbook(fakeWorkbook(), PASSWORD, 200, {
        encryptedVerifierHashValueOverride: Buffer.alloc(20).toString("base64"),
      });
      await expect(
        decryptOoxml(encrypted, PASSWORD, 20 * 1024 * 1024),
      ).rejects.toMatchObject({ reason: "corrupt-file" });
    });

    it("rejects an unparseable base64 attribute without leaking a DOM exception", async () => {
      const encrypted = buildEncryptedWorkbook(fakeWorkbook(), PASSWORD, 200, {
        passwordSaltOverride: "!!!not base64!!!",
      });
      const err = await decryptOoxml(
        encrypted,
        PASSWORD,
        20 * 1024 * 1024,
      ).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(OoxmlDecryptError);
      expect((err as OoxmlDecryptError).reason).toBe("corrupt-file");
    });
  });

  /**
   * EPIC-029 group 4 security review (CRITICAL) — the package is plain
   * AES-256-CBC, and `aesCbcDecryptNoPad` can never throw on tampered input,
   * so before `<dataIntegrity>` was checked a bit-flip in the ciphertext
   * produced attacker-chosen plaintext with the REAL password, no error, and
   * a clean upload into the reconciliation ledger.
   *
   * These fixtures are genuinely tampered bytes, not mocks: the point is
   * that the decryptor detects a modification it has no other way to see.
   */
  describe("a tampered package is detected, not silently decrypted", () => {
    /** Flips one bit inside the EncryptedPackage stream of a real fixture. */
    function tamperPackageByte(container: Uint8Array): Uint8Array {
      const pkg = parseCfb(container).read("EncryptedPackage")!;
      const patched = new Uint8Array(container);
      // Skip the 8-byte size header and the first cipher block: flipping a
      // byte in block N is what rewrites plaintext in block N+1.
      const at = indexOfBytes(patched, pkg.subarray(0, 64));
      expect(at).toBeGreaterThan(-1);
      patched[at + 8 + 4] ^= 0x01;
      return patched;
    }

    it("refuses a bit-flipped ciphertext with the RIGHT password", async () => {
      const tampered = tamperPackageByte(
        buildEncryptedWorkbook(fakeWorkbook(), PASSWORD),
      );
      const err = (await decryptOoxml(
        tampered,
        PASSWORD,
        20 * 1024 * 1024,
      ).catch((e: unknown) => e)) as OoxmlDecryptError;

      expect(err).toBeInstanceOf(OoxmlDecryptError);
      expect(err.reason).toBe("integrity-failure");
      // Emphatically NOT these: the password was correct and the container
      // is structurally perfect. Reporting either would send the user off to
      // retype a password or re-download a file for the wrong reason, and
      // would hide a deliberate modification.
      expect(err.reason).not.toBe("wrong-password");
      expect(err.reason).not.toBe("corrupt-file");
    });

    it("returns no plaintext at all when the package was altered", async () => {
      const tampered = tamperPackageByte(
        buildEncryptedWorkbook(fakeWorkbook(), PASSWORD),
      );
      await expect(
        decryptOoxml(tampered, PASSWORD, 20 * 1024 * 1024),
      ).rejects.toBeInstanceOf(OoxmlDecryptError);
    });

    it("detects a swapped-in HMAC value that does not match the package", async () => {
      const encrypted = buildEncryptedWorkbook(fakeWorkbook(), PASSWORD, 200, {
        tamperHmacValue: true,
      });
      await expect(
        decryptOoxml(encrypted, PASSWORD, 20 * 1024 * 1024),
      ).rejects.toMatchObject({ reason: "integrity-failure" });
    });

    it("still reports a WRONG password on a tampered file, rather than blaming the file", async () => {
      // Ordering check: the verifier runs first, so a user who mistyped is
      // told so instead of being told their statement looks altered.
      const tampered = tamperPackageByte(
        buildEncryptedWorkbook(fakeWorkbook(), PASSWORD),
      );
      await expect(
        decryptOoxml(tampered, "081200000000", 20 * 1024 * 1024),
      ).rejects.toMatchObject({ reason: "wrong-password" });
    });

    it("REFUSES a file that carries no dataIntegrity element at all", async () => {
      // The deliberate decision recorded on `verifyDataIntegrity`: accepting
      // when the element is absent would be a bypass, not a fallback, since
      // anyone who can alter the package can also delete one XML element.
      const encrypted = buildEncryptedWorkbook(fakeWorkbook(), PASSWORD, 200, {
        omitDataIntegrity: true,
      });
      const err = (await decryptOoxml(
        encrypted,
        PASSWORD,
        20 * 1024 * 1024,
      ).catch((e: unknown) => e)) as OoxmlDecryptError;
      expect(err.reason).toBe("integrity-missing");
      // Distinct from a real tamper, so a genuine report from a bank whose
      // generator omits it is distinguishable from an attack.
      expect(err.reason).not.toBe("integrity-failure");
    });

    it("gives the two integrity reasons different user-facing messages", () => {
      const failure = statementFileErrorMessage(
        new StatementFileError("integrity-failure"),
        dictionary,
      );
      const missing = statementFileErrorMessage(
        new StatementFileError("integrity-missing"),
        dictionary,
      );
      expect(failure).not.toBe(missing);
      expect(failure).not.toBe(
        dictionary.rekonsiliasi.protectedErrorCorruptFile,
      );
      expect(missing).not.toBe(
        dictionary.rekonsiliasi.protectedErrorWrongPassword,
      );
    });
  });

  it("refuses a compound file that is not an encrypted workbook at all", async () => {
    const legacyXls = buildCfb([
      { name: "Workbook", data: new Uint8Array(5000).fill(7) },
    ]);
    await expect(
      decryptOoxml(legacyXls, PASSWORD, 20 * 1024 * 1024),
    ).rejects.toMatchObject({ reason: "unsupported-encryption" });
  });

  it("refuses a structurally broken container as corrupt, not as a bad password", async () => {
    const encrypted = buildEncryptedWorkbook(fakeWorkbook(), PASSWORD);
    const truncated = encrypted.subarray(0, 2048);
    await expect(
      decryptOoxml(truncated, PASSWORD, 20 * 1024 * 1024),
    ).rejects.toMatchObject({ reason: "corrupt-file" });
  });
});

function indexOfBytes(haystack: Uint8Array, needle: Uint8Array): number {
  outer: for (let i = 0; i + needle.length <= haystack.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}
