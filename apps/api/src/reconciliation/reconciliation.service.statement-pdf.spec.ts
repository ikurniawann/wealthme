import { UnprocessableEntityException } from "@nestjs/common";

import { ReconciliationService } from "./reconciliation.service";
import { StatementReaderNotConfiguredError } from "./statement-reader/statement-reader-not-configured.error";

import type { StatementReading } from "./statement-reader/statement-reader.port";

/**
 * EPIC-029 groups 2-3 — the statement-PDF path end to end, from the model's
 * raw-string answer to a stored `BankSync`.
 *
 * The two properties under test are the ones the whole epic exists for:
 *
 *  1. **No amount reaches the database without `parseStatementAmount`.** The
 *     model hands back printed cell text; every number stored comes out of
 *     the same parser the CSV and XLSX imports use.
 *  2. **A totals mismatch REFUSES.** Not a banner over an import that
 *     happened anyway — a missing row is invisible on a review screen, so the
 *     statement's own arithmetic is the only thing that can catch it.
 *
 * The row fixtures below are transcribed from two GENUINE Indonesian bank
 * e-statements (a 5-page Mandiri and a 1-page BCA), including their real
 * amount formatting: `+4.350.000,00`, `-37.000,00`, `3,000,000.00 DB`. Only
 * the shapes are reproduced; no real account data is committed.
 */

const FAMILY_GROUP_ID = "fg-test-uuid";

function makePrisma() {
  return {
    bankSync: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: "sync-uuid",
        familyGroupId: FAMILY_GROUP_ID,
        fileName: data.fileName,
        uploadedAt: new Date("2026-08-01T00:00:00.000Z"),
        rowCount: data.rowCount,
      })),
    },
    bankSyncEntry: { createMany: jest.fn() },
    $transaction: jest.fn(async (fn: (tx: unknown) => unknown) =>
      fn(prismaRef),
    ),
  };
}

let prismaRef: ReturnType<typeof makePrisma>;

function build(
  reading?: StatementReading,
  key: unknown = { provider: "claude", apiKey: "k" },
) {
  prismaRef = makePrisma();
  const readStatement = jest.fn(async () => reading);
  const service = new ReconciliationService(
    prismaRef as never,
    { create: jest.fn() } as never,
    { resolveDecryptedKey: jest.fn().mockResolvedValue(key) } as never,
    { create: jest.fn(() => ({ readStatement })) } as never,
  );
  return { service, prisma: prismaRef, readStatement };
}

/** A page of plausible statement text — long enough to clear the
 *  no-text-layer floor without being a real statement. */
const PAGE = Array.from(
  { length: 20 },
  (_, i) =>
    `01 Jul 2026 | Pembayaran QR baris ${i} | -37.000,00 | 1.480.061,00`,
).join("\n");

const MANDIRI_READING: StatementReading = {
  rows: [
    {
      date: "2026-07-01",
      description: "Pembayaran QR ke TOKO",
      amount: "-37.000,00",
    },
    {
      date: "2026-07-01",
      description: "Biaya transfer BI Fast",
      amount: "-2.500,00",
    },
    {
      date: "2026-07-02",
      description: "Transfer antar Mandiri",
      amount: "+4.350.000,00",
    },
  ],
  totals: {
    openingBalance: "1.517.061,00",
    closingBalance: "5.827.561,00",
    totalCredit: "+ 4.350.000,00",
    totalDebit: "- 39.500,00",
  },
};

function readDto(overrides: Record<string, unknown> = {}) {
  return {
    fileName: "e-Statement.pdf",
    pageCount: 1,
    pages: [PAGE],
    ...overrides,
  } as never;
}

