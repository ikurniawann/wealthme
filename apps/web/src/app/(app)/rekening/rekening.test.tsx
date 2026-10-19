/**
 * Rekening v3 — /rekening as a wealth register: accounts grouped per bank,
 * filter v2, "Perlu perhatian", and the banking form (holder, product,
 * deposit terms, shares). Balances never travel on an edit.
 */

import { ShellProvider } from "../../../components/shell/shell-context";
import type { ReactElement, ReactNode } from "react";
import { toast } from "sonner";
import { resolveEffectiveAccess } from "@wealthme/contracts";
import {
  render as rtlRender,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AccountDto, ReferenceItemDto } from "@wealthme/contracts";

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

// RekeningPage's AccountCardItem calls useRouter() (next/navigation) — not
// present without a real Next.js App Router, so it must be mocked in a
// component test (same fix as beranda/beranda.test.tsx).
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
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
jest.mock("../../../components/money/use-fx-snapshot", () => ({
  useFxSnapshot: (enabled: boolean) => ({
    data: enabled
      ? jest.requireActual("../../../components/money/fx-test-rates")
          .TEST_FX_RATES
      : undefined,
    isError: false,
  }),
}));

import RekeningPage from "./page";

const FAMILY_GROUP_ID = "fg-1";
const TOKEN = "test-token";

// jsdom has no PointerEvent — Base UI's Dialog/DropdownMenu primitives read
// pointer-event fields internally, so opening the kebab menu and the CrudModal
// dialog needs this polyfilled (same fix as dana/dana.test.tsx).
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
    <QueryClientProvider client={queryClient}>
      <ShellProvider>{children}</ShellProvider>
    </QueryClientProvider>
  );
}

function render(ui: ReactElement) {
  return rtlRender(ui, { wrapper: Providers });
}

