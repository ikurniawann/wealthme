/**
 * EPIC-029 group 4 (E4b) — the DIFAT path of the compound-file reader, from
 * crafted bytes.
 *
 * `statement-ooxml-crypto.test.ts` builds a realistic container, but its
 * writer never needs a DIFAT continuation sector (a 512-byte header holds
 * 109 FAT sector numbers, which is far more than a test workbook uses), so
 * that whole branch went unexercised. It is also the branch that follows
 * pointers read from FILE CONTENT under counts read from an untrusted
 * header — the one place in this reader where a small hostile file could buy
 * unbounded work.
 *
 * These fixtures are therefore real bytes, not mocks: the bug class is byte
 * handling, and a mocked reader would prove nothing about it. `parseCfb`
 * runs BEFORE `EncryptionInfo` is even looked at and before any password is
 * checked, so anything that hangs here hangs the tab on the user's first
 * submit — including a submit with the wrong password.
 */

import { parseCfb, CfbParseError, CFB_MAX_STREAM_BYTES } from "./statement-cfb";

const SECTOR = 512;
const ENTRIES_PER_SECTOR = SECTOR / 4;
/** A DIFAT sector spends its last slot on the pointer to the next one. */
const DIFAT_ENTRIES_PER_SECTOR = ENTRIES_PER_SECTOR - 1;
const HEADER_DIFAT_ENTRIES = 109;

const FREESECT = 0xffffffff;
const ENDOFCHAIN = 0xfffffffe;
const FATSECT = 0xfffffffd;
const DIFSECT = 0xfffffffc;

const STREAM_NAME = "EncryptedPackage";
const STREAM_SIZE = 4096;
const MINI_CUTOFF = 4096;

type Fixture = {
  /** FAT sectors actually written into the file. */
  fatSectorCount: number;
  /** DIFAT continuation sectors actually written into the file. */
  difatSectorCount: number;
  /** Header offset 44. Defaults to the honest `fatSectorCount`. */
  declaredFatSectors?: number;
  /** Header offset 72. Defaults to the honest `difatSectorCount`. */
  declaredDifatSectors?: number;
  /**
   * The "next DIFAT sector" pointer written into DIFAT sector `i`. Defaults
   * to a straight chain ending in `ENDOFCHAIN`; a fixture that returns an
   * earlier index builds a cycle.
   */
  difatNext?: (index: number, sector: number) => number;
  /**
   * The directory entry's declared `streamSize` (offset 120). Defaults to
   * the honest `STREAM_SIZE`; a fixture that inflates it builds the
   * over-declared-allocation PoC.
   */
  streamSizeOverride?: number;
};

/**
 * Writes a compound file whose layout is, in sector order:
 * `[stream…][directory][DIFAT…][FAT…]`.
 */
function buildContainer(fixture: Fixture): Uint8Array {
  const {
    fatSectorCount,
    difatSectorCount,
    declaredFatSectors = fatSectorCount,
    declaredDifatSectors = difatSectorCount,
    difatNext,
    streamSizeOverride = STREAM_SIZE,
  } = fixture;

  const streamSectors = STREAM_SIZE / SECTOR;
  const directorySector = streamSectors;
  const difatStart = directorySector + 1;
  const fatStart = difatStart + difatSectorCount;
  const totalSectors = fatStart + fatSectorCount;

  const out = new Uint8Array(SECTOR * (1 + totalSectors));
  const view = new DataView(out.buffer);
  const sectorOffset = (sector: number) => SECTOR * (1 + sector);

  // ── header ──
  out.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], 0);
  view.setUint16(26, 3, true); // major version
  view.setUint16(28, 0xfffe, true); // byte order
  view.setUint16(30, 9, true); // sector shift → 512
  view.setUint16(32, 6, true); // mini sector shift → 64
  view.setUint32(40, 1, true); // directory sector count
  view.setUint32(44, declaredFatSectors, true);
  view.setUint32(48, directorySector, true);
  view.setUint32(56, MINI_CUTOFF, true);
  view.setUint32(60, ENDOFCHAIN, true); // no mini FAT
  view.setUint32(64, 0, true);
  view.setUint32(68, difatSectorCount > 0 ? difatStart : ENDOFCHAIN, true);
  view.setUint32(72, declaredDifatSectors, true);

  const fatSectorNumbers = Array.from(
    { length: fatSectorCount },
    (_, i) => fatStart + i,
  );
  for (let i = 0; i < HEADER_DIFAT_ENTRIES; i++) {
    view.setUint32(76 + i * 4, fatSectorNumbers[i] ?? FREESECT, true);
  }

  // ── DIFAT continuation sectors: the FAT numbers the header could not hold ──
  let taken = HEADER_DIFAT_ENTRIES;
  for (let i = 0; i < difatSectorCount; i++) {
    const sector = difatStart + i;
    const base = sectorOffset(sector);
    for (let slot = 0; slot < DIFAT_ENTRIES_PER_SECTOR; slot++) {
      view.setUint32(
        base + slot * 4,
        fatSectorNumbers[taken++] ?? FREESECT,
        true,
      );
    }
    const next =
      difatNext?.(i, sector) ??
      (i + 1 < difatSectorCount ? sector + 1 : ENDOFCHAIN);
    view.setUint32(base + DIFAT_ENTRIES_PER_SECTOR * 4, next, true);
  }

  // ── FAT ──
  const fat = new Uint32Array(fatSectorCount * ENTRIES_PER_SECTOR).fill(
    FREESECT,
  );
  for (let i = 0; i < streamSectors; i++) {
    fat[i] = i + 1 < streamSectors ? i + 1 : ENDOFCHAIN;
  }
  if (directorySector < fat.length) fat[directorySector] = ENDOFCHAIN;
  for (let i = 0; i < difatSectorCount; i++) {
    if (difatStart + i < fat.length) fat[difatStart + i] = DIFSECT;
  }
  for (let i = 0; i < fatSectorCount; i++) {
    if (fatStart + i < fat.length) fat[fatStart + i] = FATSECT;
  }
  for (let i = 0; i < fatSectorCount; i++) {
    const base = sectorOffset(fatStart + i);
    for (let slot = 0; slot < ENTRIES_PER_SECTOR; slot++) {
      view.setUint32(base + slot * 4, fat[i * ENTRIES_PER_SECTOR + slot], true);
    }
  }

  // ── directory: a root entry (required) plus one readable stream ──
  const writeEntry = (
    index: number,
    name: string,
    objectType: number,
    startSector: number,
    size: number,
  ) => {
    const base = sectorOffset(directorySector) + index * 128;
    for (let i = 0; i < name.length; i++) {
      view.setUint16(base + i * 2, name.charCodeAt(i), true);
    }
    view.setUint16(base + 64, name.length * 2 + 2, true);
    out[base + 66] = objectType;
    view.setUint32(base + 116, startSector, true);
    view.setUint32(base + 120, size, true);
  };
  writeEntry(0, "Root Entry", 5, ENDOFCHAIN, 0);
  writeEntry(1, STREAM_NAME, 2, 0, streamSizeOverride);

  // ── stream payload: recognisable, position-dependent bytes ──
  for (let i = 0; i < STREAM_SIZE; i++) {
    out[sectorOffset(0) + i] = (i * 7) % 251;
  }
  return out;
}

