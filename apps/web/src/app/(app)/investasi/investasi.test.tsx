/**
 * EPIC-022 Group F (F3) — CASL grants "manage Investment" only to
 * owner/spouse/member; admin_staff is read-only. The add/edit/delete
 * affordances used to render for every role regardless, so a read-only role
 * only found out via a 403 after filling in a form. Locks in: a role
 * without the grant sees neither the header "add" button nor a row's
 * Edit/Hapus actions; a role with the grant sees both.
 */

import type { ReactElement, ReactNode } from "react";
import {
  resolveEffectiveAccess,
  type MemberRoleKey,
} from "@wealthme/contracts";
import {
  fireEvent,
  render as rtlRender,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
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

import { id as idDict } from "../../../i18n/id";
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
  automatedPriceSimulated: false,
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
    // EPIC-030 — menu/permission gating reads the resolved IAM access.
    if (path.endsWith("/access/me")) {
      return Promise.resolve(
        resolveEffectiveAccess({ role: role as MemberRoleKey }),
      );
    }
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

type ApiInit = { method?: string; token?: string; body?: string };
type RouteHandler = (path: string, init?: ApiInit) => unknown;

function holdingOf(overrides: Partial<InvestmentDto>): InvestmentDto {
  return { ...HOLDING, ...overrides };
}

// Layers path-suffix routes over whatever mockSession() installed.
function routeApi(routes: Record<string, unknown>) {
  const fallback = mockApiFetch.getMockImplementation();
  mockApiFetch.mockImplementation((path: string, init?: ApiInit) => {
    const hit = Object.keys(routes).find((suffix) => path.endsWith(suffix));
    if (hit !== undefined) {
      const route = routes[hit];
      return Promise.resolve(
        typeof route === "function"
          ? (route as RouteHandler)(path, init)
          : route,
      );
    }
    return fallback ? fallback(path, init) : Promise.resolve([]);
  });
}

function postBodyTo(suffix: string): Record<string, unknown> | undefined {
  const call = mockApiFetch.mock.calls.find(
    ([path, init]) =>
      String(path).endsWith(suffix) &&
      (init as ApiInit | undefined)?.method === "POST",
  );
  return call
    ? (JSON.parse((call[1] as ApiInit).body ?? "{}") as Record<string, unknown>)
    : undefined;
}

async function openAddModal(
  user: ReturnType<typeof userEvent.setup>,
): Promise<HTMLElement> {
  await user.click(
    await screen.findByRole("button", { name: /Catat Investasi/i }),
  );
  return screen.findByLabelText("Jenis");
}

describe("InvestasiPage — role gating (F3)", () => {
  it("hides the add/edit/delete affordances from a role without CASL's manage Investment", async () => {
    mockSession("admin_staff");
    render(<InvestasiPage />);

    await screen.findByText("Emas Batangan");
    expect(
      screen.queryByRole("button", { name: /Catat Investasi/i }),
    ).not.toBeInTheDocument();

    const row = screen.getByText("Emas Batangan").closest("li");
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

    const row = screen.getByText("Emas Batangan").closest("li");
    expect(row).not.toBeNull();
    expect(
      within(row as HTMLElement).getByRole("button", { name: "Edit" }),
    ).toBeInTheDocument();
    expect(
      within(row as HTMLElement).getByRole("button", { name: "Hapus" }),
    ).toBeInTheDocument();
  });
});

describe("InvestasiPage — B6: never shows a simulated price as live", () => {
  it("shows the honest unavailable label instead of a Live badge for a mock-sourced price", async () => {
    mockSession("owner");
    routeApi({
      "/investments": [
        holdingOf({
          id: "inv-qq",
          ticker: "QQ",
          name: "QQ Corp",
          type: "saham",
          quantity: "200",
          costBasisPerUnit: "3400",
          currentPrice: null,
          currentValue: "680000",
          latestPriceSource: "mock",
          automatedPriceSimulated: true,
        }),
      ],
    });
    render(<InvestasiPage />);

    const row = (await screen.findByText("QQ Corp")).closest("li");
    expect(row).not.toBeNull();
    expect(
      within(row as HTMLElement).getByText(
        idDict.investasi.priceSimulatedLabel,
      ),
    ).toBeInTheDocument();
    expect(
      within(row as HTMLElement).queryByText(idDict.investasi.priceLiveBadge),
    ).not.toBeInTheDocument();
    // Current value falls back to cost basis (3400 * 200 = Rp 680.000),
    // never a fabricated mock-price-driven figure (e.g. the reported
    // Rp 680.240 from a Rp 3.092 simulated price).
    expect(
      within(row as HTMLElement).getAllByText("Rp 680.000").length,
    ).toBeGreaterThan(0);
    expect(
      within(row as HTMLElement).queryByText(/680\.240/),
    ).not.toBeInTheDocument();
  });

  it("still shows the Live badge for a real automated price (automatedPriceSimulated:false)", async () => {
    mockSession("owner");
    routeApi({
      "/investments": [
        holdingOf({
          id: "inv-btc",
          ticker: "BTC",
          name: "Bitcoin",
          type: "kripto",
          quantity: "0.01",
          costBasisPerUnit: "900000000",
          currentPrice: "950000000",
          currentValue: "9500000",
          latestPriceSource: "coingecko",
          automatedPriceSimulated: false,
        }),
      ],
    });
    render(<InvestasiPage />);

    // One-word names also label the hero chart's bar, so pick the list row.
    const row = (await screen.findAllByText("Bitcoin"))
      .map((el) => el.closest("li"))
      .find((li) => li !== null);
    expect(row).not.toBeNull();
    expect(
      within(row as HTMLElement).getByText(idDict.investasi.priceLiveBadge),
    ).toBeInTheDocument();
  });
});

describe("InvestasiPage — ticker required only for saham/kripto (E2E round-2 B1)", () => {
  it.each([
    ["saham", true],
    ["kripto", true],
    ["deposito", false],
    ["emas", false],
    ["reksa_dana", false],
    ["obligasi", false],
    ["lainnya", false],
  ])("Ticker field visible+required=%s for %s", async (type, visible) => {
    mockSession("owner");
    const user = userEvent.setup();
    render(<InvestasiPage />);

    await user.selectOptions(await openAddModal(user), type);

    const field = screen.queryByLabelText("Ticker");
    if (visible) {
      expect(field).toBeInTheDocument();
      expect(field).toBeRequired();
    } else {
      expect(field).not.toBeInTheDocument();
    }
  });
});

describe("InvestasiPage — quantity unit follows the instrument (Revisi D item 9)", () => {
  it.each([
    ["saham", "Jumlah Saham"],
    ["reksa_dana", "Jumlah Unit Penyertaan"],
    ["obligasi", "Jumlah Unit"],
    // B9 follow-up (client revision round 2) — the user's explicit "Per
    // kilogram" choice: gold holdings are entered/displayed in kg, stored
    // in grams unchanged.
    ["emas", "Berat Emas (kg)"],
    ["kripto", "Jumlah Koin"],
    ["lainnya", "Jumlah Unit"],
  ])("labels the %s quantity field %s", async (type, label) => {
    mockSession("owner");
    const user = userEvent.setup();
    render(<InvestasiPage />);

    await user.selectOptions(await openAddModal(user), type);

    expect(screen.getByLabelText(label)).toHaveAttribute("name", "quantity");
  });

  it("uses a kg step and an emas placeholder (B9 follow-up)", async () => {
    mockSession("owner");
    const user = userEvent.setup();
    render(<InvestasiPage />);

    await user.selectOptions(await openAddModal(user), "emas");

    const qty = screen.getByLabelText("Berat Emas (kg)");
    expect(qty).toHaveAttribute("step", "0.000001");
    expect(qty).toHaveAttribute("placeholder", "contoh: 0.025");
  });

  it("shows the gram equivalent under the kg input as it's typed (B9 follow-up)", async () => {
    mockSession("owner");
    const user = userEvent.setup();
    render(<InvestasiPage />);

    await user.selectOptions(await openAddModal(user), "emas");

    const qty = screen.getByLabelText("Berat Emas (kg)");
    fireEvent.change(qty, { target: { value: "0.025" } });

    expect(await screen.findByText("= 25 gram")).toBeInTheDocument();
  });

  it("rejects more than 6 decimals of kg without saving", async () => {
    mockSession("owner");
    const user = userEvent.setup();
    render(<InvestasiPage />);

    await user.selectOptions(await openAddModal(user), "emas");
    fireEvent.change(screen.getByLabelText("Nama"), {
      target: { value: "Antam 10 g" },
    });
    // E2E round-2 B1 — emas is not a market-priced type; the Ticker field
    // is hidden and not required.
    expect(screen.queryByLabelText("Ticker")).not.toBeInTheDocument();
    const qty = screen.getByLabelText("Berat Emas (kg)");
    fireEvent.change(qty, { target: { value: "1.23456789" } });
    fireEvent.change(screen.getByLabelText("Harga Beli per Unit (Rp)"), {
      target: { value: "1500000" },
    });
    fireEvent.submit(qty.closest("form") as HTMLFormElement);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Jumlah kg maksimal 6 angka di belakang koma.",
      ),
    );
    expect(postBodyTo("/investments")).toBeUndefined();
  });

  it("stores 0.025 kg entered as exactly 25 g, canonical, on the add payload (B9 follow-up)", async () => {
    mockSession("owner");
    const user = userEvent.setup();
    render(<InvestasiPage />);

    await user.selectOptions(await openAddModal(user), "emas");
    fireEvent.change(screen.getByLabelText("Nama"), {
      target: { value: "Antam 25 g" },
    });
    const qty = screen.getByLabelText("Berat Emas (kg)");
    fireEvent.change(qty, { target: { value: "0.025" } });
    fireEvent.change(screen.getByLabelText("Harga Beli per Unit (Rp)"), {
      target: { value: "1500000" },
    });
    fireEvent.submit(qty.closest("form") as HTMLFormElement);

    await waitFor(() =>
      expect(postBodyTo("/investments")).toEqual(
        expect.objectContaining({ quantity: "25" }),
      ),
    );
  });

  it("shows an emas holding converted to kg, with grams as the muted line (B9 follow-up)", async () => {
    mockSession("owner");
    routeApi({
      "/investments": [
        holdingOf({
          type: "emas",
          name: "Logam Mulia",
          ticker: "ANTM",
          quantity: "10.5",
        }),
      ],
    });
    render(<InvestasiPage />);

    // 10.5 g == 0.0105 kg exactly — the value math the report asks to
    // check: kg display × price/kg must equal grams × (price/kg ÷ 1000).
    expect(await screen.findByText("0,0105 kg")).toBeInTheDocument();
    expect(await screen.findByText("10,5 gram")).toBeInTheDocument();
  });

  it("shows buy/sell history quantities in kg, price scaled to per-kg (B9 follow-up)", async () => {
    mockSession("owner");
    routeApi({
      "/investments": [
        holdingOf({
          type: "emas",
          name: "Logam Mulia",
          ticker: "ANTM",
          quantity: "10.5",
        }),
      ],
      "/investments/inv-1/transactions": [
        {
          id: "tx-1",
          investmentId: "inv-1",
          type: "buy",
          quantity: "2.5",
          pricePerUnit: "1400000",
          occurredAt: "2026-09-10T03:00:00.000Z",
          realizedPnl: null,
          createdAt: "2026-09-10T03:00:00.000Z",
        },
      ],
    });
    const user = userEvent.setup();
    render(<InvestasiPage />);

    await user.click(
      await screen.findByRole("button", { name: "Lihat Detail" }),
    );

    // 2.5 g @ Rp1.400.000/g === 0.0025 kg @ Rp1.400.000.000/kg, exact.
    expect(await screen.findByText(/0,0025 kg @/)).toBeInTheDocument();
  });
});

