/**
 * EPIC-029 group 4 (E4b/E8) — decrypts a password-protected `.xlsx` IN THE
 * BROWSER, using WebCrypto only, so the plaintext workbook can be uploaded
 * to the existing (unchanged) server parser and the password never leaves
 * the tab.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Why this is hand-written instead of a package
 * ─────────────────────────────────────────────────────────────────────────
 *
 * The epic named `office-crypto` ("zero runtime dependencies"). That is true
 * of its package.json and false of its runtime: `dist/index.js` does
 * `import { createHash, createHmac, createCipheriv, createDecipheriv,
 * createPrivateKey, privateDecrypt } from "crypto"` — Node's builtin, used
 * synchronously, with no `browser` field and no browser build.
 * `officecrypto-tool` has the same hard `require("crypto")` plus `cfb`,
 * `crypto-js` and `xml2js`. Running either in a browser means bundling
 * `crypto-browserify`, whose transitive tree is precisely the thing E8's
 * reasoning (and this repo's already-red advisory list) says not to grow.
 *
 * Everything ECMA-376 "agile" encryption needs — SHA-512 and AES-256-CBC —
 * is in `crypto.subtle`, natively, in every browser this app supports. So
 * the format is implemented against the spec instead of shipping a Node
 * library and a polyfill tree.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Scope, stated honestly
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Only **agile** encryption (EncryptionInfo 4.4, [MS-OFFCRYPTO] 2.3.4.10-15)
 * is implemented. That is what Excel 2010 and every version since produces
 * by default. The older "standard" scheme (EncryptionInfo 2.2/3.2/4.2) uses
 * AES in **ECB** mode, which WebCrypto deliberately does not expose, and RC4
 * schemes older still. Those are DETECTED and refused with their own reason
 * (`unsupported-encryption`) telling the user to re-save the file from
 * Excel — never mis-reported as a corrupt file or a wrong password.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Password handling (E10)
 * ─────────────────────────────────────────────────────────────────────────
 *
 * The password is a parameter and a few short-lived `Uint8Array`s. It is
 * never returned, never stored, never logged, and never interpolated into an
 * error message — every failure here is a bare reason code. The one place it
 * could leak, an exception's `message`, is why `OoxmlDecryptError` carries a
 * fixed string per reason and nothing else.
 */

import { parseCfb, CfbParseError } from "./statement-cfb";

export type OoxmlDecryptFailure =
  /** The container is readable but the scheme is not agile encryption. */
  | "unsupported-encryption"
  /** Key derivation succeeded but the verifier did not match. */
  | "wrong-password"
  /** The container or its encryption descriptor is unreadable. */
  | "corrupt-file"
  /** The declared plaintext size exceeds the caller's budget. */
  | "too-large"
  /**
   * The password was right, but the package does not match the HMAC the file
   * carries over it: the ciphertext was altered after the bank produced it.
   */
  | "integrity-failure"
  /**
   * The file carries no `<dataIntegrity>` element at all, so there is nothing
   * to check the package against. Refused deliberately — see the note on
   * `verifyDataIntegrity`.
   */
  | "integrity-missing";

export class OoxmlDecryptError extends Error {
  constructor(readonly reason: OoxmlDecryptFailure) {
    // Deliberately reason-only: no password, no filename, no byte offsets.
    super(`ooxml decrypt failed: ${reason}`);
    this.name = "OoxmlDecryptError";
  }
}

const ENCRYPTION_INFO_STREAM = "EncryptionInfo";
const ENCRYPTED_PACKAGE_STREAM = "EncryptedPackage";

