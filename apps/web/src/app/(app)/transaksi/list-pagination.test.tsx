/**
 * "Semua transaksi" showed only the newest 50.
 *
 * The page asked for `limit=50`, never sent `page`, and then paginated
 * CLIENT-side over whatever came back — so the table's page buttons only ever
 * walked that first window and everything older was silently absent. An
 * imported bank statement is 45+ rows in a single month, which pushed the
 * rest out; filtering by month brought them back, because the narrower filter
 * fit under the cap. Rows that exist and are quietly not shown are the worst
 * kind of wrong on a money screen.
 *
 * These specs assert on the REQUESTS the page makes, because that is where
 * the bug lived.
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

// The page reads the router and `?account=` search params. Same mock shape
// as masterdata.test.tsx.
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock("sonner", () => ({
  toast: Object.assign(jest.fn(), {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  }),
}));

import { ShellProvider } from "../../../components/shell/shell-context";
import TransaksiPage from "./page";

function buildTx(index: number): TransactionDto {
  return {
    id: `tx-${index}`,
    familyGroupId: "fg-1",
    accountId: "acc-1",
    categoryId: null,
    amount: "37000",
    type: "expense",
    description: `MUTASI ${index}`,
    occurredAt: "2026-07-01T00:00:00.000Z",
    createdAt: "2026-08-01T00:00:00.000Z",
    categoryName: null,
    accountName: "BCA",
    toAccountId: null,
    toAccountName: null,
  } as unknown as TransactionDto;
}

const SUMMARY = {
  totalIncome: "0",
  totalExpense: "0",
  net: "0",
  period: { from: null, to: null },
};

/** `total` rows, served in pages of 100 like the real API. */
function serveTransactions(total: number) {
  apiFetch.mockImplementation((path: string) => {
    // `useSession` (lib/auth-compat) live-resolves the family group through
    // this endpoint, so without it the list query never becomes enabled.
    if (path === "/auth/me") return Promise.resolve({ familyGroupId: "fg-1" });
    if (!path.includes("/transactions?")) return Promise.resolve([]);
    const url = new URL(`https://x${path}`);
    const page = Number(url.searchParams.get("page") ?? "1");
    const limit = Number(url.searchParams.get("limit") ?? "20");
    const start = (page - 1) * limit;
    const rows = Array.from(
      { length: Math.max(0, Math.min(limit, total - start)) },
      (_, i) => buildTx(start + i),
    );
    return Promise.resolve({
      data: rows,
      meta: { total, page, limit },
      summary: SUMMARY,
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
        {/* The page reads shell context (the global add-transaction dialog). */}
        <ShellProvider>{children}</ShellProvider>
      </QueryClientProvider>
    ),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  queryClient.clear();
});

describe("/transaksi — the full list is actually fetched", () => {
  it("keeps paging until every transaction is loaded", async () => {
    // 240 rows is three pages. The old code fetched one window of 50 and
    // stopped, so 190 real transactions were simply invisible.
    serveTransactions(240);
    render(<TransaksiPage />);

    await waitFor(() => expect(transactionCalls().length).toBeGreaterThan(2));

    const calls = transactionCalls();
    expect(calls.map((u) => u.searchParams.get("page"))).toEqual([
      "1",
      "2",
      "3",
    ]);
    // The API caps `limit` at 100, so this is the fewest round trips allowed.
    expect(calls[0].searchParams.get("limit")).toBe("100");
  });

  it("sends exactly one request when everything fits in one page", async () => {
    serveTransactions(12);
    render(<TransaksiPage />);

    await waitFor(() => expect(transactionCalls().length).toBe(1));
    // No speculative second call: a short page means the server has no more.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(transactionCalls()).toHaveLength(1);
  });

  it("says so out loud when the fetch ceiling cuts the list short", async () => {
    // Beyond the hard cap the list IS incomplete — the one thing it must not
    // do is look complete.
    serveTransactions(5_000);
    render(<TransaksiPage />);

    await waitFor(
      () => expect(screen.getByText(/5000|5\.000/)).toBeInTheDocument(),
      { timeout: 10_000 },
    );
  });
});
