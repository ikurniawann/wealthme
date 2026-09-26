/**
 * Batch 2 (#3) — the hero's base treatment (background gradient) must track
 * `netWorth`'s own sign, not `currentMonth.net` (a separate "did I improve
 * this month" question, answered by the trend pill and left untouched).
 * "Total Kekayaan Bersih: Rp -11.944.475" previously rendered on the same
 * green `gradient-wealth` background as a positive net worth.
 */

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("../../../../hooks/use-gold-price", () => ({
  useGoldPrice: () => ({ hasPrice: false, toGoldGrams: () => null }),
}));

import { render } from "@testing-library/react";

import { BerandaHero } from "./hero-card";
import type { MoneyFormatters } from "./use-beranda-data";

const fmt: MoneyFormatters = {
  money: (v) => `Rp ${v}`,
  moneyCompact: (v) => `Rp ${v}`,
  currency: "IDR",
  isIndicative: false,
  isReady: true,
  formatMoney: (v) => `Rp ${v}`,
};

function renderHero(netWorth: number, net = 393250) {
  return render(
    <BerandaHero
      isLoading={false}
      netWorth={netWorth}
      assetsTotal={1_000_000}
      totalLiabilities={500_000}
      currentMonth={{
        income: 5_000_000,
        expense: 5_000_000 - net,
        net,
        savingsRate: 12,
      }}
      sparklinePoints={[1, 2, 3]}
      fmt={fmt}
    />,
  );
}

describe("BerandaHero — net-worth-sign warning treatment (batch-2 #3)", () => {
  it("renders the healthy wealth gradient when netWorth is positive", () => {
    const { container } = renderHero(11_944_475);
    const hero = container.querySelector(".hero");
    expect(hero).toHaveClass("gradient-wealth");
    expect(hero?.className).not.toContain("bg-[linear-gradient");
  });

  it("swaps to a warning gradient when netWorth itself is negative, even though this month's cashflow is positive", () => {
    const { container } = renderHero(-11_944_475, 393250);
    const hero = container.querySelector(".hero");
    expect(hero).not.toHaveClass("gradient-wealth");
    expect(hero?.className).toContain("bg-[linear-gradient");
  });

  it("keeps the trend pill tracking currentMonth.net independently of the hero's own warning state", () => {
    // netWorth negative (warning hero) but this month's cashflow is UP —
    // the pill must still show the up-trend icon/label, unaffected by the
    // hero's own background branch.
    const { container } = renderHero(-11_944_475, 393250);
    expect(container.querySelector(".badge")?.textContent).toMatch(
      /Bulan ini|this month/i,
    );
    expect(
      container.querySelector(".badge svg.lucide-trending-up"),
    ).toBeInTheDocument();
  });
});
