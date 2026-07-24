/**
 * EPIC-016 Task J — /beranda cashflow card month select.
 *
 * Previously the select had exactly one hardcoded <option> (the latest
 * month label) and no onChange — decorative dropdown chrome implying
 * multi-month selection that did not exist. `cashflow.months/income/expense`
 * from GET /dashboard/summary already carry the last 6 months in a single
 * payload, so the fix makes the select genuinely functional client-side
 * (real value/onChange, no extra fetch): choosing an earlier month re-derives
 * the income/expense/surplus figures shown above the bar chart from that
 * month's real data instead of always showing the current calendar month.
 */

import type { ReactElement, ReactNode } from "react";
import {
  fireEvent,
  render as rtlRender,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import type { DashboardSummaryDto } from "@wealthme/contracts";

jest.mock("../../../lib/auth-client", () => ({
  authClient: {
    useSession: jest.fn(() => ({
      data: {
        session: { token: "tok-1", familyGroupId: "fg-1" },
        user: {
          id: "u1",
          name: "Test User",
          email: "test@example.com",
          image: null,
        },
      },
      isPending: false,
    })),
    signOut: jest.fn(),
  },
}));

const mockApiFetch = jest.fn();
jest.mock("../../../lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
}));

import { BerandaPage } from "./page";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function render(ui: ReactElement) {
  return rtlRender(ui, { wrapper: Providers });
}

// income/expense/net are kept mutually distinct (within a month AND across
// the two months this suite selects) so `getByText` assertions unambiguously
// prove which month's real data is on screen — `currentMonth` (a wholly
// separate hero-card figure, unrelated to the cashflow select) is likewise
// kept clear of every cashflow value below.
const SUMMARY: DashboardSummaryDto = {
  netWorth: 500_000_000,
  assetsTotal: 100_000_000,
  cashflow: {
    months: ["Mar", "Apr", "Mei", "Jun", "Jul", "Agu"],
    income: [
      21_000_000, 22_000_000, 23_000_000, 24_000_000, 25_000_000, 30_000_000,
    ],
    expense: [
      9_000_000, 9_500_000, 10_000_000, 10_500_000, 11_000_000, 13_000_000,
    ],
    max: 30_000_000,
  },
  sparkline: Array(30).fill(50) as number[],
  allocation: [],
  accountSummary: [],
  currentMonth: { income: 1, expense: 1, net: 1, savingsRate: 1 },
  recentTransactions: [],
};

function mockDashboardApi() {
  mockApiFetch.mockImplementation((path: string) => {
    if (path === "/family-groups/fg-1/dashboard/summary") {
      return Promise.resolve(SUMMARY);
    }
    if (path.startsWith("/family-groups/fg-1/dashboard/net-worth/history")) {
      return Promise.resolve({ range: "30d", currency: "IDR", points: [] });
    }
    if (path === "/family-groups/fg-1/goals") {
      return Promise.resolve([]);
    }
    if (path === "/auth/profile") {
      return Promise.resolve({
        id: "u1",
        email: "test@example.com",
        name: "Test User",
      });
    }
    return Promise.reject(new Error(`unexpected apiFetch call: ${path}`));
  });
}

describe("/beranda cashflow card month select (EPIC-016 Task J)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryClient.clear();
    mockDashboardApi();
  });

  it("lists all 6 real months from the fetched cashflow data, defaulting to the latest month", async () => {
    render(<BerandaPage />);

    const select = await screen.findByRole("combobox", {
      name: "Arus Kas Bulanan",
    });

    await waitFor(() => {
      expect(select).not.toBeDisabled();
    });

    const options = Array.from(
      select.querySelectorAll("option"),
    ) as HTMLOptionElement[];
    expect(options.map((o) => o.value)).toEqual(["0", "1", "2", "3", "4", "5"]);
    expect(options.map((o) => o.textContent)).toEqual([
      "Mar",
      "Apr",
      "Mei",
      "Jun",
      "Jul",
      "Agu (terkini)",
    ]);

    // Defaults to the latest month (index 5 — "Agu": income 30jt, expense
    // 13jt, surplus 17jt).
    expect(select).toHaveValue("5");
    expect(screen.getByText("Rp 30.000.000")).toBeInTheDocument(); // income
    expect(screen.getByText("Rp 13.000.000")).toBeInTheDocument(); // expense
    expect(screen.getByText("Rp 17.000.000")).toBeInTheDocument(); // surplus
  });

  it("selecting an earlier month recomputes income/expense/surplus for that real month — a genuine onChange, not decorative chrome", async () => {
    render(<BerandaPage />);

    const select = await screen.findByRole("combobox", {
      name: "Arus Kas Bulanan",
    });
    await waitFor(() => expect(select).not.toBeDisabled());

    // Select "Mar" (index 0): income 21jt, expense 9jt, surplus 12jt.
    fireEvent.change(select, { target: { value: "0" } });

    expect(select).toHaveValue("0");
    await waitFor(() => {
      expect(screen.getByText("Rp 21.000.000")).toBeInTheDocument();
    });
    expect(screen.getByText("Rp 9.000.000")).toBeInTheDocument();
    expect(screen.getByText("Rp 12.000.000")).toBeInTheDocument();
    // The August (default) numbers are no longer shown.
    expect(screen.queryByText("Rp 30.000.000")).not.toBeInTheDocument();
    expect(screen.queryByText("Rp 13.000.000")).not.toBeInTheDocument();
    expect(screen.queryByText("Rp 17.000.000")).not.toBeInTheDocument();
  });
});
