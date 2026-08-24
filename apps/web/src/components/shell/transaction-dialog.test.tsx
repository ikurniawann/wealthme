/**
 * EPIC-023 Task E3/E4 (D12/D13, US-LIAB-5/US-TXN-8) — behavioral coverage
 * for the global `TransactionDialog` (previously untested):
 *
 *  E3: the Kartu Kredit tab picks a CREDIT CARD from liabilities (never an
 *      account), posts through `POST .../liabilities/:id/purchase` (never
 *      `POST .../transactions`), and never touches any account balance —
 *      asserted as the NEGATIVE: no PATCH/POST ever targets `/accounts`.
 *  E4: the Transfer tab renders NO category field at all — moving money
 *      between your own accounts is neither income nor expense (D13).
 */

import { useEffect } from "react";
import type { ReactElement, ReactNode } from "react";
import {
  act,
  fireEvent,
  render as rtlRender,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { id as mockDictionary } from "../../i18n/id";
import { queryKeys } from "../../lib/query-keys";

// jsdom has no PointerEvent — Base UI's Dialog primitives read pointer-event
// fields internally (same fix as dana/rekening/liabilitas tests). Needed
// here for the EPIC-024 Task L3 attachment-upload tests, which interact
// with a control (a hidden file input) inside the open dialog.
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

jest.mock("../../hooks/use-locale", () => ({
  useLocale: jest.fn(() => ({
    locale: "id",
    setLocale: jest.fn(),
    toggle: jest.fn(),
    t: mockDictionary,
  })),
}));

// This file imports `useSession` (via auth-compat -> auth-client), which
// re-exports the `better-auth` React client (unparseable ESM in jest) — same
// mock precedent as every other `(app)/**/*.test.tsx` in this repo.
jest.mock("../../lib/auth-client", () => ({
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

const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
jest.mock("sonner", () => ({
  toast: Object.assign(jest.fn(), {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
    warning: (...args: unknown[]) => mockToastSuccess(...args),
  }),
}));

const FAMILY_GROUP_ID = "fg-1";
const TOKEN = "test-token";

const CATEGORIES = [
  { id: "cat-1", name: "Belanja", kind: "expense", icon: "🛒" },
  { id: "cat-2", name: "Gaji", kind: "income", icon: "💰" },
];
const ACCOUNTS = [{ id: "acc-1", name: "BCA Tabungan", institution: "BCA" }];
const LIABILITIES = [
  { id: "liab-card-1", name: "BCA Kartu Kredit", type: "kartu_kredit" },
  { id: "liab-loan-1", name: "KPR Rumah", type: "kpr" },
];

// EPIC-027 B1 — the scan control is gated on the family AI key's
// `scanAvailable`; mutable so a test can flip it on.
let aiKeyStatus = {
  configured: false,
  provider: null as string | null,
  keyHint: null as string | null,
  scanAvailable: false,
};

const mockApiFetch = jest.fn(
  (url: string, options?: { method?: string; body?: string }) => {
    const method = options?.method ?? "GET";
    if (url === "/auth/me") {
      return Promise.resolve({ familyGroupId: FAMILY_GROUP_ID });
    }
    if (url.endsWith("/ai-key")) return Promise.resolve(aiKeyStatus);
    if (url === "/family-groups/mine") {
      return Promise.resolve([{ id: FAMILY_GROUP_ID, myRole: "owner" }]);
    }
    if (url.endsWith("/accounts")) return Promise.resolve(ACCOUNTS);
    if (url.endsWith("/categories")) return Promise.resolve(CATEGORIES);
    if (url.endsWith("/liabilities")) return Promise.resolve(LIABILITIES);
    if (method === "POST" && url.includes("/purchase")) {
      return Promise.resolve({
        id: "liab-card-1",
        remainingBalance: "150000",
      });
    }
    if (method === "POST" && url.endsWith("/transactions")) {
      return Promise.resolve({ id: "tx-1" });
    }
    return Promise.resolve({});
  },
);
jest.mock("../../lib/api-client", () => ({
  apiFetch: (...args: Parameters<typeof mockApiFetch>) => mockApiFetch(...args),
}));

// EPIC-027 B2 — jsdom implements no 2D canvas context, so the real
// `captureVideoFrameBase64` can never succeed here. Only the thin
// canvas wrapper is stubbed; the downscale/encode loop it wraps keeps its
// own unit coverage in `hooks/receipt-image.test.ts`.
jest.mock("../../hooks/receipt-image", () => ({
  ...jest.requireActual("../../hooks/receipt-image"),
  captureVideoFrameBase64: jest.fn(
    () => "Y2FwdHVyZWRSZWNlaXB0Qnl0ZXNGb3JUZXN0aW5nMTIzNDU2Nzg5",
  ),
}));

import { captureVideoFrameBase64 } from "../../hooks/receipt-image";
import { isoToDateInputValue } from "../../hooks/receipt-scan";
import { TransactionDialog } from "./transaction-dialog";
import { ShellProvider, useShell } from "./shell-context";

function OpenOnMount({ children }: { children: ReactNode }) {
  const { setTxnOpen } = useShell();
  useEffect(() => {
    setTxnOpen(true);
  }, [setTxnOpen]);
  return <>{children}</>;
}

function render(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const result = rtlRender(
    <QueryClientProvider client={queryClient}>
      <ShellProvider>
        <OpenOnMount>{ui}</OpenOnMount>
      </ShellProvider>
    </QueryClientProvider>,
  );
  return { ...result, queryClient };
}

describe("TransactionDialog — credit-card tab and transfer category removal (EPIC-023 E3/E4)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    aiKeyStatus = {
      configured: false,
      provider: null,
      keyHint: null,
      scanAvailable: false,
    };
  });

  it("E3: posts a card purchase through the liability's own endpoint, never /transactions, and never touches any account", async () => {
    const user = userEvent.setup();
    render(<TransactionDialog />);

    // Switch to the Kartu Kredit tab (4th tab).
    await user.click(await screen.findByRole("tab", { name: /Kartu Kredit/ }));

    // Amount.
    const amountInput = screen.getByPlaceholderText("250.000");
    await user.type(amountInput, "150000");

    // Pick the credit card (liability), NOT an account — `Field` now
    // associates its `<label>` with the control via htmlFor/id (HIGH 3
    // fix), so the select has a real accessible name to query by.
    const cardSelect = await screen.findByRole("combobox", {
      name: "Kartu Kredit",
    });
    await user.selectOptions(cardSelect, "liab-card-1");

    await user.click(screen.getByRole("button", { name: "Simpan" }));

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        `/family-groups/${FAMILY_GROUP_ID}/liabilities/liab-card-1/purchase`,
        expect.objectContaining({ method: "POST" }),
      );
    });

    // Negative assertion — the whole point of D12: no call ever POSTs to
    // the generic transactions endpoint, and no call ever touches
    // `/accounts` (no balance mutation of any kind).
    const allCalls = mockApiFetch.mock.calls as [
      string,
      { method?: string } | undefined,
    ][];
    const hitTransactions = allCalls.some(
      ([url, opts]) => opts?.method === "POST" && url.endsWith("/transactions"),
    );
    const hitAccountWrite = allCalls.some(
      ([url, opts]) =>
        url.includes("/accounts") &&
        (opts?.method === "POST" || opts?.method === "PATCH"),
    );
    expect(hitTransactions).toBe(false);
    expect(hitAccountWrite).toBe(false);
  });

  it("HIGH 2: a card purchase invalidates the budgets cache (LiabilitiesService.purchase() writes a real categorized expense row that BudgetsService.findAll groups spend on)", async () => {
    const user = userEvent.setup();
    const { queryClient } = render(<TransactionDialog />);
    const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

    await user.click(await screen.findByRole("tab", { name: /Kartu Kredit/ }));
    await user.type(screen.getByPlaceholderText("250.000"), "150000");
    const cardSelect = await screen.findByRole("combobox", {
      name: "Kartu Kredit",
    });
    await user.selectOptions(cardSelect, "liab-card-1");
    await user.click(screen.getByRole("button", { name: "Simpan" }));

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: queryKeys.budgets.all(FAMILY_GROUP_ID),
        }),
      );
    });
  });

  it("HIGH 2: an ordinary expense also invalidates the budgets cache", async () => {
    const user = userEvent.setup();
    const { queryClient } = render(<TransactionDialog />);
    const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

    // The prototype opens on Expense by default.
    await user.click(await screen.findByRole("tab", { name: /Pengeluaran/ }));
    await user.type(screen.getByPlaceholderText("250.000"), "50000");
    const accountSelect = await screen.findByRole("combobox", {
      name: "Akun",
    });
    await user.selectOptions(accountSelect, "acc-1");
    await user.click(screen.getByRole("button", { name: "Simpan" }));

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: queryKeys.budgets.all(FAMILY_GROUP_ID),
        }),
      );
    });
  });

  it("E4: the Transfer tab renders no category field", async () => {
    const user = userEvent.setup();
    render(<TransactionDialog />);

    // Income/Expense/Kartu Kredit tabs DO show the category field.
    expect(screen.getByText("Kategori")).toBeInTheDocument();

    await user.click(await screen.findByRole("tab", { name: /Transfer/ }));

    expect(screen.queryByText("Kategori")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Kategori" }),
    ).not.toBeInTheDocument();
  });
});

