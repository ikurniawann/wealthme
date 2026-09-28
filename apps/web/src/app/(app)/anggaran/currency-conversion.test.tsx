/**
 * Batch C4 (revisi-2) — /anggaran renders a converted amount, not raw IDR,
 * when the profile's display currency is USD. Mirrors the mocking pattern
 * already used by anggaran.test.tsx in this same directory.
 */

import type { ReactElement } from "react";
import { render as rtlRender, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { resolveEffectiveAccess } from "@wealthme/contracts";

jest.mock("../../../lib/auth-client", () => ({
  authClient: {
    useSession: jest.fn(() => ({
      data: {
        session: { token: "test-token", familyGroupId: "fg-1" },
        user: { id: "user-1", name: "Test User", email: "user@example.com" },
      },
      isPending: false,
    })),
    signOut: jest.fn(),
  },
}));

const apiFetch = jest.fn();
jest.mock("../../../lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
}));

jest.mock("sonner", () => ({
  toast: Object.assign(jest.fn(), {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  }),
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

import { DisplayCurrencyProvider } from "../../../hooks/use-money";
import AnggaranPage from "./page";

const BUDGET = {
  id: "budget-1",
  categoryId: "cat-1",
  categoryName: "Belanja",
  categoryIcon: "🛒",
  period: "monthly",
  limitAmount: 1_000_000,
  spentAmount: 0,
  remainingAmount: 1_000_000,
  usagePercent: 0,
  isOverBudget: false,
  isNearLimit: false,
  budgetType: null,
  autoDebitDay: null,
};

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
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
  jest.clearAllMocks();
  queryClient.clear();

  apiFetch.mockImplementation((path: string) => {
    if (path === "/auth/profile") return Promise.resolve({ currency: "USD" });
    if (path.startsWith("/fx/rates")) {
      return Promise.resolve({ base: "IDR", rates: { USD: 0.0000615 } });
    }
    if (path.endsWith("/access/me")) {
      return Promise.resolve(resolveEffectiveAccess({ role: "owner" }));
    }
    if (path.endsWith("/family-groups/mine")) {
      return Promise.resolve([{ id: "fg-1", myRole: "owner" }]);
    }
    if (path.endsWith("/coa-accounts")) return Promise.resolve([]);
    if (path.endsWith("/categories")) return Promise.resolve([]);
    if (path.endsWith("/budgets")) return Promise.resolve([BUDGET]);
    return Promise.resolve([]);
  });
});

describe("/anggaran — Batch C display currency", () => {
  it("converts the budget limit when profile.currency is USD", async () => {
    render(<AnggaranPage />);

    // limitAmount 1,000,000 IDR * 0.0000615 = 61.50 -> "≈ $ 61.50".
    const matches = await screen.findAllByText(/≈\s*\$\s*61\.50/);
    expect(matches.length).toBeGreaterThan(0);
    expect(screen.queryByText(/^Rp\s*1\.000\.000$/)).not.toBeInTheDocument();
  });
});
