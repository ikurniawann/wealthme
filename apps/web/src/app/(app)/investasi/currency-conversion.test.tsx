/**
 * Batch C4 (revisi-2) — /investasi renders a converted amount, not raw IDR,
 * when the profile's display currency is USD. Mirrors the mocking pattern
 * already used by investasi.test.tsx in this same directory.
 */

import type { ReactElement } from "react";
import { render as rtlRender, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { resolveEffectiveAccess } from "@wealthme/contracts";
import type { InvestmentDto, InvestmentSummaryDto } from "@wealthme/contracts";

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

jest.mock("socket.io-client", () => ({
  io: () => ({ on: jest.fn(), disconnect: jest.fn() }),
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
import InvestasiPage from "./page";

const HOLDING: InvestmentDto = {
  id: "inv-1",
  familyGroupId: "fg-1",
  ticker: "EMAS",
  name: "Emas Batangan",
  type: "lainnya",
  quantity: "10",
  costBasisPerUnit: "100000",
  currentPrice: "110000",
  currentValue: "1100000",
  returnRp: "100000",
  returnPct: 10,
  currency: "IDR",
  notes: null,
  latestPriceRecordedAt: null,
  latestPriceSource: null,
  latestPriceAsOf: null,
  latestPriceDelayed: null,
  priceRefreshFailed: false,
  automatedPriceUnmapped: false,
  interestRatePct: null,
  projectedAnnualYield: null,
  purchasedAt: null,
  maturityDate: null,
  realizedPnlRp: null,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

const SUMMARY: InvestmentSummaryDto = {
  totalCostBasis: "1000000",
  totalCurrentValue: "1000000",
  totalReturnRp: "0",
  totalReturnPct: 0,
  todayReturnRp: "0",
  todayReturnPct: 0,
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
    if (path.endsWith("/investments/summary")) return Promise.resolve(SUMMARY);
    if (path.endsWith("/investments")) return Promise.resolve([HOLDING]);
    return Promise.resolve([]);
  });
});

describe("/investasi — Batch C display currency", () => {
  it("converts the total cost basis (summary card) when profile.currency is USD", async () => {
    render(<InvestasiPage />);

    // totalCostBasis 1,000,000 IDR * 0.0000615 = 61.50 -> "≈ $ 61.50".
    const matches = await screen.findAllByText(/≈\s*\$\s*61\.50/);
    expect(matches.length).toBeGreaterThan(0);
    expect(screen.queryByText(/^Rp\s*1\.000\.000$/)).not.toBeInTheDocument();
  });
});