/** [MS-OFFCRYPTO] 2.3.4.12 — the three fixed block keys. */
const BLOCK_KEY_VERIFIER_INPUT = new Uint8Array([
  0xfe, 0xa7, 0xd2, 0x76, 0x3b, 0x4b, 0x9e, 0x79,
]);
const BLOCK_KEY_VERIFIER_VALUE = new Uint8Array([
  0xd7, 0xaa, 0x0f, 0x6d, 0x30, 0x61, 0x34, 0x4e,
]);
const BLOCK_KEY_SECRET_KEY = new Uint8Array([
  0x14, 0x6e, 0x0b, 0xe7, 0xab, 0xac, 0xd0, 0xd6,
]);

/** [MS-OFFCRYPTO] 2.3.4.14 — the two `<dataIntegrity>` block keys. */
const BLOCK_KEY_HMAC_KEY = new Uint8Array([
  0x5f, 0xb2, 0xad, 0x01, 0x0c, 0xb9, 0xe1, 0xf6,
]);
const BLOCK_KEY_HMAC_VALUE = new Uint8Array([
  0xa0, 0x67, 0x7f, 0x02, 0xb2, 0x2c, 0x84, 0x33,
]);

/** Each encrypted segment of the package is exactly this many plaintext bytes. */
const SEGMENT_SIZE = 4096;

/**
 * A hard ceiling on `spinCount`.
 *
 * EPIC-029 group 4 security review (HIGH) — this was 1 000 000, ten times
 * what Office actually writes, and `iterateHash` awaits `crypto.subtle`
 * sequentially, so a crafted file could freeze the tab for many seconds
 * before the user even learned whether the password was right. 200 000 keeps
 * headroom over Office's 100 000 (some third-party writers use more) while
 * capping the wait at roughly twice a normal file's.
 */
const MAX_SPIN_COUNT = 200_000;

/**
 * How many derivation iterations run before the loop yields to the event
 * loop. The derivation is inherently serial — each hash consumes the last —
 * so it cannot be made parallel, but it can stop monopolising the main
 * thread. At Office's 100 000 this is ~25 yields, which is imperceptible
 * next to the hashing itself and keeps the tab (and its "Membuka file…"
 * state) responsive throughout.
 */
const SPIN_YIELD_INTERVAL = 4096;

/** AES has one block size, and `crypto.subtle` accepts one CBC IV length. */
const AES_BLOCK_SIZE = 16;

/** Digest lengths in bytes, used to validate the descriptor's `hashSize`. */
const HASH_SIZES: Record<HashName, number> = {
  "SHA-1": 20,
  "SHA-256": 32,
  "SHA-384": 48,
  "SHA-512": 64,
};

type AgileDescriptor = {
  keySalt: Uint8Array;
  keyBits: number;
  keyBlockSize: number;
  keyHash: HashName;
  /** Digest length of `keyHash`, used to size the HMAC key and value. */
  keyHashSize: number;
  /**
   * `null` when the file carries no `<dataIntegrity>` element. Kept as an
   * explicit absence rather than a default so the decision about what to do
   * about it lives in one commented place.
   */
  dataIntegrity: {
    encryptedHmacKey: Uint8Array;
    encryptedHmacValue: Uint8Array;
  } | null;
  spinCount: number;
  passwordSalt: Uint8Array;
  passwordKeyBits: number;
  passwordHash: HashName;
  hashSize: number;
  encryptedVerifierHashInput: Uint8Array;
  encryptedVerifierHashValue: Uint8Array;
  encryptedKeyValue: Uint8Array;
};

type HashName = "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512";

const HASH_NAMES: Record<string, HashName> = {
  SHA1: "SHA-1",
  "SHA-1": "SHA-1",
  SHA256: "SHA-256",
  "SHA-256": "SHA-256",
  SHA384: "SHA-384",
  "SHA-384": "SHA-384",
  SHA512: "SHA-512",
  "SHA-512": "SHA-512",
};

