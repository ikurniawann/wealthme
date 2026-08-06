/**
 * EPIC-021 #4 — "Kode COA auto Gen tapi bisa Edit". Locks in the web fix:
 * - the code field is optional on create (server auto-generates when
 *   blank), with a distinct "auto-generated" placeholder.
 * - the code field is editable (not disabled) when editing an existing
 *   account, and the PATCH payload carries the new code.
 * - server validation errors (group-prefix mismatch, duplicate code) are
 *   surfaced to the user instead of a generic toast.
 */

import type { ReactElement, ReactNode } from "react";
import {
  render as rtlRender,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockUseSessionAuth = jest.fn();
jest.mock("../../../lib/auth-client", () => ({
  authClient: {
    useSession: (...args: unknown[]) => mockUseSessionAuth(...args),
    signOut: jest.fn(),
  },
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
}));

const mockApiFetch = jest.fn();
jest.mock("../../../lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

const mockToastError = jest.fn();
const mockToastSuccess = jest.fn();
jest.mock("sonner", () => ({
  toast: Object.assign(jest.fn(), {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  }),
}));

import MasterCoaPage from "./page";

const FAMILY_GROUP_ID = "fg-1";
const TOKEN = "test-token";

// jsdom has no PointerEvent — Base UI's Dialog/Button primitives need it.
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

type CoaAccountFixture = {
  id: string;
  familyGroupId: string;
  code: string;
  name: string;
  groupNum: number;
  direction: "INCOME" | "EXPENSE" | "TRANSFER";
  budgetType: string | null;
  parentCode: string | null;
  createdAt: string;
  updatedAt: string;
};

function buildAccount(
  overrides: Partial<CoaAccountFixture> = {},
): CoaAccountFixture {
  return {
    id: "coa-1",
    familyGroupId: FAMILY_GROUP_ID,
    code: "20001",
    name: "Belanja",
    groupNum: 2,
    direction: "EXPENSE",
    budgetType: null,
    parentCode: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/** Routes the shared apiFetch mock by path + method, like the real API. */
function mockCoaRoutes(accounts: CoaAccountFixture[]) {
  mockApiFetch.mockImplementation(
    (path: string, options?: RequestInit & { method?: string }) => {
      const method = options?.method ?? "GET";
      if (path.endsWith("/categories")) {
        return Promise.resolve([]);
      }
      if (path.endsWith("/coa-accounts") && method === "GET") {
        return Promise.resolve(accounts);
      }
      if (path.endsWith("/coa-accounts") && method === "POST") {
        const body = JSON.parse(options?.body as string) as Record<
          string,
          unknown
        >;
        return Promise.resolve({ ...body, id: "coa-new" });
      }
      if (path.includes("/coa-accounts/") && method === "PATCH") {
        const body = JSON.parse(options?.body as string) as Record<
          string,
          unknown
        >;
        return Promise.resolve({ ...accounts[0], ...body });
      }
      return Promise.resolve([]);
    },
  );
}

describe("MasterCoaPage — COA code auto-gen + editable (EPIC-021 #4)", () => {
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

  it("shows an auto-generate placeholder and does not require a code when adding", async () => {
    // Arrange
    mockCoaRoutes([buildAccount()]);
    const user = userEvent.setup();
    render(<MasterCoaPage />);
    await screen.findByText("Belanja");

    // Act
    await user.click(screen.getByRole("button", { name: "Tambah Akun" }));
    const dialog = within(await screen.findByRole("dialog"));
    expect(
      dialog.getByRole("heading", { name: "Tambah Akun COA" }),
    ).toBeInTheDocument();
    const codeInput = dialog.getByPlaceholderText("Otomatis jika dikosongkan");
    expect(codeInput).not.toBeRequired();

    await user.type(
      dialog.getByPlaceholderText("cth: Household Needs"),
      "Test Akun",
    );
    await user.click(dialog.getByRole("button", { name: "Tambah" }));

    // Assert — the POST body omits `code` entirely when left blank, letting
    // the server auto-generate the next free code.
    const postCall = mockApiFetch.mock.calls.find(
      ([path, opts]: [string, RequestInit & { method?: string }]) =>
        path.endsWith("/coa-accounts") && opts?.method === "POST",
    );
    expect(postCall).toBeDefined();
    const body = JSON.parse(postCall![1].body as string) as Record<
      string,
      unknown
    >;
    expect("code" in body).toBe(false);
  });

  it("makes the code field editable (not disabled) when editing, and PATCHes the new code", async () => {
    // Arrange
    mockCoaRoutes([buildAccount({ id: "coa-1", code: "20001" })]);
    const user = userEvent.setup();
    render(<MasterCoaPage />);
    await screen.findByText("Belanja");

    // Act
    await user.click(screen.getByRole("button", { name: "Edit" }));
    const dialog = within(await screen.findByRole("dialog"));
    expect(
      dialog.getByRole("heading", { name: "Edit Akun COA" }),
    ).toBeInTheDocument();
    const codeInput = dialog.getByDisplayValue("20001");
    expect(codeInput).not.toBeDisabled();

    await user.clear(codeInput);
    await user.type(codeInput, "20042");
    await user.click(dialog.getByRole("button", { name: "Simpan" }));

    // Assert — PATCH carries the edited code.
    const patchCall = mockApiFetch.mock.calls.find(
      ([path, opts]: [string, RequestInit & { method?: string }]) =>
        path.includes("/coa-accounts/") && opts?.method === "PATCH",
    );
    expect(patchCall).toBeDefined();
    const body = JSON.parse(patchCall![1].body as string) as {
      code: string;
    };
    expect(body.code).toBe("20042");
  });

  it("surfaces the server's group-prefix validation message instead of a generic toast", async () => {
    // Arrange — server rejects a code whose first digit doesn't match groupNum.
    mockCoaRoutes([buildAccount()]);
    mockApiFetch.mockImplementation(
      (path: string, options?: RequestInit & { method?: string }) => {
        const method = options?.method ?? "GET";
        if (path.endsWith("/categories")) return Promise.resolve([]);
        if (path.endsWith("/coa-accounts") && method === "GET") {
          return Promise.resolve([buildAccount()]);
        }
        if (path.endsWith("/coa-accounts") && method === "POST") {
          return Promise.reject({
            status: 400,
            message:
              'COA code "10001" must start with group number 2 (e.g. "20001")',
          });
        }
        return Promise.resolve([]);
      },
    );
    const user = userEvent.setup();
    render(<MasterCoaPage />);
    await screen.findByText("Belanja");

    // Act
    await user.click(screen.getByRole("button", { name: "Tambah Akun" }));
    const dialog = within(await screen.findByRole("dialog"));
    await user.type(
      dialog.getByPlaceholderText("Otomatis jika dikosongkan"),
      "10001",
    );
    await user.type(
      dialog.getByPlaceholderText("cth: Household Needs"),
      "Bad Code",
    );
    await user.click(dialog.getByRole("button", { name: "Tambah" }));

    // Assert
    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(
        'COA code "10001" must start with group number 2 (e.g. "20001")',
      ),
    );
  });
});

// EPIC-023 Task H2 (D18) — the plain-language guide + worked examples that
// now sit above the account list, and the honest risk statement it carries.
describe("MasterCoaPage — plain-language guide (EPIC-023 H2)", () => {
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

  it("states the risk of editing the COA incorrectly, and explains why groups 4/5 are transfers", async () => {
    // Arrange
    mockCoaRoutes([buildAccount()]);
    render(<MasterCoaPage />);
    await screen.findByText("Belanja");

    // Assert — the risk (D18) is stated plainly, not buried.
    expect(screen.getByText("⚠️ Risiko kalau salah edit")).toBeInTheDocument();
    expect(
      screen.getByText(/laporan laba-rugi dan neracamu bisa langsung salah/),
    ).toBeInTheDocument();

    // Assert — the single most counter-intuitive point (D23: 4/5 are
    // TRANSFER, not expense/income) is taught explicitly with a worked
    // example, not just a label.
    expect(
      screen.getByText("Kenapa Piutang & Utang bukan expense/income?"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Melunasi pokok utang BUKAN pengeluaran/),
    ).toBeInTheDocument();
  });

  it("gives every one of the 6 groups a worked example with concrete numbers", async () => {
    // Arrange
    mockCoaRoutes([buildAccount()]);
    render(<MasterCoaPage />);
    await screen.findByText("Belanja");

    // Assert — each group has its own plain-language title and example.
    expect(screen.getByText("1 · Pemasukan (Income)")).toBeInTheDocument();
    expect(screen.getByText("2 · Pengeluaran (Expense)")).toBeInTheDocument();
    expect(
      screen.getByText("3 · Alokasi Kekayaan (Wealth Allocation)"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("4 · Piutang (Account Receivable)"),
    ).toBeInTheDocument();
    expect(screen.getByText("5 · Utang (Account Payable)")).toBeInTheDocument();
    expect(screen.getByText("6 · Pajak (Tax)")).toBeInTheDocument();
    expect(
      screen.getByText(/gaji Rp 10\.000\.000 masuk ke rekening BCA-mu/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/kamu pinjamkan Rp 500\.000 ke teman/),
    ).toBeInTheDocument();
  });
});
