jest.mock("../../../../lib/auth-client", () => ({
  authClient: {
    useSession: jest.fn(() => ({ data: null, isPending: false })),
    signOut: jest.fn(),
  },
}));
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => "/beranda",
}));

import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ShellProvider } from "../../../../components/shell/shell-context";
import {
  axisCompact,
  BerandaHeroCard,
  initials,
  installmentProgress,
  monthDelta,
  monthLabel,
  splitCurrency,
} from "./bento-sections";
import { dotColumns } from "./mobile-home";
import type { MoneyFormatters } from "./use-beranda-data";

const fmt: MoneyFormatters = {
  money: (v) => `Rp ${v.toLocaleString("id-ID")}`,
  moneyCompact: (v) => `Rp ${v}`,
  currency: "IDR",
  isIndicative: false,
  isReady: true,
  formatMoney: (v) => String(v),
};

function wrap({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <ShellProvider>{children}</ShellProvider>
    </QueryClientProvider>
  );
}

describe("Beranda bento helpers", () => {
  test("monthDelta compares the last two months and refuses a zero base", () => {
    expect(monthDelta([100, 150])).toEqual({ dir: "up", pct: 50 });
    expect(monthDelta([200, 100])).toEqual({ dir: "down", pct: 50 });
    expect(monthDelta([0, 100])).toBeNull();
    expect(monthDelta([100])).toBeNull();
  });

  test("monthLabel shortens ISO months and passes other labels through", () => {
    expect(monthLabel("2026-09", "id-ID")).toMatch(/Sep/);
    expect(monthLabel("Sep", "id-ID")).toBe("Sep");
  });

  test("axisCompact drops the currency and uses Indonesian units", () => {
    expect(axisCompact(25_000_000)).toBe("25 jt");
    expect(axisCompact(1_500_000_000)).toBe("1,5 M");
    expect(axisCompact(0)).toBe("0");
  });

  test("splitCurrency separates the small hero prefix, keeping the sign", () => {
    expect(splitCurrency("Rp 12.714.000")).toEqual({
      prefix: "Rp",
      amount: "12.714.000",
    });
    expect(splitCurrency("-Rp 5.000")).toEqual({
      prefix: "Rp",
      amount: "-5.000",
    });
    expect(splitCurrency("Memuat…")).toEqual({
      prefix: null,
      amount: "Memuat…",
    });
  });

  test("initials skip symbols such as '&'", () => {
    expect(initials("Makan & Minum")).toBe("MM");
    expect(initials(null)).toBe("?");
  });

  test("installmentProgress clamps to the tenor and needs a start date", () => {
    const now = new Date(2026, 8, 30);
    expect(
      installmentProgress({ startDate: "2026-07-01", tenorMonths: 12 }, now),
    ).toEqual({ current: 3, total: 12 });
    expect(
      installmentProgress({ startDate: "2010-01-01", tenorMonths: 12 }, now),
    ).toEqual({ current: 12, total: 12 });
    expect(
      installmentProgress({ startDate: null, tenorMonths: 12 } as never, now),
    ).toBeNull();
  });

  test("dotColumns stacks income and expense within 8 dots per month", () => {
    const cols = dotColumns([100, 50], [60, 0]);
    expect(cols[0].income + cols[0].expense).toBeLessThanOrEqual(8);
    expect(cols[0]).toEqual({ expense: 3, income: 5 });
    expect(cols[1]).toEqual({ expense: 0, income: 3 });
  });
});

describe("BerandaHeroCard", () => {
  const base = {
    currentMonth: { income: 100, expense: 40, net: 60, savingsRate: 60 },
    cashflow: {
      months: ["2026-08", "2026-09"],
      income: [80, 100],
      expense: [50, 40],
      max: 100,
    },
    fmt,
  };

  test("flags a negative net worth in the caption", () => {
    render(<BerandaHeroCard {...base} netWorth={-5000} />, { wrapper: wrap });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
      "-5.000",
    );
    expect(screen.getByText(/Utang lebih besar dari aset/)).toBeInTheDocument();
  });

  test("offers the prototype's range and chart-type controls", () => {
    render(<BerandaHeroCard {...base} netWorth={1000} />, { wrapper: wrap });
    expect(screen.getByRole("combobox", { name: "Periode" })).toHaveValue("7");
    expect(
      screen.getByRole("button", { name: "Grafik batang" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "Grafik garis" }),
    ).toHaveAttribute("aria-pressed", "false");
  });
});

describe("Beranda prototype-parity helpers", () => {
  const { goalPair, lastActive } = jest.requireActual(
    "./bento-sections",
  ) as typeof import("./bento-sections");
  const { bucketDays, spendByCategory } = jest.requireActual(
    "./use-beranda-flow",
  ) as typeof import("./use-beranda-flow");

  test("goalPair keeps both numbers in the target's unit", () => {
    expect(goalPair(250_000_000, 1_000_000_000)).toBe("0,3 / 1 M");
    expect(goalPair(42_000_000, 60_000_000)).toBe("42 / 60 jt");
  });

  test("lastActive picks the latest day that moved money", () => {
    const z = { income: 0, expense: 0, savings: 0 };
    expect(lastActive([{ ...z, income: 5 }, z, z])).toBe(0);
    expect(lastActive([z, z])).toBe(1);
  });

  test("bucketDays sorts income, expense and transfers into their day", () => {
    const today = new Date(2026, 8, 30, 15);
    const days = bucketDays(
      [
        {
          amount: "100",
          type: "income",
          occurredAt: new Date(2026, 8, 30, 9).toISOString(),
        },
        {
          amount: "-40",
          type: "expense",
          occurredAt: new Date(2026, 8, 29, 9).toISOString(),
        },
        {
          amount: "25",
          type: "transfer",
          occurredAt: new Date(2026, 8, 29, 9).toISOString(),
        },
        {
          amount: "999",
          type: "income",
          occurredAt: new Date(2026, 8, 1).toISOString(),
        },
      ],
      7,
      today,
      (d) => String(d.getDate()),
    );
    expect(days.map((d) => d.label)).toEqual([
      "24",
      "25",
      "26",
      "27",
      "28",
      "29",
      "30",
    ]);
    expect(days[6]).toMatchObject({ income: 100, expense: 0, savings: 0 });
    expect(days[5]).toMatchObject({ income: 0, expense: 40, savings: 25 });
  });

  test("spendByCategory ranks expenses and names the uncategorized", () => {
    expect(
      spendByCategory(
        [
          { amount: "10", type: "expense", categoryName: "Makan" },
          { amount: "30", type: "expense", categoryName: null },
          { amount: "50", type: "income", categoryName: "Gaji" },
        ],
        "Lainnya",
      ),
    ).toEqual([
      { label: "Lainnya", value: 30 },
      { label: "Makan", value: 10 },
    ]);
  });
});
