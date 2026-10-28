/**
 * EPIC-021 #3 — "Kas Tunai bisa banyak" (multiple cash accounts as real
 * master data). The backend already supports N `AccountType.cash` rows
 * (name-scoped uniqueness); this test locks in the web fix: /dana must
 * render every cash account returned by the API (not just one hardcoded
 * row) and offer the same Add/Edit/Delete affordances as E-Wallet.
 */

import type { ReactElement, ReactNode } from "react";
import { render as rtlRender, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AccountDto } from "@wealthme/contracts";
import { ShellProvider } from "@/components/shell/shell-context";

// `./page` imports `auth-compat`, which re-exports the `better-auth` React
// client (ESM, unparsable by jest without a transform) — mock it before
// `./page` is required, same pattern as every other `(app)/**/*.test.tsx`.
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
  }),
}));

// EPIC-033 group 2 — the page now reads role/permissions/members through
// hooks; pin them so the queued `mockResolvedValueOnce` account responses
// below keep their order.
jest.mock("../../../hooks/use-role-permissions", () => ({
  useCanManage: () => ({ canManage: true, isLoading: false }),
}));
jest.mock("../../../hooks/use-my-role", () => ({
  useMyRole: () => ({ myRole: "owner", isOwner: true, isLoading: false }),
}));
jest.mock("../../../hooks/use-family-members", () => ({
  useFamilyMembers: () => ({ data: [], isLoading: false }),
}));
jest.mock("../../../hooks/use-currency-preference", () => ({
  useCurrencyPreference: () => ({
    currency: "IDR",
    isIndicative: false,
    isReady: true,
    formatMoney: String,
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

import DanaPage from "./page";

const FAMILY_GROUP_ID = "fg-1";
const TOKEN = "test-token";

// jsdom has no PointerEvent — Base UI's Dialog/Button primitives read
// pointer-event fields internally, so opening/submitting the CrudModal
// dialog needs this polyfilled (same fix as transaksi/txrow-detail.test.tsx).
if (typeof window !== "undefined" && !window.PointerEvent) {
  class PointerEventPolyfill extends MouseEvent {
    pointerId?: number;
    pointerType?: string;
    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId;
      this.pointerType = params.pointerType;
    }
  }
  // @ts-expect-error — jsdom has no native PointerEvent to satisfy the type
  window.PointerEvent = PointerEventPolyfill;
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function render(ui: ReactElement) {
  return rtlRender(ui, {
    wrapper: ({ children }) => (
      <ShellProvider>
        <Providers>{children}</Providers>
      </ShellProvider>
    ),
  });
}

function buildAccount(overrides: Partial<AccountDto> = {}): AccountDto {
  return {
    id: "acc-1",
    familyGroupId: FAMILY_GROUP_ID,
    name: "Kas Tunai",
    type: "cash",
    institution: null,
    maskedNumber: null,
    balance: "500000",
    currency: "IDR",
    isPrivate: false,
    ownerUserId: null,
    ownerName: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function mockDanaApi(
  accounts: AccountDto[],
  afterWrite: AccountDto[] = accounts,
) {
  let wrote = false;
  mockApiFetch.mockImplementation((url: string, options?: RequestInit) => {
    if (url.endsWith("/members")) return Promise.resolve([]);
    if (url.endsWith("/accounts")) {
      if (options?.method === "POST" || options?.method === "PATCH") {
        wrote = true;
        return Promise.resolve({ id: "acc-new" });
      }
      return Promise.resolve(wrote ? afterWrite : accounts);
    }
    return Promise.resolve([]);
  });
}

describe("DanaPage — multiple cash accounts as master data (EPIC-021 #3)", () => {
  beforeEach(() => {
    // `resetAllMocks` (not `clearAllMocks`) — `mockResolvedValueOnce` queues
    // from a prior test otherwise survive into the next test's calls.
    jest.resetAllMocks();
    queryClient.clear();
    mockApiFetch.mockImplementation(() => Promise.resolve([]));

    mockUseSessionAuth.mockReturnValue({
      data: {
        session: { token: TOKEN, familyGroupId: FAMILY_GROUP_ID },
        user: { id: "user-1", name: "Test User", email: "user@example.com" },
      },
      isPending: false,
    });
  });

  it("renders every cash account returned by the API, not just one hardcoded row", async () => {
    // Arrange — two distinct cash accounts (not a single hardcoded "Kas
    // Tunai"), plus one e-wallet to prove the two sections stay separate.
    mockDanaApi([
      buildAccount({ id: "acc-1", name: "Kas Tunai" }),
      buildAccount({ id: "acc-2", name: "Dompet Kerja", balance: "250000" }),
      buildAccount({
        id: "acc-3",
        name: "GoPay",
        type: "ewallet",
        institution: "GoPay",
        balance: "100000",
      }),
    ]);

    // Act
    render(<DanaPage />);

    // Assert — both cash accounts render (proves plurality, not a single
    // fixed "Kas Tunai" row), each with its own row action menu.
    expect(
      await screen.findByText("Kas Tunai", { ignore: "svg *, script, style" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Dompet Kerja", { ignore: "svg *, script, style" }),
    ).toBeInTheDocument();
    // "GoPay" renders twice for this row (name + institution subtitle).
    expect(screen.getAllByText("GoPay").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: "Menu Kas Tunai" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Menu Dompet Kerja" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Menu GoPay" }),
    ).toBeInTheDocument();
  });

  it("offers a cash action in the empty state and opens the add-cash form", async () => {
    // Arrange
    mockDanaApi([]);
    const user = userEvent.setup();
    render(<DanaPage />);
    await screen.findByText(/Belum ada kas atau e-wallet/);

    // Act — choose the cash-specific empty-state action.
    await user.click(screen.getByRole("button", { name: "Kas tunai" }));

    // Assert — a "Tambah Kas Tunai" dialog opens (the new `cash` CRUD
    // entity), not the e-wallet form.
    const dialog = within(await screen.findByRole("dialog"));
    expect(
      dialog.getByRole("heading", { name: "Tambah Kas Tunai" }),
    ).toBeInTheDocument();
  });

  it("submits a new cash account as type 'cash' via the accounts API", async () => {
    // Arrange
    const savedAccounts = [buildAccount({ id: "acc-new" })];
    mockDanaApi([], savedAccounts);
    const user = userEvent.setup();
    render(<DanaPage />);
    await screen.findByText(/Belum ada kas atau e-wallet/);

    // Act
    await user.click(screen.getByRole("button", { name: "Kas tunai" }));
    const dialog = within(await screen.findByRole("dialog"));
    await user.type(dialog.getByPlaceholderText("Dompet Harian"), "Kas Toko");
    await user.type(dialog.getByPlaceholderText("0"), "0");
    await user.click(dialog.getByRole("button", { name: /Simpan/i }));

    // Assert — the POST body's `type` is "cash", never "ewallet".
    const postCall = mockApiFetch.mock.calls.find(
      (call) => call[1]?.method === "POST",
    );
    expect(postCall).toBeDefined();
    const body = JSON.parse(postCall![1].body as string) as { type: string };
    expect(body.type).toBe("cash");
  });

  it("revisi I — a negative USD cash balance posts the preview + fxInputs", async () => {
    // Arrange
    const savedAccounts = [buildAccount({ id: "acc-new" })];
    mockDanaApi([], savedAccounts);
    const user = userEvent.setup();
    render(<DanaPage />);
    await screen.findByText(/Belum ada kas atau e-wallet/);

    // Act
    await user.click(screen.getByRole("button", { name: "Kas tunai" }));
    const dialogElement = await screen.findByRole("dialog");
    const dialog = within(dialogElement);
    await user.type(dialog.getByPlaceholderText("Dompet Harian"), "Kas Toko");
    await user.selectOptions(dialog.getAllByRole("combobox")[1]!, "USD");
    await userEvent.type(screen.getByLabelText("Saldo saat ini"), "-20");
    await user.click(dialog.getByRole("button", { name: /Simpan/i }));

    const post = mockApiFetch.mock.calls.find(
      ([url, init]) =>
        String(url).endsWith("/accounts") && init?.method === "POST",
    );
    expect(JSON.parse(post![1].body)).toMatchObject({
      type: "cash",
      balance: -358_278,
      fxInputs: [{ field: "balance", currency: "USD", amount: "-20" }],
    });
  });

  it("edits an existing cash account by PATCHing its own id (not creating a new e-wallet)", async () => {
    // Arrange
    mockDanaApi(
      [buildAccount({ id: "acc-1", name: "Kas Tunai", balance: "500000" })],
      [buildAccount({ id: "acc-1", name: "Kas Tunai Renamed" })],
    );
    const user = userEvent.setup();
    render(<DanaPage />);
    await screen.findByText("Kas Tunai", { ignore: "svg *, script, style" });

    // Act
    await user.click(screen.getByRole("button", { name: "Menu Kas Tunai" }));
    await user.click(await screen.findByRole("menuitem", { name: "Ubah" }));
    const dialog = within(await screen.findByRole("dialog"));
    expect(
      dialog.getByRole("heading", { name: "Ubah Kas Tunai" }),
    ).toBeInTheDocument();
    expect(dialog.getByPlaceholderText("Dompet Harian")).toHaveValue(
      "Kas Tunai",
    );
    await user.click(dialog.getByRole("button", { name: /Simpan/i }));

    // Assert — PATCH targets the existing account id.
    const patchCall = mockApiFetch.mock.calls.find(
      (call) => call[1]?.method === "PATCH",
    );
    expect(patchCall).toBeDefined();
    expect(patchCall![0]).toBe(
      `/family-groups/${FAMILY_GROUP_ID}/accounts/acc-1`,
    );
  });

  // EPIC-021 #21 — "Data Kas bisa minus": the cash amount field must accept
  // and round-trip a "-" sign, unlike every other "amount" field (which
  // strips it).
  it("allows typing a negative balance in the add-cash form and submits it signed", async () => {
    const savedAccounts = [buildAccount({ id: "acc-new" })];
    mockDanaApi([], savedAccounts);
    const user = userEvent.setup();
    render(<DanaPage />);
    await screen.findByText(/Belum ada kas atau e-wallet/);

    await user.click(screen.getByRole("button", { name: "Kas tunai" }));
    const dialog = within(await screen.findByRole("dialog"));
    await user.type(dialog.getByPlaceholderText("Dompet Harian"), "Kas Toko");
    // The amount field has no accessible name — it's the sole placeholder="0"
    // input in this dialog.
    await user.type(dialog.getByPlaceholderText("0"), "-50000");
    await user.click(dialog.getByRole("button", { name: /Simpan/i }));

    const postCall = mockApiFetch.mock.calls.find(
      (call) => call[1]?.method === "POST",
    );
    expect(postCall).toBeDefined();
    const body = JSON.parse(postCall![1].body as string) as {
      balance: number;
    };
    expect(body.balance).toBe(-50000);
  });

  it("an unrelated edit never resends the balance (it only moves through transactions)", async () => {
    // Arrange — this account already went negative via an over-budget
    // expense transaction (the pre-existing, transaction-driven path).
    mockDanaApi(
      [buildAccount({ id: "acc-1", name: "Kas Tunai", balance: "-75000" })],
      [
        buildAccount({
          id: "acc-1",
          name: "Kas Tunai Renamed",
          balance: "-75000",
        }),
      ],
    );
    const user = userEvent.setup();
    render(<DanaPage />);
    await screen.findByText("Kas Tunai", { ignore: "svg *, script, style" });

    // Act — edit the account; the form has no amount field to touch.
    await user.click(screen.getByRole("button", { name: "Menu Kas Tunai" }));
    await user.click(await screen.findByRole("menuitem", { name: "Ubah" }));
    const dialog = within(await screen.findByRole("dialog"));
    expect(dialog.queryByLabelText("Saldo Saat Ini")).toBeNull();
    await user.click(dialog.getByRole("button", { name: /Simpan/i }));

    // Assert — the PATCH carries no balance, so it cannot overwrite the
    // transaction-derived -75.000.
    const patchCall = mockApiFetch.mock.calls.find(
      (call) => call[1]?.method === "PATCH",
    );
    expect(patchCall).toBeDefined();
    const body = JSON.parse(patchCall![1].body as string) as Record<
      string,
      unknown
    >;
    expect(body).not.toHaveProperty("balance");
    expect(body).not.toHaveProperty("fxInputs");
  });
});