describe("InvestasiPage — Beli/Jual Lot⇄Lembar toggle (Revisi D item 8)", () => {
  const SAHAM = holdingOf({
    id: "inv-saham",
    ticker: "BBCA",
    name: "Bank Central Asia",
    type: "saham",
    quantity: "1000",
    costBasisPerUnit: "9000",
    currentPrice: "9500",
    currentValue: "9500000",
  });
  const EMAS = holdingOf({
    id: "inv-emas",
    ticker: "ANTM",
    name: "Logam Mulia",
    type: "emas",
    quantity: "10",
  });
  const TX_CREATED = {
    id: "tx-new",
    investmentId: "inv-saham",
    type: "sell",
    quantity: "500",
    pricePerUnit: "9500",
    occurredAt: "2026-09-25T00:00:00.000Z",
    realizedPnl: "250000",
    createdAt: "2026-09-25T00:00:00.000Z",
  };

  function setup() {
    mockSession("owner");
    routeApi({
      "/investments": [SAHAM, EMAS],
      "/transactions": (_path: string, init?: ApiInit) =>
        init?.method === "POST" ? TX_CREATED : [],
    });
    render(<InvestasiPage />);
  }

  async function openTrade(
    user: ReturnType<typeof userEvent.setup>,
    holdingName: string,
  ) {
    const row = (await screen.findByText(holdingName)).closest(
      "li",
    ) as HTMLElement;
    await user.click(within(row).getByRole("button", { name: "Lihat Detail" }));
    await user.click(
      await screen.findByRole("button", { name: "Beli / Jual" }),
    );
  }

  function submitTrade(input: HTMLElement) {
    fireEvent.change(screen.getByLabelText("Harga per Unit (Rp)"), {
      target: { value: "9500" },
    });
    fireEvent.submit(input.closest("form") as HTMLFormElement);
  }

  it("sells 5 lot as 500 lembar", async () => {
    const user = userEvent.setup();
    setup();
    await openTrade(user, "Bank Central Asia");

    await user.click(screen.getByRole("tab", { name: "Jual" }));
    expect(screen.getByRole("tab", { name: "Lot" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const qty = screen.getByLabelText("Jumlah (Lot)");
    fireEvent.change(qty, { target: { value: "5" } });
    submitTrade(qty);

    await waitFor(() =>
      expect(postBodyTo("/investments/inv-saham/transactions")).toEqual(
        expect.objectContaining({
          type: "sell",
          quantity: "500",
          pricePerUnit: "9500",
        }),
      ),
    );
  });

  it("buys in lembar without conversion", async () => {
    const user = userEvent.setup();
    setup();
    await openTrade(user, "Bank Central Asia");

    await user.click(screen.getByRole("tab", { name: "Lembar" }));
    const qty = screen.getByLabelText("Jumlah (Lembar)");
    fireEvent.change(qty, { target: { value: "250" } });
    submitTrade(qty);

    await waitFor(() =>
      expect(postBodyTo("/investments/inv-saham/transactions")).toEqual(
        expect.objectContaining({ type: "buy", quantity: "250" }),
      ),
    );
  });

  it("sends an odd lot as exact lembar (0.07 lot → 7)", async () => {
    const user = userEvent.setup();
    setup();
    await openTrade(user, "Bank Central Asia");

    const qty = screen.getByLabelText("Jumlah (Lot)");
    fireEvent.change(qty, { target: { value: "0.07" } });
    submitTrade(qty);

    await waitFor(() =>
      expect(postBodyTo("/investments/inv-saham/transactions")?.quantity).toBe(
        "7",
      ),
    );
  });

  it("converts the typed value when the unit is toggled", async () => {
    const user = userEvent.setup();
    setup();
    await openTrade(user, "Bank Central Asia");

    fireEvent.change(screen.getByLabelText("Jumlah (Lot)"), {
      target: { value: "5" },
    });
    await user.click(screen.getByRole("tab", { name: "Lembar" }));

    expect(screen.getByLabelText("Jumlah (Lembar)")).toHaveValue(500);
  });

  it("explains that the price stays per lembar", async () => {
    const user = userEvent.setup();
    setup();
    await openTrade(user, "Bank Central Asia");

    expect(
      screen.getByText("Harga tetap per lembar, walau jumlah diisi dalam lot."),
    ).toBeInTheDocument();
  });

  it("has no Lot/Lembar toggle for emas and labels the Beli/Jual quantity in kg (B9 follow-up)", async () => {
    const user = userEvent.setup();
    setup();
    await openTrade(user, "Logam Mulia");

    expect(screen.queryByRole("tab", { name: "Lot" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Jumlah (kg)")).toHaveAttribute(
      "step",
      "0.000001",
    );
  });

  it("explains that the price stays per gram for a gold Beli/Jual trade (B9 follow-up)", async () => {
    const user = userEvent.setup();
    setup();
    await openTrade(user, "Logam Mulia");

    expect(
      screen.getByText("Harga tetap per gram, walau jumlah diisi dalam kg."),
    ).toBeInTheDocument();
  });

  it("canonicalizes 0.025 kg entered on a gold Beli/Jual trade to exactly 25 g (B9 follow-up)", async () => {
    const user = userEvent.setup();
    setup();
    await openTrade(user, "Logam Mulia");

    const qty = screen.getByLabelText("Jumlah (kg)");
    fireEvent.change(qty, { target: { value: "0.025" } });
    submitTrade(qty);

    await waitFor(() =>
      expect(postBodyTo("/investments/inv-emas/transactions")).toEqual(
        expect.objectContaining({ quantity: "25" }),
      ),
    );
  });
});

describe("InvestasiPage — emas priced from the family gold price (Revisi D item 11)", () => {
  const GOLD = {
    pricePerGram: "1500000",
    updatedAt: "2026-09-20T03:00:00.000Z",
  };

  it("hides the manual price field for emas and points to Pengaturan › Harga Emas", async () => {
    mockSession("owner");
    routeApi({ "/gold-price": GOLD });
    const user = userEvent.setup();
    render(<InvestasiPage />);

    await user.selectOptions(await openAddModal(user), "emas");

    expect(
      screen.queryByLabelText("Harga Saat Ini (Rp, opsional)"),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByText(
        /Harga dari Pengaturan › Harga Emas \(Rp 1\.500\.000\/gram, diperbarui .+\)/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Buka Pengaturan" }),
    ).toHaveAttribute("href", "/akun");
  });

  it("says the family gold price is unset when the owner has not set one", async () => {
    mockSession("owner");
    routeApi({ "/gold-price": { pricePerGram: null, updatedAt: null } });
    const user = userEvent.setup();
    render(<InvestasiPage />);

    await user.selectOptions(await openAddModal(user), "emas");

    expect(
      await screen.findByText(/Harga emas keluarga belum diatur/),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Harga Saat Ini (Rp, opsional)"),
    ).not.toBeInTheDocument();
  });

  it("still offers the manual price field for reksa dana", async () => {
    mockSession("owner");
    routeApi({ "/gold-price": GOLD });
    const user = userEvent.setup();
    render(<InvestasiPage />);

    await user.selectOptions(await openAddModal(user), "reksa_dana");

    expect(
      screen.getByLabelText("Harga Saat Ini (Rp, opsional)"),
    ).toBeInTheDocument();
  });

  it("labels an emas row priced from the family gold price", async () => {
    mockSession("owner");
    routeApi({
      "/investments": [
        holdingOf({
          type: "emas",
          name: "Logam Mulia",
          ticker: "ANTM",
          quantity: "10",
          currentPrice: "1500000",
          currentValue: "15000000",
          latestPriceSource: "family-gold-price",
          latestPriceAsOf: GOLD.updatedAt,
          latestPriceRecordedAt: GOLD.updatedAt,
          latestPriceDelayed: false,
        }),
      ],
    });
    render(<InvestasiPage />);

    expect(await screen.findByText("Rp 1.500.000 / gram")).toBeInTheDocument();
    expect(screen.getByText(/Harga emas keluarga ·/)).toBeInTheDocument();
  });
});

describe("InvestasiPage — detail dialog layout + history date filter (Revisi D item 8b)", () => {
  const now = new Date();
  const dayIso = (day: number) =>
    new Date(now.getFullYear(), now.getMonth(), day, 10, 0).toISOString();
  const TXS = [
    {
      id: "tx-early",
      investmentId: "inv-1",
      type: "buy",
      quantity: "3",
      pricePerUnit: "100000",
      occurredAt: dayIso(2),
      realizedPnl: null,
      createdAt: dayIso(2),
    },
    {
      id: "tx-late",
      investmentId: "inv-1",
      type: "buy",
      quantity: "7",
      pricePerUnit: "100000",
      occurredAt: dayIso(20),
      realizedPnl: null,
      createdAt: dayIso(20),
    },
  ];

  async function applyRange(
    user: ReturnType<typeof userEvent.setup>,
    dialog: HTMLElement,
  ) {
    await user.click(
      within(dialog).getByRole("button", { name: "Semua tanggal" }),
    );
    const picker = screen.getByRole("dialog", { name: "Filter tanggal" });
    await user.click(within(picker).getByRole("button", { name: /^10 / }));
    await user.click(within(picker).getByRole("button", { name: /^25 / }));
    await user.click(within(picker).getByRole("button", { name: "Terapkan" }));
  }

  it("opens wide with a two-column body", async () => {
    mockSession("owner");
    routeApi({ "/investments/inv-1/transactions": TXS });
    const user = userEvent.setup();
    render(<InvestasiPage />);

    await user.click(
      await screen.findByRole("button", { name: "Lihat Detail" }),
    );
    const dialog = await screen.findByRole("dialog", { name: "Emas Batangan" });

    expect(dialog).toHaveClass("min-[769px]:w-[min(56rem,calc(100%-2rem))]");
    expect(dialog).not.toHaveClass("max-w-lg");
    expect(dialog.querySelector(".dialog__body")).toHaveClass("md:grid-cols-2");
    expect(within(dialog).getByText("Riwayat Harga")).toBeInTheDocument();
    expect(await within(dialog).findByText(/3 unit @/)).toBeInTheDocument();
    expect(within(dialog).getByText(/7 unit @/)).toBeInTheDocument();
  });

  it("filters the buy/sell history to the chosen range and clears back to all", async () => {
    mockSession("owner");
    routeApi({ "/investments/inv-1/transactions": TXS });
    const user = userEvent.setup();
    render(<InvestasiPage />);

    await user.click(
      await screen.findByRole("button", { name: "Lihat Detail" }),
    );
    const dialog = await screen.findByRole("dialog", { name: "Emas Batangan" });
    await within(dialog).findByText(/3 unit @/);

    await applyRange(user, dialog);

    expect(within(dialog).queryByText(/3 unit @/)).not.toBeInTheDocument();
    expect(within(dialog).getByText(/7 unit @/)).toBeInTheDocument();

    await user.click(
      within(dialog).getByRole("button", { name: "Hapus filter" }),
    );

    expect(within(dialog).getByText(/3 unit @/)).toBeInTheDocument();
  });

  it("does not carry a filter over to another holding", async () => {
    mockSession("owner");
    routeApi({
      "/investments": [
        HOLDING,
        holdingOf({
          id: "inv-2",
          name: "Reksa Dana Pasar Uang",
          ticker: "RDPU",
          type: "reksa_dana",
        }),
      ],
      "/investments/inv-1/transactions": TXS,
    });
    const user = userEvent.setup();
    render(<InvestasiPage />);

    const [firstDetail] = await screen.findAllByRole("button", {
      name: "Lihat Detail",
    });
    await user.click(firstDetail as HTMLElement);
    const dialog = await screen.findByRole("dialog", { name: "Emas Batangan" });
    await within(dialog).findByText(/3 unit @/);
    await applyRange(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: "Tutup" }));

    const [, secondDetail] = await screen.findAllByRole("button", {
      name: "Lihat Detail",
    });
    await user.click(secondDetail as HTMLElement);
    const second = await screen.findByRole("dialog", {
      name: "Reksa Dana Pasar Uang",
    });

    expect(
      within(second).getByRole("button", { name: "Semua tanggal" }),
    ).toBeInTheDocument();
  });
});

describe("InvestasiPage — revisi I multi-currency", () => {
  it("revisi I — Record Investment in USD sends the IDR unit price with sen + fxInputs", async () => {
    mockSession("owner");
    routeApi({
      "/investments": (_path: string, init?: ApiInit) =>
        init?.method === "POST" ? { id: "inv-new", type: "saham" } : [HOLDING],
    });
    const user = userEvent.setup();
    render(<InvestasiPage />);

    await openAddModal(user);
    fireEvent.change(screen.getByLabelText("Nama"), {
      target: { value: "Test USD Holding" },
    });
    fireEvent.change(screen.getByLabelText("Ticker"), {
      target: { value: "TST" },
    });
    fireEvent.change(screen.getByLabelText("Jumlah Saham"), {
      target: { value: "10" },
    });
    await userEvent.selectOptions(
      within(
        screen
          .getByLabelText(idDict.investasi.fieldCostBasisLabel)
          .closest(".field")!,
      ).getByLabelText("Mata uang"),
      "USD",
    );
    await userEvent.type(
      screen.getByLabelText(idDict.investasi.fieldCostBasisLabel),
      "12,34",
    );
    fireEvent.submit(
      screen.getByLabelText("Nama").closest("form") as HTMLFormElement,
    );

    await waitFor(() =>
      expect(postBodyTo("/investments")).toMatchObject({
        costBasisPerUnit: "221057.52",
        fxInputs: [
          { field: "costBasisPerUnit", currency: "USD", amount: "12.34" },
        ],
      }),
    );
  });

  it("C1 — IDR cost basis with sen sends the canonical decimal, not the ×100 digit strip", async () => {
    mockSession("owner");
    routeApi({
      "/investments": (_path: string, init?: ApiInit) =>
        init?.method === "POST" ? { id: "inv-new", type: "saham" } : [HOLDING],
    });
    const user = userEvent.setup();
    render(<InvestasiPage />);

    await openAddModal(user);
    fireEvent.change(screen.getByLabelText("Nama"), {
      target: { value: "Test IDR Sen" },
    });
    fireEvent.change(screen.getByLabelText("Ticker"), {
      target: { value: "TST" },
    });
    fireEvent.change(screen.getByLabelText("Jumlah Saham"), {
      target: { value: "10" },
    });
    await userEvent.type(
      screen.getByLabelText(idDict.investasi.fieldCostBasisLabel),
      "9.500,50",
    );
    fireEvent.submit(
      screen.getByLabelText("Nama").closest("form") as HTMLFormElement,
    );

    await waitFor(() =>
      expect(postBodyTo("/investments")).toMatchObject({
        costBasisPerUnit: "9500.50",
      }),
    );
    expect(postBodyTo("/investments")?.fxInputs).toBeUndefined();
  });

  it("C1 — IDR cost basis without sen sends the plain canonical amount", async () => {
    mockSession("owner");
    routeApi({
      "/investments": (_path: string, init?: ApiInit) =>
        init?.method === "POST" ? { id: "inv-new", type: "saham" } : [HOLDING],
    });
    const user = userEvent.setup();
    render(<InvestasiPage />);

    await openAddModal(user);
    fireEvent.change(screen.getByLabelText("Nama"), {
      target: { value: "Test IDR Whole" },
    });
    fireEvent.change(screen.getByLabelText("Ticker"), {
      target: { value: "TST" },
    });
    fireEvent.change(screen.getByLabelText("Jumlah Saham"), {
      target: { value: "10" },
    });
    await userEvent.type(
      screen.getByLabelText(idDict.investasi.fieldCostBasisLabel),
      "9.500",
    );
    fireEvent.submit(
      screen.getByLabelText("Nama").closest("form") as HTMLFormElement,
    );

    await waitFor(() =>
      expect(postBodyTo("/investments")).toMatchObject({
        costBasisPerUnit: "9500",
      }),
    );
  });

  it("M2 — edit prefill keeps sen instead of rounding to whole rupiah", async () => {
    mockSession("owner");
    routeApi({
      "/investments": [
        holdingOf({ costBasisPerUnit: "100000.55", type: "reksa_dana" }),
      ],
    });
    const user = userEvent.setup();
    render(<InvestasiPage />);

    const row = (await screen.findByText("Emas Batangan")).closest(
      "li",
    ) as HTMLElement;
    await user.click(within(row).getByRole("button", { name: "Edit" }));

    expect(
      await screen.findByLabelText(idDict.investasi.fieldCostBasisLabel),
    ).toHaveValue("100.000,55");
  });

  it("revisi I — buy/sell price in USD sends pricePerUnit with sen + fxInputs", async () => {
    mockSession("owner");
    const user = userEvent.setup();
    render(<InvestasiPage />);

    const row = (await screen.findByText("Emas Batangan")).closest(
      "li",
    ) as HTMLElement;
    await user.click(within(row).getByRole("button", { name: "Lihat Detail" }));
    await user.click(
      await screen.findByRole("button", { name: "Beli / Jual" }),
    );

    fireEvent.change(screen.getByLabelText(/Jumlah/), {
      target: { value: "1" },
    });
    await userEvent.selectOptions(
      screen.getAllByLabelText("Mata uang").at(-1)!,
      "USD",
    );
    await userEvent.type(
      screen.getByLabelText(idDict.investasi.buySellFieldPriceLabel),
      "99,99",
    );
    fireEvent.submit(
      screen
        .getByLabelText(idDict.investasi.buySellFieldPriceLabel)
        .closest("form") as HTMLFormElement,
    );

    await waitFor(() =>
      expect(postBodyTo("/investments/inv-1/transactions")).toMatchObject({
        pricePerUnit: "1791210.85",
        fxInputs: [{ field: "pricePerUnit", currency: "USD", amount: "99.99" }],
      }),
    );
  });

  it("C1 — IDR buy/sell price with sen sends the canonical decimal, not the ×100 digit strip", async () => {
    mockSession("owner");
    const user = userEvent.setup();
    render(<InvestasiPage />);

    const row = (await screen.findByText("Emas Batangan")).closest(
      "li",
    ) as HTMLElement;
    await user.click(within(row).getByRole("button", { name: "Lihat Detail" }));
    await user.click(
      await screen.findByRole("button", { name: "Beli / Jual" }),
    );

    fireEvent.change(screen.getByLabelText(/Jumlah/), {
      target: { value: "1" },
    });
    await userEvent.type(
      screen.getByLabelText(idDict.investasi.buySellFieldPriceLabel),
      "9.500,50",
    );
    fireEvent.submit(
      screen
        .getByLabelText(idDict.investasi.buySellFieldPriceLabel)
        .closest("form") as HTMLFormElement,
    );

    await waitFor(() =>
      expect(postBodyTo("/investments/inv-1/transactions")).toMatchObject({
        pricePerUnit: "9500.50",
      }),
    );
    expect(
      postBodyTo("/investments/inv-1/transactions")?.fxInputs,
    ).toBeUndefined();
  });
});

describe("InvestasiPage — allocation donut renders once (Batch 5 item 2)", () => {
  it("renders the allocation-donut section exactly once, not twice", async () => {
    mockSession("owner");
    render(<InvestasiPage />);

    // The page previously rendered the same `allocationSegments`-fed
    // DonutChart twice: once beside the "Nilai Portofolio 6 Bulan" trend
    // chart, once again on its own further down the page.
    await screen.findByText("Emas Batangan");
    expect(screen.getAllByText(idDict.investasi.v2.allocTitle)).toHaveLength(1);
  });
});

describe("InvestasiPage — hardening G1 (P0 honesty): no fabricated portfolio trend", () => {
  it("never renders the fabricated 'Nilai Portofolio 6 Bulan' trend chart", async () => {
    mockSession("owner");
    render(<InvestasiPage />);
    await screen.findByText("Emas Batangan");

    expect(
      screen.queryByText("Nilai Portofolio 6 Bulan"),
    ).not.toBeInTheDocument();
  });

  it("shows an honest empty state for the holding detail sparkline when there's no real price history", async () => {
    mockSession("owner");
    render(<InvestasiPage />);

    const row = (await screen.findByText("Emas Batangan")).closest(
      "li",
    ) as HTMLElement;
    await userEvent.click(
      within(row).getByRole("button", { name: "Lihat Detail" }),
    );

    // No detailPrices mocked for this holding — the sparkline must fall
    // back to the same honest empty-state copy as the price-history list,
    // never the old static fabricated curve.
    expect(
      screen.getAllByText(idDict.investasi.priceHistoryEmpty).length,
    ).toBeGreaterThan(0);
  });
});

describe("InvestasiPage — polish batch 7b item 3 (notice disclosure + formula tooltip)", () => {
  it("shows the pricing-source notice as one line, with the full body collapsed under a disclosure", async () => {
    mockSession("owner");
    render(<InvestasiPage />);
    await screen.findByText("Emas Batangan");

    expect(
      screen.getByText(idDict.investasi.pricingSourceNoticeTitle),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(idDict.investasi.pricingSourceNoticeBody),
    ).not.toBeVisible();

    const summaryEl = screen.getByText(idDict.investasi.pricingSourceMoreLabel);
    expect(summaryEl.closest("details")).not.toHaveAttribute("open");
    await userEvent.click(summaryEl);
    expect(summaryEl.closest("details")).toHaveAttribute("open");
    expect(
      screen.getByText(idDict.investasi.pricingSourceNoticeBody),
    ).toBeVisible();
  });

  it("moves the return formula off the always-visible line and into a tooltip", async () => {
    mockSession("owner");
    render(<InvestasiPage />);
    await screen.findByText("Emas Batangan");

    const expectedFormula = idDict.investasi.returnFormulaLabel
      .replace("{returnRp}", "Rp 100.000")
      .replace("{costBasis}", "Rp 1.000.000");
    expect(screen.queryByText(expectedFormula)).not.toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: expectedFormula }),
    ).toBeInTheDocument();
  });
});
