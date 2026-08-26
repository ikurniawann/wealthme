import { BadRequestException } from "@nestjs/common";

import { ReconciliationService } from "./reconciliation.service";

/**
 * Turning bank lines into transactions.
 *
 * Reconciliation could only MATCH a line against a transaction that already
 * existed. On the demo that meant 235 unmatched entries searched against 90
 * transactions: every line red "Tidak Ditemukan", and an imported statement
 * that never appeared on /transaksi because no code path could put it there.
 *
 * The two properties that matter here are about money, not plumbing:
 *
 *  1. **Direction comes from the statement**, never from the caller. A credit
 *     that imported as an expense would silently invert the family's balance.
 *  2. **Importing twice must not create the money twice.** A duplicated
 *     expense is invisible on a list of similar rows.
 */

const FAMILY_GROUP_ID = "fg-test-uuid";
const SYNC_ID = "sync-uuid";
const ACCOUNT_ID = "11111111-1111-4111-8111-111111111111";

type Entry = {
  id: string;
  bankSyncId: string;
  amount: bigint;
  currency: string;
  date: Date;
  description: string;
  matchedTxId: string | null;
  suggestedTxId: string | null;
  reconStatus: string;
  createdAt: Date;
};

function makeEntry(over: Partial<Entry> = {}): Entry {
  return {
    id: "entry-1",
    bankSyncId: SYNC_ID,
    amount: -37_000n,
    currency: "IDR",
    date: new Date("2026-07-01T00:00:00.000Z"),
    description: "Pembayaran QR ke TOKO",
    matchedTxId: null,
    suggestedTxId: null,
    reconStatus: "unmatched",
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    ...over,
  };
}

function build(entries: Entry[]) {
  const rows = [...entries];
  const created: Record<string, unknown>[] = [];
  const prisma = {
    bankSync: { findUnique: jest.fn(async () => ({ id: SYNC_ID })) },
    bankSyncEntry: {
      findUnique: jest.fn(
        async ({ where }: { where: { id: string } }) =>
          rows.find((row) => row.id === where.id) ?? null,
      ),
      findMany: jest.fn(async () => rows.filter((row) => !row.matchedTxId)),
      count: jest.fn(async () => rows.filter((row) => !row.matchedTxId).length),
      update: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Record<string, unknown>;
        }) => {
          const row = rows.find((item) => item.id === where.id);
          if (!row) throw new Error("missing row");
          Object.assign(row, data);
          return row;
        },
      ),
    },
  };
  const create = jest.fn(async (_fg: string, dto: Record<string, unknown>) => {
    created.push(dto);
    return {
      id: `tx-${created.length}`,
      amount: dto.amount,
      type: dto.type,
      description: dto.description,
      occurredAt: dto.occurredAt,
    };
  });
  const service = new ReconciliationService(
    prisma as never,
    { create } as never,
    { resolveDecryptedKey: jest.fn() } as never,
    { create: jest.fn() } as never,
  );
  return { service, prisma, create, created, rows };
}

