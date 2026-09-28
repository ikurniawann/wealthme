/**
 * Batch C4 (revisi-2) — /liabilitas renders a converted amount, not raw IDR,
 * when the profile's display currency is USD. Mirrors the mocking pattern
 * already used by liabilitas.test.tsx in this same directory.
 */

import type { ReactElement } from "react";
import { render as rtlRender, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { LiabilityDto } from "@wealthme/contracts";

const FAMILY_GROUP_ID = "fg-1";

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

jest.mock("sonner", () => ({
  toast: Object.assign(jest.fn(), {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  }),
}));

const LIABILITY: LiabilityDto = {
  id: "liab-1",
  familyGroupId: FAMILY_GROUP_ID,
  name: "Kartu Kredit BCA",
  institution: "BCA",
  type: "kartu_kredit",
  totalDebt: "30000000",
  remainingBalance: "1000000",
  minimumPayment: "800000",
  interestRate: "2.25",
  dueDate: "2026-08-20T00:00:00.000Z",
  nextDueDate: null,
  autoAdvanceDueDate: false,
  paymentRatio: 27,
  paidThisPeriod: false,
  notes: null,
  currency: "IDR",
  interestMethod: "efektif",
  tenorMonths: null,
  startDate: null,
  installmentAmount: null,
  currentInstallmentAmount: "800000",
  fixedRateMonths: null,
  floatingRate: null,
  kprScheme: null,
  ratePeriods: [],
  currentRatePercent: "2.25",
  currentInstallmentLate: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const mockApiFetch = jest.fn(
  (url: string, options?: { method?: string; body?: string }) => {
    if (url === "/auth/profile") return Promise.resolve({ currency: "USD" });
    if (url.startsWith("/fx/rates")) {
      return Promise.resolve({ base: "IDR", rates: { USD: 0.0000615 } });
    }
    if (url === `/family-groups/${FAMILY_GROUP_ID}/liabilities`) {
      return Promise.resolve([LIABILITY]);
    }
    if (url === `/family-groups/${FAMILY_GROUP_ID}/dashboard/net-worth`) {
      return Promise.resolve({
        accountsTotal: "0",
        investmentsTotal: "0",
        assetsTotal: "0",
        liabilitiesTotal: "1000000",
        netWorth: "-1000000",
        currency: "IDR",
      });
    }
    if (url === `/family-groups/${FAMILY_GROUP_ID}/accounts`) {
      return Promise.resolve([]);
    }
    void options;
    return Promise.resolve([]);
  },
);
jest.mock("../../../lib/api-client", () => ({
  apiFetch: (...args: Parameters<typeof mockApiFetch>) => mockApiFetch(...args),
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
import LiabilitasPage from "./page";

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
  mockApiFetch.mockClear();
  queryClient.clear();
});

describe("/liabilitas — Batch C display currency", () => {
  it("converts the remaining balance when profile.currency is USD", async () => {
    render(<LiabilitasPage />);

    // remainingBalance 1,000,000 IDR * 0.0000615 = 61.50 -> "≈ $ 61.50".
    const matches = await screen.findAllByText(/≈\s*\$\s*61\.50/);
    expect(matches.length).toBeGreaterThan(0);
    expect(screen.queryByText(/^Rp\s*1\.000\.000$/)).not.toBeInTheDocument();
  });
});
