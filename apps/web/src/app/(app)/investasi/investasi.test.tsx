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

describe("InvestasiPage — quantity unit follows the instrument (Revisi D item 9)", () => {
  it.each([
    ["saham", "Jumlah Saham"],
    ["reksa_dana", "Jumlah Unit Penyertaan"],
    ["obligasi", "Jumlah Unit"],
    ["emas", "Berat Emas (gram)"],
    ["kripto", "Jumlah Koin"],
    ["lainnya", "Jumlah Unit"],
  ])("labels the %s quantity field %s", async (type, label) => {
    mockSession("owner");
    const user = userEvent.setup();
    render(<InvestasiPage />);

    await user.selectOptions(await openAddModal(user), type);

    expect(screen.getByLabelText(label)).toHaveAttribute("name", "quantity");
  });

  it("uses a gram step and an emas placeholder", async () => {
    mockSession("owner");
    const user = userEvent.setup();
    render(<InvestasiPage />);

    await user.selectOptions(await openAddModal(user), "emas");

    const qty = screen.getByLabelText("Berat Emas (gram)");
    expect(qty).toHaveAttribute("step", "0.001");
    expect(qty).toHaveAttribute("placeholder", "contoh: 10.5");
  });

  it("rejects more than 3 decimals of gram without saving", async () => {
    mockSession("owner");
    const user = userEvent.setup();
    render(<InvestasiPage />);

    await user.selectOptions(await openAddModal(user), "emas");
    fireEvent.change(screen.getByLabelText("Nama"), {
      target: { value: "Antam 10 g" },
    });
    fireEvent.change(screen.getByLabelText("Ticker"), {
      target: { value: "ANTM" },
    });
    const qty = screen.getByLabelText("Berat Emas (gram)");
    fireEvent.change(qty, { target: { value: "1.2345" } });
    fireEvent.change(screen.getByLabelText("Harga Beli per Unit (Rp)"), {
      target: { value: "1500000" },
    });
    fireEvent.submit(qty.closest("form") as HTMLFormElement);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Jumlah gram maksimal 3 angka di belakang koma.",
      ),
    );
    expect(postBodyTo("/investments")).toBeUndefined();
  });

  it("shows an emas holding's grams without rounding", async () => {
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

    expect(await screen.findByText("10,5 gram")).toBeInTheDocument();
  });

  it("shows buy/sell history quantities in the instrument's unit", async () => {
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

    expect(await screen.findByText(/2,5 gram @/)).toBeInTheDocument();
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
      "tr",
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

  it("has no Lot/Lembar toggle for emas and labels the quantity in grams", async () => {
    const user = userEvent.setup();
    setup();
    await openTrade(user, "Logam Mulia");

    expect(screen.queryByRole("tab", { name: "Lot" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Jumlah (gram)")).toHaveAttribute(
      "step",
      "0.001",
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