describe("importEntry — one bank line becomes one transaction", () => {
  it("imports a debit as an expense, with the statement's own amount and date", async () => {
    const { service, create, rows } = build([makeEntry()]);

    await service.importEntry(FAMILY_GROUP_ID, SYNC_ID, "entry-1", {
      accountId: ACCOUNT_ID,
    });

    expect(create).toHaveBeenCalledWith(
      FAMILY_GROUP_ID,
      {
        accountId: ACCOUNT_ID,
        // Sign is dropped: the DTO takes a positive magnitude plus a type.
        amount: 37_000,
        type: "expense",
        description: "Pembayaran QR ke TOKO",
        occurredAt: "2026-07-01T00:00:00.000Z",
      },
      undefined,
      { enforceBankFloor: false },
    );
    // And the line is now linked, so it stops reading "Tidak Ditemukan".
    expect(rows[0].reconStatus).toBe("matched");
    expect(rows[0].matchedTxId).toBe("tx-1");
  });

  it("never applies the live-overdraft floor — a bank line is confirmed history, not a fresh spend", async () => {
    // EPIC-021 #22 blocks a FRESH debit from pushing a bank account
    // negative. A reconciliation import is the opposite: the family's own
    // statement already confirms this money moved. The account can only
    // look "insufficient" here because the WealthMe balance hasn't caught
    // up with the rest of the statement yet (the opening-balance row is
    // never importable, and one row can be imported before an earlier
    // credit) — that must never block importing real history.
    const { service, create } = build([makeEntry()]);

    await service.importEntry(FAMILY_GROUP_ID, SYNC_ID, "entry-1", {
      accountId: ACCOUNT_ID,
    });

    expect(create.mock.calls[0][3]).toEqual({ enforceBankFloor: false });
  });

  it("imports a credit as INCOME — the sign decides, not the caller", async () => {
    const { service, create } = build([
      makeEntry({ amount: 4_350_000n, description: "Transfer masuk GAJI" }),
    ]);

    await service.importEntry(FAMILY_GROUP_ID, SYNC_ID, "entry-1", {
      accountId: ACCOUNT_ID,
    });

    expect(create).toHaveBeenCalledWith(
      FAMILY_GROUP_ID,
      expect.objectContaining({ type: "income", amount: 4_350_000 }),
      undefined,
      { enforceBankFloor: false },
    );
  });

  it("refuses to import a line twice, so money cannot be duplicated", async () => {
    const { service, create } = build([
      makeEntry({ matchedTxId: "tx-existing", reconStatus: "matched" }),
    ]);

    await expect(
      service.importEntry(FAMILY_GROUP_ID, SYNC_ID, "entry-1", {
        accountId: ACCOUNT_ID,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });

  it("passes a category only when one was chosen", async () => {
    const { service, create } = build([makeEntry()]);

    await service.importEntry(FAMILY_GROUP_ID, SYNC_ID, "entry-1", {
      accountId: ACCOUNT_ID,
    });

    // Not `categoryId: undefined` — a statement description is not a
    // category, and inventing one would poison every budget that reads it.
    expect(Object.keys(create.mock.calls[0][1])).not.toContain("categoryId");
  });
});

describe("importUnmatchedEntries — the bulk half", () => {
  it("imports every unlinked line and leaves nothing behind", async () => {
    const { service, create, rows } = build([
      makeEntry({ id: "e1" }),
      makeEntry({ id: "e2", amount: 12_000n }),
      makeEntry({ id: "e3", amount: -5_000n }),
    ]);

    const result = await service.importUnmatchedEntries(
      FAMILY_GROUP_ID,
      SYNC_ID,
      { accountId: ACCOUNT_ID },
    );

    expect(create).toHaveBeenCalledTimes(3);
    expect(result).toEqual({
      imported: 3,
      skipped: [],
      skippedTotal: 0,
      remaining: 0,
    });
    expect(rows.every((row) => row.matchedTxId)).toBe(true);
  });

  it("never re-imports a line that is already linked", async () => {
    const { service, create } = build([
      makeEntry({ id: "e1", matchedTxId: "tx-old", reconStatus: "matched" }),
      makeEntry({ id: "e2" }),
    ]);

    const result = await service.importUnmatchedEntries(
      FAMILY_GROUP_ID,
      SYNC_ID,
      { accountId: ACCOUNT_ID },
    );

    // A "suggested" line is unconfirmed too, so the filter is on the LINK,
    // not on the status label.
    expect(create).toHaveBeenCalledTimes(1);
    expect(result.imported).toBe(1);
  });

  it("skips an unusable line WITH ITS REASON instead of aborting the rest", async () => {
    const { service, create } = build([
      makeEntry({ id: "e1" }),
      makeEntry({ id: "e2", amount: 0n, description: "SALDO AWAL" }),
      makeEntry({ id: "e3", amount: -9_000n }),
    ]);

    const result = await service.importUnmatchedEntries(
      FAMILY_GROUP_ID,
      SYNC_ID,
      { accountId: ACCOUNT_ID },
    );

    expect(create).toHaveBeenCalledTimes(2);
    expect(result.imported).toBe(2);
    expect(result.skipped).toEqual([
      {
        description: "SALDO AWAL",
        // The refusal's OWN message, not Nest's generic "Bad Request
        // Exception" — which would tell the user nothing about the line.
        reason: "Baris dengan nominal 0 tidak bisa dijadikan transaksi.",
      },
    ]);
    expect(result.remaining).toBe(1);
  });

  it("refuses an amount too large to survive the JSON number conversion", async () => {
    const { service, create } = build([
      makeEntry({
        id: "e1",
        amount: BigInt(Number.MAX_SAFE_INTEGER) + 1n,
        description: "NOMINAL MUSTAHIL",
      }),
    ]);

    const result = await service.importUnmatchedEntries(
      FAMILY_GROUP_ID,
      SYNC_ID,
      { accountId: ACCOUNT_ID },
    );

    // Rupiah are whole-unit bigints so nothing rounds; a value that cannot
    // convert is refused rather than quietly becoming a different number.
    expect(create).not.toHaveBeenCalled();
    expect(result.imported).toBe(0);
    expect(result.skipped[0].description).toBe("NOMINAL MUSTAHIL");
  });
});
