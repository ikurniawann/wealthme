/**
 * Turning bank lines into transactions, from the page.
 *
 * Reconciliation could only MATCH a line against a transaction that already
 * existed. On the demo that meant 235 unmatched entries searched against 90
 * transactions: every line red "Tidak Ditemukan", and an imported statement
 * that never appeared on /transaksi because no code path could put it there.
 *
 * These specs drive the real page and assert on the REQUEST it makes, so the
 * wiring cannot rot into a button that looks right and posts nothing.
 */

import type { ReactElement, ReactNode } from "react";
import { render as rtlRender, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// The page mount is the dominant cost here and CI is ~5x slower than local;
// see the note in password-upload.test.tsx.
jest.setTimeout(20_000);

const FAMILY_GROUP_ID = "fg-1";
const TOKEN = "test-token";
const SYNC_ID = "sync-1";
const ACCOUNT_ID = "acc-1";

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

const apiFetch = jest.fn();
jest.mock("../../../lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
}));

const toastSuccess = jest.fn();
const toastError = jest.fn();
const toastWarning = jest.fn();
jest.mock("sonner", () => ({
  toast: Object.assign(jest.fn(), {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
    warning: (...args: unknown[]) => toastWarning(...args),
  }),
}));

import { id as dictionary } from "../../../i18n/id";
import RekonsiliasiPage from "./page";

const UNMATCHED_ENTRY = {
  id: "entry-1",
  bankSyncId: SYNC_ID,
  date: "2026-07-01T00:00:00.000Z",
  description: "Pembayaran QR ke TOKO",
  amount: "-37000",
  currency: "IDR",
  reconStatus: "unmatched",
  matchedTxId: null,
  suggestedTxId: null,
  createdAt: "2026-08-01T00:00:00.000Z",
  matchedTransaction: null,
};

