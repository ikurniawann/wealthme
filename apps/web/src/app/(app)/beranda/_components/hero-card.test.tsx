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

import { fireEvent, render, screen } from "@testing-library/react";
import type { NetWorthHistoryPointDto } from "@wealthme/contracts";

jest.mock("../../../../hooks/use-money", () => {
  const { formatRupiah, formatRupiahCompact } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("../../../../lib/format");
  return {
    useMoney: () => ({
      currency: "IDR",
      isIndicative: false,
      isReady: true,
      format: formatRupiah,
      formatCompact: formatRupiahCompact,
      formatExact: (idr: string | bigint) =>
        `Rp ${BigInt(idr).toLocaleString("id-ID")}`,
    }),
  };
});

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

function renderHero(
  netWorth: number,
  net = 393250,
  historyPoints: NetWorthHistoryPointDto[] = [],
) {
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
      historyPoints={historyPoints}
      isHistoryLoading={false}
      period="6M"
      onPeriodChange={jest.fn()}
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

describe("BerandaHero — real net-worth history chart", () => {
  it("starts with the latest persisted value and supports keyboard scrubbing", () => {
    renderHero(1_250_000, 393250, [
      {
        capturedAt: "2026-09-01T00:00:00.000Z",
        netWorth: "1000000",
        totalCash: "1000000",
        totalInvestments: "0",
        totalAssets: "1000000",
        totalLiabilities: "0",
      },
      {
        capturedAt: "2026-09-29T00:00:00.000Z",
        netWorth: "1250000",
        totalCash: "1250000",
        totalInvestments: "0",
        totalAssets: "1250000",
        totalLiabilities: "0",
      },
    ]);

    const chart = screen.getByRole("group", { name: /riwayat kekayaan/i });
    expect(chart).toHaveTextContent("Rp 1.250.000");
    expect(chart).toHaveTextContent("29 Sep 2026");

    fireEvent.keyDown(chart, { key: "ArrowLeft" });
    expect(chart).toHaveTextContent("Rp 1.000.000");
    expect(chart).toHaveTextContent("1 Sep 2026");
  });

  it("does not invent a chart when fewer than two persisted snapshots exist", () => {
    renderHero(1_250_000, 393250, [
      {
        capturedAt: "2026-09-29T00:00:00.000Z",
        netWorth: "1250000",
        totalCash: "1250000",
        totalInvestments: "0",
        totalAssets: "1250000",
        totalLiabilities: "0",
      },
    ]);

    expect(
      screen.getByText(/riwayat kekayaan belum tersedia/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: /riwayat kekayaan/i }),
    ).not.toBeInTheDocument();
  });
});
