/**
 * Read-only deep-link params, used by the Laporan "Ringkasan COA" tab:
 * `from`/`to` prefill the date range sent to the API, `coa` narrows the list
 * to categories mapped to that COA account, `tx` opens that transaction's
 * detail dialog.
 */

import type { ReactElement } from "react";
import { render as rtlRender, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { TransactionDto } from "@wealthme/contracts";

jest.setTimeout(20_000);

jest.mock("../../../lib/auth-client", () => ({
  authClient: {
    useSession: jest.fn(() => ({
      data: {
        session: { token: "test-token", familyGroupId: "fg-1" },
        user: { id: "u-1", name: "Owner", email: "owner@example.com" },
      },
      isPending: false,
    })),
    signOut: jest.fn(),
  },
}));

const apiFetch = jest.fn();
jest.mock("../../../lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
}));

let mockSearch = new URLSearchParams();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => mockSearch,
}));

jest.mock("sonner", () => ({
  toast: Object.assign(jest.fn(), {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  }),
}));

import { ShellProvider } from "../../../components/shell/shell-context";
import { setLocale } from "../../../hooks/use-locale";
import TransaksiPage from "./page";

function buildTx(
  id: string,
  categoryId: string,
  description: string,
): TransactionDto {
  return {
    id,
    familyGroupId: "fg-1",
    accountId: "acc-1",
    categoryId,
    amount: "5000000",
    type: "income",
    description,
    occurredAt: "2026-05-01T00:00:00.000Z",
    createdAt: "2026-05-01T00:00:00.000Z",
    categoryName: "Gaji",
    accountName: "BCA",
    toAccountId: null,
    toAccountName: null,
  } as unknown as TransactionDto;
}

const ROWS = [
  buildTx("tx-gaji", "cat-gaji", "Gaji Mei"),
  buildTx("tx-bonus", "cat-bonus", "Bonus Mei"),
];

function serve() {
  apiFetch.mockImplementation((path: string) => {
    if (path === "/auth/me") return Promise.resolve({ familyGroupId: "fg-1" });
    if (path.endsWith("/categories")) {
      return Promise.resolve([
        { id: "cat-gaji", name: "Gaji", coaAccountId: "coa-gaji" },
        { id: "cat-bonus", name: "Bonus", coaAccountId: "coa-bonus" },
      ]);
    }
    if (!path.includes("/transactions?")) return Promise.resolve([]);
    return Promise.resolve({
      data: ROWS,
      meta: { total: ROWS.length, page: 1, limit: 100 },
      summary: {
        totalIncome: "0",
        totalExpense: "0",
        net: "0",
        period: { from: null, to: null },
      },
    });
  });
}

function transactionCalls(): URL[] {
  return apiFetch.mock.calls
    .map(([path]) => String(path))
    .filter((path) => path.includes("/transactions?"))
    .map((path) => new URL(`https://x${path}`));
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

function render(ui: ReactElement) {
  return rtlRender(ui, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>
        <ShellProvider>{children}</ShellProvider>
      </QueryClientProvider>
    ),
  });
}

beforeEach(() => {
  setLocale("id");
  jest.clearAllMocks();
  queryClient.clear();
  serve();
});

describe("/transaksi — deep-link params", () => {
  it("sends from/to and keeps only rows of the ?coa= account", async () => {
    mockSearch = new URLSearchParams(
      "coa=coa-gaji&from=2026-05-01&to=2026-05-01",
    );
    render(<TransaksiPage />);

    await waitFor(() => expect(screen.getByText("Gaji Mei")).toBeVisible());
    expect(screen.queryByText("Bonus Mei")).toBeNull();

    const call = transactionCalls()[0];
    expect(call.searchParams.get("from")).toBe("2026-05-01");
    expect(call.searchParams.get("to")).toBe("2026-05-01");
  });

  it("ignores a malformed date param instead of sending it", async () => {
    mockSearch = new URLSearchParams("from=yesterday");
    render(<TransaksiPage />);

    await waitFor(() => expect(transactionCalls().length).toBe(1));
    expect(transactionCalls()[0].searchParams.get("from")).toBeNull();
  });

  it("opens the detail dialog of the ?tx= transaction", async () => {
    mockSearch = new URLSearchParams(
      "from=2026-05-01&to=2026-05-01&tx=tx-bonus",
    );
    render(<TransaksiPage />);

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Bonus Mei");
    expect(dialog).not.toHaveTextContent("Gaji Mei");
  });
});