/**
 * EPIC-024 Task L3 (D15, US-TXN-9) — receipt/photo attachment on the
 * manual-entry form. `apiFetch` (mocked above) always forces JSON, so the
 * upload path uses its own raw `fetch` (see `uploadAttachment` in
 * `transaction-dialog.tsx`) — these tests mock `global.fetch` directly.
 */
describe("TransactionDialog — attachment upload (EPIC-024 Task L3, US-TXN-9)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    aiKeyStatus = {
      configured: false,
      provider: null,
      keyHint: null,
      scanAvailable: false,
    };
    if (!global.fetch) {
      global.fetch = jest.fn();
    }
  });

  function makeFile(name: string, type: string, sizeBytes: number): File {
    const file = new File(["x".repeat(Math.min(sizeBytes, 10))], name, {
      type,
    });
    Object.defineProperty(file, "size", { value: sizeBytes });
    return file;
  }

  // `userEvent.upload` internally clicks + focuses the input, which walks
  // Base UI's `FloatingFocusManager` focus-out handling for the still-open
  // dialog and hits a jsdom incompatibility unrelated to this feature
  // (`relatedTarget?.hasAttribute is not a function` — `event.relatedTarget`
  // is not a real `Element` under jsdom). Firing the `change` event
  // directly is what actually exercises `handleAttachmentChange` and skips
  // that unrelated focus dance.
  function selectFile(input: HTMLElement, file: File) {
    fireEvent.change(input, { target: { files: [file] } });
  }

  it("uploads the picked file to the newly created transaction after a successful save", async () => {
    const user = userEvent.setup();
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    } as Response);
    render(<TransactionDialog />);

    await user.click(await screen.findByRole("tab", { name: /Pengeluaran/ }));
    await user.type(screen.getByPlaceholderText("250.000"), "50000");
    const accountSelect = await screen.findByRole("combobox", {
      name: "Akun",
    });
    await user.selectOptions(accountSelect, "acc-1");

    const file = makeFile("struk.jpg", "image/jpeg", 1024);
    const fileInput = screen.getByTestId("attachment-file-input");
    selectFile(fileInput, file);
    expect(screen.getByText(/struk\.jpg/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Simpan" }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          `/family-groups/${FAMILY_GROUP_ID}/transactions/tx-1/attachments`,
        ),
        expect.objectContaining({
          method: "POST",
          headers: { Authorization: `Bearer ${TOKEN}` },
        }),
      );
    });
    // The body is a FormData carrying the exact File object picked.
    const [, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = options.body as FormData;
    expect(body.get("file")).toBe(file);

    fetchSpy.mockRestore();
  });

  it("surfaces an honest error toast when the attachment upload fails — the transaction itself is still saved", async () => {
    const user = userEvent.setup();
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      statusText: "Bad Request",
      json: () => Promise.resolve({ message: "Unsupported file type" }),
    } as Response);
    render(<TransactionDialog />);

    await user.click(await screen.findByRole("tab", { name: /Pengeluaran/ }));
    await user.type(screen.getByPlaceholderText("250.000"), "50000");
    const accountSelect = await screen.findByRole("combobox", {
      name: "Akun",
    });
    await user.selectOptions(accountSelect, "acc-1");

    const file = makeFile("struk.jpg", "image/jpeg", 1024);
    selectFile(screen.getByTestId("attachment-file-input"), file);

    await user.click(screen.getByRole("button", { name: "Simpan" }));

    // The transaction itself still reports success…
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith(
        "Transaksi berhasil disimpan!",
      );
    });
    // …but the failed attachment upload gets its own honest, distinct error
    // toast — never silently dropped.
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Unsupported file type");
    });

    fetchSpy.mockRestore();
  });

  it("rejects an unsupported file type client-side and never adds it to the form", async () => {
    const user = userEvent.setup();
    render(<TransactionDialog />);

    await user.click(await screen.findByRole("tab", { name: /Pengeluaran/ }));

    const badFile = makeFile("virus.exe", "application/x-msdownload", 1024);
    selectFile(screen.getByTestId("attachment-file-input"), badFile);

    expect(mockToastError).toHaveBeenCalledWith(
      "Tipe file tidak didukung — hanya JPG, PNG, WEBP, atau PDF.",
    );
    expect(screen.queryByText(/virus\.exe/)).not.toBeInTheDocument();
    expect(
      screen.getByText("Unggah foto struk atau PDF — maks 5 MB"),
    ).toBeInTheDocument();
  });

  it("rejects a file over 5MB client-side and never adds it to the form", async () => {
    const user = userEvent.setup();
    render(<TransactionDialog />);

    await user.click(await screen.findByRole("tab", { name: /Pengeluaran/ }));

    const tooBig = makeFile("besar.png", "image/png", 6 * 1024 * 1024);
    selectFile(screen.getByTestId("attachment-file-input"), tooBig);

    expect(mockToastError).toHaveBeenCalledWith("Ukuran file melebihi 5MB.");
    expect(screen.queryByText(/besar\.png/)).not.toBeInTheDocument();
  });

  it("the Kartu Kredit tab renders no attachment field (purchase() returns no transactionId to attach to)", async () => {
    render(<TransactionDialog />);

    expect(screen.getByText("Lampiran")).toBeInTheDocument();

    await userEvent
      .setup()
      .click(await screen.findByRole("tab", { name: /Kartu Kredit/ }));

    expect(screen.queryByText("Lampiran")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("attachment-file-input"),
    ).not.toBeInTheDocument();
  });
});

