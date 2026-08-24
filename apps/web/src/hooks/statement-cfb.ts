/**
 * EPIC-029 group 4 (E4b) — a minimal reader for the OLE/CFB compound-file
 * container that an ENCRYPTED `.xlsx` is wrapped in.
 *
 * Why this exists at all, rather than a package: every published Office
 * decryptor (`office-crypto`, `officecrypto-tool`) imports Node's `crypto`
 * synchronously and has no browser build. Using one in the browser means
 * pulling in `crypto-browserify`'s ~15-package tree, which is exactly the
 * dependency growth E8's threat model was trying to avoid. The container
 * format is a fixed, well-specified structure ([MS-CFB]) and we only need
 * two named streams out of it, so it is read here instead.
 *
 * Scope is deliberately the smallest thing that works:
 *   - read the header, the FAT, the mini-FAT and the directory
 *   - walk the directory linearly (no red-black tree traversal — the tree is
 *     an index, and every entry is present in the chain regardless)
 *   - return a named stream's bytes
 *
 * Nothing is written, nothing is mutated, and no length is trusted: every
 * chain walk is bounded by the number of sectors that actually exist, so a
 * malformed or hostile file loops a bounded number of times and then fails,
 * rather than spinning forever on a self-referencing FAT entry.
 */

/** `D0 CF 11 E0 A1 B1 1A E1` — the compound-file magic. */
export const CFB_SIGNATURE = [
  0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
] as const;

/**
 * An absolute ceiling on any single stream this reader will materialise.
 *
 * EPIC-029 group 4 security review (CRITICAL) — `concatSectors` used to
 * allocate `new Uint8Array(streamSize)` from the DIRECTORY'S declared size
 * before walking the chain that has to fill it. `readDirectoryEntries` only
 * rejected a non-zero HIGH word, so the low word admitted `0xFFFFFFFE` —
 * ~4.29 GB — from a ~2 KB file. The allocation really was attempted (and
 * briefly held) before the after-the-fact "written < length" check could
 * fire, which on mobile Safari is a hung or killed tab.
 *
 * Worse, `parseCfb` runs inside `decryptOoxml` BEFORE any password work, so
 * merely PICKING a crafted file was enough. Two independent bounds now apply
 * before a byte is allocated: the chain must actually be long enough, and
 * the declared size must fit this ceiling.
 *
 * 20 MiB mirrors `STATEMENT_MAX_FILE_BYTES` (`statement-file.ts`), which is
 * the API's own upload limit — no stream inside a file we are allowed to
 * upload can legitimately be larger than the file itself. Callers may pass a
 * tighter value.
 */
export const CFB_MAX_STREAM_BYTES = 20 * 1024 * 1024;

const FREESECT = 0xffffffff;
const ENDOFCHAIN = 0xfffffffe;
const DIRECTORY_ENTRY_SIZE = 128;
const OBJECT_TYPE_STREAM = 2;
const OBJECT_TYPE_ROOT = 5;

/** Thrown for any structurally unreadable container. The caller maps this to
 * a single "corrupt file" reason — it never carries a password or a path. */
export class CfbParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CfbParseError";
  }
}

/** True when `bytes` starts with the compound-file magic. */
export function isCfbContainer(bytes: Uint8Array): boolean {
  if (bytes.length < CFB_SIGNATURE.length) return false;
  return CFB_SIGNATURE.every((b, i) => bytes[i] === b);
}

type CfbDirectoryEntry = {
  name: string;
  objectType: number;
  startSector: number;
  streamSize: number;
};

/**
 * A parsed container. `read(name)` returns a stream's bytes, or `null` when
 * no stream by that name exists.
 */
export type CfbFile = {
  names: readonly string[];
  read: (name: string) => Uint8Array | null;
};

function u16(view: DataView, offset: number): number {
  return view.getUint16(offset, true);
}

function u32(view: DataView, offset: number): number {
  return view.getUint32(offset, true);
}

