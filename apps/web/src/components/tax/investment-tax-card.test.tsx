import type { ReactElement, ReactNode } from "react";
import { render as rtlRender, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { FinalTaxEstimateDto } from "@wealthme/contracts";

const FAMILY_GROUP_ID = "fg-1";
const TOKEN = "test-token";

const mockUseSessionAuth = jest.fn();
jest.mock("../../lib/auth-client", () => ({
  authClient: {
    useSession: (...args: unknown[]) => mockUseSessionAuth(...args),
    signOut: jest.fn(),
  },
}));

const mockApiFetch = jest.fn();
jest.mock("../../lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

const mockUseMyAccess = jest.fn();
jest.mock("../../hooks/use-my-access", () => ({
  useMyAccess: () => mockUseMyAccess(),
}));

import { InvestmentTaxCard } from "./investment-tax-card";

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

function buildEstimate(
  overrides: Partial<FinalTaxEstimateDto> = {},
): FinalTaxEstimateDto {
  return {
    taxYear: new Date().getFullYear(),
    lines: [],
    totalTax: "0",
    missingRateCount: 0,
    skippedForeign: 0,
    ...overrides,
  };
}

const kriptoLine = {
  source: "holding" as const,
  instrument: "kripto_domestik" as const,
  label: "BTC",
  investmentId: "inv-1",
  accountId: null,
  entryId: null,
  occurredAt: null,
  grossAmount: "5000000",
  rateBps: 21,
  tax: "10500",
  rateSource: "rule" as const,
  belowThreshold: false,
  caveat: "assumed_domestic" as const,
  rule: {
    key: "final.cryptoDomestic",
    legalBasis: "PMK 50/2025",
    source: null,
    verified: true,
    effectiveFrom: "2025-01-01",
    effectiveTo: null,
    outOfRange: false,
    note: null,
  },
};

beforeEach(() => {
  jest.resetAllMocks();
  queryClient.clear();
  mockUseSessionAuth.mockReturnValue({
    data: {
      session: { token: TOKEN, familyGroupId: FAMILY_GROUP_ID },
      user: { id: "user-1", name: "Test User", email: "user@example.com" },
    },
    isPending: false,
  });
  mockUseMyAccess.mockReturnValue({
    access: { isMaster: true, permissions: {}, dataScope: "family" },
    isLoading: false,
  });
});

it("renders the total and a kripto line with its caveat", async () => {
  mockApiFetch.mockResolvedValueOnce(
    buildEstimate({ totalTax: "10500", lines: [kriptoLine] }),
  );
  render(<InvestmentTaxCard />);
  expect((await screen.findAllByText("Rp 10.500")).length).toBeGreaterThan(0);
  expect(
    screen.getByText("Diasumsikan exchange domestik, ubah di Investasi"),
  ).toBeInTheDocument();
});

it("changing the exchange select to Luar negeri PATCHes the crypto profile", async () => {
  mockApiFetch.mockImplementation((url: string, init?: { method?: string }) =>
    Promise.resolve(
      init?.method === "PATCH"
        ? { investmentId: "inv-1", cryptoExchange: "luar_negeri" }
        : buildEstimate({ totalTax: "10500", lines: [kriptoLine] }),
    ),
  );
  render(<InvestmentTaxCard />);
  const select = await screen.findByLabelText("Exchange");
  await userEvent.selectOptions(select, "luar_negeri");
  expect(mockApiFetch).toHaveBeenCalledWith(
    `/family-groups/${FAMILY_GROUP_ID}/investment-tax/inv-1/profile`,
    expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ cryptoExchange: "luar_negeri" }),
    }),
  );
});

it("renders the empty state when there are no lines", async () => {
  mockApiFetch.mockResolvedValueOnce(buildEstimate());
  render(<InvestmentTaxCard />);
  expect(
    await screen.findByText(
      "Belum ada bunga/kupon atau penjualan yang kena pajak final tahun ini.",
    ),
  ).toBeInTheDocument();
});

it("hides the 'Lihat di Pajak' link when the viewer cannot open /tax", async () => {
  mockUseMyAccess.mockReturnValue({
    access: { isMaster: false, permissions: {}, dataScope: "family" },
    isLoading: false,
  });
  mockApiFetch.mockResolvedValueOnce(
    buildEstimate({ totalTax: "10500", lines: [kriptoLine] }),
  );
  render(<InvestmentTaxCard />);
  await screen.findAllByText("Rp 10.500");
  expect(screen.queryByText("Lihat di Pajak")).not.toBeInTheDocument();
});