/**
 * EPIC-027 group 7 (B1-B4, D8/D9/D10/D13) — the receipt scanner stopped
 * being a simulation. What is asserted here is exactly what used to be
 * false: the button is gated on a real capability flag, the camera is a
 * real `getUserMedia` stream whose tracks get released, each backend
 * failure `code` produces its own message, and NOTHING is created until the
 * user confirms through the ordinary form.
 */
describe("TransactionDialog — receipt scan (EPIC-027 B1-B4)", () => {
  const SCAN_RESULT = {
    amount: 58000,
    description: "Alfamart Pahlawan",
    occurredAt: "2025-05-18T07:32:15.000Z",
    categoryHint: "belanja",
    categoryId: "cat-1",
  };
  const CAPTURED_BASE64 =
    "Y2FwdHVyZWRSZWNlaXB0Qnl0ZXNGb3JUZXN0aW5nMTIzNDU2Nzg5";
  const SCAN_URL = `/family-groups/${FAMILY_GROUP_ID}/transactions/scan`;

  let tracks: { stop: jest.Mock }[];
  let mockGetUserMedia: jest.Mock;

  function setScanResponse(response: Partial<Response> | (() => Response)) {
    return jest
      .spyOn(global, "fetch")
      .mockImplementation((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/transactions/scan")) {
          return Promise.resolve(
            (typeof response === "function"
              ? response()
              : response) as Response,
          );
        }
        // Everything else on the raw-fetch path is the attachment upload.
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        } as Response);
      });
  }

  function okScan(body: unknown = SCAN_RESULT) {
    return { ok: true, json: () => Promise.resolve(body) } as Partial<Response>;
  }

  function failedScan(status: number, body: Record<string, unknown>) {
    return {
      ok: false,
      status,
      statusText: "Error",
      json: () => Promise.resolve(body),
    } as Partial<Response>;
  }

  async function openScanView(user: ReturnType<typeof userEvent.setup>) {
    const scanButton = await screen.findByRole("button", {
      name: mockDictionary.shell.transactionDialog.scanReceipt,
    });
    await waitFor(() => expect(scanButton).toBeEnabled());
    await user.click(scanButton);
    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: mockDictionary.shell.transactionDialog.scanCapture,
        }),
      ).toBeEnabled(),
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    aiKeyStatus = {
      configured: true,
      provider: "claude",
      keyHint: "sk-...abcd",
      scanAvailable: true,
    };
    // jsdom's default document URL is plain http, so `isSecureContext` is
    // false and the hook would (correctly) refuse to open the camera.
    Object.defineProperty(window, "isSecureContext", {
      value: true,
      configurable: true,
    });
    // jsdom has no media playback; the hook already tolerates a rejected or
    // undefined `play()`, this only silences the "Not implemented" noise.
    jest
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockImplementation(() => Promise.resolve());
    tracks = [{ stop: jest.fn() }, { stop: jest.fn() }];
    mockGetUserMedia = jest.fn(() =>
      Promise.resolve({ getTracks: () => tracks } as unknown as MediaStream),
    );
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia: mockGetUserMedia },
      configurable: true,
    });
    (captureVideoFrameBase64 as jest.Mock).mockReturnValue(CAPTURED_BASE64);
  });

  it("B1: disables the scan control, says why, and links to Pengaturan when the family key has no vision support", async () => {
    aiKeyStatus = {
      configured: true,
      provider: "claude",
      keyHint: "sk-...abcd",
      scanAvailable: false,
    };
    const user = userEvent.setup();
    render(<TransactionDialog />);

    const scanButton = await screen.findByRole("button", {
      name: mockDictionary.shell.transactionDialog.scanReceipt,
    });
    await waitFor(() => expect(scanButton).toBeDisabled());
    expect(
      screen.getByText(
        new RegExp(mockDictionary.shell.transactionDialog.scanUnavailable),
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: mockDictionary.shell.transactionDialog.scanUnavailableLink,
      }),
    ).toHaveAttribute("href", "/akun");

    await user.click(scanButton);
    expect(mockGetUserMedia).not.toHaveBeenCalled();
  });

  it("B1/B2: opens a rear-facing camera preview and posts the captured frame with no data-URL prefix", async () => {
    const fetchSpy = setScanResponse(okScan());
    const user = userEvent.setup();
    render(<TransactionDialog />);

    await openScanView(user);

    expect(mockGetUserMedia).toHaveBeenCalledWith({
      video: { facingMode: { ideal: "environment" } },
    });
    expect(screen.getByTestId("scan-camera-preview")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: mockDictionary.shell.transactionDialog.scanCapture,
      }),
    );

    await waitFor(() =>
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining(SCAN_URL),
        expect.objectContaining({ method: "POST" }),
      ),
    );
    const [, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const posted = JSON.parse(String(options.body)) as { imageBase64: string };
    expect(posted.imageBase64).toBe(CAPTURED_BASE64);
    expect(posted.imageBase64.startsWith("data:")).toBe(false);

    fetchSpy.mockRestore();
  });

  it.each([
    [
      412,
      { code: "OCR_NOT_CONFIGURED" },
      mockDictionary.shell.transactionDialog.scanErrorNotConfigured,
    ],
    [
      409,
      { code: "AI_KEY_CORRUPTED" },
      mockDictionary.shell.transactionDialog.scanErrorKeyCorrupted,
    ],
    [
      502,
      { code: "OCR_AUTH" },
      mockDictionary.shell.transactionDialog.scanErrorAuth,
    ],
    [
      504,
      { code: "OCR_TIMEOUT" },
      mockDictionary.shell.transactionDialog.scanErrorTimeout,
    ],
    [
      502,
      { code: "OCR_PARSE_FAILED" },
      mockDictionary.shell.transactionDialog.scanErrorParseFailed,
    ],
    [
      502,
      { code: "OCR_UPSTREAM_FAILED" },
      mockDictionary.shell.transactionDialog.scanErrorUpstream,
    ],
    [
      429,
      { code: "OCR_RATE_LIMITED", scope: "minute" },
      mockDictionary.shell.transactionDialog.scanErrorRateLimited,
    ],
    [
      429,
      { code: "OCR_RATE_LIMITED", scope: "daily" },
      mockDictionary.shell.transactionDialog.scanErrorRateLimitedDaily,
    ],
  ])(
    "B2: a %i failure renders the message for its own code, never one generic failure",
    async (status, body, expected) => {
      const fetchSpy = setScanResponse(failedScan(status, body));
      const user = userEvent.setup();
      render(<TransactionDialog />);

      await openScanView(user);
      await user.click(
        screen.getByRole("button", {
          name: mockDictionary.shell.transactionDialog.scanCapture,
        }),
      );

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(expected);
      // Never a fabricated result on failure.
      expect(
        screen.queryByText(mockDictionary.shell.transactionDialog.scanUse),
      ).not.toBeInTheDocument();

      fetchSpy.mockRestore();
    },
  );

  it("B2: a DAILY quota exhaustion never tells the user to try again shortly", async () => {
    const fetchSpy = setScanResponse(
      failedScan(429, { code: "OCR_RATE_LIMITED", scope: "daily" }),
    );
    const user = userEvent.setup();
    render(<TransactionDialog />);

    await openScanView(user);
    await user.click(
      screen.getByRole("button", {
        name: mockDictionary.shell.transactionDialog.scanCapture,
      }),
    );

    const alert = await screen.findByRole("alert");
    expect(alert).not.toHaveTextContent(/sebentar lagi/i);
    expect(alert).toHaveTextContent(/Kuota harian/i);

    fetchSpy.mockRestore();
  });

  it("B1: a denied camera permission reads as a permission problem, not a broken app, and makes no scan request", async () => {
    const fetchSpy = setScanResponse(okScan());
    mockGetUserMedia.mockRejectedValue(
      Object.assign(new Error("denied"), { name: "NotAllowedError" }),
    );
    const user = userEvent.setup();
    render(<TransactionDialog />);

    await user.click(
      await screen.findByRole("button", {
        name: mockDictionary.shell.transactionDialog.scanReceipt,
      }),
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      mockDictionary.shell.transactionDialog.cameraErrorPermission,
    );
    expect(
      fetchSpy.mock.calls.some(([url]) =>
        String(url).includes("/transactions/scan"),
      ),
    ).toBe(false);

    fetchSpy.mockRestore();
  });

  it("B3 (D9): the review screen creates nothing — 'Gunakan' only prefills the real form", async () => {
    const fetchSpy = setScanResponse(okScan());
    const user = userEvent.setup();
    render(<TransactionDialog />);

    await openScanView(user);
    await user.click(
      screen.getByRole("button", {
        name: mockDictionary.shell.transactionDialog.scanCapture,
      }),
    );

    // Review screen shows what was actually read.
    expect(await screen.findByText("Alfamart Pahlawan")).toBeInTheDocument();
    expect(screen.getByText("Rp 58.000")).toBeInTheDocument();

    // NOTHING was created by getting here.
    const createdFromReview = mockApiFetch.mock.calls.some(
      ([url, opts]) =>
        opts?.method === "POST" && String(url).endsWith("/transactions"),
    );
    expect(createdFromReview).toBe(false);

    await user.click(
      screen.getByRole("button", {
        name: mockDictionary.shell.transactionDialog.scanUse,
      }),
    );

    // …and still nothing after the prefill — only the form is populated.
    expect(
      mockApiFetch.mock.calls.some(
        ([url, opts]) =>
          opts?.method === "POST" && String(url).endsWith("/transactions"),
      ),
    ).toBe(false);
    expect(screen.getByPlaceholderText("250.000")).toHaveValue("58.000");
    expect(
      await screen.findByRole("combobox", { name: "Kategori" }),
    ).toHaveValue("cat-1");
    const expectedDate = isoToDateInputValue(SCAN_RESULT.occurredAt, "");
    expect(
      screen.getByLabelText(mockDictionary.shell.transactionDialog.dateLabel),
    ).toHaveValue(expectedDate);

    fetchSpy.mockRestore();
  });

  it("B3 (D13): a null categoryId leaves the category blank instead of guessing from the hint", async () => {
    const fetchSpy = setScanResponse(
      okScan({ ...SCAN_RESULT, categoryId: null }),
    );
    const user = userEvent.setup();
    render(<TransactionDialog />);

    await openScanView(user);
    await user.click(
      screen.getByRole("button", {
        name: mockDictionary.shell.transactionDialog.scanCapture,
      }),
    );
    expect(
      await screen.findByText(
        new RegExp(mockDictionary.shell.transactionDialog.categoryUnmatched),
      ),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: mockDictionary.shell.transactionDialog.scanUse,
      }),
    );

    expect(
      await screen.findByRole("combobox", { name: "Kategori" }),
    ).toHaveValue("");

    fetchSpy.mockRestore();
  });

  it("B4 (D10): the captured frame rides the existing post-create attachment flow, and a 202 held expense is never reported as saved", async () => {
    // A row-scoped member's over-threshold expense: the create endpoint
    // answers 202 { held: true } and writes NOTHING.
    mockApiFetch.mockImplementation(
      (url: string, options?: { method?: string; body?: string }) => {
        const method = options?.method ?? "GET";
        if (url === "/auth/me") {
          return Promise.resolve({ familyGroupId: FAMILY_GROUP_ID });
        }
        if (url.endsWith("/ai-key")) return Promise.resolve(aiKeyStatus);
        if (url === "/family-groups/mine") {
          return Promise.resolve([{ id: FAMILY_GROUP_ID, myRole: "owner" }]);
        }
        if (url.endsWith("/accounts")) return Promise.resolve(ACCOUNTS);
        if (url.endsWith("/categories")) return Promise.resolve(CATEGORIES);
        if (url.endsWith("/liabilities")) return Promise.resolve(LIABILITIES);
        if (method === "POST" && url.endsWith("/transactions")) {
          return Promise.resolve({ held: true });
        }
        return Promise.resolve({});
      },
    );
    const fetchSpy = setScanResponse(okScan());
    const user = userEvent.setup();
    render(<TransactionDialog />);

    await openScanView(user);
    await user.click(
      screen.getByRole("button", {
        name: mockDictionary.shell.transactionDialog.scanCapture,
      }),
    );
    await user.click(
      await screen.findByRole("button", {
        name: mockDictionary.shell.transactionDialog.scanUse,
      }),
    );

    // The captured JPEG is queued on the ORDINARY attachment field.
    expect(await screen.findByText(/struk-\d+\.jpg/)).toBeInTheDocument();

    await user.selectOptions(
      await screen.findByRole("combobox", { name: "Akun" }),
      "acc-1",
    );
    await user.click(screen.getByRole("button", { name: "Simpan" }));

    await waitFor(() =>
      expect(mockToastSuccess).toHaveBeenCalledWith(
        mockDictionary.shell.transactionDialog.heldToast,
      ),
    );
    expect(mockToastSuccess).not.toHaveBeenCalledWith(
      mockDictionary.shell.transactionDialog.savedToast,
    );
    // A held expense is not a transaction, so there is nothing to attach to.
    expect(
      fetchSpy.mock.calls.some(([url]) => String(url).includes("/attachments")),
    ).toBe(false);

    fetchSpy.mockRestore();
  });

  /**
   * EPIC-027 group 7 review (CRITICAL) — the cancellation race. The existing
   * "stops every camera track" test cannot catch it: its `getUserMedia` mock
   * resolves before a stop can interleave. Here the promise is held open
   * across the user's cancellation, which is exactly the real sequence
   * (permission prompt still on screen when the user backs out).
   */
  it("B1: releases a stream that arrives AFTER the user cancelled, and never re-arms the camera", async () => {
    let resolveMedia: (stream: MediaStream) => void = () => {};
    mockGetUserMedia.mockImplementation(
      () =>
        new Promise<MediaStream>((resolve) => {
          resolveMedia = resolve;
        }),
    );
    const user = userEvent.setup();
    render(<TransactionDialog />);

    // Enter the scan view; `start()` is now parked on the permission prompt.
    const scanButton = await screen.findByRole("button", {
      name: mockDictionary.shell.transactionDialog.scanReceipt,
    });
    await waitFor(() => expect(scanButton).toBeEnabled());
    await user.click(scanButton);
    expect(screen.getByTestId("scan-camera-preview")).toBeInTheDocument();

    // The user backs out while the prompt is still open.
    await user.click(screen.getByRole("button", { name: "Batal" }));
    expect(screen.queryByTestId("scan-camera-preview")).not.toBeInTheDocument();

    // …and only THEN does the browser hand over a live stream.
    await act(async () => {
      resolveMedia({ getTracks: () => tracks } as unknown as MediaStream);
    });

    // Every track is released instead of adopted…
    tracks.forEach((track) => expect(track.stop).toHaveBeenCalled());
    // …and no state moved to "ready": the scanner did not reappear.
    expect(screen.queryByTestId("scan-camera-preview")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: mockDictionary.shell.transactionDialog.scanCapture,
      }),
    ).not.toBeInTheDocument();
  });

  it("B1: releases a stream that arrives after unmount", async () => {
    let resolveMedia: (stream: MediaStream) => void = () => {};
    mockGetUserMedia.mockImplementation(
      () =>
        new Promise<MediaStream>((resolve) => {
          resolveMedia = resolve;
        }),
    );
    const user = userEvent.setup();
    const { unmount } = render(<TransactionDialog />);

    const scanButton = await screen.findByRole("button", {
      name: mockDictionary.shell.transactionDialog.scanReceipt,
    });
    await waitFor(() => expect(scanButton).toBeEnabled());
    await user.click(scanButton);

    unmount();
    await act(async () => {
      resolveMedia({ getTracks: () => tracks } as unknown as MediaStream);
    });

    tracks.forEach((track) => expect(track.stop).toHaveBeenCalled());
  });

  it("B1: the effect itself stops the camera on a view change, without relying on the call site", async () => {
    const fetchSpy = setScanResponse(okScan());
    const user = userEvent.setup();
    render(<TransactionDialog />);

    await openScanView(user);
    // A successful scan moves the view to the result screen; the effect
    // cleanup must release the stream regardless of the imperative call.
    await user.click(
      screen.getByRole("button", {
        name: mockDictionary.shell.transactionDialog.scanCapture,
      }),
    );
    await screen.findByText("Alfamart Pahlawan");

    tracks.forEach((track) => expect(track.stop).toHaveBeenCalled());

    fetchSpy.mockRestore();
  });

  it("A11y: moves focus onto each view's heading and back to the scan trigger", async () => {
    const fetchSpy = setScanResponse(okScan());
    const user = userEvent.setup();
    render(<TransactionDialog />);

    const scanButton = await screen.findByRole("button", {
      name: mockDictionary.shell.transactionDialog.scanReceipt,
    });
    await waitFor(() => expect(scanButton).toBeEnabled());
    await user.click(scanButton);

    // Focus never falls back to <body> on a view swap.
    await waitFor(() =>
      expect(document.activeElement).toHaveTextContent(
        mockDictionary.shell.transactionDialog.scanTitle,
      ),
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: mockDictionary.shell.transactionDialog.scanCapture,
        }),
      ).toBeEnabled(),
    );
    await user.click(
      screen.getByRole("button", {
        name: mockDictionary.shell.transactionDialog.scanCapture,
      }),
    );
    await waitFor(() =>
      expect(document.activeElement).toHaveTextContent(
        mockDictionary.shell.transactionDialog.resultTitle,
      ),
    );

    await user.click(
      screen.getByRole("button", {
        name: mockDictionary.shell.transactionDialog.scanUse,
      }),
    );
    // Back on the form, focus returns to the control that opened the scanner.
    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: mockDictionary.shell.transactionDialog.scanReceipt,
        }),
      ).toHaveFocus(),
    );

    fetchSpy.mockRestore();
  });

  it("A11y: the disabled capture button points at the status text that explains why", async () => {
    const user = userEvent.setup();
    render(<TransactionDialog />);

    await openScanView(user);
    const capture = screen.getByRole("button", {
      name: mockDictionary.shell.transactionDialog.scanCapture,
    });
    const describedBy = capture.getAttribute("aria-describedby");

    expect(describedBy).toBeTruthy();
    expect(document.getElementById(String(describedBy))).toHaveTextContent(
      mockDictionary.shell.transactionDialog.scanGuidanceReady,
    );
  });

  it("B1: stops every camera track when the scan view is left and when the dialog unmounts", async () => {
    const fetchSpy = setScanResponse(okScan());
    const user = userEvent.setup();
    const { unmount } = render(<TransactionDialog />);

    await openScanView(user);
    await user.click(screen.getByRole("button", { name: "Batal" }));

    tracks.forEach((track) => expect(track.stop).toHaveBeenCalled());

    // …and again from a fresh stream that is still live at unmount.
    tracks = [{ stop: jest.fn() }];
    await openScanView(user);
    unmount();
    tracks.forEach((track) => expect(track.stop).toHaveBeenCalled());

    fetchSpy.mockRestore();
  });
});
