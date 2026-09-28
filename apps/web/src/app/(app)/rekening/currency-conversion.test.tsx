/**
 * Batch C4 (revisi-2) — /rekening renders a converted amount, not raw IDR,
 * when the profile's display currency is USD. Mirrors the mocking pattern
 * already used by rekening.test.tsx in this same directory.
 */

import type { ReactElement } from "react";
import { render as rtlRender, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { resolveEffectiveAccess } from "@wealthme/contracts";
import type { AccountDto } from "@wealthme/contracts";

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
  toast: Object.assign(jest.fn(), { success: jest.fn(), error: jest.fn() }),
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

import { DisplayCurrencyProvider } from "../../../hooks/use-money";
import RekeningPage from "./page";

const ACCOUNT: AccountDto = {
  id: "acc-1",
  familyGroupId: "fg-1",
  name: "Tabungan Utama",
  type: "bank",
  institution: "BCA",
  maskedNumber: null,
  balance: "1000000",
  currency: "IDR",
  isPrivate: false,
  ownerUserId: null,
  ownerName: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
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
    if (path.endsWith("/members")) return Promise.resolve([]);
    if (path.endsWith("/access/me")) {
      return Promise.resolve(resolveEffectiveAccess({ role: "owner" }));
    }
    if (path.endsWith("/family-groups/mine")) {
      return Promise.resolve([{ id: "fg-1", myRole: "owner" }]);
    }
    if (path.endsWith("/reference-items")) return Promise.resolve([]);
    return Promise.resolve([ACCOUNT]);
  });
});

describe("/rekening — Batch C display currency", () => {
  it("converts the account balance when profile.currency is USD", async () => {
    render(<RekeningPage />);

    // 1,000,000 IDR * 0.0000615 = 61.50 -> "≈ $ 61.50", not "Rp 1.000.000".
    const matches = await screen.findAllByText(/≈\s*\$\s*61\.50/);
    expect(matches.length).toBeGreaterThan(0);
    expect(screen.queryByText(/^Rp\s*1\.000\.000$/)).not.toBeInTheDocument();
  });
});