const MATCHED_ENTRY = {
  ...UNMATCHED_ENTRY,
  id: "entry-2",
  description: "Sudah cocok",
  reconStatus: "matched",
  matchedTxId: "tx-existing",
  matchedTransaction: {
    id: "tx-existing",
    description: "Sudah cocok",
    amount: "-37000",
    occurredAt: "2026-07-01T00:00:00.000Z",
    accountName: "BCA",
    toAccountName: null,
    categoryName: null,
    type: "expense",
  },
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

/** Answers every apiFetch by URL so the page can reach step 3. */
function routeApiFetch(entries: unknown[] = [UNMATCHED_ENTRY]) {
  apiFetch.mockImplementation((path: string) => {
    if (path.endsWith("/accounts")) {
      return Promise.resolve([
        { id: ACCOUNT_ID, name: "BCA Utama", institution: "BCA" },
        { id: "acc-2", name: "Mandiri", institution: "Mandiri" },
      ]);
    }
    if (path.endsWith("/entries")) return Promise.resolve(entries);
    if (path.endsWith("/auto-match")) {
      return Promise.resolve({ totalEntries: entries.length, suggested: 0 });
    }
    if (path.endsWith("/import-unmatched")) {
      return Promise.resolve({
        imported: 1,
        skipped: [],
        skippedTotal: 0,
        remaining: 0,
      });
    }
    if (path.includes("/import")) return Promise.resolve(UNMATCHED_ENTRY);
    if (path.endsWith("/templates")) return Promise.resolve([]);
    return Promise.resolve([]);
  });
}

/** Drives the upload step so the page lands on the entries table. */
async function reachEntriesTable(user: ReturnType<typeof userEvent.setup>) {
  const { container } = render(<RekonsiliasiPage />);
  globalThis.fetch = jest.fn(async () => ({
    ok: true,
    status: 201,
    json: async () => ({
      id: SYNC_ID,
      familyGroupId: FAMILY_GROUP_ID,
      fileName: "mutasi.csv",
      uploadedAt: "2026-08-01T00:00:00.000Z",
      rowCount: 1,
      skippedRows: [],
    }),
  })) as unknown as typeof fetch;

  // The page opens on a landing view; the wizard starts behind this button.
  await user.click(
    await screen.findByRole("button", {
      name: new RegExp(dictionary.rekonsiliasi.uploadMutasiButton, "i"),
    }),
  );

  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("no file input on the page");
  await user.upload(
    input,
    new File(["tanggal,keterangan,jumlah\n"], "mutasi.csv", {
      type: "text/csv",
    }),
  );
  // Upload lands on step 1's result card; the user walks to matching and
  // then to the results table, which is where the import lives.
  // Upload lands on the result card; one "Lanjut" runs the auto-match and
  // drops the page on the results table, which is where the import lives.
  await user.click(
    await screen.findByRole(
      "button",
      { name: new RegExp(`^${dictionary.rekonsiliasi.continueButton}$`, "i") },
      { timeout: 8_000 },
    ),
  );
  // Whichever line the spec supplied — the table is up either way.
  await waitFor(
    () => expect(screen.getAllByRole("row").length).toBeGreaterThan(1),
    {
      timeout: 8_000,
    },
  );
  return container;
}

beforeEach(() => {
  jest.clearAllMocks();
  queryClient.clear();
  routeApiFetch();
});

describe("/rekonsiliasi — the amounts on screen are the statement's amounts", () => {
  it("shows the FULL rupiah amount, not a hundredth of it", async () => {
    // The table divided by 100 for years, on the belief that the CSV path
    // stored cents. It does not — every path stores whole rupiah — so a real
    // statement line of Rp 38.500 rendered as Rp 385, and nothing on screen
    // agreed with the PDF the user was holding. Cross-checked against a
    // genuine 5-page Mandiri statement: all 52 stored amounts equal their
    // printed values and reconstruct the printed closing balance exactly, so
    // the parser was never the problem — the display was.
    routeApiFetch([{ ...UNMATCHED_ENTRY, amount: "-38500" }]);
    const user = userEvent.setup();
    await reachEntriesTable(user);

    const cells = screen.getAllByText((_, node) =>
      (node?.textContent ?? "").replace(/\s/g, "").includes("38.500"),
    );
    expect(cells.length).toBeGreaterThan(0);
    // The hundredth-scale figure must appear nowhere at all.
    expect(
      screen.queryAllByText((_, node) => {
        const text = (node?.textContent ?? "").replace(/\s/g, "");
        return /(^|[^.\d])385([^.\d]|$)/.test(text) && !text.includes("38.500");
      }),
    ).toHaveLength(0);
  });
});

describe("/rekonsiliasi — turning bank lines into transactions", () => {
  it("posts the chosen account, and the direction is NOT sent (the sign decides)", async () => {
    const user = userEvent.setup();
    await reachEntriesTable(user);

    await user.click(
      screen.getByRole("button", {
        name: `${dictionary.rekonsiliasi.importEntryAriaLabelPrefix} ${UNMATCHED_ENTRY.description}`,
      }),
    );

    await waitFor(() =>
      expect(
        apiFetch.mock.calls.some(([path]) =>
          String(path).endsWith(`/entries/${UNMATCHED_ENTRY.id}/import`),
        ),
      ).toBe(true),
    );
    const call = apiFetch.mock.calls.find(([path]) =>
      String(path).endsWith(`/entries/${UNMATCHED_ENTRY.id}/import`),
    );
    const body = JSON.parse((call?.[1] as { body: string }).body) as Record<
      string,
      unknown
    >;
    expect(body).toEqual({ accountId: ACCOUNT_ID });
    // No `type` and no `amount`: the server reads both off the bank line, so
    // the client cannot contradict the statement.
    expect(Object.keys(body)).not.toContain("type");
    expect(Object.keys(body)).not.toContain("amount");
  });

  it("offers no import on a line that already has a transaction", async () => {
    routeApiFetch([MATCHED_ENTRY]);
    const user = userEvent.setup();
    await reachEntriesTable(user);

    // Non-vacuous: the table really did render this line. (It appears twice
    // — the bank line and its matched transaction both carry the text.)
    expect(
      screen.getAllByText(MATCHED_ENTRY.description).length,
    ).toBeGreaterThan(0);

    // Importing an already-linked line would duplicate the money, so the
    // affordance is not there to be pressed.
    expect(
      screen.queryByRole("button", {
        name: `${dictionary.rekonsiliasi.importEntryAriaLabelPrefix} ${MATCHED_ENTRY.description}`,
      }),
    ).not.toBeInTheDocument();
  });

  it("reports a partial bulk import as a WARNING, not a success", async () => {
    const user = userEvent.setup();
    await reachEntriesTable(user);
    apiFetch.mockImplementation((path: string) => {
      if (path.endsWith("/import-unmatched")) {
        return Promise.resolve({
          imported: 4,
          skipped: [{ description: "SALDO AWAL", reason: "nominal 0" }],
          skippedTotal: 1,
          remaining: 1,
        });
      }
      if (path.endsWith("/entries")) return Promise.resolve([UNMATCHED_ENTRY]);
      if (path.endsWith("/accounts")) {
        return Promise.resolve([
          { id: ACCOUNT_ID, name: "BCA Utama", institution: "BCA" },
        ]);
      }
      return Promise.resolve([]);
    });

    // The upload step toasts its own success; only the IMPORT's toasts are
    // under test here.
    toastSuccess.mockClear();
    toastWarning.mockClear();

    await user.click(
      screen.getByRole("button", {
        name: dictionary.rekonsiliasi.importAllButton.replace("{count}", "1"),
      }),
    );

    await waitFor(() => expect(toastWarning).toHaveBeenCalled());
    // "Berhasil" over a run that skipped a row is the half-truth that gets
    // found weeks later, when the balance disagrees with the bank.
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastWarning).toHaveBeenCalledWith(
      dictionary.rekonsiliasi.toastEntriesImportedPartial
        .replace("{imported}", "4")
        .replace("{skipped}", "1"),
    );
  });
});
