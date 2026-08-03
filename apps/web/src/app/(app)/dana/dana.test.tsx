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
  return rtlRender(ui, { wrapper: Providers });
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

describe("DanaPage — multiple cash accounts as master data (EPIC-021 #3)", () => {
  beforeEach(() => {
    // `resetAllMocks` (not `clearAllMocks`) — `mockResolvedValueOnce` queues
    // from a prior test otherwise survive into the next test's calls.
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

  it("renders every cash account returned by the API, not just one hardcoded row", async () => {
    // Arrange — two distinct cash accounts (not a single hardcoded "Kas
    // Tunai"), plus one e-wallet to prove the two sections stay separate.
    mockApiFetch.mockResolvedValue([
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
    // fixed "Kas Tunai" row), each with its own edit/delete controls.
    expect(await screen.findByText("Kas Tunai")).toBeInTheDocument();
    expect(screen.getByText("Dompet Kerja")).toBeInTheDocument();
    // "GoPay" renders twice for this row (name + institution subtitle).
    expect(screen.getAllByText("GoPay").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Edit" })).toHaveLength(3);
    expect(screen.getAllByRole("button", { name: "Hapus" })).toHaveLength(3);
  });

  it("offers a + Tambah action for the cash section, opening an add-cash form", async () => {
    // Arrange
    mockApiFetch.mockResolvedValue([buildAccount()]);
    const user = userEvent.setup();
    render(<DanaPage />);
    await screen.findByText("Kas Tunai");

    // Act — the cash section's own "+ Tambah" (not the E-Wallet one).
    const addButtons = screen.getAllByText("+ Tambah");
    await user.click(addButtons[0]!);

    // Assert — a "Tambah Kas Tunai" dialog opens (the new `cash` CRUD
    // entity), not the e-wallet form.
    const dialog = within(await screen.findByRole("dialog"));
    expect(
      dialog.getByRole("heading", { name: "Tambah Kas Tunai" }),
    ).toBeInTheDocument();
  });

  it("submits a new cash account as type 'cash' via the accounts API", async () => {
    // Arrange
    mockApiFetch.mockResolvedValueOnce([]); // initial accounts list
    const user = userEvent.setup();
    render(<DanaPage />);
    await screen.findByText("Belum ada kas tunai.");

    mockApiFetch.mockResolvedValueOnce({ id: "acc-new" }); // POST response
    mockApiFetch.mockResolvedValueOnce([buildAccount({ id: "acc-new" })]); // refetch

    // Act
    await user.click(screen.getAllByText("+ Tambah")[0]!);
    const dialog = within(await screen.findByRole("dialog"));
    await user.type(
      dialog.getByPlaceholderText("cth: Kas Tunai, Dompet Kerja"),
      "Kas Toko",
    );
    await user.click(dialog.getByRole("button", { name: /Simpan/i }));

    // Assert — the POST body's `type` is "cash", never "ewallet".
    const postCall = mockApiFetch.mock.calls.find(
      (call) => call[1]?.method === "POST",
    );
    expect(postCall).toBeDefined();
    const body = JSON.parse(postCall![1].body as string) as { type: string };
    expect(body.type).toBe("cash");
  });

  it("edits an existing cash account by PATCHing its own id (not creating a new e-wallet)", async () => {
    // Arrange
    mockApiFetch.mockResolvedValue([
      buildAccount({ id: "acc-1", name: "Kas Tunai", balance: "500000" }),
    ]);
    const user = userEvent.setup();
    render(<DanaPage />);
    await screen.findByText("Kas Tunai");

    mockApiFetch.mockResolvedValueOnce({ id: "acc-1" }); // PATCH response
    mockApiFetch.mockResolvedValueOnce([
      buildAccount({ id: "acc-1", name: "Kas Tunai Renamed" }),
    ]); // refetch

    // Act
    await user.click(screen.getAllByRole("button", { name: "Edit" })[0]!);
    const dialog = within(await screen.findByRole("dialog"));
    expect(
      dialog.getByRole("heading", { name: "Edit Kas Tunai" }),
    ).toBeInTheDocument();
    expect(
      dialog.getByPlaceholderText("cth: Kas Tunai, Dompet Kerja"),
    ).toHaveValue("Kas Tunai");
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
});
