/**
 * Polish batch 7b item 4 — the "KPR jatuh tempo ..." due-date notice used to
 * render in both this card ("Komposisi Kekayaan") and attention-card.tsx
 * ("Perlu Perhatian"). It now lives only in the latter; this locks in that
 * WealthSnapshot no longer accepts/renders it.
 */

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

import { render, screen } from "@testing-library/react";

import { WealthSnapshot } from "./wealth-snapshot";
import { id as idDict } from "../../../../i18n/id";

describe("WealthSnapshot — no duplicated due-date notice (polish batch 7b item 4)", () => {
  it("never renders the liability due-date notice, even with liquid/non-liquid data", () => {
    render(
      <WealthSnapshot
        isLoading={false}
        liquidTotal={10_000_000}
        nonLiquidTotal={5_000_000}
        liquidPct={67}
        nonLiquidPct={33}
        fmt={{
          moneyCompact: (n: number) => `Rp ${n}`,
          money: (n: number) => `Rp ${n}`,
          currency: "IDR",
          isIndicative: false,
          isReady: true,
          formatMoney: (n: number) => `Rp ${n}`,
        }}
      />,
    );

    expect(
      screen.getByText(idDict.beranda.wealthComposition),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(idDict.beranda.liabilityDueNotice),
    ).not.toBeInTheDocument();
  });
});
