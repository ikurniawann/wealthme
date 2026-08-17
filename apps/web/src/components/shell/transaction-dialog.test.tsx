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

const mockApiFetch = jest.fn(
  (url: string, options?: { method?: string; body?: string }) => {
    const method = options?.method ?? "GET";
    if (url === "/auth/me") {
      return Promise.resolve({ familyGroupId: FAMILY_GROUP_ID });
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
