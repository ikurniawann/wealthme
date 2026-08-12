import { Test, type TestingModule } from "@nestjs/testing";

import { PrismaService } from "../prisma/prisma.service";

import { ReportsService } from "./reports.service";

// EPIC-024 Task M (M1, D16, US-RPT-14) — focused unit tests for
// `getCoaMatrix`'s matrix-building logic. A lightweight `findMany` mock
// (matching the coa-accounts.service.spec.ts pattern) is enough here: the
// method's only real logic is grouping the rows `findMany` returns into
// `cells[month][day]`, not the `where` clause construction (already
// exercised by every other reports.service method's privacy tests).

const FAMILY_GROUP_ID = "fg-1";
const COA_ACCOUNT_ID = "coa-belanja";

interface FakeTxRow {
  id: string;
  amount: bigint;
  description: string | null;
  occurredAt: Date;
}

function makePrisma(rows: FakeTxRow[]) {
  return {
    transaction: {
      findMany: jest.fn().mockResolvedValue(rows),
    },
  };
}

async function buildService(rows: FakeTxRow[]) {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      ReportsService,
      { provide: PrismaService, useValue: makePrisma(rows) },
    ],
  }).compile();
  return module.get(ReportsService);
}

describe("ReportsService.getCoaMatrix", () => {
  it("empty year: no transactions produces a zeroed total and no cells", async () => {
    const service = await buildService([]);

    const result = await service.getCoaMatrix(
      FAMILY_GROUP_ID,
      COA_ACCOUNT_ID,
      2026,
      true,
    );

    expect(result.total).toBe(0);
    expect(result.cells).toEqual({});
  });

  it("short month (Feb): a leap-year Feb 29 transaction lands in month 2, day 29", async () => {
    const service = await buildService([
      {
        id: "tx-feb29",
        amount: 150_000n,
        description: "Belanja bulanan",
        occurredAt: new Date(2028, 1, 29), // 2028 is a leap year
      },
    ]);

    const result = await service.getCoaMatrix(
      FAMILY_GROUP_ID,
      COA_ACCOUNT_ID,
      2028,
      true,
    );

    expect(result.cells[2]?.[29]).toEqual([
      { txId: "tx-feb29", amount: 150_000, description: "Belanja bulanan" },
    ]);
    expect(result.total).toBe(150_000);
  });

  it("day 31 in a 30-day month (April) never appears — only the real day (30) is populated", async () => {
    const service = await buildService([
      {
        id: "tx-apr30",
        amount: 75_000n,
        description: null,
        occurredAt: new Date(2026, 3, 30), // April 30 — the last real day
      },
    ]);

    const result = await service.getCoaMatrix(
      FAMILY_GROUP_ID,
      COA_ACCOUNT_ID,
      2026,
      true,
    );

    expect(result.cells[4]?.[30]).toEqual([
      { txId: "tx-apr30", amount: 75_000, description: null },
    ]);
    // April has no 31st day — the matrix must never fabricate one.
    expect(result.cells[4]?.[31]).toBeUndefined();
  });

  it("stacks multiple transactions on the same day and sums them into the total", async () => {
    const service = await buildService([
      {
        id: "tx-1",
        amount: 100_000n,
        description: "Sarapan",
        occurredAt: new Date(2026, 0, 1),
      },
      {
        id: "tx-2",
        amount: 250_000n,
        description: "Makan malam",
        occurredAt: new Date(2026, 0, 1),
      },
    ]);

    const result = await service.getCoaMatrix(
      FAMILY_GROUP_ID,
      COA_ACCOUNT_ID,
      2026,
      true,
    );

    expect(result.cells[1]?.[1]).toEqual([
      { txId: "tx-1", amount: 100_000, description: "Sarapan" },
      { txId: "tx-2", amount: 250_000, description: "Makan malam" },
    ]);
    expect(result.total).toBe(350_000);
  });
});
