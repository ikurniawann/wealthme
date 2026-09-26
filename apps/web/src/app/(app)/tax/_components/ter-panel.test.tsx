import type { ReactElement, ReactNode } from "react";
import { render as rtlRender, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const FAMILY_GROUP_ID = "fg-1";
const TOKEN = "test-token";

const mockUseSessionAuth = jest.fn();
jest.mock("../../../../lib/auth-client", () => ({
  authClient: {
    useSession: (...args: unknown[]) => mockUseSessionAuth(...args),
    signOut: jest.fn(),
  },
}));

const mockApiFetch = jest.fn();
jest.mock("../../../../lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

import { TerPanel } from "./ter-panel";

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
});

it("renders the December refund from the server as a positive amount in parentheses with the refund note", async () => {
  mockApiFetch.mockImplementation((url: string) => {
    if (url.endsWith("/tax/ter/preview")) {
      return Promise.resolve({
        category: "A",
        annualTax: "9000000",
        withheldJanNov: "11000000",
        december: "-2000000",
        isRefund: true,
        dtpTotal: "0",
        rules: [],
        months: [
          ...Array.from({ length: 11 }, (_, i) => ({
            month: i + 1,
            gross: i === 0 ? "50000000" : "10000000",
            category: "A",
            rateBps: i === 0 ? 1800 : 200,
            withholding: i === 0 ? "9000000" : "200000",
            dtp: null,
          })),
          {
            month: 12,
            gross: "10000000",
            category: "A",
            rateBps: null,
            withholding: "-2000000",
            dtp: null,
          },
        ],
      });
    }
    return Promise.resolve(null);
  });
  render(
    <TerPanel
      taxYear={2026}
      maritalStatus="TK"
      dependents={0}
      defaultMonthlyGross="10000000"
    />,
  );
  expect(await screen.findByText(/Lebih potong/)).toBeInTheDocument();
  expect(screen.getByText("(Rp 2.000.000)")).toBeInTheDocument();
  expect(screen.getByText("18%")).toBeInTheDocument();
});

it("shows the TER-not-applicable notice on 422", async () => {
  mockApiFetch.mockRejectedValue({
    status: 422,
    message: "TER berlaku mulai 2024 (tahun pajak 2023)",
  });
  render(
    <TerPanel
      taxYear={2023}
      maritalStatus="TK"
      dependents={0}
      defaultMonthlyGross="10000000"
    />,
  );
  expect(
    await screen.findByText("TER berlaku mulai tahun pajak 2024."),
  ).toBeInTheDocument();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
});

it("K/I shows the husband-category note", async () => {
  mockApiFetch.mockResolvedValue(null);
  render(
    <TerPanel
      taxYear={2026}
      maritalStatus="KI"
      dependents={1}
      defaultMonthlyGross="10000000"
    />,
  );
  expect(
    await screen.findByText(
      "Untuk K/I, pemotongan bulanan memakai kategori K/n suami.",
    ),
  ).toBeInTheDocument();
});