function expectedStreamBytes(): Uint8Array {
  const out = new Uint8Array(STREAM_SIZE);
  for (let i = 0; i < STREAM_SIZE; i++) out[i] = (i * 7) % 251;
  return out;
}

describe("statement-cfb — DIFAT continuation", () => {
  it("reads a stream whose FAT is described by a real DIFAT chain", () => {
    // 110 FAT sectors: 109 fit in the header, the 110th only reachable
    // through a continuation sector. This is the branch no other test walks.
    const bytes = buildContainer({ fatSectorCount: 110, difatSectorCount: 1 });

    const cfb = parseCfb(bytes);

    expect(cfb.names).toContain(STREAM_NAME);
    expect(Buffer.from(cfb.read(STREAM_NAME)!)).toEqual(
      Buffer.from(expectedStreamBytes()),
    );
  });

  it("reads a stream across a multi-sector DIFAT chain", () => {
    // 109 + 127 + 1 → the chain has to be followed twice, so a fixture that
    // stopped after one continuation sector would fail here.
    const bytes = buildContainer({ fatSectorCount: 237, difatSectorCount: 2 });

    expect(Buffer.from(parseCfb(bytes).read(STREAM_NAME)!)).toEqual(
      Buffer.from(expectedStreamBytes()),
    );
  });

  it("refuses a DIFAT chain that points back at itself", () => {
    // Two continuation sectors pointing at each other. Before this was
    // guarded, the walk was bounded only by the header's own 32-bit count.
    const bytes = buildContainer({
      fatSectorCount: 1,
      difatSectorCount: 2,
      declaredFatSectors: 5,
      difatNext: (index, sector) => (index === 0 ? sector + 1 : sector - 1),
    });

    expect(() => parseCfb(bytes)).toThrow(CfbParseError);
    expect(() => parseCfb(bytes)).toThrow(/cyclic/i);
  });

  it("refuses a header that claims more FAT sectors than the file can hold", () => {
    const bytes = buildContainer({
      fatSectorCount: 1,
      difatSectorCount: 0,
      declaredFatSectors: 0xfffffff0,
    });

    expect(() => parseCfb(bytes)).toThrow(CfbParseError);
  });

  it("refuses a header that claims more DIFAT sectors than the file can hold", () => {
    const bytes = buildContainer({
      fatSectorCount: 1,
      difatSectorCount: 1,
      declaredDifatSectors: 0xffffffff,
    });

    expect(() => parseCfb(bytes)).toThrow(CfbParseError);
  });

  /**
   * The whole attack in one fixture, at the size it really takes: a file of
   * a few kilobytes, whose header counts are near
   * 2^32 and whose two DIFAT sectors point at each other. Unbounded, this is
   * ~2^32 iterations each appending up to 127 entries to a growing array —
   * a hung tab, reached before any password is looked at. The timeout is the
   * assertion: it must fail fast, not eventually.
   */
  it("refuses a kilobyte-sized DIFAT bomb immediately instead of spinning on it", () => {
    const bytes = buildContainer({
      fatSectorCount: 0,
      difatSectorCount: 2,
      declaredFatSectors: 0xfffffff0,
      declaredDifatSectors: 0xffffffff,
      difatNext: (index, sector) => (index === 0 ? sector + 1 : sector - 1),
    });
    expect(bytes.length).toBeLessThan(8 * 1024);

    // The TIMEOUT is the assertion, deliberately: a wall-clock
    // `Date.now()` budget lived here and flaked whenever the suite ran
    // under load (a 1 s budget is not a property of the parser, it is a
    // property of the machine). Unbounded, this fixture spins ~2^32 times
    // and no timeout on earth saves it; bounded, it returns in
    // microseconds. A generous ceiling separates those two outcomes
    // without pretending to measure performance.
    expect(() => parseCfb(bytes)).toThrow(CfbParseError);
  }, 5000);
});

