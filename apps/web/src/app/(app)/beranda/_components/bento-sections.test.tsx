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
  BerandaHeroCard,
  initials,
  installmentProgress,
  monthDelta,
  monthLabel,
  SpendingBento,
  splitCurrency,
} from "./bento-sections";
import { currentMonthWindow } from "../../../../lib/month-compare";
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
    expect(monthDelta([100, 150], "income")).toEqual({
      dir: "up",
      pct: 50,
      comparison: expect.objectContaining({ basis: "full" }),
    });
    expect(monthDelta([200, 100], "expense")).toEqual(
      expect.objectContaining({ dir: "down", pct: 50 }),
    );
    expect(monthDelta([0, 100], "income")).toBeNull();
    expect(monthDelta([100], "income")).toBeNull();
  });

  test("monthDelta uses the prior day-aligned window while the month runs", () => {
    const window = currentMonthWindow(new Date("2026-10-06T05:00:00.000Z"));
    const prior = { income: 0, expense: 230_000, net: -230_000 };
    // Full Sep 4.525.000 would read ↓68%; like-for-like (1–6 Sep) is ↑530%.
    const series = [4_525_000, 1_450_000];
    const full = monthDelta(series, "expense");
    expect(full?.dir).toBe("down");
    expect(Math.round(full!.pct)).toBe(68);
    const aligned = monthDelta(series, "expense", { window, prior });
    expect(aligned?.dir).toBe("up");
    expect(Math.round(aligned!.pct)).toBe(530);
    // Prior window still loading → honest full-month fallback, flagged.
    expect(
      monthDelta(series, "expense", { window, prior: undefined })?.comparison
        .basis,
    ).toBe("window-pending");
  });

  test("monthLabel shortens ISO months and passes other labels through", () => {
    expect(monthLabel("2026-09", "id-ID")).toMatch(/Sep/);
    expect(monthLabel("Sep", "id-ID")).toBe("Sep");
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
    currentMonth: {
      income: 100,
      expense: 40,
      net: 60,
      savingsRate: 60,
      expenseByCategory: [],
    },
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
    expect(document.querySelector(".wm-big")?.textContent).toContain("-5.000");
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

  test("expense up against the like-for-like window is a bad ↑530% naming both windows", () => {
    const monthCompare = {
      window: currentMonthWindow(new Date("2026-10-06T05:00:00.000Z")),
      prior: { income: 100, expense: 230_000, net: -229_900 },
    };
    render(
      <BerandaHeroCard
        {...base}
        cashflow={{
          months: ["Sep", "Okt"],
          income: [100, 100],
          expense: [4_525_000, 1_450_000],
          max: 4_525_000,
        }}
        monthCompare={monthCompare}
        netWorth={1000}
      />,
      { wrapper: wrap },
    );
    const deltas = [...document.querySelectorAll(".wm-delta")];
    const expenseDelta = deltas.find((el) => el.textContent?.includes("530%"));
    expect(expenseDelta).toBeDefined();
    expect(expenseDelta).toHaveAttribute("data-tone", "bad");
    expect(expenseDelta?.textContent).toContain("↑");
    expect(expenseDelta?.textContent).toContain("1–6 Okt vs 1–6 Sep");
    expect(expenseDelta?.textContent).not.toContain("68%");
  });

  test("a complete month keeps the plain full-month caption", () => {
    render(<BerandaHeroCard {...base} netWorth={1000} />, { wrapper: wrap });
    const expenseDelta = [...document.querySelectorAll(".wm-delta")].find(
      (el) => el.textContent?.includes("20%"),
    );
    expect(expenseDelta).toHaveAttribute("data-tone", "good");
    expect(expenseDelta?.textContent).toContain("↓");
    expect(expenseDelta?.textContent).toContain("dari bulan lalu");
  });
});

describe("Beranda prototype-parity helpers", () => {
  const { goalPair, spendRows } = jest.requireActual(
    "./bento-sections",
  ) as typeof import("./bento-sections");
  const { bucketDays } = jest.requireActual(
    "./use-beranda-flow",
  ) as typeof import("./use-beranda-flow");

  test("goalPair keeps both numbers in the target's unit", () => {
    expect(goalPair(250_000_000, 1_000_000_000)).toBe("0,3 / 1 M");
    expect(goalPair(42_000_000, 60_000_000)).toBe("42 / 60 jt");
  });

  test("bucketDays sorts income and expense into their day and derives net = income - expense", () => {
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
    expect(days[6]).toMatchObject({ income: 100, expense: 0, net: 100 });
    // Transfers (25) are not part of income, expense or net.
    expect(days[5]).toMatchObject({ income: 0, expense: 40, net: -40 });
  });

  test("spendRows keeps the top six, folds the rest and uncategorized into one other row, and preserves the total", () => {
    const breakdown = [
      ...Array.from({ length: 8 }, (_, i) => ({
        categoryName: `Kat ${i}`,
        amount: 100 - i,
      })),
      { categoryName: null, amount: 30 },
    ];
    const rows = spendRows(breakdown, "Lainnya");
    expect(rows.map((r) => r.label)).toEqual([
      "Kat 0",
      "Kat 1",
      "Kat 2",
      "Kat 3",
      "Kat 4",
      "Kat 5",
      "Lainnya",
    ]);
    expect(rows[6]?.value).toBe(94 + 93 + 30);
    expect(rows.reduce((s, r) => s + r.value, 0)).toBe(
      breakdown.reduce((s, r) => s + r.amount, 0),
    );
  });
});

describe("SpendingBento", () => {
  test("headline equals currentMonth.expense (the hero's figure) and the rows come from the server breakdown", () => {
    const currentMonth = {
      income: 9_000_000,
      expense: 5_650_000,
      net: 3_350_000,
      savingsRate: 37,
      expenseByCategory: [
        { categoryName: "Makan", amount: 4_000_000 },
        { categoryName: "Transport", amount: 1_000_000 },
        { categoryName: null, amount: 650_000 },
      ],
    };
    render(<SpendingBento currentMonth={currentMonth} fmt={fmt} />, {
      wrapper: wrap,
    });
    expect(document.querySelector(".wm-mid")?.textContent).toBe(
      fmt.money(currentMonth.expense),
    );
    expect(screen.getByText("Makan")).toBeInTheDocument();
    expect(screen.getByText("Transport")).toBeInTheDocument();
    expect(screen.getByText("Lainnya")).toBeInTheDocument();
    // No truncation notice: the figure is a server aggregate, not a paged list.
    expect(screen.queryByText(/transaksi terbaru/)).not.toBeInTheDocument();
  });
});
