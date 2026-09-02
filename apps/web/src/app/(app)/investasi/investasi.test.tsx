/**
 * EPIC-022 Group F (F3) — CASL grants "manage Investment" only to
 * owner/spouse/member; admin_staff is read-only. The add/edit/delete
 * affordances used to render for every role regardless, so a read-only role
 * only found out via a 403 after filling in a form. Locks in: a role
 * without the grant sees neither the header "add" button nor a row's
 * Edit/Hapus actions; a role with the grant sees both.
 */

import type { ReactElement, ReactNode } from "react";
import { render as rtlRender, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { InvestmentDto, InvestmentSummaryDto } from "@wealthme/contracts";

const mockUseSessionAuth = jest.fn();
jest.mock("../../../lib/auth-client", () => ({
  authClient: {
    useSession: (...args: unknown[]) => mockUseSessionAuth(...args),
    signOut: jest.fn(),
  },
}));

const mockApiFetch = jest.fn();
jest.mock("../../../lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

jest.mock("sonner", () => ({
  toast: Object.assign(jest.fn(), {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  }),
}));

// InvestasiPage opens a live Socket.io connection — not present without a
// real server, so it must be mocked in a component test.
jest.mock("socket.io-client", () => ({
  io: () => ({
    on: jest.fn(),
    disconnect: jest.fn(),
  }),
}));

import InvestasiPage from "./page";

const FAMILY_GROUP_ID = "fg-1";
const TOKEN = "test-token";

const HOLDING: InvestmentDto = {
  id: "inv-1",
  familyGroupId: FAMILY_GROUP_ID,
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
  totalCurrentValue: "1100000",
  totalReturnRp: "100000",
  totalReturnPct: 10,
  todayReturnRp: "0",
  todayReturnPct: 0,
};

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function render(ui: ReactElement) {
  return rtlRender(ui, { wrapper: Providers });
}

function mockSession(role: string) {
  mockUseSessionAuth.mockReturnValue({
    data: {
      session: { token: TOKEN, familyGroupId: FAMILY_GROUP_ID },
      user: { id: "user-1", name: "Test User", email: "user@example.com" },
    },
    isPending: false,
  });
  mockApiFetch.mockImplementation((path: string) => {
    if (path.endsWith("/family-groups/mine")) {
      return Promise.resolve([{ id: FAMILY_GROUP_ID, myRole: role }]);
    }
    if (path.endsWith("/investments/summary")) {
      return Promise.resolve(SUMMARY);
    }
    if (path.endsWith("/investments")) {
      return Promise.resolve([HOLDING]);
    }
    return Promise.resolve([]);
  });
}

beforeEach(() => {
  jest.resetAllMocks();
  queryClient.clear();
});

describe("InvestasiPage — role gating (F3)", () => {
  it("hides the add/edit/delete affordances from a role without CASL's manage Investment", async () => {
    mockSession("admin_staff");
    render(<InvestasiPage />);

    await screen.findByText("Emas Batangan");
    expect(
      screen.queryByRole("button", { name: /Catat Investasi/i }),
    ).not.toBeInTheDocument();

    const row = screen.getByText("Emas Batangan").closest("tr");
    expect(row).not.toBeNull();
    expect(
      within(row as HTMLElement).queryByRole("button", { name: "Edit" }),
    ).not.toBeInTheDocument();
    expect(
      within(row as HTMLElement).queryByRole("button", { name: "Hapus" }),
    ).not.toBeInTheDocument();
  });

  it("offers the add/edit/delete affordances to a role with CASL's manage Investment", async () => {
    mockSession("owner");
    render(<InvestasiPage />);

    await screen.findByText("Emas Batangan");
    expect(
      screen.getByRole("button", { name: /Catat Investasi/i }),
    ).toBeInTheDocument();

    const row = screen.getByText("Emas Batangan").closest("tr");
    expect(row).not.toBeNull();
    expect(
      within(row as HTMLElement).getByRole("button", { name: "Edit" }),
    ).toBeInTheDocument();
    expect(
      within(row as HTMLElement).getByRole("button", { name: "Hapus" }),
    ).toBeInTheDocument();
  });
});
