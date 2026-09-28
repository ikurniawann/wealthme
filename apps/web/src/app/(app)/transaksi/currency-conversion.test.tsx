/**
 * Batch C4 (revisi-2) — /transaksi renders a converted amount, not raw IDR,
 * when the profile's display currency is USD. Mirrors the mocking pattern
 * already used by list-pagination.test.tsx in this same directory.
 */

import type { ReactElement } from "react";
import { render as rtlRender, screen } from "@testing-library/react";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import type { TransactionDto } from "@wealthme/contracts";

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

const apiFetch = jest.fn();
jest.mock("../../../lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
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
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock("sonner", () => ({
  toast: Object.assign(jest.fn(), {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  }),
}));

import { ShellProvider } from "../../../components/shell/shell-context";
import { DisplayCurrencyProvider } from "../../../hooks/use-money";
import TransaksiPage from "./page";

const TX: TransactionDto = {
  id: "tx-1",
  familyGroupId: "fg-1",
  accountId: "acc-1",
  categoryId: null,
  amount: "1000000",
  type: "expense",
  description: "Belanja bulanan",
  occurredAt: "2026-07-01T00:00:00.000Z",
  createdAt: "2026-08-01T00:00:00.000Z",
  categoryName: null,
  accountName: "BCA",
  toAccountId: null,
  toAccountName: null,
} as unknown as TransactionDto;

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

function render(ui: ReactElement) {
  return rtlRender(ui, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>
        <DisplayCurrencyProvider>
          <ShellProvider>{children}</ShellProvider>
        </DisplayCurrencyProvider>
      </QueryClientProvider>
    ),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  queryClient.clear();

  apiFetch.mockImplementation((path: string) => {
    if (path === "/auth/me") return Promise.resolve({ familyGroupId: "fg-1" });
    if (path === "/auth/profile") return Promise.resolve({ currency: "USD" });
    if (path.startsWith("/fx/rates")) {
      return Promise.resolve({ base: "IDR", rates: { USD: 0.0000615 } });
    }
    if (path.includes("/transactions?")) {
      return Promise.resolve({
        data: [TX],
        meta: { total: 1, page: 1, limit: 100 },
        summary: {
          totalIncome: "0",
          totalExpense: "1000000",
          net: "-1000000",
          period: { from: null, to: null },
        },
      });
    }
    return Promise.resolve([]);
  });
});

describe("/transaksi — Batch C display currency", () => {
  it("converts the row amount when profile.currency is USD", async () => {
    render(<TransaksiPage />);

    // 1,000,000 IDR * 0.0000615 = 61.50 -> "≈ $ 61.50", not "Rp 1.000.000".
    // Both the mobile card and desktop table render the same row, so this
    // renders more than once.
    const matches = await screen.findAllByText(/≈\s*\$\s*61\.50/);
    expect(matches.length).toBeGreaterThan(0);
    expect(screen.queryByText(/Rp\s*1\.000\.000/)).not.toBeInTheDocument();
  });
});