function concat(...parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/**
 * Base64 out of the descriptor XML, which is untrusted: `atob` throws a
 * DOMException on malformed input, and letting that escape would put an error
 * this module does not own — and whose message it cannot vouch for — outside
 * the closed `OoxmlDecryptFailure` taxonomy. A bad blob is a broken file.
 */
function fromBase64(value: string): Uint8Array {
  let binary: string;
  try {
    binary = atob(value);
  } catch {
    throw new OoxmlDecryptError("corrupt-file");
  }
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function le32(value: number): Uint8Array {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value, true);
  return out;
}

/** UTF-16LE, which is what [MS-OFFCRYPTO] hashes — not UTF-8. */
function utf16le(text: string): Uint8Array {
  const out = new Uint8Array(text.length * 2);
  const view = new DataView(out.buffer);
  for (let i = 0; i < text.length; i++) {
    view.setUint16(i * 2, text.charCodeAt(i), true);
  }
  return out;
}

function requireAttribute(el: Element, name: string): string {
  const value = el.getAttribute(name);
  if (value === null) throw new OoxmlDecryptError("corrupt-file");
  return value;
}

/**
 * Reads a numeric attribute and refuses anything that is not a whole number
 * inside `[min, max]`.
 *
 * This exists because `Number("x")` is `NaN` and NaN then propagates
 * silently: `Math.min(NaN, n)` is `NaN`, and `TypedArray#subarray(0, NaN)`
 * coerces to `subarray(0, 0)`. An unvalidated size attribute can therefore
 * shrink a comparison to zero bytes and make it succeed vacuously — which is
 * precisely how a bogus `hashSize` used to let ANY password through the
 * verifier below. Every size taken from the descriptor goes through here.
 */
function requireNumericAttribute(
  el: Element,
  name: string,
  min: number,
  max: number,
): number {
  const value = Number(requireAttribute(el, name));
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new OoxmlDecryptError("corrupt-file");
  }
  return value;
}

/**
 * A ciphertext blob from the descriptor. AES-CBC only produces whole blocks,
 * and each blob has a minimum useful size (a hash, or a key), so a blob that
 * fails either test is a malformed descriptor — not a wrong password, and not
 * something to hand to `crypto.subtle` and hope it objects.
 */
function requireCipherBlob(bytes: Uint8Array, minLength: number): Uint8Array {
  if (
    bytes.length === 0 ||
    bytes.length % AES_BLOCK_SIZE !== 0 ||
    bytes.length < minLength
  ) {
    throw new OoxmlDecryptError("corrupt-file");
  }
  return bytes;
}

function hashNameOf(raw: string): HashName {
  const name = HASH_NAMES[raw.toUpperCase()];
  if (!name) throw new OoxmlDecryptError("unsupported-encryption");
  return name;
}

/**
 * Reads the version words at the head of `EncryptionInfo` and returns the
 * agile XML descriptor, or throws `unsupported-encryption` for the standard
 * / extensible / RC4 schemes. Version detection happens BEFORE any password
 * work, so an unsupported file never prompts for a secret it cannot use.
 */
function parseEncryptionInfo(info: Uint8Array): AgileDescriptor {
  if (info.length < 8) throw new OoxmlDecryptError("corrupt-file");
  const view = new DataView(info.buffer, info.byteOffset, info.byteLength);
  const major = view.getUint16(0, true);
  const minor = view.getUint16(2, true);
  if (major !== 4 || minor !== 4) {
    throw new OoxmlDecryptError("unsupported-encryption");
  }

  const xml = new TextDecoder().decode(info.subarray(8));
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) {
    throw new OoxmlDecryptError("corrupt-file");
  }

  // `getElementsByTagName` is namespace-blind on the local name only when the
  // document has no prefixes, and the password key encryptor is `p:`-prefixed
  // in every file Office writes — so match on the local name explicitly.
  const localName = (el: Element, name: string) =>
    el.localName === name || el.nodeName.endsWith(`:${name}`);
  const all = Array.from(doc.getElementsByTagName("*"));
  const keyData = all.find((el) => localName(el, "keyData"));
  const encryptedKey = all.find((el) => localName(el, "encryptedKey"));
  if (!keyData || !encryptedKey) throw new OoxmlDecryptError("corrupt-file");

  // Optional in the schema, and REQUIRED by us — see `verifyDataIntegrity`
  // for why a missing element is refused rather than tolerated.
  const dataIntegrity =
    all.find((el) => localName(el, "dataIntegrity")) ?? null;

  return agileDescriptorFrom(keyData, encryptedKey, dataIntegrity);
}

