import { BadRequestException } from "@nestjs/common";

import { InvestmentMetadataService } from "./investment-metadata.service";

import type { PrismaService } from "../prisma/prisma.service";

// Client bug 2026-10-21 — "gak bisa edit investasi": editing a holding
// re-ran the platform catalog check on its unchanged placement, so a
// holding whose platform's catalog had narrowed could never be renamed.
describe("InvestmentMetadataService.update — catalog check", () => {
  const holding = {
    id: "inv-1",
    familyGroupId: "fg",
    type: "kripto",
    market: "CRYPTO",
    name: "Bitcoin",
    ticker: "BTC",
    ownerUserId: null,
    platformAccountId: "pa-gotrade",
    cashAccountId: null,
    priceSymbol: null,
    currency: "IDR",
    details: {},
  };
  const build = () => {
    const tx = {
      $queryRaw: jest.fn(),
      investment: {
        findFirst: jest.fn().mockResolvedValue(holding),
        update: jest.fn().mockResolvedValue({ ...holding, name: "BTC" }),
      },
      member: { findFirst: jest.fn() },
      platformAccount: {
        // Gotrade's catalog has no kripto.
        findFirst: jest.fn().mockResolvedValue({
          id: "pa-gotrade",
          platformKey: "gotrade",
          ownerUserId: null,
        }),
      },
      account: { findFirst: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const prisma = {
      $transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
    } as unknown as PrismaService;
    return { tx, service: new InvestmentMetadataService(prisma) };
  };
  const actor = {
    userId: "u-1",
    member: { userId: "u-1", role: "owner" as const },
  };

  it("renames a holding on its existing platform", async () => {
    const { tx, service } = build();
    await service.update(
      "fg",
      "inv-1",
      { market: "CRYPTO", name: "BTC", platformAccountId: "pa-gotrade" },
      actor,
    );
    expect(tx.investment.update).toHaveBeenCalled();
  });

  it("corrects a wrong ticker, uppercased", async () => {
    const { tx, service } = build();
    await service.update(
      "fg",
      "inv-1",
      { market: "CRYPTO", ticker: " eth ", platformAccountId: "pa-gotrade" },
      actor,
    );
    const call = tx.investment.update.mock.calls[0][0] as {
      data: { ticker: string };
    };
    expect(call.data.ticker).toBe("ETH");
  });

  it("still refuses moving it to a platform that lacks the product", async () => {
    const { tx, service } = build();
    tx.investment.findFirst.mockResolvedValue({
      ...holding,
      platformAccountId: null,
    });
    await expect(
      service.update(
        "fg",
        "inv-1",
        { market: "CRYPTO", platformAccountId: "pa-gotrade" },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
