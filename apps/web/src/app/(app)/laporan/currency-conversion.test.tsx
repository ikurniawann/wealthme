/**
 * Batch C4 (revisi-2) — /laporan renders a converted amount, not raw IDR,
 * when the profile's display currency is USD. Mirrors the mocking pattern
 * already used by laporan-balance.test.tsx in this same directory; pins the
 * active tab to "rkas" (Arus Kas), which reads `/reports/summary` directly.
 */

import type { ReactElement } from "react";
import { render as rtlRender, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("../../../lib/auth-client", () => ({
  authClient: {
    useSession: jest.fn(() => ({
      data: {
        session: { token: "test-token", familyGroupId: "fg-1" },
        user: { id: "u-1", name: "Owner", email: "owner@example.com" },
      },
      isPending: false,
    })),
    signOut: jest.fn(),
  },
}));

jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("tab=rkas"),
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
}));

jest.mock("sonner", () => ({
  toast: Object.assign(jest.fn(), { success: jest.fn(), error: jest.fn() }),
}));

jest.mock("../../../components/money/use-fx-snapshot", () => ({
  useFxSnapshot: (enabled: boolean) => ({
    data: enabled
      ? jest.requireActual("../../../components/money/fx-test-rates")
          .TEST_FX_RATES
      : undefined,
    isError: false,
  }),
}));

const apiFetch = jest.fn((url: string) => {
  if (url === "/auth/profile") return Promise.resolve({ currency: "USD" });
  if (url.startsWith("/fx/rates")) {
    return Promise.resolve({ base: "IDR", rates: { USD: 0.0000615 } });
  }
  if (url.includes("/reports/summary")) {
    return Promise.resolve({
      period: "monthly",
      points: [],
      totalIncome: 1_000_000,
      totalExpense: 0,
      netSavings: 1_000_000,
      savingsRate: 100,
      topIncomeCategories: [],
      topExpenseCategories: [],
    });
  }
  if (url.includes("/dashboard/net-worth")) {
    return Promise.resolve({
      accountsTotal: "0",
      investmentsTotal: "0",
      assetsTotal: "0",
      liabilitiesTotal: "0",
      netWorth: "0",
      currency: "IDR",
    });
  }
  if (url.includes("/investments")) return Promise.resolve([]);
  return Promise.resolve({});
});
jest.mock("../../../lib/api-client", () => ({
  apiFetch: (...args: Parameters<typeof apiFetch>) => apiFetch(...args),
}));

import { DisplayCurrencyProvider } from "../../../hooks/use-money";
import LaporanPage from "./page";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function render(ui: ReactElement) {
  return rtlRender(ui, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>
        <DisplayCurrencyProvider>{children}</DisplayCurrencyProvider>
      </QueryClientProvider>
    ),
  });
}

beforeEach(() => {
  apiFetch.mockClear();
  queryClient.clear();
});

describe("/laporan (Arus Kas tab) — Batch C display currency", () => {
  it("converts totalIncome when profile.currency is USD", async () => {
    render(<LaporanPage />);

    // totalIncome 1,000,000 IDR * 0.0000615 = 61,50 -> "≈ US$ 61,50".
    const matches = await screen.findAllByText(/≈\s*US\$\s*61,50/);
    expect(matches.length).toBeGreaterThan(0);
    expect(screen.queryByText(/^Rp\s*1\.000\.000$/)).not.toBeInTheDocument();
  });
});