describe("readStatementPdf", () => {
  it("refuses with no family AI key, and never calls a provider", async () => {
    // E5 — "no key" is a real, actionable state. There is no server key and
    // no mock, so the alternative to this refusal is a fabricated table.
    const { service, readStatement } = build(MANDIRI_READING, null);
    await expect(
      service.readStatementPdf(FAMILY_GROUP_ID, readDto()),
    ).rejects.toBeInstanceOf(StatementReaderNotConfiguredError);
    expect(readStatement).not.toHaveBeenCalled();
  });

  it("refuses a scan by name, without spending the family's key on it", async () => {
    // E1c — the failure is not a crash: it is a paid model handed an empty
    // prompt, answering with a confident, entirely invented table.
    const { service, readStatement } = build(MANDIRI_READING);
    await expect(
      service.readStatementPdf(FAMILY_GROUP_ID, readDto({ pages: ["   "] })),
    ).rejects.toThrow(/lapisan teks/);
    expect(readStatement).not.toHaveBeenCalled();
  });

  it("refuses text above the character cap before contacting the provider", async () => {
    const { service, readStatement } = build(MANDIRI_READING);
    await expect(
      service.readStatementPdf(
        FAMILY_GROUP_ID,
        readDto({ pages: ["x".repeat(200_001)] }),
      ),
    ).rejects.toThrow(UnprocessableEntityException);
    expect(readStatement).not.toHaveBeenCalled();
  });

  it("PERSISTS NOTHING — a read is a preview, never a BankSync", async () => {
    // E3a. This is the whole point of the two-step shape.
    const { service, prisma } = build(MANDIRI_READING);
    const preview = await service.readStatementPdf(FAMILY_GROUP_ID, readDto());

    expect(prisma.bankSync.create).not.toHaveBeenCalled();
    expect(prisma.bankSyncEntry.createMany).not.toHaveBeenCalled();
    expect(preview).not.toHaveProperty("id");
    expect(preview.rowCount).toBe(3);
  });

  it("parses every amount through parseStatementAmount, including a leading +", async () => {
    const { service } = build(MANDIRI_READING);
    const preview = await service.readStatementPdf(FAMILY_GROUP_ID, readDto());
    expect(preview.rows.map((r) => r.amount)).toEqual([
      "-37000",
      "-2500",
      "4350000",
    ]);
    expect(preview.rows[0]!.date).toBe("2026-07-01T00:00:00.000Z");
  });

  it("echoes the RAW draft back unchanged, so confirming re-parses the same strings", async () => {
    const { service } = build(MANDIRI_READING);
    const preview = await service.readStatementPdf(FAMILY_GROUP_ID, readDto());
    expect(preview.draft.rows).toEqual(MANDIRI_READING.rows);
    expect(preview.draft.totals).toEqual(MANDIRI_READING.totals);
  });

  it("reports a matching totals verdict with all three checks", async () => {
    const { service } = build(MANDIRI_READING);
    const preview = await service.readStatementPdf(FAMILY_GROUP_ID, readDto());
    expect(preview.totals.status).toBe("matched");
    expect(preview.totals.checks).toHaveLength(3);
  });

  it("still returns a preview for a mismatch, so the user can SEE the discrepancy", async () => {
    // E7 refuses the IMPORT, not the preview: a refusal with no numbers on it
    // is indistinguishable from a broken feature.
    const { service } = build({
      ...MANDIRI_READING,
      totals: { ...MANDIRI_READING.totals, totalDebit: "- 76.500,00" },
    });
    const preview = await service.readStatementPdf(FAMILY_GROUP_ID, readDto());
    expect(preview.totals.status).toBe("mismatch");
    const debit = preview.totals.checks.find((c) => c.label === "total-debit")!;
    expect(debit.expected).toBe("76500");
    expect(debit.actual).toBe("39500");
    expect(debit.difference).toBe("-37000");
  });

  it("reports an unparseable row with its reason instead of dropping it silently", async () => {
    const { service } = build({
      ...MANDIRI_READING,
      rows: [
        ...MANDIRI_READING.rows,
        { date: "tidak diketahui", description: "x", amount: "-1.000,00" },
      ],
    });
    const preview = await service.readStatementPdf(FAMILY_GROUP_ID, readDto());
    expect(preview.rowCount).toBe(3);
    expect(preview.skippedRowsTotal).toBe(1);
    expect(preview.skippedRows[0]!.reason).toMatch(/date/i);
  });

  it("refuses when the model returns no rows at all", async () => {
    const { service } = build({ rows: [], totals: MANDIRI_READING.totals });
    await expect(
      service.readStatementPdf(FAMILY_GROUP_ID, readDto()),
    ).rejects.toThrow(/tidak ada baris transaksi/i);
  });

  it("refuses when every row fails to parse, quoting the shared reason", async () => {
    const { service } = build({
      rows: [{ date: "bukan tanggal", description: "x", amount: "-1,00" }],
      totals: MANDIRI_READING.totals,
    });
    await expect(
      service.readStatementPdf(FAMILY_GROUP_ID, readDto()),
    ).rejects.toThrow(/Tidak ada baris valid/);
  });
});