/**
 * Turns the two descriptor elements into a validated `AgileDescriptor`.
 *
 * Everything here comes out of an untrusted XML document, so everything is
 * checked before it is used — the sizes especially. See the note on
 * `requireNumericAttribute` for why an unchecked size is not a cosmetic
 * problem in a decryptor.
 */
function agileDescriptorFrom(
  keyData: Element,
  encryptedKey: Element,
  dataIntegrityEl: Element | null,
): AgileDescriptor {
  if (
    requireAttribute(keyData, "cipherAlgorithm") !== "AES" ||
    requireAttribute(keyData, "cipherChaining") !== "ChainingModeCBC" ||
    requireAttribute(encryptedKey, "cipherAlgorithm") !== "AES" ||
    requireAttribute(encryptedKey, "cipherChaining") !== "ChainingModeCBC"
  ) {
    throw new OoxmlDecryptError("unsupported-encryption");
  }

  const spinCount = requireNumericAttribute(
    encryptedKey,
    "spinCount",
    0,
    Number.MAX_SAFE_INTEGER,
  );
  if (spinCount > MAX_SPIN_COUNT) {
    throw new OoxmlDecryptError("unsupported-encryption");
  }

  // EPIC-029 group 4 review (MEDIUM) — these two used bare `Number(...)`.
  // The `[128,192,256]` allow-list below did reject `NaN`, so it was not
  // exploitable, but it left the file stating one invariant ("every size from
  // the descriptor goes through `requireNumericAttribute`") and practising
  // another. A later "simplification" to a range check would have
  // reintroduced the NaN hazard silently.
  const keyBits = requireNumericAttribute(keyData, "keyBits", 1, 4096);
  const passwordKeyBits = requireNumericAttribute(
    encryptedKey,
    "keyBits",
    1,
    4096,
  );
  if (
    ![128, 192, 256].includes(keyBits) ||
    ![128, 192, 256].includes(passwordKeyBits)
  ) {
    // A well-formed integer that names an AES key length we do not implement
    // is unsupported, not corrupt.
    throw new OoxmlDecryptError("unsupported-encryption");
  }

  // The descriptor has already declared AES, and AES has exactly one block
  // size. A `blockSize` that says otherwise contradicts its own file, so it
  // is malformed rather than merely unsupported — and it must not be allowed
  // to reach `crypto.subtle` as a wrong-length IV and be diagnosed there by
  // luck.
  const keyBlockSize = requireNumericAttribute(
    keyData,
    "blockSize",
    AES_BLOCK_SIZE,
    AES_BLOCK_SIZE,
  );

  const passwordHash = hashNameOf(
    requireAttribute(encryptedKey, "hashAlgorithm"),
  );
  // [MS-OFFCRYPTO] 2.3.4.10: `hashSize` is the size of the named hash's
  // output. Pinning it to that exact value is what keeps the verifier's
  // comparison full-length; see the note on `requireNumericAttribute`.
  const hashSize = requireNumericAttribute(
    encryptedKey,
    "hashSize",
    HASH_SIZES[passwordHash],
    HASH_SIZES[passwordHash],
  );

  // The password salt is used verbatim as the CBC IV for the verifier and
  // key blobs, so its length is a size that matters just as much as the
  // declared ones.
  const passwordSalt = fromBase64(requireAttribute(encryptedKey, "saltValue"));
  if (passwordSalt.length !== AES_BLOCK_SIZE) {
    throw new OoxmlDecryptError("corrupt-file");
  }
  const keySalt = fromBase64(requireAttribute(keyData, "saltValue"));
  if (keySalt.length === 0) throw new OoxmlDecryptError("corrupt-file");

  const keyHash = hashNameOf(requireAttribute(keyData, "hashAlgorithm"));
  // Same pinning as the password half: `keyHashSize` sizes the HMAC key and
  // the expected HMAC value, so a shrunken value would shorten the integrity
  // comparison exactly as a shrunken `hashSize` shortened the verifier's.
  const keyHashSize = requireNumericAttribute(
    keyData,
    "hashSize",
    HASH_SIZES[keyHash],
    HASH_SIZES[keyHash],
  );

  const dataIntegrity = dataIntegrityEl
    ? {
        encryptedHmacKey: requireCipherBlob(
          fromBase64(requireAttribute(dataIntegrityEl, "encryptedHmacKey")),
          keyHashSize,
        ),
        encryptedHmacValue: requireCipherBlob(
          fromBase64(requireAttribute(dataIntegrityEl, "encryptedHmacValue")),
          keyHashSize,
        ),
      }
    : null;

  return {
    keySalt,
    keyBits,
    keyBlockSize,
    keyHash,
    keyHashSize,
    dataIntegrity,
    spinCount,
    passwordSalt,
    passwordKeyBits,
    passwordHash,
    hashSize,
    // Long enough to hold what each is supposed to hold: a hash's worth of
    // verifier, and the whole secret key.
    encryptedVerifierHashInput: requireCipherBlob(
      fromBase64(requireAttribute(encryptedKey, "encryptedVerifierHashInput")),
      AES_BLOCK_SIZE,
    ),
    encryptedVerifierHashValue: requireCipherBlob(
      fromBase64(requireAttribute(encryptedKey, "encryptedVerifierHashValue")),
      hashSize,
    ),
    encryptedKeyValue: requireCipherBlob(
      fromBase64(requireAttribute(encryptedKey, "encryptedKeyValue")),
      keyBits / 8,
    ),
  };
}

