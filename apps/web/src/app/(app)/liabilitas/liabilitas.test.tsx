/**
 * EPIC-024 Group G review round 2 (HIGH gap, review-qa-agent +
 * silent-failure-hunter) — this page had zero test coverage even though it
 * carries a real money-moving pay flow (`POST .../liabilities/:id/pay`
 * debits a real account) plus create/edit/delete. Covers:
 *  - the read-only Detail dialog + its honestly-labeled amortisation preview
 *  - edit PATCHes the right body
 *  - delete requires confirmation, then DELETEs
 *  - pay POSTs sourceAccountId + amount
 *  - a mocked 409 "already paid this period" surfaces its real server
 *    message via `extractApiErrorMessage`, not a generic fallback
 *  - the pay button is disabled + relabeled once `paidThisPeriod` is true
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
import type { LiabilityDto } from "@wealthme/contracts";

// jsdom has no PointerEvent — Base UI's Dialog primitives read pointer-event
// fields internally (same fix as dana/rekening/crud-modal tests).
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

const FAMILY_GROUP_ID = "fg-1";
const TOKEN = "test-token";

const mockUseSessionAuth = jest.fn();
jest.mock("../../../lib/auth-client", () => ({
  authClient: {
    useSession: (...args: unknown[]) => mockUseSessionAuth(...args),
    signOut: jest.fn(),
  },
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

function baseLiability(overrides: Partial<LiabilityDto> = {}): LiabilityDto {
  return {
    id: "liab-1",
    familyGroupId: FAMILY_GROUP_ID,
    name: "Kartu Kredit BCA",
    institution: "BCA",
    type: "kartu_kredit",
    totalDebt: "30000000",
    remainingBalance: "8000000",
    minimumPayment: "800000",
    interestRate: "2.25",
    dueDate: "2026-08-20T00:00:00.000Z",
    autoAdvanceDueDate: false,
    paymentRatio: 27,
    paidThisPeriod: false,
    notes: null,
    currency: "IDR",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const ACCOUNTS = [{ id: "acc-1", name: "BCA Tabungan", institution: "BCA" }];

let liabilitiesFixture: LiabilityDto[] = [];
let payOutcome: "ok" | "conflict" = "ok";

const mockApiFetch = jest.fn(
  (url: string, options?: { method?: string; body?: string }) => {
    const method = options?.method ?? "GET";

    if (url === `/family-groups/${FAMILY_GROUP_ID}/liabilities`) {
      return Promise.resolve(liabilitiesFixture);
    }
    if (
      method === "PATCH" &&
      url.startsWith(`/family-groups/${FAMILY_GROUP_ID}/liabilities/`)
    ) {
      const body = options?.body ? JSON.parse(options.body) : {};
      return Promise.resolve({ ...liabilitiesFixture[0], ...body });
    }
    if (
      method === "DELETE" &&
      url.startsWith(`/family-groups/${FAMILY_GROUP_ID}/liabilities/`)
    ) {
      return Promise.resolve(undefined);
    }
    if (
      method === "POST" &&
      url.endsWith("/pay") &&
      url.startsWith(`/family-groups/${FAMILY_GROUP_ID}/liabilities/`)
    ) {
      if (payOutcome === "conflict") {
        return Promise.reject({
          status: 409,
          message: "Liabilitas ini sudah dibayar untuk periode ini",
        });
      }
      return Promise.resolve({
        ...liabilitiesFixture[0],
        paidThisPeriod: true,
      });
    }
    if (url === `/family-groups/${FAMILY_GROUP_ID}/dashboard/net-worth`) {
      return Promise.resolve({
        accountsTotal: "0",
        investmentsTotal: "0",
        assetsTotal: "50000000",
        liabilitiesTotal: "8000000",
        netWorth: "42000000",
        currency: "IDR",
      });
    }
    if (url === `/family-groups/${FAMILY_GROUP_ID}/accounts`) {
      return Promise.resolve(ACCOUNTS);
    }
    return Promise.reject(new Error(`unexpected url: ${url} (${method})`));
  },
);
jest.mock("../../../lib/api-client", () => ({
  apiFetch: (...args: Parameters<typeof mockApiFetch>) => mockApiFetch(...args),
}));

import LiabilitasPage from "./page";

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

/*
 * CI stability. Every test here drives the pay/edit dialogs through
 * userEvent (open dialog -> clear -> type -> selectOptions -> click ->
 * several waitFor round-trips), which regularly runs past Jest's 5000ms
 * default on a loaded CI runner while passing comfortably in ~3s locally.
 * Two different tests in this one file have already failed CI that way on
 * changes that touched neither of them (PR #292, then #295). A per-test
 * bump just moves the failure to the next-slowest test in the suite, so
 * the timeout is raised once for the whole file instead.
 */
jest.setTimeout(20000);