describe("commitStatementDraft", () => {
  const draft = {
    fileName: "e-Statement.pdf",
    rows: MANDIRI_READING.rows,
    totals: MANDIRI_READING.totals,
  } as never;

  it("stores whole-rupiah bigints parsed from the raw strings", async () => {
    const { service, prisma } = build();
    const sync = await service.commitStatementDraft(FAMILY_GROUP_ID, draft);

    expect(sync.rowCount).toBe(3);
    const created = prisma.bankSyncEntry.createMany.mock.calls[0]![0] as {
      data: { amount: bigint; date: Date }[];
    };
    expect(created.data.map((r) => r.amount)).toEqual([
      -37_000n,
      -2_500n,
      4_350_000n,
    ]);
    // Every one is a bigint from the parser, not a number off the wire.
    created.data.forEach((r) => expect(typeof r.amount).toBe("bigint"));
  });

  it("REFUSES a totals mismatch and stores nothing", async () => {
    const { service, prisma } = build();
    const tampered = {
      ...(draft as unknown as Record<string, unknown>),
      totals: { ...MANDIRI_READING.totals, totalDebit: "- 76.500,00" },
    } as never;

    await expect(
      service.commitStatementDraft(FAMILY_GROUP_ID, tampered),
    ).rejects.toThrow(UnprocessableEntityException);
    expect(prisma.bankSync.create).not.toHaveBeenCalled();
    expect(prisma.bankSyncEntry.createMany).not.toHaveBeenCalled();
  });

  it("carries the discrepancy in the refusal body, not just a message", async () => {
    const { service } = build();
    const tampered = {
      ...(draft as unknown as Record<string, unknown>),
      totals: { ...MANDIRI_READING.totals, totalDebit: "- 76.500,00" },
    } as never;
    try {
      await service.commitStatementDraft(FAMILY_GROUP_ID, tampered);
      throw new Error("expected a refusal");
    } catch (err) {
      const body = (err as UnprocessableEntityException).getResponse() as {
        code: string;
        totals: { status: string; checks: unknown[] };
      };
      expect(body.code).toBe("STATEMENT_TOTALS_MISMATCH");
      expect(body.totals.status).toBe("mismatch");
      expect(body.totals.checks.length).toBeGreaterThan(0);
    }
  });

  it("does NOT call the AI again — confirming costs the family nothing", async () => {
    const { service, readStatement } = build();
    await service.commitStatementDraft(FAMILY_GROUP_ID, draft);
    expect(readStatement).not.toHaveBeenCalled();
  });

  it("imports a BCA-shaped draft: DB/CR markers and a dotted-decimal amount", async () => {
    // The genuine BCA e-statement prints "3,000,000.00 DB" and "135.57",
    // in a locale where "." is the decimal point — the opposite of Mandiri.
    // `parseStatementAmount` already handles both; there is no per-bank path.
    const { service, prisma } = build();
    const bca = {
      fileName: "bca.pdf",
      rows: [
        {
          date: "2026-04-02",
          description: "TRSF E-BANKING DB",
          amount: "3,000,000.00 DB",
        },
        {
          date: "2026-04-06",
          description: "TRSF E-BANKING CR",
          amount: "4,000,000.00",
        },
        {
          date: "2026-04-17",
          description: "BIAYA ADM",
          amount: "10,000.00 DB",
        },
        { date: "2026-04-30", description: "BUNGA", amount: "135.57" },
      ],
      totals: {
        openingBalance: "7,018,919.53",
        closingBalance: "8,009,055.53",
        totalCredit: "4,000,135.57",
        totalDebit: "3,010,000.00",
      },
    } as never;

    const sync = await service.commitStatementDraft(FAMILY_GROUP_ID, bca);
    expect(sync.rowCount).toBe(4);
    const created = prisma.bankSyncEntry.createMany.mock.calls[0]![0] as {
      data: { amount: bigint }[];
    };
    expect(created.data.map((r) => r.amount)).toEqual([
      -3_000_000n,
      4_000_000n,
      -10_000n,
      // 135.57 rounds to whole rupiah, as every other import path does.
      136n,
    ]);
  });

  it("absorbs whole-rupiah rounding on a cents-quoted statement rather than refusing it", async () => {
    // The BCA fixture above sums to 4,000,136 credit against a printed
    // 4,000,135.57 — a rounding artefact, not a missing row. Refusing it
    // would make every cents-quoted statement unimportable.
    const { service } = build();
    const bca = {
      fileName: "bca.pdf",
      rows: [{ date: "2026-04-30", description: "BUNGA", amount: "135.57" }],
      totals: {
        openingBalance: null,
        closingBalance: null,
        totalCredit: "135.57",
        totalDebit: null,
      },
    } as never;
    await expect(
      service.commitStatementDraft(FAMILY_GROUP_ID, bca),
    ).resolves.toMatchObject({ rowCount: 1 });
  });
});