/**
 * Walks a FAT/mini-FAT chain from `start`, returning the sector numbers.
 *
 * `maxSectors` is the number of sectors that physically exist, and doubles
 * as the loop bound: a chain can never legitimately be longer than that, so
 * a cyclic FAT (`n -> n`) terminates with an error instead of hanging the
 * user's tab.
 */
function followChain(
  fat: Uint32Array,
  start: number,
  maxSectors: number,
): number[] {
  const chain: number[] = [];
  let sector = start;
  while (sector !== ENDOFCHAIN && sector !== FREESECT) {
    // `sector` always comes out of a `Uint32Array` or a `getUint32`, so it can
    // never be negative — an upper bound is the whole check needed here.
    if (sector >= fat.length) {
      throw new CfbParseError("sector out of range");
    }
    if (chain.length > maxSectors) {
      throw new CfbParseError("sector chain too long");
    }
    chain.push(sector);
    sector = fat[sector];
  }
  return chain;
}

/**
 * Copies a sector chain into one contiguous buffer.
 *
 * Both refusals happen BEFORE `new Uint8Array(length)`. That ordering is the
 * whole fix for the CRITICAL described on `CFB_MAX_STREAM_BYTES`: a declared
 * size is attacker-controlled data, and validating it after allocating it
 * validates nothing.
 */
function concatSectors(
  bytes: Uint8Array,
  chain: readonly number[],
  sectorSize: number,
  base: number,
  length: number,
  maxBytes: number,
): Uint8Array {
  // (a) The chain is the ground truth for how many bytes exist. A stream
  //     that claims more than its own sectors can hold is malformed, and
  //     saying so costs one multiplication instead of one allocation.
  if (length > chain.length * sectorSize) {
    throw new CfbParseError("stream shorter than declared");
  }
  // (b) An absolute ceiling, so a file that pads itself out with real
  //     sectors still cannot demand an unreasonable buffer.
  if (length > maxBytes) {
    throw new CfbParseError("stream larger than supported");
  }

  const out = new Uint8Array(length);
  let written = 0;
  for (const sector of chain) {
    if (written >= length) break;
    const start = base + sector * sectorSize;
    const take = Math.min(sectorSize, length - written);
    if (start + take > bytes.length) {
      throw new CfbParseError("sector past end of file");
    }
    out.set(bytes.subarray(start, start + take), written);
    written += take;
  }
  // Check (a) guarantees the chain could fill `out`; the only way to leave
  // early is the EOF throw above. Kept as a cheap invariant rather than
  // trusting that reasoning to survive a future edit.
  if (written < length) throw new CfbParseError("stream shorter than declared");
  return out;
}

/**
 * Reads the DIFAT (the list of FAT sector numbers), header part + continuation.
 *
 * Both counts this walks — `numFatSectors` (header offset 44) and the number
 * of DIFAT sectors (offset 72) — are 32-bit fields inside an untrusted file,
 * and the continuation pointers are read from file CONTENT. So both are
 * bounded by `maxSectors`, the number of sectors the file physically has: a
 * FAT sector and a DIFAT sector are each a real sector, so neither count can
 * legitimately exceed it. Without that bound, counts near `0xFFFFFFFF` plus
 * two DIFAT sectors pointing at each other spin ~2^32 times on a ~1.5 KB
 * file — and `parseCfb` runs before any password check, so the tab would
 * hang on the user's very first submit, right or wrong password.
 *
 * The visited set makes a cycle a refusal rather than merely a bounded spin,
 * matching what `followChain` already does for FAT chains.
 */
