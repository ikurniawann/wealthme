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

import { AnnualSummary } from "./annual-summary";

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

it("shows the total, parts and SPT timing with the grace note", async () => {
  mockApiFetch.mockResolvedValueOnce({
    taxYear: 2025,
    pphOp: {
      recordId: "t1",
      calcMode: "legacy",
      tax: "2425000",
      withheld: "0",
      balance: "2425000",
    },
    finalTax: { totalTax: "712603", lineCount: 1, missingRateCount: 0 },
    umkm: {
      totalTax: "1700000",
      exceedsCeiling: false,
      ineligibleReason: null,
    },
    totalEstimatedTax: "4837603",
    spt: {
      status: "belum_lapor",
      deadline: "2026-03-31",
      graceUntil: "2026-04-30",
      daysToDeadline: -179,
      pastDeadline: true,
      withinGrace: false,
      filedAt: null,
    },
    rules: [],
  });
  render(<AnnualSummary taxYear={2025} />);
  expect(await screen.findByText("Rp 4.837.603")).toBeInTheDocument();
  expect(screen.getByText("lewat 179 hari")).toBeInTheDocument();
  expect(
    screen.getByText(
      /Sanksi administrasi dihapus bila lapor\/bayar s\.d\. 30 April 2026/,
    ),
  ).toBeInTheDocument();
});

it("no record → the noRecord hint and no PPh OP figure", async () => {
  mockApiFetch.mockResolvedValueOnce({
    taxYear: 2026,
    pphOp: null,
    finalTax: { totalTax: "0", lineCount: 0, missingRateCount: 0 },
    umkm: null,
    totalEstimatedTax: "0",
    spt: {
      status: null,
      deadline: "2027-03-31",
      graceUntil: null,
      daysToDeadline: 186,
      pastDeadline: false,
      withinGrace: false,
      filedAt: null,
    },
    rules: [],
  });
  render(<AnnualSummary taxYear={2026} />);
  expect(
    await screen.findByText(
      "Belum ada catatan PPh, hitung dan simpan di kalkulator di atas.",
    ),
  ).toBeInTheDocument();
  expect(screen.getByText("186 hari lagi")).toBeInTheDocument();
});
