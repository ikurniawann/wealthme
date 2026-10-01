import { ForbiddenException } from "@nestjs/common";
import { Role } from "@prisma/client";

import { BalancesVisibleGuard } from "../guards/balances-visible.guard";
import { TenantGuard } from "../guards/tenant.guard";

import {
  redactAccount,
  redactDashboardSummary,
  redactNetWorth,
} from "./balance-visibility.util";

import type { DashboardSummaryDto, NetWorthDto } from "@wealthme/contracts";

const HIDDEN = { balancesHidden: true };
const VISIBLE = { balancesHidden: false };

const summary: DashboardSummaryDto = {
  netWorth: 1_000,
  assetsTotal: 2_000,
  cashflow: { months: ["Jan"], income: [5], expense: [3], max: 5 },
  sparkline: [1, 2],
  allocation: [{ label: "Bank", value: 100, amount: 900, color: "#000" }],
  accountSummary: [{ type: "bank", label: "Bank", total: 900 }],
  currentMonth: { income: 5, expense: 3, net: 2, savingsRate: 40 },
  recentTransactions: [],
};
const netWorth: NetWorthDto = {
  accountsTotal: "1",
  investmentsTotal: "2",
  assetsTotal: "3",
  liabilitiesTotal: "4",
  netWorth: "5",
  currency: "IDR",
};

function ctxFor(member: unknown, params: Record<string, string> = {}) {
  const req = {
    user: { sub: "user-tina" },
    params,
    tenantContext: { member },
  };
  return { switchToHttp: () => ({ getRequest: () => req }), _req: req };
}

describe('"Lihat saldo" balance visibility', () => {
  it("nulls an account balance and marks it when hidden", () => {
    expect(redactAccount({ id: "a", balance: "500" }, HIDDEN)).toEqual({
      id: "a",
      balance: null,
      balancesHidden: true,
    });
  });

  it("leaves an account untouched when visible", () => {
    const acc = { id: "a", balance: "500" };
    expect(redactAccount(acc, VISIBLE)).toBe(acc);
    expect(redactAccount(acc, null)).toBe(acc);
  });

  it("withholds every dashboard money aggregate but keeps transactions", () => {
    const out = redactDashboardSummary(summary, HIDDEN);
    expect(out).toMatchObject({
      balancesHidden: true,
      netWorth: null,
      assetsTotal: null,
      cashflow: null,
      currentMonth: null,
      sparkline: [],
      allocation: [],
      accountSummary: [],
    });
    expect(out.recentTransactions).toBe(summary.recentTransactions);
    expect(redactDashboardSummary(summary, VISIBLE)).toBe(summary);
  });

  it("nulls net worth when hidden", () => {
    expect(redactNetWorth(netWorth, HIDDEN)).toEqual({
      currency: "IDR",
      accountsTotal: null,
      investmentsTotal: null,
      assetsTotal: null,
      liabilitiesTotal: null,
      netWorth: null,
      balancesHidden: true,
    });
  });

  it("BalancesVisibleGuard 403s a hidden member and passes others", () => {
    const guard = new BalancesVisibleGuard();
    expect(() => guard.canActivate(ctxFor(HIDDEN) as never)).toThrow(
      ForbiddenException,
    );
    expect(guard.canActivate(ctxFor(VISIBLE) as never)).toBe(true);
  });

  describe("TenantGuard resolution", () => {
    async function resolve(role: Role, canViewBalances: boolean) {
      const prisma = {
        member: {
          findUnique: jest.fn().mockResolvedValue({
            id: "m",
            userId: "user-tina",
            familyGroupId: "fg",
            role,
            canViewBalances,
            accessOverrides: null,
            accessRole: null,
          }),
        },
      };
      const ctx = ctxFor(null, { familyGroupId: "fg" });
      await new TenantGuard(prisma as never).canActivate(ctx as never);
      return (ctx._req as unknown as { tenantContext: any }).tenantContext;
    }

    it("hides balances for a member with the flag off", async () => {
      const tc = await resolve(Role.operational, false);
      expect(tc.member.balancesHidden).toBe(true);
      expect(tc.access.balancesHidden).toBe(true);
    });

    it("owner and spouse always see balances", async () => {
      for (const role of [Role.owner, Role.spouse]) {
        const tc = await resolve(role, false);
        expect(tc.member.balancesHidden).toBe(false);
        expect(tc.access.balancesHidden).toBeUndefined();
      }
    });

    it("defaults to visible", async () => {
      const tc = await resolve(Role.member, true);
      expect(tc.member.balancesHidden).toBe(false);
    });
  });
});

describe("redactAccount — own accounts stay visible", () => {
  const hidden = { balancesHidden: true } as const;
  it("keeps the balance of an account the viewer owns", () => {
    const acc = { balance: "500", ownerUserId: "u1" };
    expect(redactAccount(acc, hidden, "u1").balance).toBe("500");
  });
  it("hides a shared account", () => {
    const acc = { balance: "500", ownerUserId: null };
    expect(redactAccount(acc, hidden, "u1")).toMatchObject({
      balance: null,
      balancesHidden: true,
    });
  });
  it("hides another member's account", () => {
    const acc = { balance: "500", ownerUserId: "u2" };
    expect(redactAccount(acc, hidden, "u1").balance).toBeNull();
  });
});
