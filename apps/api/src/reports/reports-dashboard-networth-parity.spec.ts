/**
 * EPIC-022 (adversarial review round 3, finding 1, CRITICAL) —
 * `ReportsService.getBalanceSheet` never queried `investment` at all, so any
 * family holding investments had its balance sheet under-report
 * totalAssets/netWorth by the entire portfolio while `DashboardService`
 * (used by /ringkasan and /beranda) reported correctly — and the balance
 * sheet's ✅ "Seimbang" banner printed over the discrepancy the whole time.
 *
 * This is a cross-service parity test: ONE fake Prisma mock feeds BOTH
 * `ReportsService.getBalanceSheet` and `DashboardService.getNetWorth`
 * (a genuinely different service/query path — see
 * `laporan-utils.ts`'s `computeBalanceSheetIdentity` for the client-side
 * check built on this same independence). For a family holding accounts,
 * physical assets, liabilities, AND investments, the two must agree.
 */

import { Test, type TestingModule } from "@nestjs/testing";
import { Decimal } from "@prisma/client/runtime/library";

import { DashboardService } from "../dashboard/dashboard.service";
import { PrismaService } from "../prisma/prisma.service";

import { ReportsService } from "./reports.service";

const FAMILY_GROUP_ID = "fg-1";

function makeFakePrisma() {
  const accounts = [
    {
      id: "a1",
      name: "BCA",
      type: "bank",
      balance: 5_000_000n,
      isPrivate: false,
    },
    {
      id: "a2",
      name: "Dompet",
      type: "cash",
      balance: 500_000n,
      isPrivate: false,
    },
  ];
  const assetsList = [
    { name: "Rumah", type: "property", currentValue: 800_000_000n },
  ];
  const liabilitiesList = [
    { name: "KPR", type: "mortgage", remainingBalance: 300_000_000n },
  ];
  // Two holdings: one with a recorded price (priced at more than cost), one
  // with no price row yet (falls back to cost basis) — exercises both
  // branches of the shared `investmentPositionValue` basis.
  const investmentsList = [
    {
      name: "Bank Central Asia",
      ticker: "BBCA",
      quantity: new Decimal(100),
      costBasisPerUnit: new Decimal(9_000),
      prices: [{ price: new Decimal(10_000) }],
    },
    {
      name: "Reksa Dana Pasar Uang",
      ticker: "RDPU",
      quantity: new Decimal(50),
      costBasisPerUnit: new Decimal(200_000),
      prices: [] as { price: Decimal }[],
    },
  ];

  return {
    account: {
      findMany: jest.fn().mockResolvedValue(accounts),
    },
    asset: {
      findMany: jest.fn().mockResolvedValue(assetsList),
    },
    liability: {
      findMany: jest.fn().mockResolvedValue(liabilitiesList),
    },
    investment: {
      findMany: jest.fn().mockResolvedValue(investmentsList),
    },
  };
}

describe("ReportsService.getBalanceSheet vs DashboardService.getNetWorth — cross-source parity", () => {
  it("totalAssets/netWorth match for a family holding accounts, assets, liabilities, and investments", async () => {
    const prisma = makeFakePrisma();

    const reportsMod: TestingModule = await Test.createTestingModule({
      providers: [ReportsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    const reportsService = reportsMod.get(ReportsService);

    const dashboardMod: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    const dashboardService = dashboardMod.get(DashboardService);

    const balanceSheet = await reportsService.getBalanceSheet(
      FAMILY_GROUP_ID,
      new Date(),
      true,
    );
    const netWorth = await dashboardService.getNetWorth(FAMILY_GROUP_ID, true);

    const dashboardTotalAssets =
      Number(netWorth.accountsTotal) +
      Number(netWorth.investmentsTotal) +
      Number(netWorth.assetsTotal);

    // The regression this test guards: before the fix, balanceSheet.
    // totalAssets omitted investments entirely (5_500_000 cash + 800_000_000
    // property, missing the ~Rp 1.010.000.000 portfolio), while
    // dashboardTotalAssets already included it — the two would NOT have
    // matched, and the balance sheet's ✅ banner would have been printed
    // over that exact gap.
    expect(balanceSheet.totalAssets).toBe(dashboardTotalAssets);
    expect(balanceSheet.netWorth).toBe(Number(netWorth.netWorth));

    // Confirm the investments bucket is genuinely present and correctly
    // valued (BBCA: 10_000 × 100 = 1_000_000; RDPU, no price yet, falls
    // back to cost basis: 200_000 × 50 = 10_000_000).
    const investBucket = balanceSheet.assets.find(
      (group) => group.category === "Investasi",
    );
    expect(investBucket).toBeDefined();
    expect(investBucket?.amount).toBe(1_000_000 + 10_000_000);
  });

  it("agrees even when there are no investments at all (regression guard for the non-investment path)", async () => {
    const prisma = {
      account: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "a1",
            name: "BCA",
            type: "bank",
            balance: 1_000_000n,
            isPrivate: false,
          },
        ]),
      },
      asset: { findMany: jest.fn().mockResolvedValue([]) },
      liability: { findMany: jest.fn().mockResolvedValue([]) },
      investment: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const reportsMod: TestingModule = await Test.createTestingModule({
      providers: [ReportsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    const reportsService = reportsMod.get(ReportsService);

    const dashboardMod: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    const dashboardService = dashboardMod.get(DashboardService);

    const balanceSheet = await reportsService.getBalanceSheet(
      FAMILY_GROUP_ID,
      new Date(),
      true,
    );
    const netWorth = await dashboardService.getNetWorth(FAMILY_GROUP_ID, true);

    expect(balanceSheet.totalAssets).toBe(1_000_000);
    expect(balanceSheet.netWorth).toBe(Number(netWorth.netWorth));
    expect(
      balanceSheet.assets.some((group) => group.category === "Investasi"),
    ).toBe(false);
  });
});
