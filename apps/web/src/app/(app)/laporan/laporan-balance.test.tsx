/**
 * EPIC-023 Task B retry — component coverage for the /laporan Balance Sheet
 * tab's honest "no data" states, exactly where CRITICAL 3 (a fake Rp 0
 * balance sheet rendering under the honest banner) and the HIGH finding
 * (the ✅/⚠️ identity check firing falsely against a historical snapshot)
 * lived. None of these branches had a component test before this retry.
 */

import type { ReactElement, ReactNode } from "react";
import {
  fireEvent,
  render as rtlRender,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
// pinned to "rbalance" (the Balance Sheet tab) by default for every test in
// this file; the revisi I investment-dialog test overrides it to "rinv".
const mockSearchParams = jest.fn(() => new URLSearchParams("tab=rbalance"));
jest.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams(),
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

jest.mock("../../../components/money/use-fx-snapshot", () => ({
  useFxSnapshot: (enabled: boolean) => ({
    data: enabled
      ? jest.requireActual("../../../components/money/fx-test-rates")
          .TEST_FX_RATES
      : undefined,
    isError: false,
  }),
}));

jest.mock("../../../hooks/use-currency-preference", () => ({
  useCurrencyPreference: () => ({
    currency: "IDR",
    isIndicative: false,
    isReady: true,
    formatMoney: String,
  }),
}));

let balanceSheetFixture: BalanceSheetDto;
let bridgeFixture: ReconciliationBridgeDto;
let netWorthFixture: NetWorthDto;

const mockApiFetch = jest.fn(
  (url: string, init?: { method?: string; body?: string }) => {
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
    if (url.includes("/investments/summary")) {
      return Promise.resolve({
        totalCostBasis: "0",
        totalCurrentValue: "0",
        totalReturnRp: "0",
        totalReturnPct: 0,
        todayReturnRp: "0",
        todayReturnPct: 0,
      });
    }
    if (url.endsWith("/investments") && init?.method === "POST") {
      return Promise.resolve({ id: "inv-new" });
    }
    if (url.includes("/investments")) return Promise.resolve([]);
    return Promise.resolve({});
  },
);
jest.mock("../../../lib/api-client", () => ({
  apiFetch: (...args: Parameters<typeof mockApiFetch>) => mockApiFetch(...args),
}));

import { id as idDict } from "../../../i18n/id";
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
    contribution: 0,
    holdingsChange: 0,
    unexplained: 0,
    dataAvailable: true,
    restrictedForViewer: false,
    ...overrides,
  };
}