function subtle(): SubtleCrypto {
  const api = globalThis.crypto?.subtle;
  if (!api) throw new OoxmlDecryptError("unsupported-encryption");
  return api;
}

async function digest(name: HashName, data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await subtle().digest(name, data as BufferSource));
}

/**
 * AES-CBC with NO padding, which is what Office uses and what WebCrypto does
 * not offer.
 *
 * The trick: `subtle.decrypt` insists the last block is PKCS#7 padding and
 * strips it. So we manufacture one — a block that decrypts to a full 16
 * bytes of `0x10` — by encrypting the empty message with the last ciphertext
 * block as the IV, and append it. The final `decrypt` then yields exactly
 * the original plaintext with the manufactured block consumed as padding.
 */
async function aesCbcDecryptNoPad(
  key: CryptoKey,
  iv: Uint8Array,
  ciphertext: Uint8Array,
): Promise<Uint8Array> {
  if (ciphertext.length === 0) return new Uint8Array(0);
  if (ciphertext.length % 16 !== 0) {
    throw new OoxmlDecryptError("corrupt-file");
  }
  const lastBlock = ciphertext.subarray(ciphertext.length - 16);
  const padBlock = new Uint8Array(
    await subtle().encrypt(
      { name: "AES-CBC", iv: lastBlock as BufferSource },
      key,
      new Uint8Array(0),
    ),
  );
  const plain = new Uint8Array(
    await subtle().decrypt(
      { name: "AES-CBC", iv: iv as BufferSource },
      key,
      concat(ciphertext, padBlock) as BufferSource,
    ),
  );
  return plain.subarray(0, ciphertext.length);
}

async function importAesKey(raw: Uint8Array): Promise<CryptoKey> {
  return subtle().importKey("raw", raw as BufferSource, "AES-CBC", false, [
    "encrypt",
    "decrypt",
  ]);
}