/**
 * Records the largest `new Uint8Array(n)` ATTEMPTED while `fn` runs.
 *
 * A wall-clock or heap-usage assertion would be flaky; this is deterministic
 * and asserts the property that actually matters — that the allocation is
 * never requested at all, rather than being requested and then regretted.
 * The `Proxy` keeps the real constructor as its target, so `instanceof`,
 * `subarray`, and every other view operation behave normally.
 */
function largestAllocationDuring(fn: () => unknown): {
  thrown: unknown;
  largestAllocation: number;
} {
  const RealUint8Array = globalThis.Uint8Array;
  let largestAllocation = 0;
  const spied = new Proxy(RealUint8Array, {
    construct(target, args, newTarget) {
      if (typeof args[0] === "number") {
        largestAllocation = Math.max(largestAllocation, args[0]);
      }
      return Reflect.construct(target, args, newTarget);
    },
  });
  const globals = globalThis as unknown as Record<string, unknown>;
  globals.Uint8Array = spied;
  let thrown: unknown = null;
  try {
    fn();
  } catch (err) {
    thrown = err;
  } finally {
    globals.Uint8Array = RealUint8Array;
  }
  return { thrown, largestAllocation };
}

/**
 * EPIC-029 group 4 security review (CRITICAL) — a directory entry's
 * `streamSize` is attacker-controlled, and `concatSectors` used to size its
 * output buffer from it before checking whether that many bytes existed.
 * The high word was rejected, so the reachable maximum was `0xFFFFFFFE`:
 * ~4.29 GB demanded by a file of a few kilobytes, attempted and briefly held
 * before the after-the-fact length check could fire.
 *
 * It is reachable before any password work — `parseCfb` runs inside
 * `decryptOoxml` first — so picking the file is the whole attack.
 */
describe("statement-cfb — an over-declared streamSize never sizes an allocation", () => {
  const OVER_DECLARED = 0xfffffffe;

  it("refuses a ~4.29 GB declaration from a kilobyte-sized file without attempting it", () => {
    const bytes = buildContainer({
      fatSectorCount: 1,
      difatSectorCount: 0,
      streamSizeOverride: OVER_DECLARED,
    });
    expect(bytes.length).toBeLessThan(16 * 1024);

    const { thrown, largestAllocation } = largestAllocationDuring(() =>
      parseCfb(bytes).read(STREAM_NAME),
    );

    expect(thrown).toBeInstanceOf(CfbParseError);
    // The container itself is kilobytes; nothing it can say should move this
    // anywhere near the declared size.
    expect(largestAllocation).toBeLessThan(1024 * 1024);
    expect(largestAllocation).toBeLessThan(OVER_DECLARED);
  });

  it("refuses a declaration just over the absolute ceiling", () => {
    const bytes = buildContainer({
      fatSectorCount: 1,
      difatSectorCount: 0,
      streamSizeOverride: CFB_MAX_STREAM_BYTES + 1,
    });
    const { thrown, largestAllocation } = largestAllocationDuring(() =>
      parseCfb(bytes).read(STREAM_NAME),
    );
    expect(thrown).toBeInstanceOf(CfbParseError);
    expect(largestAllocation).toBeLessThan(CFB_MAX_STREAM_BYTES);
  });

  it("honours a tighter ceiling supplied by the caller", () => {
    const bytes = buildContainer({ fatSectorCount: 1, difatSectorCount: 0 });
    expect(() =>
      parseCfb(bytes, { maxStreamBytes: 1024 }).read(STREAM_NAME),
    ).toThrow(CfbParseError);
  });

  it("still reads an honestly-declared stream", () => {
    const bytes = buildContainer({ fatSectorCount: 1, difatSectorCount: 0 });
    const { thrown, largestAllocation } = largestAllocationDuring(() =>
      parseCfb(bytes).read(STREAM_NAME),
    );
    expect(thrown).toBeNull();
    // Proof the spy sees real allocations at all, so the assertions above
    // are not passing because nothing was measured.
    expect(largestAllocation).toBeGreaterThanOrEqual(STREAM_SIZE);
  });
});
