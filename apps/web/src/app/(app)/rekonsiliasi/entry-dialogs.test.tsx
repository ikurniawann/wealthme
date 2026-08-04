/**
 * EPIC-021 Group C — reconciliation entry detail (#9) and fee-split (#29)
 * dialogs. `EntryDetailDialog`/`SplitEntryDialog` are exported from `./page`
 * the same way `/transaksi`'s `TxRow`/`TransactionDetailDialog` are, so they
 * can be tested directly without driving the full 4-step wizard.
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

// `./page` imports `auth-compat`, which re-exports the `better-auth` React
// client (ESM, unparsable by jest without a transform) — mock it before
// `./page` is required, same pattern as every other `(app)/**/*.test.tsx`.
jest.mock("../../../lib/auth-client", () => ({
  authClient: {
    useSession: jest.fn(() => ({ data: null, isPending: false })),
    signOut: jest.fn(),
  },
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

import { EntryDetailDialog, SplitEntryDialog } from "./page";

type BankSyncEntryDto = Parameters<typeof EntryDetailDialog>[0]["entry"];

// jsdom doesn't implement PointerEvent — Base UI's Dialog primitives read
// pointer-event fields internally, so userEvent interactions inside an open
// dialog need this polyfilled (same fix as transaksi/txrow-detail.test.tsx).
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

function buildEntry(
  overrides: Partial<NonNullable<BankSyncEntryDto>> = {},
): NonNullable<BankSyncEntryDto> {
  return {
    id: "entry-1",
    bankSyncId: "sync-1",
    date: "2026-06-15T00:00:00.000Z",
    description: "TOPUP GOPAY 101000",
    amount: "-101000",
    currency: "IDR",
    reconStatus: "unmatched",
    matchedTxId: null,
    suggestedTxId: null,
    createdAt: "2026-06-15T00:00:00.000Z",
    matchedTransaction: null,
    ...overrides,
  };
}

const ACCOUNTS = [
  { id: "acc-bank", name: "BCA Tabungan", institution: "BCA" },
  { id: "acc-ewallet", name: "GoPay", institution: null },
];

describe("EntryDetailDialog (EPIC-021 #9)", () => {
  const onClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the entry's date, description, and status when open", () => {
    render(<EntryDetailDialog entry={buildEntry()} onClose={onClose} />);

    expect(
      screen.getByRole("heading", { name: "Detail Entri Rekonsiliasi" }),
    ).toBeInTheDocument();
    expect(screen.getByText("TOPUP GOPAY 101000")).toBeInTheDocument();
    expect(screen.getByText("Tidak Ditemukan")).toBeInTheDocument();
  });

  it("shows 'Belum ada transaksi yang cocok.' when there is no matched transaction", () => {
    render(<EntryDetailDialog entry={buildEntry()} onClose={onClose} />);

    expect(
      screen.getByText("Belum ada transaksi yang cocok."),
    ).toBeInTheDocument();
  });

  it("shows the full matched transaction summary when the entry is matched", () => {
    render(
      <EntryDetailDialog
        entry={buildEntry({
          reconStatus: "matched",
          matchedTxId: "tx-1",
          matchedTransaction: {
            id: "tx-1",
            accountId: "acc-bank",
            accountName: "BCA Tabungan",
            toAccountId: "acc-ewallet",
            toAccountName: "GoPay",
            categoryId: null,
            categoryName: null,
            amount: "100000",
            type: "transfer",
            description: "Top up GoPay",
            occurredAt: "2026-06-15T00:00:00.000Z",
            createdAt: "2026-06-15T10:00:00.000Z",
          },
        })}
        onClose={onClose}
      />,
    );

    expect(screen.getByText("Transaksi Tercocokkan")).toBeInTheDocument();
    expect(screen.getByText("BCA Tabungan")).toBeInTheDocument();
    expect(screen.getByText("GoPay")).toBeInTheDocument();
    expect(screen.getByText("Transfer")).toBeInTheDocument();
  });

  it("calls onClose when the Tutup button is clicked", async () => {
    const user = userEvent.setup();
    render(<EntryDetailDialog entry={buildEntry()} onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: "Tutup" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders nothing open when entry is null", () => {
    render(<EntryDetailDialog entry={null} onClose={onClose} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("SplitEntryDialog (EPIC-021 #29 fee-split)", () => {
  const onClose = jest.fn();
  const onSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function renderSplit(entry = buildEntry()) {
    return render(
      <SplitEntryDialog
        entry={entry}
        accounts={ACCOUNTS}
        familyGroupId="fg-1"
        syncId="sync-1"
        token="test-token"
        onClose={onClose}
        onSuccess={onSuccess}
      />,
    );
  }

  it("rejects submission when no source account is selected", async () => {
    const user = userEvent.setup();
    renderSplit();

    await user.click(screen.getByRole("button", { name: "Simpan Pembagian" }));

    expect(mockToastError).toHaveBeenCalledWith(
      "Pilih akun sumber terlebih dahulu",
    );
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it("rejects submission when principal + fee does not equal the entry amount", async () => {
    const user = userEvent.setup();
    renderSplit();
    const dialog = within(screen.getByRole("dialog"));

    await user.selectOptions(
      dialog.getByLabelText("Akun Sumber (Bank)"),
      "acc-bank",
    );
    await user.selectOptions(
      dialog.getByLabelText("Akun Tujuan (E-Wallet)"),
      "acc-ewallet",
    );
    await user.type(dialog.getByLabelText("Jumlah Pokok"), "100000");
    await user.type(dialog.getByLabelText("Biaya Admin"), "2000"); // 102000 != 101000

    await user.click(screen.getByRole("button", { name: "Simpan Pembagian" }));

    expect(mockToastError).toHaveBeenCalledWith(
      "Pokok + biaya admin harus sama dengan jumlah entri",
    );
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it("submits the split with the correct body and calls onSuccess", async () => {
    const user = userEvent.setup();
    mockApiFetch.mockResolvedValueOnce(
      buildEntry({ reconStatus: "matched", matchedTxId: "tx-new" }),
    );
    renderSplit();
    const dialog = within(screen.getByRole("dialog"));

    await user.selectOptions(
      dialog.getByLabelText("Akun Sumber (Bank)"),
      "acc-bank",
    );
    await user.selectOptions(
      dialog.getByLabelText("Akun Tujuan (E-Wallet)"),
      "acc-ewallet",
    );
    await user.type(dialog.getByLabelText("Jumlah Pokok"), "100000");
    await user.type(dialog.getByLabelText("Biaya Admin"), "1000");

    await user.click(screen.getByRole("button", { name: "Simpan Pembagian" }));

    expect(mockApiFetch).toHaveBeenCalledWith(
      "/family-groups/fg-1/reconciliation/sync-1/entries/entry-1/split",
      expect.objectContaining({ method: "POST", token: "test-token" }),
    );
    const body = JSON.parse(
      (mockApiFetch.mock.calls[0]![1] as { body: string }).body,
    ) as {
      accountId: string;
      toAccountId: string;
      principalAmount: number;
      adminFee: number;
    };
    expect(body).toEqual({
      accountId: "acc-bank",
      toAccountId: "acc-ewallet",
      principalAmount: 100000,
      adminFee: 1000,
    });
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(mockToastSuccess).toHaveBeenCalledWith(
      "Entri berhasil dipecah dan dicocokkan!",
    );
  });
});