describe("/laporan Balance Sheet tab — honest no-data states (EPIC-023 Task B retry)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiFetch.mockClear();
    mockSearchParams.mockImplementation(
      () => new URLSearchParams("tab=rbalance"),
    );
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
      await screen.findByText("Tidak Tersedia Untuk Peran kamu"),
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
        "Snapshot untuk periode ini ada, tapi menyertakan semua akun. Karena peran kamu tidak bisa melihat akun privat, jembatan ini tidak bisa ditampilkan tanpa membocorkan saldo yang disembunyikan.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        "Riwayat snapshot belum cukup untuk merekonsiliasi periode ini.",
      ),
    ).not.toBeInTheDocument();
  });

  it("bridge card — names the contribution separately from holdings-change, and the rows sum to Closing (EPIC-023 Task B3 review, HIGH x2 / FIX 1 & FIX 4)", async () => {
    balanceSheetFixture = baseBalanceSheet();
    // The epic's own clean-month fixture: 270,000,000 + 15,000,000 -
    // 10,000,000 + 21,000,000 + 0 = 296,000,000. Asserting the FORMATTED
    // VALUES (not just the labels) is FIX 4 — a test that only checked
    // `getByText("Belum Terjelaskan")` would still pass if the wrong field
    // (or the wrong sign) were rendered in any of these slots.
    bridgeFixture = baseBridge({
      opening: 270_000_000,
      closing: 296_000_000,
      profit: 15_000_000,
      contribution: 10_000_000,
      holdingsChange: 21_000_000,
      unexplained: 0,
    });

    render(<LaporanPage />);

    expect(await screen.findByText("Net Worth Awal")).toBeInTheDocument();
    expect(
      screen.getByText(/kontribusi tunai ke aset\/investasi \(net-netral\)/i),
    ).toBeInTheDocument();
    // The contribution row displays the SIGNED amount it actually
    // subtracts from the running total (-10,000,000), not the raw
    // +10,000,000 contribution — this is what makes the rows sum to
    // Closing when read top to bottom (FIX 1's second defect).
    expect(screen.getByText("-10 jt")).toBeInTheDocument();
    expect(screen.getByText("21 jt")).toBeInTheDocument();
    // The Closing figure itself — FIX 4 requires asserting this value in
    // at least one bridge test.
    expect(screen.getByText("296 jt")).toBeInTheDocument();
    // unexplained is 0 — the row must not render at all.
    expect(screen.queryByText("Belum Terjelaskan")).not.toBeInTheDocument();
  });

  it("bridge card — shows the unexplained row, honestly labelled and valued, only when it is non-zero (FIX 4)", async () => {
    balanceSheetFixture = baseBalanceSheet();
    bridgeFixture = baseBridge({
      // profit is deliberately non-zero so `unexplained` (-3,000,000) does
      // NOT coincide with `netWorthChange` (closing − opening = 2,000,000)
      // — a collision that would make the "-3 jt" assertion below
      // ambiguous between the Unexplained row and the informational
      // Perubahan Net Worth row.
      opening: 270_000_000,
      closing: 272_000_000,
      profit: 5_000_000,
      contribution: 0,
      holdingsChange: 0,
      unexplained: -3_000_000,
    });

    render(<LaporanPage />);

    expect(await screen.findByText("Net Worth Awal")).toBeInTheDocument();
    expect(screen.getByText("Belum Terjelaskan")).toBeInTheDocument();
    // The residual's formatted amount — FIX 4 requires asserting the
    // actual value, not only the label, so a wrong field or a dropped sign
    // in the Unexplained slot would fail this test.
    expect(screen.getByText("-3 jt")).toBeInTheDocument();
    expect(screen.getByText("272 jt")).toBeInTheDocument();
  });
});

describe("/laporan — revisi I multi-currency (investment dialog)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiFetch.mockClear();
    mockSearchParams.mockImplementation(() => new URLSearchParams("tab=rinv"));
    queryClient.clear();
    balanceSheetFixture = baseBalanceSheet();
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

  it("revisi I — laporan add-investment in EUR sends costBasisPerUnit with sen + fxInputs", async () => {
    const user = userEvent.setup();
    render(<LaporanPage />);

    const [addButton] = await screen.findAllByRole("button", {
      name: `+ ${idDict.common.add}`,
    });
    await user.click(addButton!);

    await user.type(
      screen.getByPlaceholderText(idDict.investasi.fieldTickerPlaceholder),
      "BBCA",
    );
    await user.type(
      screen.getByPlaceholderText(idDict.investasi.fieldNamePlaceholder),
      "Bank Central Asia",
    );
    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "10" },
    });
    await userEvent.selectOptions(screen.getByLabelText("Mata uang"), "EUR");
    await userEvent.type(
      screen.getByLabelText(idDict.investasi.fieldCostBasisLabel),
      "10",
    );

    fireEvent.submit(
      screen
        .getByLabelText(idDict.investasi.fieldCostBasisLabel)
        .closest("form") as HTMLFormElement,
    );

    await waitFor(() => {
      const post = mockApiFetch.mock.calls.find(
        ([url, init]) =>
          String(url).endsWith("/investments") &&
          (init as { method?: string } | undefined)?.method === "POST",
      );
      expect(post).toBeDefined();
    });
    const post = mockApiFetch.mock.calls.find(
      ([url, init]) =>
        String(url).endsWith("/investments") &&
        (init as { method?: string } | undefined)?.method === "POST",
    ) as [string, { body: string }];
    expect(JSON.parse(post[1].body)).toMatchObject({
      costBasisPerUnit: "204272.20",
      fxInputs: [{ field: "costBasisPerUnit", currency: "EUR", amount: "10" }],
    });
  });
});
