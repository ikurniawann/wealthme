/**
 * EPIC-016 Task I — /rekonsiliasi "Unduh Ringkasan (TXT)" and "Unduh Excel
 * (CSV)" export buttons (attempt 2 — fixes review findings from attempt 1).
 *
 * - CSV/formula injection (CWE-1236): `entry.description` originates from
 *   user-uploaded bank-statement content (client-parsed CSV rows sent to the
 *   API, unsanitized). A malicious description like
 *   `=HYPERLINK("http://evil","x")` must not execute as a formula when a
 *   DIFFERENT family-group member later opens the CSV export in
 *   Excel/Sheets — `csvCell` now prefixes a leading single quote for any
 *   value starting with a formula-trigger character.
 * - Both buttons are disabled (and their handlers early-return) while the
 *   entries query is loading or errored, mirroring /tax's
 *   `isTaxRecordsLoading` guard, so a fast click or a failed background
 *   fetch can never produce an export that falsely claims zero
 *   entries/matches.
 * - Both handlers are wrapped in try/catch with a toast.error fallback so
 *   malformed entry data (e.g. an unparsable date) fails loudly instead of
 *   silently, with no user feedback.
 */

import type { ReactElement, ReactNode } from "react";
import { render as rtlRender, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// jsdom has no URL.createObjectURL/revokeObjectURL implementation.
const mockCreateObjectURL = jest.fn<string, [Blob]>(() => "blob:mock-url");
const mockRevokeObjectURL = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(URL as any).createObjectURL = mockCreateObjectURL;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(URL as any).revokeObjectURL = mockRevokeObjectURL;

// jsdom's Blob implementation has no .text() method, so capture the raw
// parts/options passed to the constructor instead of trying to read them
// back off the Blob instance.
const OriginalBlob = global.Blob;
let capturedBlobParts: BlobPart[] = [];
let capturedBlobOptions: BlobPropertyBag | undefined;
class CapturingBlob extends OriginalBlob {
  constructor(parts?: BlobPart[], options?: BlobPropertyBag) {
    super(parts, options);
    capturedBlobParts = parts ?? [];
    capturedBlobOptions = options;
  }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).Blob = CapturingBlob;

jest.mock("../../../lib/auth-client", () => ({
  authClient: {
    useSession: jest.fn(() => ({
      data: {
        session: { token: "tok-1", familyGroupId: "fg-1" },
        user: {
          id: "u1",
          name: "Test User",
          email: "test@example.com",
          image: null,
        },
      },
      isPending: false,
    })),
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

import RekonsiliasiPage from "./page";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function render(ui: ReactElement) {
  return rtlRender(ui, { wrapper: Providers });
}

const SYNCS = [
  {
    id: "sync-1",
    familyGroupId: "fg-1",
    fileName: "statement.csv",
    uploadedAt: "2026-07-01T00:00:00.000Z",
    rowCount: 2,
  },
];

const AUTO_MATCH_RESULT = { totalEntries: 2, suggested: 1 };

// entry-1 carries a formula-injection payload in its description — exactly
// the kind of value a malicious family-group member could smuggle in via an
// uploaded bank-statement row (client-parsed, unsanitized, sent to the API
// as-is).
const ENTRIES = [
  {
    id: "entry-1",
    bankSyncId: "sync-1",
    date: "2026-07-01T00:00:00.000Z",
    description: '=HYPERLINK("http://evil.com","Click me")',
    amount: "1000000",
    currency: "IDR",
    reconStatus: "matched",
    matchedTxId: "tx-1",
    suggestedTxId: null,
    createdAt: "2026-07-01T00:00:00.000Z",
  },
  {
    id: "entry-2",
    bankSyncId: "sync-1",
    date: "2026-07-02T00:00:00.000Z",
    description: "Belanja bulanan",
    amount: "250000",
    currency: "IDR",
    reconStatus: "suggested",
    matchedTxId: null,
    suggestedTxId: "tx-2",
    createdAt: "2026-07-02T00:00:00.000Z",
  },
];

function mockHappyPathApiFetch(): void {
  mockApiFetch.mockImplementation(
    (path: string, options?: { method?: string }) => {
      if (path === "/family-groups/fg-1/reconciliation") {
        return Promise.resolve(SYNCS);
      }
      if (
        path === "/family-groups/fg-1/reconciliation/sync-1/auto-match" &&
        options?.method === "POST"
      ) {
        return Promise.resolve(AUTO_MATCH_RESULT);
      }
      if (path === "/family-groups/fg-1/reconciliation/sync-1/entries") {
        return Promise.resolve(ENTRIES);
      }
      return Promise.reject(new Error(`unexpected apiFetch call: ${path}`));
    },
  );
}

/** Drives the wizard from Step 1 through to Step 4 by clicking the recent
 * upload row (Step 1 → 2), waiting for auto-match then "Lanjut" (2 → 3),
 * then "Simpan Hasil Rekonsiliasi" (3 → 4) — the download buttons only
 * render on Step 4. */
async function navigateToStep4(
  user: ReturnType<typeof userEvent.setup>,
): Promise<void> {
  await waitFor(() => {
    expect(screen.getByText("statement.csv")).toBeInTheDocument();
  });
  await user.click(screen.getByText("statement.csv"));

  await waitFor(() => {
    expect(screen.getByText("Lanjut")).toBeInTheDocument();
  });
  await user.click(screen.getByText("Lanjut"));

  await waitFor(() => {
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/family-groups/fg-1/reconciliation/sync-1/entries",
      { token: "tok-1" },
    );
  });

  await user.click(screen.getByText("Simpan Hasil Rekonsiliasi"));
}

describe("/rekonsiliasi export buttons (EPIC-016 Task I)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateObjectURL.mockReturnValue("blob:mock-url");
    capturedBlobParts = [];
    capturedBlobOptions = undefined;
    queryClient.clear();
  });

  it('"Unduh Ringkasan (TXT)" downloads a real TXT summary built from the loaded entries', async () => {
    mockHappyPathApiFetch();
    const { toast } = jest.requireMock<{
      toast: jest.Mock & { success: jest.Mock; error: jest.Mock };
    }>("sonner");
    const downloadedFileNames: string[] = [];
    const clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        downloadedFileNames.push(this.download);
      });
    const user = userEvent.setup();

    render(<RekonsiliasiPage />);
    await navigateToStep4(user);

    await user.click(screen.getByText("Unduh Ringkasan (TXT)"));

    expect(mockCreateObjectURL).toHaveBeenCalledTimes(1);
    expect(capturedBlobOptions?.type).toContain("text/plain");
    expect(downloadedFileNames[0]).toMatch(
      /^ringkasan-rekonsiliasi-\d{4}-\d{2}-\d{2}\.txt$/,
    );

    const content = capturedBlobParts.join("");
    expect(content).toContain("Total Transaksi: 2");
    expect(content).toContain("Cocok: 1");
    expect(content).toContain("Perlu Review: 1");
    expect(content).toContain("Belanja bulanan");

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith(
      "📥 Ringkasan rekonsiliasi berhasil diunduh.",
    );

    clickSpy.mockRestore();
  });

  it('"Unduh Excel (CSV)" downloads a real CSV report and neutralizes a formula-injection payload in entry.description', async () => {
    mockHappyPathApiFetch();
    const { toast } = jest.requireMock<{
      toast: jest.Mock & { success: jest.Mock; error: jest.Mock };
    }>("sonner");
    const downloadedFileNames: string[] = [];
    const clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        downloadedFileNames.push(this.download);
      });
    const user = userEvent.setup();

    render(<RekonsiliasiPage />);
    await navigateToStep4(user);

    await user.click(screen.getByText("Unduh Excel (CSV)"));

    expect(mockCreateObjectURL).toHaveBeenCalledTimes(1);
    expect(capturedBlobOptions?.type).toContain("text/csv");
    expect(downloadedFileNames[0]).toMatch(
      /^rekonsiliasi-\d{4}-\d{2}-\d{2}\.csv$/,
    );

    const content = capturedBlobParts.join("");

    // Regression: entry-1's description starts with `=`, a classic
    // CSV/formula-injection payload (CWE-1236). It must come out prefixed
    // with a leading single quote (then RFC 4180 quoted, since it also
    // contains commas and double quotes) so Excel/Sheets treats it as
    // literal text, never as a formula.
    expect(content).toContain(
      '"\'=HYPERLINK(""http://evil.com"",""Click me"")"',
    );
    expect(content).not.toContain(',=HYPERLINK("http://evil.com"');
    expect(content).toContain("Belanja bulanan");

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith(
      "📊 Excel (CSV) rekonsiliasi berhasil diunduh.",
    );

    clickSpy.mockRestore();
  });

  it('"Unduh Excel (CSV)" neutralizes a raw tab/CR-prefixed description and does not corrupt a legitimate negative amount', async () => {
    // Regression coverage for two attempt-2 bugs:
    // (1) `.trim()` was applied before checking the formula-trigger
    //     character, so a raw leading tab/CR was stripped away before the
    //     check ever ran and slipped through unneutralized.
    // (2) the formula-injection guard was applied to every column,
    //     including `Jumlah` (amount) — a computed/numeric field the app
    //     controls, never attacker input. The upload parser accepts
    //     negative amounts (`parseFloat`) as a normal shape for
    //     debit/expense entries, so a value like "-500000" is legitimate
    //     data, not a formula-injection attempt, and must stay a plain
    //     numeric-looking cell so Excel keeps treating it as a number.
    mockApiFetch.mockImplementation(
      (path: string, options?: { method?: string }) => {
        if (path === "/family-groups/fg-1/reconciliation") {
          return Promise.resolve(SYNCS);
        }
        if (
          path === "/family-groups/fg-1/reconciliation/sync-1/auto-match" &&
          options?.method === "POST"
        ) {
          return Promise.resolve({ totalEntries: 2, suggested: 0 });
        }
        if (path === "/family-groups/fg-1/reconciliation/sync-1/entries") {
          return Promise.resolve([
            {
              id: "entry-tab",
              bankSyncId: "sync-1",
              date: "2026-07-03T00:00:00.000Z",
              description: "\tPembayaran tunai",
              amount: "-50000000",
              currency: "IDR",
              reconStatus: "unmatched",
              matchedTxId: null,
              suggestedTxId: null,
              createdAt: "2026-07-03T00:00:00.000Z",
            },
            {
              id: "entry-cr",
              bankSyncId: "sync-1",
              date: "2026-07-04T00:00:00.000Z",
              description: "\rTransfer masuk",
              amount: "750000",
              currency: "IDR",
              reconStatus: "matched",
              matchedTxId: "tx-cr",
              suggestedTxId: null,
              createdAt: "2026-07-04T00:00:00.000Z",
            },
          ]);
        }
        return Promise.reject(new Error(`unexpected apiFetch call: ${path}`));
      },
    );
    const downloadedFileNames: string[] = [];
    const clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        downloadedFileNames.push(this.download);
      });
    const user = userEvent.setup();

    render(<RekonsiliasiPage />);
    await navigateToStep4(user);

    await user.click(screen.getByText("Unduh Excel (CSV)"));

    expect(mockCreateObjectURL).toHaveBeenCalledTimes(1);
    expect(downloadedFileNames[0]).toMatch(
      /^rekonsiliasi-\d{4}-\d{2}-\d{2}\.csv$/,
    );
    const content = capturedBlobParts.join("");

    // (1) a raw leading tab/CR must be neutralized with a leading `'`.
    expect(content).toContain("'\tPembayaran tunai");
    expect(content).toContain("'\rTransfer masuk");

    // (2) the negative amount is a computed column: no quote-prefix, plain
    // numeric-looking cell, still comma-separated from its neighbors.
    expect(content).toContain(",-500000,IDR,");
    expect(content).not.toContain(",'-500000,");

    expect(clickSpy).toHaveBeenCalledTimes(1);
    clickSpy.mockRestore();
  });

  it("disables both download buttons and guards the handlers while the entries query is still loading", async () => {
    // Sync list + auto-match resolve normally, but the entries fetch never
    // resolves during this test — simulates it still being in flight when
    // Step 4 renders (reachable even before entries finish loading, since
    // "Simpan Hasil Rekonsiliasi" is not itself gated on the entries query).
    mockApiFetch.mockImplementation(
      (path: string, options?: { method?: string }) => {
        if (path === "/family-groups/fg-1/reconciliation") {
          return Promise.resolve(SYNCS);
        }
        if (
          path === "/family-groups/fg-1/reconciliation/sync-1/auto-match" &&
          options?.method === "POST"
        ) {
          return Promise.resolve(AUTO_MATCH_RESULT);
        }
        if (path === "/family-groups/fg-1/reconciliation/sync-1/entries") {
          return new Promise(() => {});
        }
        return Promise.reject(new Error(`unexpected apiFetch call: ${path}`));
      },
    );
    const { toast } = jest.requireMock<{
      toast: jest.Mock & { success: jest.Mock; error: jest.Mock };
    }>("sonner");
    const clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    const user = userEvent.setup();

    render(<RekonsiliasiPage />);
    await navigateToStep4(user);

    const txtButton = screen
      .getByText("Unduh Ringkasan (TXT)")
      .closest("button");
    const csvButton = screen.getByText("Unduh Excel (CSV)").closest("button");
    expect(txtButton).toBeDisabled();
    expect(csvButton).toBeDisabled();

    // A real user cannot click a disabled button; assert no download is
    // ever produced from the stray click attempts.
    if (txtButton) await user.click(txtButton);
    if (csvButton) await user.click(csvButton);

    expect(mockCreateObjectURL).not.toHaveBeenCalled();
    expect(clickSpy).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();

    clickSpy.mockRestore();
  });

  it("disables both download buttons when the entries query fails", async () => {
    mockApiFetch.mockImplementation(
      (path: string, options?: { method?: string }) => {
        if (path === "/family-groups/fg-1/reconciliation") {
          return Promise.resolve(SYNCS);
        }
        if (
          path === "/family-groups/fg-1/reconciliation/sync-1/auto-match" &&
          options?.method === "POST"
        ) {
          return Promise.resolve(AUTO_MATCH_RESULT);
        }
        if (path === "/family-groups/fg-1/reconciliation/sync-1/entries") {
          return Promise.reject(new Error("network down"));
        }
        return Promise.reject(new Error(`unexpected apiFetch call: ${path}`));
      },
    );
    const clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    const user = userEvent.setup();

    render(<RekonsiliasiPage />);

    await waitFor(() => {
      expect(screen.getByText("statement.csv")).toBeInTheDocument();
    });
    await user.click(screen.getByText("statement.csv"));

    await waitFor(() => {
      expect(screen.getByText("Lanjut")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Lanjut"));

    // Wait for the entries query to actually fail before advancing, so the
    // disabled check below isn't racing the rejection.
    await waitFor(() => {
      expect(
        screen.getByText("Gagal memuat entri. Coba lagi."),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByText("Simpan Hasil Rekonsiliasi"));

    const txtButton = screen
      .getByText("Unduh Ringkasan (TXT)")
      .closest("button");
    const csvButton = screen.getByText("Unduh Excel (CSV)").closest("button");
    expect(txtButton).toBeDisabled();
    expect(csvButton).toBeDisabled();

    if (csvButton) await user.click(csvButton);
    if (txtButton) await user.click(txtButton);

    expect(mockCreateObjectURL).not.toHaveBeenCalled();
    expect(clickSpy).not.toHaveBeenCalled();

    clickSpy.mockRestore();
  });

  it("shows toast.error instead of crashing when an entry has malformed data the CSV export can't format", async () => {
    mockApiFetch.mockImplementation(
      (path: string, options?: { method?: string }) => {
        if (path === "/family-groups/fg-1/reconciliation") {
          return Promise.resolve(SYNCS);
        }
        if (
          path === "/family-groups/fg-1/reconciliation/sync-1/auto-match" &&
          options?.method === "POST"
        ) {
          return Promise.resolve({ totalEntries: 1, suggested: 0 });
        }
        if (path === "/family-groups/fg-1/reconciliation/sync-1/entries") {
          return Promise.resolve([
            { ...ENTRIES[1], id: "entry-bad", date: "not-a-real-date" },
          ]);
        }
        return Promise.reject(new Error(`unexpected apiFetch call: ${path}`));
      },
    );
    const { toast } = jest.requireMock<{
      toast: jest.Mock & { success: jest.Mock; error: jest.Mock };
    }>("sonner");
    const user = userEvent.setup();

    render(<RekonsiliasiPage />);
    await navigateToStep4(user);

    await user.click(screen.getByText("Unduh Excel (CSV)"));

    expect(toast.error).toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(mockCreateObjectURL).not.toHaveBeenCalled();
  });
});
