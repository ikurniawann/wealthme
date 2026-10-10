import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DetailReportDto } from "@wealthme/contracts";

// useMoney() -> useCurrencyPreference -> useSession -> better-auth's ESM
// client; mock it the same way harian-section.test.tsx does.
jest.mock("../../../../../lib/auth-client", () => ({
  authClient: {
    useSession: jest.fn(() => ({ data: null, isPending: false })),
  },
}));

import { setLocale } from "../../../../../hooks/use-locale";
import { DetailSection } from "./detail-section";

function report(count: number, startDate = "2026-10-01"): DetailReportDto {
  return {
    period: "monthly",
    startDate,
    endDate: "2026-10-31",
    count,
    totalIncome: 0,
    totalExpense: count * 1000,
    transactions: Array.from({ length: count }, (_, i) => ({
      id: `tx-${i}`,
      occurredAt: "2026-10-05T03:00:00.000Z",
      description: `Belanja ${i + 1}`,
      categoryName: "Belanja",
      accountName: "BCA",
      type: "expense" as const,
      amount: 1000,
    })),
  } as DetailReportDto;
}

const bodyRows = () =>
  within(screen.getAllByRole("rowgroup")[1]).getAllByRole("row");

describe("DetailSection — pagination", () => {
  beforeEach(() => setLocale("id"));

  it("renders one page of 25 rows and pages forward", async () => {
    const user = userEvent.setup({ delay: null });
    render(<DetailSection detailReport={report(60)} />);

    expect(bodyRows()).toHaveLength(25);
    expect(screen.getByText(/1–25/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sebelumnya" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Berikutnya" }));
    expect(screen.getByText("Belanja 26")).toBeInTheDocument();
    expect(screen.queryByText("Belanja 1")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Berikutnya" }));
    expect(bodyRows()).toHaveLength(10);
    expect(screen.getByRole("button", { name: "Berikutnya" })).toBeDisabled();
  });

  it("keeps the totals over every row, not just the visible page", () => {
    render(<DetailSection detailReport={report(60)} />);
    // 60 x Rp 1.000 expense, although only 25 rows render.
    expect(screen.getAllByText(/Rp 60\.000/).length).toBeGreaterThan(0);
  });

  it("shows no pager when everything fits on one page", () => {
    render(<DetailSection detailReport={report(10)} />);
    expect(
      screen.queryByRole("button", { name: "Berikutnya" }),
    ).not.toBeInTheDocument();
  });

  it("starts from page 1 again when the period changes", async () => {
    const user = userEvent.setup({ delay: null });
    const { rerender } = render(<DetailSection detailReport={report(60)} />);
    await user.click(screen.getByRole("button", { name: "Berikutnya" }));
    expect(screen.getByText("Belanja 26")).toBeInTheDocument();

    rerender(<DetailSection detailReport={report(60, "2026-09-01")} />);
    expect(screen.getByText("Belanja 1")).toBeInTheDocument();
  });
});
