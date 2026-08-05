/**
 * EPIC-023 Task B retry — component coverage for the /laporan Balance Sheet
 * tab's honest "no data" states, exactly where CRITICAL 3 (a fake Rp 0
 * balance sheet rendering under the honest banner) and the HIGH finding
 * (the ✅/⚠️ identity check firing falsely against a historical snapshot)
 * lived. None of these branches had a component test before this retry.
 */

import type { ReactElement, ReactNode } from "react";
import { render as rtlRender, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type {
  BalanceSheetDto,
  NetWorthDto,
  ReconciliationBridgeDto,
} from "@wealthme/contracts";

const FAMILY_GROUP_ID = "fg-1";
const TOKEN = "test-token";

jest.mock("../../../lib/auth-client", () => ({
  authClient: {
    useSession: jest.fn(() => ({
      data: {
        session: { token: TOKEN, familyGroupId: FAMILY_GROUP_ID },
        user: { id: "u-1", name: "Owner", email: "owner@example.com" },
      },
      isPending: false,
    })),
    signOut: jest.fn(),
  },
}));

// LaporanInner reads the active tab via next/navigation's useSearchParams —
// pin it to "rbalance" (the Balance Sheet tab) for every test in this file.
jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("tab=rbalance"),
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

let balanceSheetFixture: BalanceSheetDto;
let bridgeFixture: ReconciliationBridgeDto;
let netWorthFixture: NetWorthDto;

const mockApiFetch = jest.fn((url: string) => {
  if (url.includes("/reports/balance-sheet")) {
    return Promise.resolve(balanceSheetFixture);
  }
  if (url.includes("/reports/reconciliation-bridge")) {
    return Promise.resolve(bridgeFixture);
  }
  if (url.includes("/dashboard/net-worth")) {
    return Promise.resolve(netWorthFixture);
  }
  if (url.includes("/reports/summary")) {
    return Promise.resolve({
      period: "monthly",
      points: [],
      totalIncome: 0,
      totalExpense: 0,
      netSavings: 0,
      savingsRate: 0,
      topIncomeCategories: [],
      topExpenseCategories: [],
    });
  }
  return Promise.resolve({});
});
jest.mock("../../../lib/api-client", () => ({
  apiFetch: (...args: Parameters<typeof mockApiFetch>) => mockApiFetch(...args),
}));

import LaporanPage from "./page";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function render(ui: ReactElement) {
  return rtlRender(ui, { wrapper: Providers });
}

function baseBalanceSheet(
  overrides: Partial<BalanceSheetDto> = {},
): BalanceSheetDto {
  return {
    asOfDate: "2026-08-31T16:59:59.999Z",
    totalAssets: 0,
    totalLiabilities: 0,
    netWorth: 0,
    assets: [],
    liabilities: [],
    dataAvailable: true,
    isHistorical: false,
    restrictedForViewer: false,
    ...overrides,
  };
}

function baseBridge(
  overrides: Partial<ReconciliationBridgeDto> = {},
): ReconciliationBridgeDto {
  return {
    startDate: "2026-08-01T00:00:00.000Z",
    endDate: "2026-08-31T16:59:59.999Z",
    opening: 0,
    closing: 0,
    profit: 0,
    assetRevaluation: 0,
    investmentRevaluation: 0,
    assetContribution: 0,
    investmentContribution: 0,
    dataAvailable: true,
    restrictedForViewer: false,
    ...overrides,
  };
}

describe("/laporan Balance Sheet tab — honest no-data states (EPIC-023 Task B retry)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiFetch.mockClear();
    queryClient.clear();
    bridgeFixture = baseBridge();
    netWorthFixture = {
      accountsTotal: "0",
      investmentsTotal: "0",
      assetsTotal: "0",
      liabilitiesTotal: "0",
      netWorth: "0",
      currency: "IDR",
    };
  });

  it("CRITICAL 3 — suppresses the asset/liability tables and the balanced/imbalanced banners when dataAvailable is false", async () => {
    balanceSheetFixture = baseBalanceSheet({ dataAvailable: false });
    // A dashboard net worth that genuinely differs from the balance sheet's
    // zeroed netWorth — if the identity check weren't gated on `hasData`,
    // this would render a false "⚠️ Tidak Seimbang" over the honest banner.
    netWorthFixture = {
      ...netWorthFixture,
      netWorth: "50000000",
    };

    render(<LaporanPage />);

    expect(
      await screen.findByText("Belum Ada Data Historis"),
    ).toBeInTheDocument();
    // The fake "Total Aset: Rp 0" / "Net Worth: 0" tables must be gone.
    expect(screen.queryByText("Total Aset")).not.toBeInTheDocument();
    expect(screen.queryByText("Total Liabilitas")).not.toBeInTheDocument();
    // Neither identity banner may render once `hasData` is false.
    expect(
      screen.queryByText("Net Worth Cocok dengan Ringkasan"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Net Worth Tidak Cocok dengan Ringkasan"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Memeriksa kecocokan Net Worth/),
    ).not.toBeInTheDocument();
  });

  it("CRITICAL 2 — shows the restricted-for-viewer message (not the generic no-data one) when a snapshot is hidden from this viewer", async () => {
    balanceSheetFixture = baseBalanceSheet({
      dataAvailable: false,
      restrictedForViewer: true,
    });

    render(<LaporanPage />);

    expect(
      await screen.findByText("Tidak Tersedia Untuk Peran Anda"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Belum Ada Data Historis"),
    ).not.toBeInTheDocument();
  });

  it("HIGH — does not fire the identity banner against a historical snapshot, even when the live dashboard net worth genuinely differs", async () => {
    balanceSheetFixture = baseBalanceSheet({
      dataAvailable: true,
      isHistorical: true,
      totalAssets: 100_000_000,
      totalLiabilities: 0,
      netWorth: 100_000_000,
      assets: [
        { category: "Kas & Setara Kas", amount: 100_000_000, items: [] },
      ],
    });
    // Wildly different from the balance sheet's netWorth — the identity
    // check must stay silent because this balance sheet is historical.
    netWorthFixture = { ...netWorthFixture, netWorth: "999999999" };

    render(<LaporanPage />);

    expect(await screen.findByText("Total Aset")).toBeInTheDocument();
    expect(
      screen.queryByText("Net Worth Cocok dengan Ringkasan"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Net Worth Tidak Cocok dengan Ringkasan"),
    ).not.toBeInTheDocument();
  });

  it("bridge card — shows the no-data description instead of the table when dataAvailable is false", async () => {
    balanceSheetFixture = baseBalanceSheet();
    bridgeFixture = baseBridge({ dataAvailable: false });

    render(<LaporanPage />);

    expect(
      await screen.findByText(
        "Riwayat snapshot belum cukup untuk merekonsiliasi periode ini.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Net Worth Awal")).not.toBeInTheDocument();
  });

  it("bridge card — shows the restricted-for-viewer description (not the generic no-data one) when opening/closing are hidden from this viewer", async () => {
    balanceSheetFixture = baseBalanceSheet();
    bridgeFixture = baseBridge({
      dataAvailable: false,
      restrictedForViewer: true,
    });

    render(<LaporanPage />);

    expect(
      await screen.findByText(
        "Snapshot untuk periode ini ada, tapi menyertakan semua akun. Karena peran Anda tidak bisa melihat akun privat, jembatan ini tidak bisa ditampilkan tanpa membocorkan saldo yang disembunyikan.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        "Riwayat snapshot belum cukup untuk merekonsiliasi periode ini.",
      ),
    ).not.toBeInTheDocument();
  });

  it("bridge card — names the asset/investment contribution separately from the revaluation, both on the same table", async () => {
    balanceSheetFixture = baseBalanceSheet();
    bridgeFixture = baseBridge({
      opening: 270_000_000,
      closing: 295_000_000,
      profit: 25_000_000,
      assetRevaluation: 0,
      investmentRevaluation: 0,
      assetContribution: 0,
      investmentContribution: 10_000_000,
    });

    render(<LaporanPage />);

    expect(await screen.findByText("Net Worth Awal")).toBeInTheDocument();
    expect(
      screen.getByText(/kontribusi tunai ke investasi \(net-netral\)/),
    ).toBeInTheDocument();
  });
});