function readFatSectorNumbers(
  view: DataView,
  bytes: Uint8Array,
  sectorSize: number,
  numFatSectors: number,
  maxSectors: number,
): number[] {
  if (numFatSectors > maxSectors) {
    throw new CfbParseError("more FAT sectors than the file can hold");
  }
  const numbers: number[] = [];
  for (let i = 0; i < 109 && numbers.length < numFatSectors; i++) {
    const sector = u32(view, 76 + i * 4);
    if (sector === FREESECT || sector === ENDOFCHAIN) break;
    numbers.push(sector);
  }

  const declaredDifatSectors = u32(view, 72);
  if (declaredDifatSectors > maxSectors) {
    throw new CfbParseError("more DIFAT sectors than the file can hold");
  }

  const entriesPerSector = sectorSize / 4 - 1;
  const visited = new Set<number>();
  let difatSector = u32(view, 68);
  let remaining = declaredDifatSectors + 1;
  while (
    numbers.length < numFatSectors &&
    difatSector !== ENDOFCHAIN &&
    difatSector !== FREESECT &&
    remaining-- > 0
  ) {
    if (visited.has(difatSector)) {
      throw new CfbParseError("cyclic DIFAT chain");
    }
    visited.add(difatSector);
    const start = sectorSize + difatSector * sectorSize;
    if (start + sectorSize > bytes.length) {
      throw new CfbParseError("DIFAT sector past end of file");
    }
    for (
      let i = 0;
      i < entriesPerSector && numbers.length < numFatSectors;
      i++
    ) {
      const sector = u32(view, start + i * 4);
      if (sector === FREESECT || sector === ENDOFCHAIN) break;
      numbers.push(sector);
    }
    difatSector = u32(view, start + entriesPerSector * 4);
  }
  return numbers;
}

function readDirectoryEntries(directory: Uint8Array): CfbDirectoryEntry[] {
  const view = new DataView(
    directory.buffer,
    directory.byteOffset,
    directory.byteLength,
  );
  const entries: CfbDirectoryEntry[] = [];
  const count = Math.floor(directory.length / DIRECTORY_ENTRY_SIZE);
  for (let i = 0; i < count; i++) {
    const base = i * DIRECTORY_ENTRY_SIZE;
    const objectType = directory[base + 66];
    if (objectType !== OBJECT_TYPE_STREAM && objectType !== OBJECT_TYPE_ROOT) {
      continue;
    }
    const nameBytes = Math.max(0, Math.min(64, u16(view, base + 64) - 2));
    let name = "";
    for (let c = 0; c < nameBytes; c += 2) {
      name += String.fromCharCode(u16(view, base + c));
    }
    // `streamSize` is a 64-bit field. Anything past 2^32 is far beyond the
    // 20 MB upload ceiling, so the high word is read only to reject it
    // rather than silently truncating to a plausible-looking small size.
    if (u32(view, base + 124) !== 0) {
      throw new CfbParseError("stream larger than supported");
    }
    entries.push({
      name,
      objectType,
      startSector: u32(view, base + 116),
      streamSize: u32(view, base + 120),
    });
  }
  return entries;
}

/**
 * Parses a compound file. Throws `CfbParseError` for anything malformed —
 * the caller turns that into one honest "file rusak" reason, never into a
 * password-related message.
 */
