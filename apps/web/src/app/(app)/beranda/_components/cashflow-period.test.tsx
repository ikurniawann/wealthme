jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("../../../../hooks/use-gold-price", () => ({
  useGoldPrice: () => ({ hasPrice: false, toGoldGrams: () => null }),
}));

jest.mock("../../../../components/charts/apex-presets", () => ({
  CashflowChart: () => null,
}));

jest.mock("../../../../hooks/use-money", () => ({
  useMoney: () => ({
    currency: "IDR",
    isIndicative: false,
    isReady: true,
    format: (value: number) => `Rp ${value}`,
    formatCompact: (value: number) => `Rp ${value}`,
    formatExact: (value: string | bigint) =>
      `Rp ${BigInt(value).toLocaleString("id-ID")}`,
  }),
}));

jest.mock("./use-beranda-data", () => ({
  PERIODS: ["6M", "12M"],
}));

import { fireEvent, render, screen } from "@testing-library/react";
import type { NetWorthHistoryPointDto } from "@wealthme/contracts";
import { id as t } from "../../../../i18n/id";
import type { MoneyFormatters } from "./use-beranda-data";
import { BerandaHero } from "./hero-card";
import { CashflowCard } from "./cashflow-card";

const fmt: MoneyFormatters = {
  money: (value) => `Rp ${value}`,
  moneyCompact: (value) => `Rp ${value}`,
  currency: "IDR",
  isIndicative: false,
  isReady: true,
  formatMoney: (value) => `Rp ${value}`,
};

function renderHero(onPeriodChange = jest.fn()) {
  const historyPoints: NetWorthHistoryPointDto[] = [];
  return render(
    <BerandaHero
      isLoading
      netWorth={0}
      assetsTotal={0}
      totalLiabilities={0}
      currentMonth={undefined}
      historyPoints={historyPoints}
      isHistoryLoading
      fmt={fmt}
      period="6M"
      onPeriodChange={onPeriodChange}
    />,
  );
}

describe("Beranda period ownership", () => {
  it("period tabs are labeled as the net-worth history range", () => {
    const onPeriodChange = jest.fn();
    renderHero(onPeriodChange);

    expect(
      screen.getByRole("tablist", {
        name: t.beranda.periodToggleAriaLabel,
      }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("tab", { name: t.beranda.periodToggle12 }),
    );
    expect(onPeriodChange).toHaveBeenCalledWith("12M");
  });

  it("cashflow keeps the six-month title for its fixed series", () => {
    render(
      <CashflowCard
        isLoading
        cashflow={undefined}
        currentMonth={undefined}
        fmt={fmt}
      />,
    );

    expect(screen.getByText(t.beranda.cashflowTitle6)).toBeInTheDocument();
    expect(
      screen.queryByText(t.beranda.cashflowTitle12),
    ).not.toBeInTheDocument();
  });
});
