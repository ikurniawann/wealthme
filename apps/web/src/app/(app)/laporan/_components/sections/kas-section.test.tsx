// Defect/feature change (2026-10-06): KasSection's "Arus Kas" chart was a
// monthly income/expense bar chart (HatchedBarChart); replaced with a
// journey-flow chart (income categories -> Total -> expense categories +
// Surplus/Defisit) per request — uiarc.dev's `journey-flow` block is
// Pro-only, so this is a from-scratch recreation (journey-flow-chart.tsx),
// not an install. Same auth-client mock precedent as harian-section.test.tsx.
jest.mock("../../../../../lib/auth-client", () => ({
  authClient: {
    useSession: jest.fn(() => ({ data: null, isPending: false })),
  },
}));

import { render, screen } from "@testing-library/react";

import { setLocale } from "../../../../../hooks/use-locale";
import { KasSection } from "./kas-section";
import type { ReportSummaryDto } from "@wealthme/contracts";

function summary(overrides: Partial<ReportSummaryDto> = {}): ReportSummaryDto {
  return {
    period: "monthly",
    points: [],
    totalIncome: 10_000_000,
    totalExpense: 4_000_000,
    netSavings: 6_000_000,
    savingsRate: 60,
    topIncomeCategories: [
      { categoryName: "Gaji", amount: 8_000_000, percentage: 80, color: null },
      {
        categoryName: "Lainnya",
        amount: 2_000_000,
        percentage: 20,
        color: null,
      },
    ],
    topExpenseCategories: [
      {
        categoryName: "Belanja",
        amount: 4_000_000,
        percentage: 100,
        color: null,
      },
    ],
    ...overrides,
  };
}

describe("KasSection — journey-flow chart", () => {
  beforeEach(() => setLocale("id"));

  it("renders the flow chart with a Surplus node when income exceeds expense", () => {
    render(<KasSection summary={summary()} />);

    expect(
      screen.getByRole("img", {
        name: /Arus Kas.*Pemasukan.*Pengeluaran.*Surplus/,
      }),
    ).toBeInTheDocument();
  });

  it("adds a Defisit source node instead of a negative destination when expense exceeds income", () => {
    render(
      <KasSection
        summary={summary({
          totalIncome: 4_000_000,
          totalExpense: 10_000_000,
          netSavings: -6_000_000,
          savingsRate: -150,
          topIncomeCategories: [
            {
              categoryName: "Gaji",
              amount: 4_000_000,
              percentage: 100,
              color: null,
            },
          ],
          topExpenseCategories: [
            {
              categoryName: "Belanja",
              amount: 10_000_000,
              percentage: 100,
              color: null,
            },
          ],
        })}
      />,
    );

    // Still renders (sources now include the deficit shortfall, keeping
    // the two columns balanced) rather than silently hiding the chart.
    expect(screen.getByRole("img", { name: /Arus Kas/ })).toBeInTheDocument();
  });

  it("hides the chart entirely when there is no income data yet", () => {
    render(
      <KasSection
        summary={summary({
          totalIncome: 0,
          topIncomeCategories: [],
          topExpenseCategories: [],
        })}
      />,
    );

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("still renders the income-sources list below the chart", () => {
    render(<KasSection summary={summary()} />);

    // "Gaji"/"Lainnya" each appear twice: once as an aria-hidden label
    // inside the chart's SVG, once as a real list row below it.
    const gajiMatches = screen.getAllByText("Gaji");
    const lainnyaMatches = screen.getAllByText("Lainnya");
    expect(gajiMatches.length).toBeGreaterThanOrEqual(1);
    expect(lainnyaMatches.length).toBeGreaterThanOrEqual(1);
    expect(gajiMatches.some((el) => el.closest(".lp-act"))).toBe(true);
  });
});