/**
 * The per-page split.
 *
 * Reading a whole statement in one call could not work in production: a
 * 5-page statement outran the reader's budget while nginx cut the upstream
 * at 60s and Cloudflare capped the request at ~100s, so the browser only
 * ever saw a dead connection. Pages are read one at a time now, merged in
 * the browser, and parsed by a single free call.
 */
describe("readStatementPdfPage — one page, raw strings only", () => {
  const pageDto = (text: string, pageIndex = 0) => ({
    fileName: "e-statement.pdf",
    pageCount: 3,
    pageIndex,
    text,
  });

  it("returns the model's RAW cells, with nothing parsed into money", async () => {
    const { service, readStatement } = build(MANDIRI_READING);

    const read = await service.readStatementPdfPage(
      FAMILY_GROUP_ID,
      pageDto(PAGE, 1),
    );

    expect(readStatement).toHaveBeenCalledWith(PAGE);
    expect(read.pageIndex).toBe(1);
    // Byte-for-byte what the model said. A page read that quietly returned a
    // number here would let the model's own arithmetic become a stored
    // amount without ever passing `parseStatementAmount` (E1).
    expect(read.rows).toEqual(MANDIRI_READING.rows);
    for (const row of read.rows) expect(typeof row.amount).toBe("string");
  });

  it("refuses a page with no text layer WITHOUT spending the family's key", async () => {
    const { service, readStatement } = build(MANDIRI_READING);

    await expect(
      service.readStatementPdfPage(FAMILY_GROUP_ID, pageDto("  \n \n ")),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    // The point of the check: a near-empty prompt is exactly what makes a
    // model invent a confident table of money rows, so the paid call is not
    // made at all.
    expect(readStatement).not.toHaveBeenCalled();
  });

  it("refuses when the family has no AI key, before any call", async () => {
    const { service, readStatement } = build(MANDIRI_READING, null);

    await expect(
      service.readStatementPdfPage(FAMILY_GROUP_ID, pageDto(PAGE)),
    ).rejects.toBeInstanceOf(StatementReaderNotConfiguredError);
    expect(readStatement).not.toHaveBeenCalled();
  });
});

describe("previewStatementDraft — parse and gate the merged pages, no AI", () => {
  const draftFrom = (reading: StatementReading) => ({
    fileName: "e-statement.pdf",
    pageCount: 3,
    rows: reading.rows,
    totals: reading.totals,
  });

  it("parses the merged rows and cross-checks the statement's own totals", async () => {
    const { service, readStatement } = build();

    const preview = service.previewStatementDraft(
      draftFrom(MANDIRI_READING) as never,
    );

    // Free and repeatable: confirming or re-previewing must not re-charge
    // the family for a read it already paid for.
    expect(readStatement).not.toHaveBeenCalled();
    expect(preview.rowCount).toBe(MANDIRI_READING.rows.length);
    expect(preview.totals.status).toBe("matched");
    // The raw draft rides back out untouched, so the confirm step can post
    // the same strings for the server to re-parse.
    expect(preview.draft.rows).toEqual(MANDIRI_READING.rows);
  });

  it("reports a mismatch rather than quietly previewing a short statement", async () => {
    const { service } = build();
    const short = {
      ...MANDIRI_READING,
      rows: MANDIRI_READING.rows.slice(0, -1),
    };

    const preview = service.previewStatementDraft(draftFrom(short) as never);

    // A dropped row is invisible on a review screen; the statement's own
    // arithmetic is the only thing that catches it.
    expect(preview.totals.status).toBe("mismatch");
  });
});
