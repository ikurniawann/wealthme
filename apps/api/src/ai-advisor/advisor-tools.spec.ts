import { Test } from "@nestjs/testing";

import { PrismaService } from "../prisma/prisma.service";

import { ADVISOR_TOOL_MAX_ROWS, ADVISOR_TOOL_NAME } from "./advisor-tools";
import { AiAdvisorFactory } from "./ai-advisor-factory.service";
import { AiAdvisorService } from "./ai-advisor.service";
import { AiKeyService } from "./ai-key.service";

/**
 * The advisor's tool reaches real money rows, so the properties under test
 * are about REACH, not about phrasing:
 *
 *  1. The family is bound server-side. The model names a period; it can
 *     never name a family, so an invented `familyGroupId` cannot widen what
 *     it sees.
 *  2. The viewer's privacy filter is applied to the tool as well as to the
 *     prompt — otherwise a role that cannot see private rows on the page
 *     could read them by asking the advisor.
 */

const FAMILY_GROUP_ID = "fg-1";

function build() {
  const groupBy = jest.fn().mockResolvedValue([]);
  const findMany = jest.fn().mockResolvedValue([]);
  const prisma = { transaction: { groupBy, findMany } };
  return { prisma, groupBy, findMany };
}

async function makeService(prisma: unknown) {
  const moduleRef = await Test.createTestingModule({
    providers: [
      AiAdvisorService,
      { provide: PrismaService, useValue: prisma },
      { provide: AiKeyService, useValue: { resolveDecryptedKey: jest.fn() } },
      { provide: AiAdvisorFactory, useValue: { create: jest.fn() } },
    ],
  }).compile();
  return moduleRef.get(AiAdvisorService);
}

describe("advisor tool runner", () => {
  it("binds the family server-side and ignores one the model invents", async () => {
    const { prisma, groupBy } = build();
    const service = await makeService(prisma);
    const run = service.buildToolRunner(FAMILY_GROUP_ID, "owner");

    await run(ADVISOR_TOOL_NAME, {
      from: "2026-03-01",
      to: "2026-03-31",
      // A model that decides to name someone else's family must not be
      // able to reach it. The argument is not in the schema at all.
      familyGroupId: "fg-someone-else",
    });

    const where = groupBy.mock.calls[0]![0].where as Record<string, unknown>;
    expect(where.familyGroupId).toBe(FAMILY_GROUP_ID);
  });

  it("makes `to` inclusive, so the last day of a month is not dropped", async () => {
    const { prisma, groupBy } = build();
    const service = await makeService(prisma);
    const run = service.buildToolRunner(FAMILY_GROUP_ID, "owner");

    await run(ADVISOR_TOOL_NAME, { from: "2026-03-01", to: "2026-03-31" });

    const where = groupBy.mock.calls[0]![0].where as {
      occurredAt: { gte: Date; lt: Date };
    };
    expect(where.occurredAt.gte.toISOString()).toBe("2026-03-01T00:00:00.000Z");
    // Exclusive upper bound at the NEXT midnight — asking for the 31st and
    // silently excluding the 31st is the classic off-by-one on a money total.
    expect(where.occurredAt.lt.toISOString()).toBe("2026-04-01T00:00:00.000Z");
  });

  it("applies the viewer's privacy filter, not just the prompt's", async () => {
    const { prisma, groupBy } = build();
    const service = await makeService(prisma);
    // A role that cannot see private rows must not read them by asking.
    const run = service.buildToolRunner(FAMILY_GROUP_ID, "member");

    await run(ADVISOR_TOOL_NAME, {});

    const where = groupBy.mock.calls[0]![0].where as Record<string, unknown>;
    expect(where.AND).toBeDefined();
  });

  it("returns totals per MONTH, which is what a comparison question needs", async () => {
    const { prisma, groupBy, findMany } = build();
    groupBy.mockResolvedValue([
      { type: "expense", _sum: { amount: 500n }, _count: { _all: 2 } },
    ]);
    findMany.mockResolvedValue([
      {
        occurredAt: new Date("2026-03-05T00:00:00Z"),
        type: "expense",
        amount: 200n,
      },
      {
        occurredAt: new Date("2026-03-09T00:00:00Z"),
        type: "expense",
        amount: 100n,
      },
      {
        occurredAt: new Date("2026-04-02T00:00:00Z"),
        type: "expense",
        amount: 200n,
      },
    ]);
    const service = await makeService(prisma);
    const run = service.buildToolRunner(FAMILY_GROUP_ID, "owner");

    const answer = JSON.parse(await run(ADVISOR_TOOL_NAME, {})) as {
      months: { month: string; expense: string }[];
      totals: Record<string, { total: string }>;
    };

    expect(answer.months).toEqual([
      { month: "2026-03", income: "0", expense: "300" },
      { month: "2026-04", income: "0", expense: "200" },
    ]);
    expect(answer.totals.expense.total).toBe("500");
  });

  it("omits rows unless they were asked for, and caps them when they are", async () => {
    const { prisma, findMany } = build();
    const service = await makeService(prisma);
    const run = service.buildToolRunner(FAMILY_GROUP_ID, "owner");

    const summaryOnly = JSON.parse(await run(ADVISOR_TOOL_NAME, {})) as {
      rows?: unknown;
    };
    // Rows cost tokens on a free-tier key; they are opt-in.
    expect(summaryOnly.rows).toBeUndefined();

    findMany.mockClear();
    await run(ADVISOR_TOOL_NAME, { includeRows: true });
    const rowCall = findMany.mock.calls.at(-1)![0] as { take: number };
    expect(rowCall.take).toBe(ADVISOR_TOOL_MAX_ROWS);
  });

  it("answers a bad tool name and bad arguments instead of throwing", async () => {
    const { prisma } = build();
    const service = await makeService(prisma);
    const run = service.buildToolRunner(FAMILY_GROUP_ID, "owner");

    // A model mistake is the model's to correct on the next round; throwing
    // would fail the user's whole question over a malformed argument.
    const wrongName = JSON.parse(await run("drop_everything", {})) as {
      error: string;
    };
    expect(wrongName.error).toContain("Unknown tool");

    const badArgs = JSON.parse(
      await run(ADVISOR_TOOL_NAME, { from: "March 2026" }),
    ) as { error: string };
    expect(badArgs.error).toBe("Invalid arguments");
  });
});
