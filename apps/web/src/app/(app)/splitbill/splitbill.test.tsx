/**
 * EPIC-023 Group F fix round (HIGH 6) — splitbill/page.tsx had NO component
 * tests despite the payout picker, the confirm/revoke state machine, and
 * per-participant links all landing in this same epic. These tests would
 * have caught HIGH 2 (a missing `invalidateQueries` for dashboard/net-worth
 * after a real income Transaction posts) and HIGH 1 (confirming a payment
 * firing on a single click instead of behind a real confirmation dialog).
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

const mockApiFetch = jest.fn();
jest.mock("../../../lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

jest.mock("sonner", () => ({
  toast: Object.assign(jest.fn(), {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  }),
}));

const mockUseFxSnapshot = jest.fn((enabled: boolean) => ({
  data: enabled
    ? jest.requireActual("../../../components/money/fx-test-rates")
        .TEST_FX_RATES
    : undefined,
  isError: false,
}));
jest.mock("../../../components/money/use-fx-snapshot", () => ({
  useFxSnapshot: (enabled: boolean) => mockUseFxSnapshot(enabled),
}));

jest.mock("../../../hooks/use-currency-preference", () => ({
  useCurrencyPreference: () => ({
    currency: "IDR",
    isIndicative: false,
    isReady: true,
    formatMoney: String,
  }),
}));

import { id as idDict } from "../../../i18n/id";

import SplitBillPage from "./page";

const FAMILY_GROUP_ID = "fg-1";
const TOKEN = "test-token";

const ACCOUNT = {
  id: "acc-1",
  name: "BCA Utama",
  type: "bank",
  balance: "1000000",
};

const PARTICIPANT_PENDING = {
  id: "participant-1",
  splitBillId: "bill-1",
  name: "Budi",
  amountOwed: "100000",
  status: "pending",
  shareToken: "share-budi",
  claimedAt: null,
  paidAt: null,
  createdAt: "2026-08-01T00:00:00.000Z",
};

const SPLIT_BILL = {
  id: "bill-1",
  familyGroupId: FAMILY_GROUP_ID,
  title: "Makan di Sushi Tei",
  totalAmount: "200000",
  currency: "IDR",
  status: "open",
  notes: null,
  payoutAccountId: ACCOUNT.id,
  payoutInstructions: null,
  revokedAt: null,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
  participants: [PARTICIPANT_PENDING],
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

function mockApiFetchDefault(
  splitsOutcome: "ok" | "error" = "ok",
  splits: unknown[] = [SPLIT_BILL],
) {
  mockApiFetch.mockImplementation((url: string, options?: RequestInit) => {
    if (url === `/family-groups/${FAMILY_GROUP_ID}/split-bills`) {
      return splitsOutcome === "ok"
        ? Promise.resolve(splits)
        : Promise.reject({ status: 500, message: "Server error" });
    }
    if (url === `/family-groups/${FAMILY_GROUP_ID}/accounts`) {
      return Promise.resolve([ACCOUNT]);
    }
    if (
      url ===
      `/family-groups/${FAMILY_GROUP_ID}/split-bills/bill-1/participants/participant-1/confirm`
    ) {
      return Promise.resolve({ ...PARTICIPANT_PENDING, status: "paid" });
    }
    if (url === `/family-groups/${FAMILY_GROUP_ID}/split-bills/bill-1/revoke`) {
      return Promise.resolve({
        ...SPLIT_BILL,
        revokedAt: "2026-08-06T00:00:00.000Z",
      });
    }
    return Promise.reject(
      new Error(`unexpected url: ${url} ${options?.method}`),
    );
  });
}

describe("SplitBillPage (EPIC-023 F3/Group F)", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    queryClient.clear();
    mockUseFxSnapshot.mockImplementation((enabled: boolean) => ({
      data: enabled
        ? jest.requireActual("../../../components/money/fx-test-rates")
            .TEST_FX_RATES
        : undefined,
      isError: false,
    }));

    mockUseSessionAuth.mockReturnValue({
      data: {
        session: { token: TOKEN, familyGroupId: FAMILY_GROUP_ID },
        user: { id: "user-1", name: "Test User", email: "user@example.com" },
      },
      isPending: false,
    });
  });

  it("renders the active split bill list (happy path)", async () => {
    mockApiFetchDefault();
    render(<SplitBillPage />);

    expect(await screen.findByText("Makan di Sushi Tei")).toBeInTheDocument();
  });

  it("batch 5 item 5 — the 'created on' date is pinned to UTC, not shifted by the viewer's local zone", async () => {
    // 23:30 UTC on Aug 1 is already Aug 2 in this suite's pinned Jakarta
    // zone (UTC+7, see jest.config.ts). Without an explicit `timeZone: "UTC"`
    // on the `toLocaleDateString` call, this renders "2 Agu 2026" locally
    // but a different day again during a UTC-zoned SSR pass — the
    // hydration mismatch this fix removes.
    mockApiFetchDefault("ok", [
      { ...SPLIT_BILL, createdAt: "2026-08-01T23:30:00.000Z" },
    ]);
    render(<SplitBillPage />);

    await screen.findByText("Makan di Sushi Tei");
    expect(
      screen.getByText((text) => text.includes("1 Agu 2026")),
    ).toBeInTheDocument();
    expect(
      screen.queryByText((text) => text.includes("2 Agu 2026")),
    ).toBeNull();
  });

  it("batch 1 — the Total Ditalangin stat card renders through the shared SummaryCard, with a neutral (non-colored) caption", async () => {
    mockApiFetchDefault();
    render(<SplitBillPage />);

    await screen.findByText("Makan di Sushi Tei");

    expect(
      screen.getByText(idDict.splitbill.totalDitalanginLabel),
    ).toBeInTheDocument();
    const caption = screen.getByText(`1${idDict.splitbill.activeSplitsSuffix}`);
    expect(caption).toHaveClass("stat__delta");
    expect(caption).toHaveClass("stat__delta--neutral");
    expect(caption).not.toHaveClass("t-success");
    expect(caption).not.toHaveClass("t-danger");
    // All three cards now share the `.card.stat` shell — no hand-rolled markup.
    expect(document.querySelectorAll(".card.stat")).toHaveLength(3);
  });

  it("shows an honest error banner when the list fails to load", async () => {
    mockApiFetchDefault("error");
    render(<SplitBillPage />);

    expect(
      await screen.findByText(/gagal memuat data split bill/i),
    ).toBeInTheDocument();
  });

  it("confirming a payment requires an explicit confirmation dialog, not a single click", async () => {
    mockApiFetchDefault();
    const user = userEvent.setup();
    render(<SplitBillPage />);

    await user.click(await screen.findByRole("button", { name: /detail/i }));
    await user.click(
      await screen.findByRole("button", {
        name: /konfirmasi & catat pemasukan/i,
      }),
    );

    // The mutation must NOT have fired yet — only the confirmation dialog
    // opened (HIGH 1: this used to fire on a single click).
    expect(mockApiFetch).not.toHaveBeenCalledWith(
      expect.stringContaining("/confirm"),
      expect.anything(),
    );
    const dialog = await screen.findByRole("dialog", {
      name: /konfirmasi pembayaran budi/i,
    });

    await user.click(
      within(dialog).getByRole("button", { name: /ya, konfirmasi/i }),
    );

    expect(mockApiFetch).toHaveBeenCalledWith(
      `/family-groups/${FAMILY_GROUP_ID}/split-bills/bill-1/participants/participant-1/confirm`,
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("revoking requires an explicit confirmation dialog, not window.confirm", async () => {
    mockApiFetchDefault();
    const user = userEvent.setup();
    render(<SplitBillPage />);

    await user.click(await screen.findByRole("button", { name: /detail/i }));
    await user.click(
      await screen.findByRole("button", { name: /cabut semua link/i }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: /cabut semua link\?/i,
    });
    await user.click(
      within(dialog).getByRole("button", { name: /ya, cabut link/i }),
    );

    expect(mockApiFetch).toHaveBeenCalledWith(
      `/family-groups/${FAMILY_GROUP_ID}/split-bills/bill-1/revoke`,
      expect.objectContaining({ method: "PATCH" }),
    );
  });
});

/** Task 10b — revisi I multi-currency: one currency per bill (Decision 10). */
describe("SplitBillPage — revisi I multi-currency", () => {
  function mockApiFetchCreate(onPost?: (body: unknown) => void) {
    mockApiFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (url === `/family-groups/${FAMILY_GROUP_ID}/split-bills`) {
        if (options?.method === "POST") {
          onPost?.(JSON.parse(String(options.body)));
          return Promise.resolve(SPLIT_BILL);
        }
        return Promise.resolve([]);
      }
      if (url === `/family-groups/${FAMILY_GROUP_ID}/accounts`) {
        return Promise.resolve([ACCOUNT]);
      }
      return Promise.reject(
        new Error(`unexpected url: ${url} ${options?.method}`),
      );
    });
  }

  beforeEach(() => {
    jest.resetAllMocks();
    queryClient.clear();
    mockUseFxSnapshot.mockImplementation((enabled: boolean) => ({
      data: enabled
        ? jest.requireActual("../../../components/money/fx-test-rates")
            .TEST_FX_RATES
        : undefined,
      isError: false,
    }));

    mockUseSessionAuth.mockReturnValue({
      data: {
        session: { token: TOKEN, familyGroupId: FAMILY_GROUP_ID },
        user: { id: "user-1", name: "Test User", email: "user@example.com" },
      },
      isPending: false,
    });
  });

  async function openCreateDialogWithTitle(
    user: ReturnType<typeof userEvent.setup>,
  ) {
    await user.click(
      await screen.findByRole("button", {
        name: idDict.splitbill.createButton,
      }),
    );
    const dialog = await screen.findByRole("dialog");
    await user.type(
      within(dialog).getByLabelText(idDict.splitbill.fieldTitleLabel),
      "Makan Bareng",
    );
    return dialog;
  }

  it("revisi I — a USD bill sends total + every share as fxInputs in one currency", async () => {
    let posted: Record<string, unknown> | undefined;
    mockApiFetchCreate((body) => {
      posted = body as Record<string, unknown>;
    });
    const user = userEvent.setup();
    render(<SplitBillPage />);

    const dialog = await openCreateDialogWithTitle(user);
    await user.selectOptions(within(dialog).getByLabelText("Mata uang"), "USD");
    await user.type(
      within(dialog).getByLabelText(idDict.splitbill.fieldTotalLabel),
      "10",
    );
    await user.click(
      within(dialog).getByRole("tab", {
        name: idDict.splitbill.methodCustomLabel,
      }),
    );
    const shares = within(dialog).getAllByLabelText(
      new RegExp(`^${idDict.splitbill.fieldTotalLabel} `),
    );
    await user.type(shares[0]!, "3,33");
    await user.type(shares[1]!, "3,33");
    await user.type(shares[2]!, "3,34");
    await user.selectOptions(
      within(dialog).getByLabelText(idDict.splitbill.fieldPayoutAccountLabel),
      ACCOUNT.id,
    );

    await user.click(
      within(dialog).getByRole("button", {
        name: idDict.splitbill.createAndShareButton,
      }),
    );

    await waitFor(() => expect(posted).toBeDefined());
    expect(posted!.totalAmount).toBe(179_139);
    expect(
      (posted!.participants as { amountOwed: number }[]).map(
        (p) => p.amountOwed,
      ),
    ).toEqual([59_653, 59_653, 59_832]);
    expect(posted!.fxInputs).toEqual([
      { field: "totalAmount", currency: "USD", amount: "10.00" },
      { field: "participants.0.amountOwed", currency: "USD", amount: "3.33" },
      { field: "participants.1.amountOwed", currency: "USD", amount: "3.33" },
      { field: "participants.2.amountOwed", currency: "USD", amount: "3.34" },
    ]);
  });

  it("revisi I — an IDR bill posts no fxInputs key", async () => {
    let posted: Record<string, unknown> | undefined;
    mockApiFetchCreate((body) => {
      posted = body as Record<string, unknown>;
    });
    const user = userEvent.setup();
    render(<SplitBillPage />);

    const dialog = await openCreateDialogWithTitle(user);
    await user.type(
      within(dialog).getByLabelText(idDict.splitbill.fieldTotalLabel),
      "300000",
    );
    await user.selectOptions(
      within(dialog).getByLabelText(idDict.splitbill.fieldPayoutAccountLabel),
      ACCOUNT.id,
    );

    await user.click(
      within(dialog).getByRole("button", {
        name: idDict.splitbill.createAndShareButton,
      }),
    );

    await waitFor(() => expect(posted).toBeDefined());
    expect(posted).not.toHaveProperty("fxInputs");
    expect(posted!.totalAmount).toBe(300_000);
  });

  it("revisi I — Buat & Bagikan Link stays disabled and no POST fires while /fx/rates is pending for USD", async () => {
    mockUseFxSnapshot.mockImplementation(() => ({
      data: undefined,
      isError: false,
    }));
    mockApiFetchCreate();
    const user = userEvent.setup();
    render(<SplitBillPage />);

    const dialog = await openCreateDialogWithTitle(user);
    await user.selectOptions(within(dialog).getByLabelText("Mata uang"), "USD");
    await user.type(
      within(dialog).getByLabelText(idDict.splitbill.fieldTotalLabel),
      "10",
    );
    await user.selectOptions(
      within(dialog).getByLabelText(idDict.splitbill.fieldPayoutAccountLabel),
      ACCOUNT.id,
    );

    const createButton = within(dialog).getByRole("button", {
      name: idDict.splitbill.createAndShareButton,
    });
    await waitFor(() => expect(createButton).toBeDisabled());
    await user.click(createButton);

    expect(
      mockApiFetch.mock.calls.some(
        ([url, i]) =>
          url === `/family-groups/${FAMILY_GROUP_ID}/split-bills` &&
          (i as RequestInit | undefined)?.method === "POST",
      ),
    ).toBe(false);
  });

  // Fix round 1 — "Bagi Rata Sisa" parsed split-math's id-ID-grouped output
  // ("1.234") with `Number()`, which misreads the "." as a decimal point.
  // Below 1000 minor units this is invisible (no grouping dot yet); at or
  // above 1000 it silently shrinks the fill by ~1000x.
  it("revisi I — Bagi Rata Sisa splits a USD 100.00 bill into shares summing exactly to 100.00", async () => {
    mockApiFetchCreate();
    const user = userEvent.setup();
    render(<SplitBillPage />);

    const dialog = await openCreateDialogWithTitle(user);
    await user.selectOptions(within(dialog).getByLabelText("Mata uang"), "USD");
    await user.type(
      within(dialog).getByLabelText(idDict.splitbill.fieldTotalLabel),
      "100",
    );
    await user.click(
      within(dialog).getByRole("tab", {
        name: idDict.splitbill.methodCustomLabel,
      }),
    );
    await user.click(
      within(dialog).getByRole("button", {
        name: idDict.splitbill.splitRemainderButton,
      }),
    );

    const shares = within(dialog).getAllByLabelText(
      new RegExp(`^${idDict.splitbill.fieldTotalLabel} `),
    );
    expect(shares.map((s) => (s as HTMLInputElement).value)).toEqual([
      "33,33",
      "33,33",
      "33,34",
    ]);
  });

  it("revisi I — Bagi Rata Sisa splits a JPY 10000 bill into whole-yen shares", async () => {
    mockApiFetchCreate();
    const user = userEvent.setup();
    render(<SplitBillPage />);

    const dialog = await openCreateDialogWithTitle(user);
    await user.selectOptions(within(dialog).getByLabelText("Mata uang"), "JPY");
    await user.type(
      within(dialog).getByLabelText(idDict.splitbill.fieldTotalLabel),
      "10000",
    );
    await user.click(
      within(dialog).getByRole("tab", {
        name: idDict.splitbill.methodCustomLabel,
      }),
    );
    await user.click(
      within(dialog).getByRole("button", {
        name: idDict.splitbill.splitRemainderButton,
      }),
    );

    const shares = within(dialog).getAllByLabelText(
      new RegExp(`^${idDict.splitbill.fieldTotalLabel} `),
    );
    expect(shares.map((s) => (s as HTMLInputElement).value)).toEqual([
      "3.333",
      "3.333",
      "3.334",
    ]);
  });

  it("revisi I — Bagi Rata Sisa still splits a sub-1000-unit USD bill correctly", async () => {
    mockApiFetchCreate();
    const user = userEvent.setup();
    render(<SplitBillPage />);

    const dialog = await openCreateDialogWithTitle(user);
    await user.selectOptions(within(dialog).getByLabelText("Mata uang"), "USD");
    await user.type(
      within(dialog).getByLabelText(idDict.splitbill.fieldTotalLabel),
      "9",
    );
    await user.click(
      within(dialog).getByRole("tab", {
        name: idDict.splitbill.methodCustomLabel,
      }),
    );
    await user.click(
      within(dialog).getByRole("button", {
        name: idDict.splitbill.splitRemainderButton,
      }),
    );

    const shares = within(dialog).getAllByLabelText(
      new RegExp(`^${idDict.splitbill.fieldTotalLabel} `),
    );
    expect(shares.map((s) => (s as HTMLInputElement).value)).toEqual([
      "3,00",
      "3,00",
      "3,00",
    ]);
  });

  it("revisi I — Bagi Rata Sisa on an IDR bill (>= 1000 rupiah) still fills exact shares", async () => {
    mockApiFetchCreate();
    const user = userEvent.setup();
    render(<SplitBillPage />);

    const dialog = await openCreateDialogWithTitle(user);
    await user.type(
      within(dialog).getByLabelText(idDict.splitbill.fieldTotalLabel),
      "300000",
    );
    await user.click(
      within(dialog).getByRole("tab", {
        name: idDict.splitbill.methodCustomLabel,
      }),
    );
    await user.click(
      within(dialog).getByRole("button", {
        name: idDict.splitbill.splitRemainderButton,
      }),
    );

    const shares = within(dialog).getAllByLabelText(
      new RegExp(`^${idDict.splitbill.fieldTotalLabel} `),
    );
    expect(shares.map((s) => (s as HTMLInputElement).value)).toEqual([
      "100.000",
      "100.000",
      "100.000",
    ]);
  });
});