export function parseCfb(
  bytes: Uint8Array,
  options: { maxStreamBytes?: number } = {},
): CfbFile {
  const maxStreamBytes = options.maxStreamBytes ?? CFB_MAX_STREAM_BYTES;
  if (!isCfbContainer(bytes)) {
    throw new CfbParseError("not a compound file");
  }
  if (bytes.length < 512) throw new CfbParseError("truncated header");

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const sectorShift = u16(view, 30);
  const miniSectorShift = u16(view, 32);
  if (sectorShift !== 9 && sectorShift !== 12) {
    throw new CfbParseError(`unsupported sector shift ${sectorShift}`);
  }
  if (miniSectorShift !== 6) {
    throw new CfbParseError(`unsupported mini sector shift ${miniSectorShift}`);
  }
  const sectorSize = 1 << sectorShift;
  const miniSectorSize = 1 << miniSectorShift;
  const miniCutoff = u32(view, 56);
  const totalSectors = Math.max(
    0,
    Math.floor((bytes.length - sectorSize) / sectorSize),
  );

  const fatSectors = readFatSectorNumbers(
    view,
    bytes,
    sectorSize,
    u32(view, 44),
    totalSectors,
  );
  const entriesPerSector = sectorSize / 4;
  const fat = new Uint32Array(fatSectors.length * entriesPerSector);
  fatSectors.forEach((sector, index) => {
    const start = sectorSize + sector * sectorSize;
    if (start + sectorSize > bytes.length) {
      throw new CfbParseError("FAT sector past end of file");
    }
    for (let i = 0; i < entriesPerSector; i++) {
      fat[index * entriesPerSector + i] = u32(view, start + i * 4);
    }
  });

  const directoryChain = followChain(fat, u32(view, 48), totalSectors);
  const directory = concatSectors(
    bytes,
    directoryChain,
    sectorSize,
    sectorSize,
    directoryChain.length * sectorSize,
    maxStreamBytes,
  );
  const entries = readDirectoryEntries(directory);
  const root = entries.find((e) => e.objectType === OBJECT_TYPE_ROOT);
  if (!root) throw new CfbParseError("no root entry");

  let miniStream: Uint8Array | null = null;
  let miniFat: Uint32Array | null = null;

  const readMiniStream = (): { data: Uint8Array; fat: Uint32Array } => {
    if (!miniStream || !miniFat) {
      const chain = followChain(fat, root.startSector, totalSectors);
      miniStream = concatSectors(
        bytes,
        chain,
        sectorSize,
        sectorSize,
        // The clamp that WAS here (and, as the security review noted, was
        // conspicuously absent from `read` below) is now redundant:
        // `concatSectors` enforces the same bound for every caller. Kept
        // explicit so the root stream cannot regress independently.
        Math.min(root.streamSize, chain.length * sectorSize),
        maxStreamBytes,
      );
      const miniFatChain = followChain(fat, u32(view, 60), totalSectors);
      const miniFatBytes = concatSectors(
        bytes,
        miniFatChain,
        sectorSize,
        sectorSize,
        miniFatChain.length * sectorSize,
        maxStreamBytes,
      );
      const miniView = new DataView(
        miniFatBytes.buffer,
        miniFatBytes.byteOffset,
        miniFatBytes.byteLength,
      );
      miniFat = new Uint32Array(miniFatBytes.length / 4);
      for (let i = 0; i < miniFat.length; i++) {
        miniFat[i] = u32(miniView, i * 4);
      }
    }
    return { data: miniStream, fat: miniFat };
  };

  const read = (name: string): Uint8Array | null => {
    const entry = entries.find(
      (e) => e.objectType === OBJECT_TYPE_STREAM && e.name === name,
    );
    if (!entry) return null;
    if (entry.streamSize === 0) return new Uint8Array(0);
    // The ceiling is asserted here as well as inside `concatSectors`: this
    // is the earliest point at which an attacker-controlled size is known,
    // and it must never reach a `new Uint8Array` — see CFB_MAX_STREAM_BYTES.
    if (entry.streamSize > maxStreamBytes) {
      throw new CfbParseError("stream larger than supported");
    }

    if (entry.streamSize < miniCutoff) {
      const mini = readMiniStream();
      const maxMiniSectors = Math.ceil(mini.data.length / miniSectorSize);
      const chain = followChain(mini.fat, entry.startSector, maxMiniSectors);
      return concatSectors(
        mini.data,
        chain,
        miniSectorSize,
        // The mini stream is addressed from its own byte 0, not from the
        // sector-1 base the main file uses.
        0,
        entry.streamSize,
        maxStreamBytes,
      );
    }
    const chain = followChain(fat, entry.startSector, totalSectors);
    return concatSectors(
      bytes,
      chain,
      sectorSize,
      sectorSize,
      entry.streamSize,
      maxStreamBytes,
    );
  };

  return {
    names: entries
      .filter((e) => e.objectType === OBJECT_TYPE_STREAM)
      .map((e) => e.name),
    read,
  };
}