/**
 * [MS-OFFCRYPTO] 2.3.4.11 — H0 = H(salt ‖ passwordUTF16LE), then
 * Hn = H(LE32(i) ‖ Hn-1) for `spinCount` iterations, then
 * key = H(Hn ‖ blockKey) truncated (or zero-padded) to the key length.
 */
async function deriveKey(
  descriptor: AgileDescriptor,
  blockKey: Uint8Array,
  iterated: Uint8Array,
): Promise<CryptoKey> {
  const keyBytes = descriptor.passwordKeyBits / 8;
  const combined = await digest(
    descriptor.passwordHash,
    concat(iterated, blockKey),
  );
  const raw = new Uint8Array(keyBytes).fill(0x36);
  raw.set(combined.subarray(0, Math.min(keyBytes, combined.length)));
  return importAesKey(raw);
}

/** The expensive half of the derivation, run once and reused for all three block keys. */
async function iterateHash(
  descriptor: AgileDescriptor,
  password: string,
): Promise<Uint8Array> {
  let h = await digest(
    descriptor.passwordHash,
    concat(descriptor.passwordSalt, utf16le(password)),
  );
  for (let i = 0; i < descriptor.spinCount; i++) {
    h = await digest(descriptor.passwordHash, concat(le32(i), h));
    if (i > 0 && i % SPIN_YIELD_INTERVAL === 0) {
      // `await`ing `subtle.digest` alone does NOT return to the task queue on
      // every engine — the promise can resolve in a microtask, which starves
      // rendering and input for the whole derivation. A real macrotask does.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }
  return h;
}

/**
 * Compares two byte strings without an early exit.
 *
 * Every caller pins the two lengths equal beforehand and this runs in the
 * user's own tab with no remote timing channel, so the previous
 * short-circuit was theoretical — but folding the length into the same
 * accumulator costs one XOR, so there is no reason to keep the shape that
 * has to be argued about.
 */
function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  let diff = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

/**
 * [MS-OFFCRYPTO] 2.3.4.14 — verifies the package against the HMAC the file
 * carries over it, and throws if it does not match.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * EPIC-029 group 4 security review (CRITICAL) — why this is not optional
 * ─────────────────────────────────────────────────────────────────────────
 *
 * The password verifier proves the KEY is right. It says nothing about
 * whether the package was modified afterwards, and the segments are plain
 * AES-256-CBC with no authentication: `aesCbcDecryptNoPad` can never throw on
 * tampered input, because the padding block it appends is valid by
 * construction regardless of what precedes it.
 *
 * That makes textbook CBC bit-flipping available to anyone who can alter the
 * file between the bank and the upload — a MITM on a downgraded portal, a
 * compromised mail or file-share hop, any local process with write access
 * before the user picks it. Flipping bytes in ciphertext block N flips the
 * corresponding plaintext bytes in block N+1 deterministically, no key
 * needed, and the ZIP/XML boilerplate around a spreadsheet's numeric cells is
 * very guessable. The real password would still unlock the file, no error
 * would surface anywhere, and altered transaction amounts would be uploaded
 * and parsed into the reconciliation ledger as pristine.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * The deliberate decision about a MISSING `<dataIntegrity>`
 * ─────────────────────────────────────────────────────────────────────────
 *
 * A file that simply omits the element is REFUSED (`integrity-missing`),
 * not accepted. Accepting-when-absent would preserve compatibility while
 * leaving the hole wide open: an attacker who can alter the package can also
 * delete one XML element, so a lenient path is not a fallback, it is a
 * bypass. Excel has written `<dataIntegrity>` for agile encryption since
 * 2010, so the expected real-world cost is zero — and `integrity-missing` is
 * kept DISTINCT from `integrity-failure` precisely so that if some bank's
 * generator does omit it, we find out from a specific report rather than
 * from a silent tamper.
 */
async function verifyDataIntegrity(
  descriptor: AgileDescriptor,
  secretKey: CryptoKey,
  encryptedPackage: Uint8Array,
): Promise<void> {
  if (!descriptor.dataIntegrity) {
    throw new OoxmlDecryptError("integrity-missing");
  }

  const ivFor = async (blockKey: Uint8Array) =>
    (
      await digest(descriptor.keyHash, concat(descriptor.keySalt, blockKey))
    ).subarray(0, descriptor.keyBlockSize);

  const hmacKeyRaw = (
    await aesCbcDecryptNoPad(
      secretKey,
      await ivFor(BLOCK_KEY_HMAC_KEY),
      descriptor.dataIntegrity.encryptedHmacKey,
    )
  ).subarray(0, descriptor.keyHashSize);
  const expected = (
    await aesCbcDecryptNoPad(
      secretKey,
      await ivFor(BLOCK_KEY_HMAC_VALUE),
      descriptor.dataIntegrity.encryptedHmacValue,
    )
  ).subarray(0, descriptor.keyHashSize);

  const hmacKey = await subtle().importKey(
    "raw",
    hmacKeyRaw as BufferSource,
    { name: "HMAC", hash: descriptor.keyHash },
    false,
    ["sign"],
  );
  // Over the WHOLE `EncryptedPackage` stream, including its 8-byte declared
  // length header — that header is attacker-controlled too, and covering it
  // is what stops a truncation being passed off as a shorter workbook.
  const actual = new Uint8Array(
    await subtle().sign("HMAC", hmacKey, encryptedPackage as BufferSource),
  );

  if (!bytesEqual(actual.subarray(0, descriptor.keyHashSize), expected)) {
    throw new OoxmlDecryptError("integrity-failure");
  }
}

/**
 * Decrypts an encrypted OOXML workbook and returns the plaintext `.xlsx`
 * bytes (a normal ZIP starting `PK\x03\x04`).
 *
 * `maxPlaintextBytes` bounds the declared package size BEFORE the output
 * buffer is allocated — the header's 64-bit length field is attacker
 * controlled, so allocating it first would be the bomb this guards against.
 */
export async function decryptOoxml(
  bytes: Uint8Array,
  password: string,
  maxPlaintextBytes: number,
): Promise<Uint8Array> {
  let info: Uint8Array | null;
  let pkg: Uint8Array | null;
  try {
    const cfb = parseCfb(bytes);
    info = cfb.read(ENCRYPTION_INFO_STREAM);
    pkg = cfb.read(ENCRYPTED_PACKAGE_STREAM);
  } catch (err) {
    if (err instanceof CfbParseError)
      throw new OoxmlDecryptError("corrupt-file");
    throw err;
  }
  if (!info || !pkg) {
    // A compound file without these two streams is a legacy `.xls`/`.doc`,
    // not an encrypted workbook — a different problem with a different fix.
    throw new OoxmlDecryptError("unsupported-encryption");
  }

  const descriptor = parseEncryptionInfo(info);
  const iterated = await iterateHash(descriptor, password);

  const verifierInputKey = await deriveKey(
    descriptor,
    BLOCK_KEY_VERIFIER_INPUT,
    iterated,
  );
  const verifierValueKey = await deriveKey(
    descriptor,
    BLOCK_KEY_VERIFIER_VALUE,
    iterated,
  );
  const verifierInput = await aesCbcDecryptNoPad(
    verifierInputKey,
    descriptor.passwordSalt,
    descriptor.encryptedVerifierHashInput,
  );
  const verifierValue = await aesCbcDecryptNoPad(
    verifierValueKey,
    descriptor.passwordSalt,
    descriptor.encryptedVerifierHashValue,
  );
  const expected = await digest(descriptor.passwordHash, verifierInput);
  // `hashSize` is pinned to the declared hash's digest length and both blobs
  // are known to be at least that long, so `size` is a real, non-zero number
  // of bytes. It must never be able to collapse to 0: two empty arrays
  // compare equal, which would let every password through this gate.
  const size = descriptor.hashSize;
  if (
    !bytesEqual(expected.subarray(0, size), verifierValue.subarray(0, size))
  ) {
    // THE distinction this whole group turns on: a password that does not
    // match is its own answer, retryable, and never "file rusak".
    throw new OoxmlDecryptError("wrong-password");
  }

  const secretKeyKey = await deriveKey(
    descriptor,
    BLOCK_KEY_SECRET_KEY,
    iterated,
  );
  const secretRaw = (
    await aesCbcDecryptNoPad(
      secretKeyKey,
      descriptor.passwordSalt,
      descriptor.encryptedKeyValue,
    )
  ).subarray(0, descriptor.keyBits / 8);
  const secretKey = await importAesKey(secretRaw);

  if (pkg.length < 8) throw new OoxmlDecryptError("corrupt-file");
  const pkgView = new DataView(pkg.buffer, pkg.byteOffset, pkg.byteLength);
  const declaredLow = pkgView.getUint32(0, true);
  const declaredHigh = pkgView.getUint32(4, true);
  if (declaredHigh !== 0 || declaredLow > maxPlaintextBytes) {
    throw new OoxmlDecryptError("too-large");
  }
  const cipher = pkg.subarray(8);
  // The declared length can also LIE downward-friendly: it must not exceed
  // what is actually present, or the truncation below would read past the
  // decrypted bytes.
  if (declaredLow > cipher.length) throw new OoxmlDecryptError("corrupt-file");

  // AFTER the password verifier, BEFORE any plaintext is produced or
  // returned. The ordering matters both ways: a user who mistyped their
  // password must be told that, not that their file looks altered; and a
  // package that fails this check must never reach the caller at all.
  await verifyDataIntegrity(descriptor, secretKey, pkg);

  return decryptSegments(descriptor, secretKey, cipher, declaredLow);
}

/**
 * How many segments may be in flight at once.
 *
 * Every segment's IV comes from `keySalt` and the segment INDEX alone — no
 * segment depends on another's plaintext — so they are genuinely independent
 * and the loop below writes each result at its own fixed offset rather than
 * appending. A 20 MB workbook is ~5000 segments, and doing them strictly one
 * after another is ~10 000 serialised `crypto.subtle` round trips. The cap
 * keeps that from becoming thousands of simultaneous operations instead,
 * which is its own way to make a big file behave badly.
 */
const MAX_CONCURRENT_SEGMENTS = 8;

/** [MS-OFFCRYPTO] 2.3.4.15 — the package is AES-CBC over 4096-byte segments. */
async function decryptSegments(
  descriptor: AgileDescriptor,
  secretKey: CryptoKey,
  cipher: Uint8Array,
  plaintextLength: number,
): Promise<Uint8Array> {
  const out = new Uint8Array(plaintextLength);
  const segmentCount = Math.ceil(cipher.length / SEGMENT_SIZE);
  let written = 0;
  let next = 0;

  const worker = async (): Promise<void> => {
    for (let segment = next++; segment < segmentCount; segment = next++) {
      const offset = segment * SEGMENT_SIZE;
      const take = Math.min(SEGMENT_SIZE, out.length - offset);
      if (take <= 0) continue;
      const chunk = cipher.subarray(offset, offset + SEGMENT_SIZE);
      const iv = (
        await digest(
          descriptor.keyHash,
          concat(descriptor.keySalt, le32(segment)),
        )
      ).subarray(0, descriptor.keyBlockSize);
      const plain = await aesCbcDecryptNoPad(secretKey, iv, chunk);
      const copied = Math.min(plain.length, take);
      out.set(plain.subarray(0, copied), offset);
      written += copied;
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(MAX_CONCURRENT_SEGMENTS, segmentCount) },
      worker,
    ),
  );
  if (written < out.length) throw new OoxmlDecryptError("corrupt-file");
  return out;
}
