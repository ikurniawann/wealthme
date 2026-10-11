import type { ReactNode } from "react";
import { resolveEffectiveAccess } from "@wealthme/contracts";
import type { ReferenceItemDto } from "@wealthme/contracts";
import {
  render as rtlRender,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

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

jest.mock("../money/use-fx-snapshot", () => ({
  useFxSnapshot: (enabled: boolean) => ({
    data: enabled
      ? jest.requireActual("../money/fx-test-rates").TEST_FX_RATES
      : undefined,
    isError: false,
  }),
}));

const mockPref = jest.fn();
jest.mock("../../hooks/use-currency-preference", () => ({
  useCurrencyPreference: () => mockPref(),
}));
const IDR_PREF = {
  currency: "IDR",
  isIndicative: false,
  isReady: true,
  formatMoney: String,
};
const USD_PREF = {
  currency: "USD",
  isIndicative: true,
  isReady: true,
  formatMoney: String,
};

// jsdom has no PointerEvent — Base UI's Dialog reads pointer-event fields.
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

import { setLocale } from "../../hooks/use-locale";
import { CrudModal } from "./crud-modal";
import { selectMoneyCurrency } from "@/components/money/money-input.test-utils";

const FG = "fg-1";
const STATIC_EWALLETS = ["GoPay", "OVO", "DANA", "LinkAja", "ShopeePay"];

function item(
  id: string,
  group: ReferenceItemDto["group"],
  label: string,
  isSystem = false,
): ReferenceItemDto {
  return {
    id,
    familyGroupId: FG,
    group,
    label,
    sortOrder: 0,
    isSystem,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

let queryClient: QueryClient;

function renderModal(entity: "ewallet" | "cash") {
  function Providers({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  return rtlRender(
    <CrudModal
      state={{ entity, mode: "add" }}
      onClose={jest.fn()}
      onSubmit={jest.fn()}
    />,
    { wrapper: Providers },
  );
}

function routeApi({
  role = "owner",
  referenceItems,
}: {
  role?: "owner" | "dependant";
  referenceItems: ReferenceItemDto[] | Error;
}) {
  mockApiFetch.mockImplementation((path: string) => {
    if (path.endsWith("/access/me")) {
      return Promise.resolve(resolveEffectiveAccess({ role }));
    }
    if (path.endsWith("/family-groups/mine")) {
      return Promise.resolve([{ id: FG, myRole: role }]);
    }
    if (path.endsWith("/reference-items")) {
      return referenceItems instanceof Error
        ? Promise.reject(referenceItems)
        : Promise.resolve(referenceItems);
    }
    return Promise.resolve([]);
  });
}

function optionLabels(select: HTMLElement): string[] {
  return within(select)
    .getAllByRole("option")
    .map((o) => o.textContent ?? "");
}

beforeEach(() => {
  jest.resetAllMocks();
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  mockUseSessionAuth.mockReturnValue({
    data: {
      session: { token: "test-token", familyGroupId: FG },
      user: { id: "user-1", name: "Test User", email: "user@example.com" },
    },
    isPending: false,
  });
});
beforeEach(() => mockPref.mockReturnValue(IDR_PREF));

describe("CrudModal — selects backed by Master Data (Revisi H)", () => {
  it("lists the family's Master Data e-wallets (not other groups), then the built-in leftovers", async () => {
    routeApi({
      referenceItems: [
        item("e1", "ewallet", "GoPay", true),
        item("e2", "ewallet", "OVO", true),
        item("e3", "ewallet", "Jenius"),
        item("b1", "bank", "Bank Tes MD"),
      ],
    });
    renderModal("ewallet");

    const select = await screen.findByRole("combobox", { name: /^E-Wallet/ });
    await waitFor(() =>
      expect(optionLabels(select)).toEqual([
        "GoPay",
        "OVO",
        "Jenius",
        "DANA",
        "LinkAja",
        "ShopeePay",
      ]),
    );
  });

  it("keeps the built-in list when the reference-items request fails", async () => {
    routeApi({ referenceItems: new Error("offline") });
    renderModal("ewallet");

    const select = await screen.findByRole("combobox", { name: /^E-Wallet/ });
    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith(
        `/family-groups/${FG}/reference-items`,
        expect.anything(),
      ),
    );
    expect(optionLabels(select)).toEqual(STATIC_EWALLETS);
  });

  it("offers '+ Tambah ke Master Data' for the e-wallet group to a manager", async () => {
    routeApi({ referenceItems: [] });
    renderModal("ewallet");

    const link = await screen.findByRole("link", {
      name: "+ Tambah ke Master Data",
    });
    expect(link).toHaveAttribute("href", "/masterdata#ewallet");
  });

  it("hides the link from a member who cannot manage Master Data", async () => {
    routeApi({ role: "dependant", referenceItems: [] });
    renderModal("ewallet");

    await screen.findByRole("combobox", { name: /^E-Wallet/ });
    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith(
        `/family-groups/${FG}/access/me`,
        expect.anything(),
      ),
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("does not fetch reference items for a form without a Master Data field", async () => {
    routeApi({ referenceItems: [] });
    renderModal("cash");

    await screen.findByRole("dialog");
    expect(mockApiFetch).not.toHaveBeenCalledWith(
      `/family-groups/${FG}/reference-items`,
      expect.anything(),
    );
  });
});

function localMonthPrefix(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function nextYearMonthPrefix(): string {
  const now = new Date();
  return `${now.getFullYear() + 1}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function renderTujuan(
  state:
    | { mode: "add" }
    | { mode: "edit"; initialValues: Record<string, string> },
  onSubmit = jest.fn().mockResolvedValue(undefined),
  onClose = jest.fn(),
) {
  function Providers({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  return {
    onSubmit,
    onClose,
    ...rtlRender(
      <CrudModal
        state={{ entity: "tujuan", ...state }}
        onClose={onClose}
        onSubmit={onSubmit}
      />,
      { wrapper: Providers },
    ),
  };
}

describe("CrudModal — date fields use the shared DateField", () => {
  beforeEach(() => {
    setLocale("id");
    routeApi({ referenceItems: [] });
  });

  it("picks the tujuan deadline from the calendar inside the dialog and submits it as ISO", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderTujuan({ mode: "add" });

    const dialog = await screen.findByRole("dialog", {
      name: /tambah tujuan keuangan/i,
    });
    // E2E round 1, bug 1 — `nama` is now a required field; a blank name
    // blocks Simpan before this test's own assertion on `deadline`.
    await user.type(
      within(dialog).getByPlaceholderText("cth: Dana Liburan"),
      "Dana Liburan",
    );
    await user.type(within(dialog).getByLabelText("Target Jumlah"), "5000000");
    const trigger = within(dialog).getByLabelText("Target Tanggal");
    expect(trigger.tagName).toBe("BUTTON");

    await user.click(trigger);
    const pop = screen.getByRole("dialog", { name: "Target Tanggal" });
    expect(dialog).toContainElement(pop);

    // Next year, so the "not in the past" rule never depends on today's date.
    await user.selectOptions(
      within(pop).getByRole("combobox", { name: /tahun/i }),
      String(new Date().getFullYear() + 1),
    );
    await user.click(within(pop).getByRole("button", { name: /^20 / }));
    expect(
      screen.getByRole("dialog", { name: /tambah tujuan keuangan/i }),
    ).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Simpan" }));

    expect(onSubmit).toHaveBeenCalledWith(
      "tujuan",
      "add",
      expect.objectContaining({ deadline: `${nextYearMonthPrefix()}-20` }),
    );
  });

  it("blocks a goal with no target, a past deadline or an auto-debit day outside 1–28", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderTujuan({
      mode: "edit",
      initialValues: {
        nama: "Liburan",
        target: "0",
        deadline: "2020-01-01",
        autodebitDay: "35",
      },
    });
    const dialog = await screen.findByRole("dialog");

    await user.click(within(dialog).getByRole("button", { name: "Simpan" }));

    expect(
      within(dialog).getByText("Target jumlah harus lebih dari 0."),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText("Target tanggal tidak boleh sebelum hari ini."),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText("Tanggal auto-debit harus antara 1 dan 28."),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("Escape closes only the picker, never the CRUD dialog around it", async () => {
    const user = userEvent.setup();
    const { onClose } = renderTujuan({ mode: "add" });

    const dialog = await screen.findByRole("dialog", {
      name: /tambah tujuan keuangan/i,
    });
    await user.click(within(dialog).getByLabelText("Target Tanggal"));
    expect(
      screen.getByRole("dialog", { name: "Target Tanggal" }),
    ).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(
      screen.queryByRole("dialog", { name: "Target Tanggal" }),
    ).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(
      screen.getByRole("dialog", { name: /tambah tujuan keuangan/i }),
    ).toBeInTheDocument();
  });

  it("pre-fills an edit with the stored date", async () => {
    renderTujuan({ mode: "edit", initialValues: { deadline: "2026-12-01" } });

    const dialog = await screen.findByRole("dialog", {
      name: /edit tujuan keuangan/i,
    });
    expect(within(dialog).getByLabelText("Target Tanggal")).toHaveTextContent(
      "1 Desember 2026",
    );
  });
});

describe("CrudModal — revisi I money", () => {
  beforeEach(() => routeApi({ referenceItems: [] }));

  function renderRekening(
    state:
      | { mode: "add" }
      | { mode: "edit"; initialValues: Record<string, string> },
    onSubmit = jest.fn().mockResolvedValue(undefined),
  ) {
    function Providers({ children }: { children: ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );
    }
    rtlRender(
      <CrudModal
        state={{ entity: "rekening", ...state }}
        onClose={() => {}}
        onSubmit={onSubmit}
      />,
      { wrapper: Providers },
    );
    return { onSubmit };
  }

  it("revisi I — an amount field offers a currency select and hands the normalized IDR + __fx to onSubmit", async () => {
    const { onSubmit } = renderRekening({ mode: "add" });
    await selectMoneyCurrency("USD");
    await userEvent.type(screen.getByLabelText("Saldo Saat Ini"), "100");
    await userEvent.click(screen.getByRole("button", { name: /simpan/i }));
    const values = onSubmit.mock.calls[0][2];
    expect(values.saldo).toBe("1.791.390");
    expect(JSON.parse(values.saldo__fx)).toEqual({
      currency: "USD",
      amount: "100",
    });
  });

  it("revisi I — a USD-display user's new account opens on USD", async () => {
    mockPref.mockReturnValue(USD_PREF);
    const { onSubmit } = renderRekening({ mode: "add" });
    expect(screen.getByRole("button", { name: "Mata uang" })).toHaveTextContent(
      "USD",
    );
    await userEvent.type(screen.getByLabelText("Saldo Saat Ini"), "100");
    await userEvent.click(screen.getByRole("button", { name: /simpan/i }));
    expect(JSON.parse(onSubmit.mock.calls[0][2].saldo__fx)).toEqual({
      currency: "USD",
      amount: "100",
    });
  });

  it("revisi I — a USD-display user's edit form opens on IDR and sends no fxInputs", async () => {
    mockPref.mockReturnValue(USD_PREF);
    const { onSubmit } = renderRekening({
      mode: "edit",
      initialValues: { nama: "BCA", saldo: "5000000" },
    });
    expect(screen.getByRole("button", { name: "Mata uang" })).toHaveTextContent(
      "IDR",
    );
    await userEvent.click(screen.getByRole("button", { name: /simpan/i }));
    expect(onSubmit.mock.calls[0][2]).not.toHaveProperty("saldo__fx");
    expect(onSubmit.mock.calls[0][2].saldo).toBe("5.000.000");
  });

  it("revisi I — IDR amounts reach onSubmit exactly as typed (no __fx key)", async () => {
    const { onSubmit } = renderRekening({ mode: "add" });
    await userEvent.type(screen.getByLabelText("Saldo Saat Ini"), "5000000");
    await userEvent.click(screen.getByRole("button", { name: /simpan/i }));
    const values = onSubmit.mock.calls[0][2];
    expect(values.saldo).toBe("5.000.000");
    expect(values).not.toHaveProperty("saldo__fx");
  });
});