function buildAccount(overrides: Partial<AccountDto> = {}): AccountDto {
  return {
    id: "acc-1",
    familyGroupId: FAMILY_GROUP_ID,
    name: "Tabungan Utama",
    type: "bank",
    institution: "BCA",
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

/** Routes `apiFetch` calls by path/method instead of one blanket mock, since
 * this page fires 3 GETs (accounts, members, fx rates) plus the PATCH under
 * test. */
function mockApiRoutes(
  accounts: AccountDto[],
  referenceItems: ReferenceItemDto[] = [],
  members: Array<Record<string, unknown>> = [
    { userId: "user-1", name: "Test User", role: "owner", dataScope: "all" },
    {
      userId: "user-rina",
      name: "Rina S.",
      role: "operational",
      dataScope: "own",
    },
  ],
) {
  mockApiFetch.mockImplementation(
    (path: string, options?: { method?: string }) => {
      if (options?.method === "PATCH" || options?.method === "POST") {
        return Promise.resolve({ id: "acc-new" });
      }
      if (path.endsWith("/members")) {
        return Promise.resolve(members);
      }
      if (path.startsWith("/fx/rates")) {
        return Promise.resolve({ base: "IDR", rates: {} });
      }
      // EPIC-030 — menu/permission gating reads the resolved IAM access.
      if (path.endsWith("/access/me")) {
        return Promise.resolve(resolveEffectiveAccess({ role: "owner" }));
      }
      if (path.endsWith("/family-groups/mine")) {
        return Promise.resolve([{ id: FAMILY_GROUP_ID, myRole: "owner" }]);
      }
      if (path.endsWith("/reference-items")) {
        return Promise.resolve(referenceItems);
      }
      return Promise.resolve(accounts);
    },
  );
}

function buildBankItem(
  id: string,
  label: string,
  isSystem: boolean,
): ReferenceItemDto {
  return {
    id,
    familyGroupId: FAMILY_GROUP_ID,
    group: "bank",
    label,
    sortOrder: 0,
    isSystem,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

function callsWith(method: string) {
  return mockApiFetch.mock.calls.filter((call) => call[1]?.method === method);
}

function bodyOf(call: unknown[]): Record<string, unknown> {
  return JSON.parse((call[1] as { body: string }).body) as Record<
    string,
    unknown
  >;
}

describe("RekeningPage — Rekening v3", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    queryClient.clear();
    try {
      window.localStorage.clear();
    } catch {
      /* ignore */
    }
    mockUseSessionAuth.mockReturnValue({
      data: {
        session: { token: TOKEN, familyGroupId: FAMILY_GROUP_ID },
        user: { id: "user-1", name: "Test User", email: "user@example.com" },
      },
      isPending: false,
    });
  });

  it("groups accounts per bank with the bank total, and labels family-shared ones", async () => {
    mockApiRoutes([
      buildAccount({ id: "a1", name: "Tabungan Keluarga", balance: "300000" }),
      buildAccount({
        id: "a2",
        name: "Rekening Adit",
        balance: "200000",
        ownerUserId: "user-2",
        ownerName: "Adit",
      }),
      buildAccount({
        id: "a3",
        name: "Mandiri Gaji",
        institution: "Mandiri",
        balance: "100000",
      }),
    ]);
    render(<RekeningPage />);
    const bca = await screen.findByRole("region", { name: "BCA" });
    expect(within(bca).getByText("Tabungan Keluarga")).toBeInTheDocument();
    expect(within(bca).getByText("Rekening Adit")).toBeInTheDocument();
    expect(within(bca).getByText(/Rp\s*500\.000/)).toBeInTheDocument();
    const shared = within(bca)
      .getByText("Tabungan Keluarga")
      .closest("article") as HTMLElement;
    expect(within(shared).getByText("Bersama")).toBeInTheDocument();
    const owned = within(bca)
      .getByText("Rekening Adit")
      .closest("article") as HTMLElement;
    expect(within(owned).queryByText("Bersama")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Mandiri" })).toBeInTheDocument();
  });

  it("filters by bank through the bank pills and echoes a removable chip", async () => {
    mockApiRoutes([
      buildAccount({ id: "a1", name: "Tabungan BCA", balance: "300000" }),
      buildAccount({
        id: "a3",
        name: "Mandiri Gaji",
        institution: "Mandiri",
        balance: "100000",
      }),
    ]);
    const user = userEvent.setup();
    render(<RekeningPage />);
    await screen.findByText("Tabungan BCA");
    const pills = screen.getByRole("group", { name: "Bank" });
    await user.click(within(pills).getByRole("button", { name: /Mandiri/ }));
    expect(
      screen.queryByRole("region", { name: "BCA" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Mandiri" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reset filter" }));
    expect(
      await screen.findByRole("region", { name: "BCA" }),
    ).toBeInTheDocument();
  });

  it("folds zero-balance accounts away until asked", async () => {
    mockApiRoutes([
      buildAccount({ id: "a1", name: "Tabungan Isi", balance: "300000" }),
      buildAccount({ id: "a2", name: "Tabungan Kosong", balance: "0" }),
    ]);
    const user = userEvent.setup();
    render(<RekeningPage />);
    await screen.findByText("Tabungan Isi");
    expect(screen.queryByText("Tabungan Kosong")).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: /saldo Rp 0 disembunyikan/ }),
    );
    expect(screen.getByText("Tabungan Kosong")).toBeInTheDocument();
  });

  it("Mutasi opens Transaksi filtered to that account", async () => {
    mockApiRoutes([buildAccount()]);
    const user = userEvent.setup();
    render(<RekeningPage />);
    await screen.findByText("Tabungan Utama");
    await user.click(
      screen.getByRole("button", { name: "Mutasi Tabungan Utama" }),
    );
    expect(mockPush).toHaveBeenCalledWith("/transaksi?accountId=acc-1");
  });

  it("flags a deposit maturing soon under Perlu perhatian", async () => {
    const placement = new Date();
    placement.setMonth(placement.getMonth() - 3);
    placement.setDate(placement.getDate() + 5);
    mockApiRoutes([
      buildAccount({
        id: "dep",
        name: "Deposito Mandiri",
        institution: "Mandiri",
        balance: "300000000",
        productKind: "time_deposit",
        placementDate: placement.toISOString().slice(0, 10),
        tenorMonths: 3,
        maturityInstruction: "aro_plus",
      }),
    ]);
    render(<RekeningPage />);
    const attn = (
      await screen.findByRole("heading", { name: "Perlu perhatian" })
    ).closest("section") as HTMLElement;
    expect(
      await within(attn).findByText(
        /Deposito Mandiri jatuh tempo \d+ hari lagi/,
      ),
    ).toBeInTheDocument();
  });

  it("adds an account: picking a bank fills its codes, and the POST carries the banking detail", async () => {
    mockApiRoutes([]);
    const user = userEvent.setup();
    render(<RekeningPage />);
    await user.click(
      (await screen.findAllByRole("button", { name: "Tambah rekening" }))[0],
    );
    const dialog = within(await screen.findByRole("dialog"));
    expect(
      dialog.getByRole("heading", { name: "Tambah Rekening Bank" }),
    ).toBeInTheDocument();

    await user.selectOptions(
      dialog.getByRole("combobox", { name: /^Bank\s*pilih/ }),
      "BCA",
    );
    expect(dialog.getByText("SWIFT CENAIDJA")).toBeInTheDocument();
    await user.click(dialog.getByRole("button", { name: "Tahapan Xpresi" }));
    await user.type(dialog.getByLabelText("Saldo awal 1"), "10000000");
    await user.type(dialog.getByLabelText(/Bunga p\.a\./), "0,75");
    await user.selectOptions(
      dialog.getByLabelText("Dibagikan kepada Rina S."),
      "post",
    );
    await user.click(dialog.getByRole("button", { name: "Simpan rekening" }));

    await waitFor(() => expect(callsWith("POST")).toHaveLength(1));
    const body = bodyOf(callsWith("POST")[0]);
    expect(body).toMatchObject({
      type: "bank",
      name: "BCA Tahapan Xpresi",
      institution: "BCA",
      bankCode: "014",
      swiftCode: "CENAIDJA",
      productKind: "savings",
      productName: "Tahapan Xpresi",
      balance: 10_000_000,
      interestRate: 0.75,
      holderUserId: "user-1",
      shares: [{ userId: "user-rina", canPost: true }],
    });
    expect(toast.success).toHaveBeenCalled();
  });

  it("requires a bank before saving", async () => {
    mockApiRoutes([]);
    const user = userEvent.setup();
    render(<RekeningPage />);
    await user.click(
      (await screen.findAllByRole("button", { name: "Tambah rekening" }))[0],
    );
    const dialog = within(await screen.findByRole("dialog"));
    await user.click(dialog.getByRole("button", { name: "Simpan rekening" }));
    expect(dialog.getAllByRole("alert").length).toBeGreaterThan(0);
    expect(callsWith("POST")).toHaveLength(0);
  });

  it("editing shows no opening balance and sends no balance or fxInputs", async () => {
    mockApiRoutes([
      buildAccount({
        id: "acc-2",
        name: "BCA Tahapan",
        balance: "1000000",
        holderName: "Anak",
      }),
    ]);
    const user = userEvent.setup();
    render(<RekeningPage />);
    await screen.findByText("BCA Tahapan");
    await user.click(
      screen.getByRole("button", { name: "Opsi rekening BCA Tahapan" }),
    );
    await user.click(await screen.findByText("Edit"));
    const dialog = within(await screen.findByRole("dialog"));
    expect(
      dialog.getByRole("heading", { name: "Edit Rekening Bank" }),
    ).toBeInTheDocument();
    expect(dialog.queryByLabelText(/Saldo awal/)).not.toBeInTheDocument();
    expect(dialog.getByDisplayValue("Anak")).toBeInTheDocument();
    await user.click(dialog.getByRole("button", { name: "Simpan rekening" }));

    await waitFor(() => expect(callsWith("PATCH")).toHaveLength(1));
    const body = bodyOf(callsWith("PATCH")[0]);
    expect(body).not.toHaveProperty("balance");
    expect(body).not.toHaveProperty("fxInputs");
    expect(body).toMatchObject({
      name: "BCA Tahapan",
      holderUserId: null,
      holderName: "Anak",
    });
  });

  it("keeps a Master Data bank selectable when editing (Revisi H)", async () => {
    mockApiRoutes(
      [
        buildAccount({
          id: "acc-3",
          name: "Kas Koperasi",
          institution: "Koperasi Sejahtera",
        }),
      ],
      [buildBankItem("ref-1", "Koperasi Sejahtera", false)],
    );
    const user = userEvent.setup();
    render(<RekeningPage />);
    await screen.findByText("Kas Koperasi");
    await user.click(
      screen.getByRole("button", { name: "Opsi rekening Kas Koperasi" }),
    );
    await user.click(await screen.findByText("Edit"));
    const dialog = within(await screen.findByRole("dialog"));
    await user.click(dialog.getByRole("button", { name: "Simpan rekening" }));
    await waitFor(() => expect(callsWith("PATCH")).toHaveLength(1));
    expect(bodyOf(callsWith("PATCH")[0]).institution).toBe(
      "Koperasi Sejahtera",
    );
  });

  it("shows the indicative USD total thousands-grouped", async () => {
    mockApiRoutes([buildAccount({ balance: "292144000" })]);
    render(<RekeningPage />);
    // 292.144.000 / 17.913,899851 ≈ 16.308
    expect(await screen.findByText(/≈ US\$ 16\.308/)).toBeInTheDocument();
  });
});