describe("LiabilitasPage (EPIC-024 Group G review round 2)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    toastSuccess.mockClear();
    toastError.mockClear();
    toastWarning.mockClear();
    queryClient.clear();
    liabilitiesFixture = [baseLiability()];
    payOutcome = "ok";

    mockUseSessionAuth.mockReturnValue({
      data: {
        session: { token: TOKEN, familyGroupId: FAMILY_GROUP_ID },
        user: { id: "user-1", name: "Test User", email: "user@example.com" },
      },
      isPending: false,
    });
  });

  it("opens the Detail dialog with the liability's info and a labeled amortisation estimate", async () => {
    const user = userEvent.setup();
    render(<LiabilitasPage />);

    await user.click(await screen.findByRole("button", { name: "Detail" }));

    const dialog = within(await screen.findByRole("dialog"));
    expect(dialog.getByText("Detail Liabilitas")).toBeInTheDocument();
    expect(dialog.getByText("Kartu Kredit BCA")).toBeInTheDocument();
    expect(dialog.getByText("Ringkasan Amortisasi")).toBeInTheDocument();
    // Honestly labeled as an estimate, not an authoritative schedule.
    expect(
      dialog.getByText(/estimasi kasar berdasarkan sisa saldo/i),
    ).toBeInTheDocument();
  });

  it("PATCHes the edited liability with the current form values", async () => {
    const user = userEvent.setup();
    render(<LiabilitasPage />);

    await user.click(await screen.findByRole("button", { name: "Edit" }));
    await screen.findByText("Edit Liabilitas");

    await user.click(
      screen.getByRole("button", { name: /simpan liabilitas/i }),
    );

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        `/family-groups/${FAMILY_GROUP_ID}/liabilities/liab-1`,
        expect.objectContaining({ method: "PATCH" }),
      );
    });

    const patchCall = mockApiFetch.mock.calls.find(
      ([url, opts]) =>
        url === `/family-groups/${FAMILY_GROUP_ID}/liabilities/liab-1` &&
        (opts as { method?: string })?.method === "PATCH",
    );
    const body = JSON.parse(
      (patchCall?.[1] as { body: string }).body,
    ) as Record<string, unknown>;
    expect(body).toEqual(
      expect.objectContaining({
        name: "Kartu Kredit BCA",
        institution: "BCA",
        type: "kartu_kredit",
        totalDebt: "30000000",
        remainingBalance: "8000000",
        minimumPayment: "800000",
        interestRate: "2.25",
      }),
    );
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
  });

  it("deletes only after the confirm dialog is accepted", async () => {
    const user = userEvent.setup();
    render(<LiabilitasPage />);

    await user.click(await screen.findByRole("button", { name: "Hapus" }));

    const confirmDialog = within(await screen.findByRole("dialog"));
    expect(
      confirmDialog.getByText(/hapus kartu kredit bca\?/i),
    ).toBeInTheDocument();

    // Not yet deleted just by opening the confirmation.
    expect(mockApiFetch).not.toHaveBeenCalledWith(
      `/family-groups/${FAMILY_GROUP_ID}/liabilities/liab-1`,
      expect.objectContaining({ method: "DELETE" }),
    );

    await user.click(confirmDialog.getByRole("button", { name: /ya, hapus/i }));

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        `/family-groups/${FAMILY_GROUP_ID}/liabilities/liab-1`,
        expect.objectContaining({ method: "DELETE" }),
      );
    });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
  });

  it("pays: submitting a valid amount + source account POSTs to /:id/pay", async () => {
    const user = userEvent.setup();
    render(<LiabilitasPage />);

    await user.click(await screen.findByRole("button", { name: "Bayar" }));

    const dialog = within(await screen.findByRole("dialog"));
    // The amount field is pre-filled from item.minimumPayment ("800.000") by
    // the page's onPay handler — clear it first or "500000" appends instead
    // of replacing.
    const amountInput = dialog.getByLabelText(/jumlah bayar/i);
    await user.clear(amountInput);
    await user.type(amountInput, "500000");
    await user.selectOptions(
      dialog.getByLabelText(/rekening sumber/i),
      "acc-1",
    );
    await user.click(
      dialog.getByRole("button", { name: /ya, bayar sekarang/i }),
    );

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        `/family-groups/${FAMILY_GROUP_ID}/liabilities/liab-1/pay`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            sourceAccountId: "acc-1",
            amount: "500000",
          }),
        }),
      );
    });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
  });

  it("surfaces the real 409 'already paid' server message, not a generic fallback", async () => {
    payOutcome = "conflict";
    const user = userEvent.setup();
    render(<LiabilitasPage />);

    await user.click(await screen.findByRole("button", { name: "Bayar" }));

    const dialog = within(await screen.findByRole("dialog"));
    await user.type(dialog.getByLabelText(/jumlah bayar/i), "500000");
    await user.selectOptions(
      dialog.getByLabelText(/rekening sumber/i),
      "acc-1",
    );
    await user.click(
      dialog.getByRole("button", { name: /ya, bayar sekarang/i }),
    );

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        "Liabilitas ini sudah dibayar untuk periode ini",
      );
    });
    // Never the generic fallback for a real server-named conflict.
    expect(toastError).not.toHaveBeenCalledWith(
      "Gagal mencatat pembayaran. Silakan coba lagi.",
    );
  });

  it("disables and relabels the pay button once paidThisPeriod is true", async () => {
    liabilitiesFixture = [baseLiability({ paidThisPeriod: true })];
    render(<LiabilitasPage />);

    const payButton = await screen.findByRole("button", {
      name: "Sudah dibayar periode ini",
    });
    expect(payButton).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Bayar" }),
    ).not.toBeInTheDocument();
  });
});
